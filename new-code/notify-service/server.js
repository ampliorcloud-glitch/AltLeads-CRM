'use strict';

require('dotenv').config();

const path      = require('path');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { buildEmail } = require('./email-templates');

/* ── Config ──────────────────────────────────────────────────────── */

const PORT           = parseInt(process.env.PORT || '8787', 10);
// When serving from the same origin, ALLOWED_ORIGIN is not needed for same-origin requests.
// For local dev (web on 5173, server on 8787) set ALLOWED_ORIGIN=http://localhost:5173.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const WEB_DIST       = path.join(__dirname, '..', 'web', 'dist');
const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_PASS     = process.env.GMAIL_APP_PASSWORD;

/* ── Supabase service-role admin client (lazy, created once) ─────── */
/**
 * Returns a singleton service-role admin client, or null if the env vars are
 * not set. Used both by the auth middleware (token verification + role lookup)
 * and by the user-management handlers below.
 */
let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseAdmin;
}

/* ── SMTP transporter (lazy — created once) ──────────────────────── */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[notify] GMAIL_USER / GMAIL_APP_PASSWORD not set — emails will not be sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });
  return transporter;
}

/* ── Auth middleware ─────────────────────────────────────────────── */
/**
 * Verifies a Supabase JWT from the Authorization: Bearer <token> header.
 * On success attaches the verified auth uid to req.actorUserId and calls next().
 *
 * requireAuth  — accepts ANY valid Supabase JWT.
 * requireAdmin — additionally requires the caller's profiles.role === 'ADMIN'.
 */
async function requireAuth(req, res, next) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'invalid token' });
  req.actorUserId = user.id;
  next();
}

async function requireAdmin(req, res, next) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'invalid token' });
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!prof || prof.role !== 'ADMIN') return res.status(403).json({ error: 'admin only' });
  req.actorUserId = user.id;
  next();
}

/* ── Rate limiter (30 req / min / IP) ────────────────────────────── */

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/* ── Express app ─────────────────────────────────────────────────── */

const app = express();

/* Security headers. Helmet defaults plus an explicit, conservative CSP that
   still allows the SPA, Supabase (REST + Realtime websockets) and the
   same-origin API. */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Vite-built bundles are self-hosted; allow inline styles for the SPA.
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      // Same-origin API + Supabase REST/Realtime (https + wss).
      connectSrc: ["'self'", 'https:', 'wss:'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
// Belt-and-braces explicit headers (in case CSP is relaxed by a proxy).
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '32kb' }));

// Throttle the email + user-management endpoints.
app.use('/notify', apiLimiter);
app.use('/api/', apiLimiter);

/* ── GET /health ─────────────────────────────────────────────────── */

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'amplior-notify', ts: new Date().toISOString() });
});

/* ── POST /notify ────────────────────────────────────────────────── */
/**
 * Body: { event: string, to: string, data: object }
 * Response: { ok: true, id: string } | { ok: false, error: string }
 */
app.post('/notify', requireAuth, async (req, res) => {
  const { event, to, data = {} } = req.body || {};

  if (!event || !to) {
    return res.status(400).json({ ok: false, error: 'event and to are required' });
  }

  // "to" must be exactly ONE well-formed email address. Reject comma-lists,
  // arrays, or anything containing whitespace/multiple recipients.
  const recipient = String(to).trim();
  const singleEmailRegex = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  if (!singleEmailRegex.test(recipient)) {
    return res.status(400).json({ ok: false, error: 'to must be a single valid email address' });
  }

  const transport = getTransporter();
  if (!transport) {
    console.error('[notify] No transporter — SMTP credentials missing.');
    return res.status(503).json({ ok: false, error: 'SMTP not configured' });
  }

  try {
    const { subject, html } = buildEmail(event, data);

    const info = await transport.sendMail({
      from: `"AltLeads · Amplior CRM" <${GMAIL_USER}>`,
      to: recipient,
      subject,
      html,
    });

    console.log(`[notify] Sent ${event} to ${recipient} — messageId: ${info.messageId}`);
    return res.json({ ok: true, id: info.messageId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notify] Failed to send ${event} to ${recipient}:`, msg);
    // Don't expose internal SMTP errors to the caller in production
    return res.status(500).json({ ok: false, error: 'Email send failed' });
  }
});

/* ── POST /api/users/create ──────────────────────────────────────── */
/**
 * Auth: requireAdmin (valid Supabase JWT belonging to a profiles.role==='ADMIN').
 * Body: { full_name, email, role_id, mobile_number? }
 *   (created_by is IGNORED — derived from the verified caller.)
 * Response 200: { ok: true, user_id: number, tempPassword: string }
 * Response 400: { error: string }  (validation)
 * Response 409: { error: string }  (duplicate email)
 * Response 500: { error: string }  (DB / auth failure)
 * Response 503: { error: string }  (missing env vars)
 */
app.post('/api/users/create', requireAdmin, async (req, res) => {
  const { full_name, email, role_id, mobile_number } = req.body || {};

  /* 1. Validate */
  if (!full_name || !String(full_name).trim()) {
    return res.status(400).json({ error: 'full_name is required.' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'email is required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email).trim())) {
    return res.status(400).json({ error: 'email format is invalid.' });
  }
  if (role_id === undefined || role_id === null || role_id === '') {
    return res.status(400).json({ error: 'role_id is required.' });
  }
  const roleIdInt = parseInt(role_id, 10);
  if (isNaN(roleIdInt) || roleIdInt < 1 || roleIdInt > 6) {
    return res.status(400).json({ error: 'role_id must be an integer between 1 and 6.' });
  }

  /* 2. Shared service-role admin client (requireAdmin already verified env). */
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  const trimmedName = String(full_name).trim();

  /* 3. Derive created_by from the VERIFIED caller — look up the numeric
        user_id from profiles by the auth uid. Never trust req.body.created_by. */
  let actor = 'system';
  const { data: actorProfile } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('id', req.actorUserId)
    .single();
  if (actorProfile && actorProfile.user_id !== undefined && actorProfile.user_id !== null) {
    actor = String(actorProfile.user_id);
  }

  /* 4. Check for existing user */
  const { data: existing } = await supabaseAdmin
    .from('user_master')
    .select('user_id')
    .eq('email', trimmedEmail)
    .limit(1);
  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'A user with this email already exists.' });
  }

  /* 5. Split full_name into f_name / l_name */
  const spaceIdx = trimmedName.indexOf(' ');
  const fName = spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
  const lName = spaceIdx === -1 ? '' : trimmedName.slice(spaceIdx + 1).trim();

  /* 6. INSERT into user_master */
  const { data: insertedUsers, error: insertErr } = await supabaseAdmin
    .from('user_master')
    .insert({
      full_name: trimmedName,
      f_name: fName,
      l_name: lName || null,
      email: trimmedEmail,
      enabled: true,
      mobile_number: mobile_number ? String(mobile_number).trim() : null,
      created_by: actor,
      created_date: new Date().toISOString(),
    })
    .select('user_id');

  if (insertErr || !insertedUsers || insertedUsers.length === 0) {
    const msg = insertErr ? insertErr.message : 'user_master insert returned no row';
    console.error('[users/create] user_master insert failed:', msg);
    return res.status(500).json({ error: `Failed to create user record: ${msg}` });
  }
  const newUser = insertedUsers[0];

  /* 7. INSERT into user_role */
  const { error: roleErr } = await supabaseAdmin
    .from('user_role')
    .insert({
      user_id: newUser.user_id,
      role_id: roleIdInt,
      created_by: actor,
      created_date: new Date().toISOString(),
    });

  if (roleErr) {
    // Best-effort cleanup
    await supabaseAdmin.from('user_master').delete().eq('user_id', newUser.user_id);
    console.error('[users/create] user_role insert failed:', roleErr.message);
    return res.status(500).json({ error: `Failed to assign role: ${roleErr.message}` });
  }

  /* 8. Generate temp password */
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let tempPassword = pick(upper) + pick(lower) + pick(digits) + pick(special);
  for (let i = 4; i < 12; i++) tempPassword += pick(all);
  // Shuffle
  tempPassword = tempPassword.split('').sort(() => Math.random() - 0.5).join('');

  /* 9. Create Supabase Auth user */
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: trimmedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: trimmedName },
  });

  /* 10. If auth creation fails: cleanup and return 500 */
  if (authErr || !authData?.user) {
    const msg = authErr ? authErr.message : 'Auth user creation returned no user';
    console.error('[users/create] auth.admin.createUser failed:', msg);
    // Best-effort cleanup
    await supabaseAdmin.from('user_role').delete().eq('user_id', newUser.user_id);
    await supabaseAdmin.from('user_master').delete().eq('user_id', newUser.user_id);
    return res.status(500).json({ error: `Failed to create auth user: ${msg}` });
  }

  console.log(`[users/create] Created user ${newUser.user_id} (${trimmedEmail}) with role ${roleIdInt}`);

  /* 11. Return success */
  return res.status(200).json({ ok: true, user_id: newUser.user_id, tempPassword });
});

/* ── POST /api/users/reset-password ─────────────────────────────── */
/**
 * Auth: requireAdmin (valid Supabase JWT belonging to a profiles.role==='ADMIN').
 * Body: { user_id } (bigint/number)
 * Response 200: { ok: true, tempPassword: string }
 * Response 400: { error: string }  (validation)
 * Response 404: { error: string }  (user not found in profiles)
 * Response 500: { error: string }  (auth update failure)
 * Response 503: { error: string }  (missing env vars)
 */
app.post('/api/users/reset-password', requireAdmin, async (req, res) => {
  const { user_id, email } = req.body || {};

  /* 1. Validate — need at least user_id or email */
  if ((user_id === undefined || user_id === null || user_id === '') && !email) {
    return res.status(400).json({ error: 'user_id is required.' });
  }

  /* 2. Shared service-role admin client (requireAdmin already verified env). */
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  /* 3. Resolve auth UID — look up profiles table by user_id (or email fallback) */
  let profileQuery = supabaseAdmin.from('profiles').select('id, email');
  if (user_id !== undefined && user_id !== null && user_id !== '') {
    profileQuery = profileQuery.eq('user_id', user_id);
  } else {
    profileQuery = profileQuery.eq('email', String(email).trim().toLowerCase());
  }
  const { data: profileRows, error: profileErr } = await profileQuery.limit(1);

  if (profileErr) {
    console.error('[users/reset-password] profiles lookup failed:', profileErr.message);
    return res.status(500).json({ error: `Failed to look up user: ${profileErr.message}` });
  }
  if (!profileRows || profileRows.length === 0) {
    return res.status(404).json({ error: 'No login found for this user.' });
  }
  const authUid = profileRows[0].id;

  /* 5. Generate strong 12-char temp password */
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let tempPassword = pick(upper) + pick(lower) + pick(digits) + pick(special);
  for (let i = 4; i < 12; i++) tempPassword += pick(all);
  tempPassword = tempPassword.split('').sort(() => Math.random() - 0.5).join('');

  /* 6. Update auth user password */
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUid, {
    password: tempPassword,
  });

  if (updateErr) {
    console.error('[users/reset-password] auth.admin.updateUserById failed:', updateErr.message);
    return res.status(500).json({ error: `Failed to reset password: ${updateErr.message}` });
  }

  console.log(`[users/reset-password] Reset password for user_id=${user_id} (auth uid=${authUid})`);

  /* 7. Return success */
  return res.status(200).json({ ok: true, tempPassword });
});

/* ── Serve React web app (static + SPA fallback) ─────────────────── */
// Serve built assets. Must come AFTER all API routes so /health and /notify
// are handled by the Express routes above, not treated as static file requests.

app.use(express.static(WEB_DIST));

// SPA catch-all: any GET that didn't match an API route or a real static file
// returns index.html so that client-side routes (React Router) work correctly.
app.get('*', (_req, res) => {
  res.sendFile(path.join(WEB_DIST, 'index.html'));
});

/* ── Start ───────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`[notify] Amplior notify-service listening on http://localhost:${PORT}`);
  console.log(`[notify] CORS allowed origin: ${ALLOWED_ORIGIN}`);
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[notify] WARNING: GMAIL credentials not set — POST /notify will return 503');
  }
});
