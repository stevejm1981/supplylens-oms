# Integrations & API Tokens

> `/integrations`

The connection catalogue and the credentials that power it. Cards show what the platform reaches: marketplaces, e-commerce, EDI, 3PL/WMS, accounting, carriers: with a live status each: **Connected** (a channel in this OMS carries its sync key today), **Ready** (the OMS-side endpoints exist, waiting for a flow to be switched on: the card names them), or **Available** (wired through the platform on request).

## Generating an API token

1. Open `Integrations` (owners and admins manage tokens).
2. In **API tokens**, name what will use it: "3PL warehouse sync", "EDI gateway": one token per integration, so each can be revoked on its own.
3. Click `Generate token` and **copy it immediately**: it's shown exactly once and stored only as a hash. Format: `oms_…`
4. The integration sends it on every call: `Authorization: Bearer oms_…`
5. The list shows each token's prefix, created date and **last used**: a quick health check that a connection is alive. `Revoke` kills it instantly (requests get 401).

> **Note:** API activity Every authenticated API call is logged with its method, path, and token, and the page shows calls today, calls this month, per-token counts, and the last 15 requests. This is the support and fair-use monitor: API volume is watched, never billed.

> **Tip:** Development key Locally the fixed key `demo-key-supplylens` also works, so the curl examples in this guide run without setup.
