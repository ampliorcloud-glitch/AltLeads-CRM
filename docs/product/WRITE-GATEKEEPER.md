# Write Gatekeeper — ALT-431

**Status:** Implemented (server + web client wrapper). Feature flag OFF by default — zero prod impact until flipped.

## Problem

The React app writes to master tables directly via the Supabase anon/user JWT + RLS. A determined user can bypass UI rules by calling PostgREST directly. This gateway makes privileged writes impossible to bypass: they route through an Express endpoint that runs with the service role, derives the actor entirely from the verified JWT, checks a role allow-list, and executes the write.

---

## Files

| File | Purpose |
|---|---|
| `new-code/notify-service/src/writeGateway.js` | Gateway router module — mounts `POST /api/write` |
| `new-code/notify-service/server.js` | Mount call added (additive, before static serving) |
| `new-code/web/src/lib/writeGateway.ts` | Typed client wrapper + feature flag |

---

## Endpoint contract

```
POST /api/write
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

Body:
{
  "action":  string,          // one of the registered GatewayAction names
  "entity":  string,          // free-form label for logging (e.g. "lead_report")
  "payload": object           // action-specific; validated server-side
}

200 OK:  { ok: true,  ...actionResult }
400:     { ok: false, error: string }  — validation / unknown action
401:     { ok: false, error: string }  — missing or invalid JWT
403:     { ok: false, error: string }  — role not in allow-list
500:     { ok: false, error: string }  — handler threw (sanitised)
503:     { ok: false, error: string }  — Supabase env vars not set
```

**Identity is always server-derived.** The endpoint ignores any actor/user id in the request body. The JWT is verified via `admin.auth.getUser(token)` (service-role key), then the `profiles` row is fetched to resolve `user_id` and `role`.

---

## Action allow-list

Defined in `notify-service/src/writeGateway.js` — `ROLE_ALLOW_LIST` object.  
Roles from `role_master`: ADMIN(1), TEAM_LEAD(2), AGENT(3), SALES_HEAD(4), SALES_PERSON(5), QC(6).

| Action | Allowed roles | Status |
|---|---|---|
| `lead.reassign` | ADMIN, TEAM_LEAD | Implemented |
| `record.markDnc` | ADMIN, TEAM_LEAD, AGENT, QC | Implemented (TODO: table map per entity_type) |
| `record.setFeasibility` | ADMIN, TEAM_LEAD, QC | Implemented (TODO: confirm column name) |
| `lead.import` | ADMIN | Stubbed — import agent to implement |
| `lead.export` | ADMIN, TEAM_LEAD | Stubbed — import agent to implement |
| `contact.markDnc` | ADMIN, TEAM_LEAD, AGENT, QC | Stubbed (delegates to record.markDnc) |
| `ownership.reassign` | ADMIN | Stubbed — write-path-blocker agent to implement |
| `feedback.upsert` | ADMIN, SALES_HEAD, SALES_PERSON | Stubbed — HungerBox feedback agent to implement |

---

## Feature flags

### Server side
No flag — the endpoint is always mounted and available. The web client controls rollout via the flag below.

### Client side (`new-code/web/src/lib/writeGateway.ts`)

| Flag | Default | How to flip |
|---|---|---|
| `USE_WRITE_GATEWAY` (env) | `false` | Set `VITE_USE_WRITE_GATEWAY=true` at build time |
| `setWriteGatewayEnabled(bool)` | matches env | Call at runtime (e.g. from admin feature panel) |

When the flag is OFF, `callGateway()` returns `{ ok: false, bypassed: true }` — the caller falls back to its existing direct Supabase write. **Nothing in prod changes until the flag is flipped.**

---

## Web client API

```ts
import { callGateway, setWriteGatewayEnabled, roleCanCall } from '@/lib/writeGateway';
import type { GatewayAction } from '@/lib/writeGateway';

// With fallback (recommended during rollout):
const gw = await callGateway('lead.reassign', 'lead_report', {
  lead_report_id: 42,
  new_user_id: 7,
});
if (gw.bypassed) {
  // flag is off — use existing direct write
} else if (!gw.ok) {
  throw new Error(gw.error);
}

// Client-side UI hint (NOT a security boundary — server enforces the real check):
if (roleCanCall(userRole, 'lead.reassign')) {
  // show the reassign button
}
```

Base URL reuses `VITE_NOTIFY_URL` (same as `lib/notify.ts`): empty string in production (same origin), `http://localhost:8787` for local dev.

---

## How to add a new handler (checklist for other agents)

1. **Allow-list** (`notify-service/src/writeGateway.js`, `ROLE_ALLOW_LIST`): add `'your.action': [ROLES.ADMIN, ...]`.
2. **Handler** (`ACTION_HANDLERS`): add `async 'your.action'(admin, actor, payload) { ... }`. Throw `GatewayValidationError` for 400, any other `Error` for 500.
3. **Action type** (`web/src/lib/writeGateway.ts`, `GatewayAction` union): add `| 'your.action'`.
4. **Client allow-list** (`roleCanCall` in same file): add the entry.
5. Call `callGateway('your.action', 'entity-label', payload)` from the component.

---

## ALT-431 progress

- [x] Gateway router module (`writeGateway.js`) — mount, actor resolution, allow-list, dispatch
- [x] Three implemented handlers: `lead.reassign`, `record.markDnc`, `record.setFeasibility`
- [x] Five stubbed handlers for future agents: `lead.import`, `lead.export`, `contact.markDnc`, `ownership.reassign`, `feedback.upsert`
- [x] Web client wrapper (`writeGateway.ts`) with feature flag + `roleCanCall` hint
- [x] Web build passes (zero TypeScript errors)
- [ ] TODO: confirm `lead_master` column names for `markDnc` and `setFeasibility` when schema is finalised
- [ ] TODO: flip `VITE_USE_WRITE_GATEWAY=true` after validation in staging
- [ ] TODO: migrate direct Supabase writes for `lead.reassign` callers (e.g. `AssignModal`) to use `callGateway` once flag is on
