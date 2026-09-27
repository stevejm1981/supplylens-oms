# Organisation, Users & Sign-in

> `/sign-in · /sign-up · Settings`

The app is now gated: visiting any page signed-out redirects to sign-in. Sign-up creates a company: an **organisation**: and makes you its **owner**. The demo login is `steve@supplylens.co.uk` / `demo1234` (Greenfield Trading Co.). Your name, company and role live in the sidebar footer, with sign-out beside them.

## Inviting your team

1. Open `Settings` → **Users & invitations** (owners and admins only).
2. Enter an email, pick a role: **Admin** can manage the organisation and invite others; **Member** uses the app: and click `Create invite`.
3. Copy the **invite link** and send it yourself: there's no mail server locally; production emails it automatically via Supabase. Links expire after 7 days, can be revoked, and re-inviting the same email issues a fresh link.
4. The invitee opens the link, sees "Join <company> as member", sets a name and password (or just their password if their email already has an account), and lands signed-in on the dashboard. Used links can't be reused.

## Organisation details

1. Settings → **Organisation**: company name, VAT number and registered address: the details that will print on invoices and other documents.

> **Tip:** The three-phase plan Phase 1 (this) is identity: who you are, which company, what role. Phase 2 scopes every record by organisation so two customers can share a database without seeing each other. Phase 3 swaps this credential layer for Supabase Auth at deployment, the org/membership model is built to survive that swap unchanged.
