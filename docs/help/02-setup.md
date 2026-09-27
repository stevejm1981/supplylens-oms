# Running the app

> `Terminal → http://localhost:3000 (or the next free port)`

1. **Install and create the database.** From the repo folder run the first three commands below. The database is a single local SQLite file: nothing to host.
2. **Seed the demo story.** `npm run seed` loads 3 suppliers, 12 products, 2 warehouses, one shared container with two received POs, three allocated cost invoices, a draft PO, 4 channels, a 3-person sales team, 5 customers and a month of sales history (14 orders, 11 invoices). Run it again anytime to reset.
3. **Start the dev server** and open the printed URL. If port 3000 is busy, Next.js picks the next one (on this machine it's usually 3002).
npm install npx prisma migrate dev # creates prisma/dev.db npm run seed # loads the container story npm run dev # open the URL it prints npm test # optional: 18 engine tests

> **Careful:** Prototype boundaries No login, one user, local only. Don't put real customer data in it.
