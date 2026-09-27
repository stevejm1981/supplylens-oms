# Settings

> `/settings`

Make the OMS speak each customer's language **without bending its rules**. The design principle: statuses are a fixed canonical path the machine (and the API) runs on: DRAFT → OPEN → INVOICED, PICKING → PICKED → DESPATCHED: and Settings only renames what humans see. A customer can call a draft a "Held order"; every integration still sees `DRAFT`.

> **Note:** Plan & usage The organisation carries a subscription plan (Starter to Enterprise); the card shows orders this month against the plan's included volume, the derived bill with any overage, channel headroom, and the month's API call count. Usage is computed live per calendar month, never a stored counter, and nothing is ever blocked: overage bills, and the card says when another plan would be cheaper at the current volume.

> **Note:** Appearance The Ordo brand kit ships two directions, A Ledger (forest green, square, exact) and B Signal (signal yellow, pills, bold), each in light and dark. Pick any of the four on the Appearance card here or with the sun/moon and A/B toggles at the bottom of the sidebar; the choice is per browser and every screen, badge, and chart follows instantly.

1. **Document numbering**: set the prefix for every document type (SO, INV, DSP, PO, CRN, RMA, RTV, ADJ, TRF, RSV, SJ), with a live "next: XXX-0018" preview. Applies to *new* documents only; existing references never change, and duplicate prefixes are refused.
2. **Status labels**: rename the display label for each canonical code, grouped by lifecycle (order, fulfilment, despatch, PO, invoice payment) with the code shown as a fixed chip beside each label. Save and every badge in the app updates instantly.
3. **Defaults**: the default tax treatment for new orders: pre-selects on the order form and applies to API orders that don't specify one.

> **Tip:** Why labels, not custom statuses Systems that let customers invent real statuses end up with integrations that can't tell "Awaiting Dave" from "Despatched". Fixed codes + custom labels give the flexibility that's actually wanted, familiar words, while every order still walks the same path.
