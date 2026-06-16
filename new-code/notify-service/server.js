'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const nodemailer = require('nodemailer');
const { buildEmail } = require('./email-templates');

/* ── Config ──────────────────────────────────────────────────────── */

const PORT           = parseInt(process.env.PORT || '8787', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_PASS     = process.env.GMAIL_APP_PASSWORD;

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

/* ── Express app ─────────────────────────────────────────────────── */

const app = express();

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

/* ── GET /health ─────────────────────────────────────────────────── */

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'amplior-notify', ts: new Date().toISOString() });
});

/* ── POST /notify ────────────────────────────────────────────────── */
/**
 * Body: { event: string, to: string, data: object }
 * Response: { ok: true, id: string } | { ok: false, error: string }
 */
app.post('/notify', async (req, res) => {
  const { event, to, data = {} } = req.body || {};

  if (!event || !to) {
    return res.status(400).json({ ok: false, error: 'event and to are required' });
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
      to,
      subject,
      html,
    });

    console.log(`[notify] Sent ${event} to ${to} — messageId: ${info.messageId}`);
    return res.json({ ok: true, id: info.messageId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notify] Failed to send ${event} to ${to}:`, msg);
    // Don't expose internal SMTP errors to the caller in production
    return res.status(500).json({ ok: false, error: 'Email send failed' });
  }
});

/* ── Start ───────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`[notify] Amplior notify-service listening on http://localhost:${PORT}`);
  console.log(`[notify] CORS allowed origin: ${ALLOWED_ORIGIN}`);
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[notify] WARNING: GMAIL credentials not set — POST /notify will return 503');
  }
});
