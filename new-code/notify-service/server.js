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

/* ── User-management helpers ─────────────────────────────────────── */

/** Generate a strong 12-char temp password (guaranteed mixed character classes). */
function genTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(upper) + pick(lower) + pick(digits) + pick(special);
  for (let i = 4; i < 12; i++) pw += pick(all);
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Find a Supabase Auth user by email. The admin API has no get-by-email, so we
 * page through listUsers (cap at 20 pages / 20k users — far above our scale).
 * Returns the auth user object or null.
 */
async function findAuthUserByEmail(admin, email) {
  const target = String(email).trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const hit = (data.users || []).find((u) => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (!data.users || data.users.length < 1000) break; // last page
  }
  return null;
}

/**
 * Ensure the profiles row linking auth uid -> numeric user_id exists & is correct,
 * so RLS helpers (current_user_id / is_admin) and requireAdmin work for this user.
 * Resolves profiles.role from the user's most-privileged (lowest role_id) role.
 * Best-effort: logs and continues on failure (never blocks the password action).
 */
async function ensureProfileLink(admin, { authUid, userId, email, fullName }) {
  try {
    let roleName = null;
    if (userId != null) {
      const { data: roleRows } = await admin
        .from('user_role').select('role_id').eq('user_id', userId).is('deleted_date', null);
      if (roleRows && roleRows.length) {
        const minRole = Math.min(...roleRows.map((r) => Number(r.role_id)));
        const { data: rm } = await admin
          .from('role_master').select('name').eq('role_id', minRole).single();
        roleName = rm && rm.name ? rm.name : null;
      }
    }
    const row = { id: authUid, email: String(email).trim().toLowerCase() };
    if (userId != null) row.user_id = userId;
    if (fullName) row.full_name = fullName;
    if (roleName) row.role = roleName;
    const { error } = await admin.from('profiles').upsert(row, { onConflict: 'id' });
    if (error) console.error('[users] ensureProfileLink upsert failed:', error.message);
  } catch (e) {
    console.error('[users] ensureProfileLink threw:', e.message);
  }
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
  let user, error;
  try {
    ({ data: { user }, error } = await admin.auth.getUser(token));
  } catch (e) {
    return res.status(503).json({ error: 'auth check failed' });
  }
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
  try {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'invalid token' });
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (!prof || prof.role !== 'ADMIN') return res.status(403).json({ error: 'admin only' });
    req.actorUserId = user.id;
    next();
  } catch (e) {
    return res.status(503).json({ error: 'auth check failed' });
  }
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
  if (typeof role_id !== 'number' && typeof role_id !== 'string') {
    return res.status(400).json({ error: 'role_id must be a number.' });
  }
  const roleIdInt = parseInt(role_id, 10);
  if (isNaN(roleIdInt) || roleIdInt < 1 || roleIdInt > 6) {
    return res.status(400).json({ error: 'role_id must be an integer between 1 and 6.' });
  }
  if (mobile_number != null && String(mobile_number).trim().length > 20) {
    return res.status(400).json({ error: 'mobile_number is too long.' });
  }

  /* 2. Shared service-role admin client (requireAdmin already verified env). */
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  const trimmedName = String(full_name).trim();

  try {
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
    return res.status(500).json({ error: 'Failed to create user record.' });
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
    return res.status(500).json({ error: 'Failed to assign role.' });
  }

  /* 8. Generate temp password */
  const tempPassword = genTempPassword();

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
    return res.status(500).json({ error: 'Failed to create auth user.' });
  }

  /* 10b. Explicitly link auth uid -> numeric user_id in profiles. Don't rely on
     the email-matching onboarding trigger — guarantee the link so reset-password,
     RLS (current_user_id/is_admin) and the created_by audit all work immediately. */
  await ensureProfileLink(supabaseAdmin, {
    authUid: authData.user.id,
    userId: newUser.user_id,
    email: trimmedEmail,
    fullName: trimmedName,
  });

  console.log(`[users/create] Created user ${newUser.user_id} (${trimmedEmail}) with role ${roleIdInt}`);

  /* 11. Return success */
  return res.status(200).json({ ok: true, user_id: newUser.user_id, tempPassword });
  } catch (e) {
    console.error('[users/create]', e);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

/* ── POST /api/users/reset-password ─────────────────────────────── */
/**
 * Set or reset a user's login password (admin only).
 *
 * Auth: requireAdmin (valid Supabase JWT belonging to a profiles.role==='ADMIN').
 * Body: { user_id } (bigint/number) and/or { email }
 *
 * Behaviour: resolves the user's email from user_master, then finds their
 * Supabase Auth account by email.
 *   - If a login exists  -> reset its password.
 *   - If NO login exists -> CREATE one with the new password (most legacy users
 *     migrated from the old system have no login yet; this is how an admin grants
 *     access). Either way we (re)link profiles so RLS works immediately.
 *
 * Response 200: { ok: true, tempPassword: string, created: boolean }
 * Response 400/404: { error }   500: { error }   503: { error } (missing env)
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

  try {
  /* 3. Resolve the user's email + numeric id + name from user_master. The email
        (not a fragile profiles link) is the authoritative key to the auth account. */
  let targetUserId = (user_id !== undefined && user_id !== null && user_id !== '') ? user_id : null;
  let targetEmail = email ? String(email).trim().toLowerCase() : null;
  let fullName = null;
  if (targetUserId !== null) {
    const { data: um } = await supabaseAdmin
      .from('user_master').select('user_id, email, full_name').eq('user_id', targetUserId).single();
    if (um) {
      if (um.email) targetEmail = String(um.email).trim().toLowerCase();
      fullName = um.full_name || null;
    }
  } else if (targetEmail) {
    const { data: um } = await supabaseAdmin
      .from('user_master').select('user_id, full_name').eq('email', targetEmail).limit(1).maybeSingle();
    if (um) { targetUserId = um.user_id; fullName = um.full_name || null; }
  }
  if (!targetEmail) {
    return res.status(404).json({ error: 'This user has no email on file — add an email before setting a password.' });
  }

  /* 4. Strong temp password. */
  const tempPassword = genTempPassword();

  /* 5. Find an existing auth account by email; reset it, or create a fresh login. */
  const existingAuth = await findAuthUserByEmail(supabaseAdmin, targetEmail);
  let authUid;
  let created = false;
  if (existingAuth) {
    authUid = existingAuth.id;
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUid, {
      password: tempPassword,
      email_confirm: true,
    });
    if (updateErr) {
      console.error('[users/reset-password] updateUserById failed:', updateErr.message);
      return res.status(500).json({ error: 'Failed to set password.' });
    }
  } else {
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: targetEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (createErr || !authData?.user) {
      const msg = createErr ? createErr.message : 'auth user creation returned no user';
      console.error('[users/reset-password] createUser failed:', msg);
      return res.status(500).json({ error: 'Failed to set password.' });
    }
    authUid = authData.user.id;
    created = true;
  }

  /* 6. (Re)link the auth account to the numeric user_id so RLS + future resets work. */
  await ensureProfileLink(supabaseAdmin, { authUid, userId: targetUserId, email: targetEmail, fullName });

  console.log(`[users/reset-password] ${created ? 'Created login + set' : 'Reset'} password for ${targetEmail} (user_id=${targetUserId}, auth uid=${authUid})`);

  /* 7. Return success */
  return res.status(200).json({ ok: true, tempPassword, created });
  } catch (err) {
    console.error('[users/reset-password] unexpected error:', err);
    return res.status(500).json({ error: 'Failed to set password.' });
  }
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
