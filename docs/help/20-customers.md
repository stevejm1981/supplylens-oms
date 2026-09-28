# Customers & Salespeople

> `/customers · /salespeople`

Who you sell to, and who owns the relationship. The defaults you set here are what make raising a sales order a ten-second job.

## Set up the sales team

1. On **Salespeople**, click `+ New salesperson`: just a name and optional email. The list shows each person's customers, order count, and sales value.

## Add customers with defaults

1. On **Customers**, click `+ New customer`. Name and Code are required.
2. Set the **Default salesperson**: every new order for this customer pre-fills with them (still editable per order).
3. Set the **Default warehouse**: where this customer's orders usually dispatch from. Leave it empty to fall back to the system default warehouse.
4. Fill in **phone** and **payment terms** in days: invoice due dates are calculated from them.
5. Open the **map-pin icon** on a customer row to manage their **named delivery locations**: each has a display name, a structured address, a contact, and a **code** (e.g. `AVONMOUTH-DC3`). The first becomes the default; star another to change it.

> **Note:** Why locations carry a code The code is the API sync key. When the OMS is opened up to integrations, a synced order carrying `{ "location": "AVONMOUTH-DC3" }` resolves to the right delivery point automatically, the same way channel codes map to integrations. On manual orders, picking a location snapshots its address onto the order, so documents stay stable if the location is edited later.

> **Note:** Addresses are structured Every address (customer default, delivery location, the order's ship-to, the organisation's own) is stored as named parts: name, company, address lines 1 to 3, city, county/province, postcode, country, never a free-text blob. Carrier labels, EDI name-and-address segments, and postcode rate cards all need the parts. A delivery address must carry at least a name or company (the customer's name stands in), address line 1, city, and postcode; the forms and the API both enforce it.

> **Note:** Why defaults live on the customer The salesperson is essential on every sale, but nobody wants to pick it 40 times a day. Customer defaults mean the order form fills itself; the field stays editable for the exceptions.

> **Careful:** Delete guards Customers and salespeople with orders against them can't be deleted. Deleting a salesperson clears them as a default from any customers first.
