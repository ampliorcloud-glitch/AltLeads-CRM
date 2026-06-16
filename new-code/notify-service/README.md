# Amplior Notify Service

Lightweight Node/Express microservice that sends branded HTML emails for Amplior CRM events.

## Local setup

```bash
cd new-code/notify-service
npm install
npm start
# → listening on http://localhost:8787
```

## Environment variables

| Variable | Description | Example |
|---|---|---|
| `GMAIL_USER` | Gmail address used as sender | `amplior.ankits@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail App Password (16-char) | `xxxx xxxx xxxx xxxx` |
| `PORT` | Port to listen on | `8787` |
| `ALLOWED_ORIGIN` | CORS allowed origin (web app URL) | `http://localhost:5173` |

Copy `.env.example` → `.env` and fill in values. **Never commit `.env`.**

## API

### GET /health
Returns `{ ok: true }`.

### POST /notify
```json
{ "event": "lead_assigned", "to": "user@example.com", "data": { "leadName": "...", "company": "...", "assignedByName": "..." } }
```
Returns `{ "ok": true, "id": "<messageId>" }` or `{ "ok": false, "error": "..." }`.

### Supported events
| Event | Key `data` fields |
|---|---|
| `lead_assigned` | `leadName`, `company`, `assignedByName` |
| `lead_reassigned` | `leadName`, `company`, `assignedByName` |
| `meeting_scheduled` | `leadName`, `meetingDate`, `meetingTime`, `mode` |
| `approval_requested` | `leadName`, `leadNumber`, `agentName` |
| `approval_approved` | `leadName`, `leadNumber`, `approvedByName` |
| `approval_rejected` | `leadName`, `leadNumber`, `reason`, `rejectedByName` |

## Hostinger deploy (Node app)

1. In Hostinger hPanel → **Node.js** → create app, set entry point to `server.js`, Node version 18+.
2. Upload all files (excluding `node_modules/` and `.env`).
3. In hPanel, set environment variables matching the table above.
4. Run `npm install` via the hPanel terminal.
5. Start/restart the app.
6. Update `VITE_NOTIFY_URL` in your web app's production env to the Hostinger URL.
