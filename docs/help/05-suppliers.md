# Suppliers

> `/suppliers`

The parties you raise purchase orders against. Simplest module, learn the create/edit/delete pattern here; every other module reuses it.

## Add a supplier

1. Click `+ New supplier` (top right).
2. Fill the dialog. Three fields are required; the code is auto-uppercased.
3. Click `Create supplier`. A toast confirms and the row appears immediately.

| Field | Required | Notes |
|---|---|---|
| Name | Yes | e.g. Shenzhen Bright Trading Co. |
| Code | Yes | Short code, stored uppercase, `SBT` |
| Country | Yes | Free text, `CN`, `GB` |
| Lead time (days) | No | Shown in the list as “45d” |
| Contact email / Notes | No | Reference only |

## Edit or delete

1. Use the **pencil icon** on a row to edit in place.
2. Use the **bin icon** to delete: a confirm dialog appears first.

> **Careful:** Delete guard A supplier with products or purchase orders attached can't be deleted; the app tells you why instead of failing silently.
