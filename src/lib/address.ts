// Structured addresses. Every address in the system (customer default,
// delivery location, order ship-to snapshot, organisation) is stored as a
// JSON object of these named parts, never a free-text blob: carrier APIs,
// EDI name-and-address segments, and postcode rate cards all need the parts.
// Display strings are always DERIVED via formatAddress, never stored.

export interface Address {
  name?: string | null; // recipient or contact name
  company?: string | null;
  line1?: string | null;
  line2?: string | null;
  line3?: string | null;
  city?: string | null;
  province?: string | null; // county / state / region
  postcode?: string | null;
  country?: string | null;
  // Index signature so an Address is directly storable in a Prisma Json column.
  [key: string]: string | null | undefined;
}

export const ADDRESS_KEYS = [
  "name",
  "company",
  "line1",
  "line2",
  "line3",
  "city",
  "province",
  "postcode",
  "country",
] as const;

export const DEFAULT_COUNTRY = "United Kingdom";

/**
 * Trim every part, drop empties; null when nothing remains. A country on its
 * own is not an address (forms default the country), so it also yields null.
 */
export function normalizeAddress(input: Partial<Address> | null | undefined): Address | null {
  if (!input || typeof input !== "object") return null;
  const out: Address = {};
  let any = false;
  for (const key of ADDRESS_KEYS) {
    const raw = input[key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value) {
      out[key] = value;
      if (key !== "country") any = true;
    }
  }
  return any ? out : null;
}

/**
 * The delivery-address minimum: someone to address it to (name or company),
 * a first line, a city, and a postcode. Returns the missing parts, empty
 * when the address passes.
 */
export function validateAddress(address: Partial<Address> | null | undefined): string[] {
  const a = normalizeAddress(address);
  const missing: string[] = [];
  if (!a?.name && !a?.company) missing.push("name or company");
  if (!a?.line1) missing.push("address line 1");
  if (!a?.city) missing.push("city");
  if (!a?.postcode) missing.push("postcode");
  return missing;
}

/** Read a Prisma Json column back as an Address (null-safe). */
export function asAddress(json: unknown): Address | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  return normalizeAddress(json as Partial<Address>);
}

/**
 * Multi-line display block: name, company, lines, "city, province", postcode,
 * country. The home country is omitted so domestic documents stay clean; pass
 * homeCountry: null to always print it (international labels).
 */
export function formatAddress(
  address: Address | null | undefined,
  opts: { homeCountry?: string | null } = {},
): string {
  const a = normalizeAddress(address);
  if (!a) return "";
  const home = opts.homeCountry === undefined ? DEFAULT_COUNTRY : opts.homeCountry;
  const cityLine = [a.city, a.province].filter(Boolean).join(", ");
  const lines = [
    a.name,
    a.company,
    a.line1,
    a.line2,
    a.line3,
    cityLine || null,
    a.postcode,
    a.country && a.country.toLowerCase() !== home?.toLowerCase() ? a.country : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Single-line variant for tables and logs. */
export function addressOneLine(address: Address | null | undefined): string {
  return formatAddress(address).split("\n").join(", ");
}

const UK_POSTCODE_TAIL = /^(.*?)[,\s]*([A-Za-z]{1,2}[0-9][0-9A-Za-z]?\s?[0-9][A-Za-z]{2})$/;

/**
 * Best-effort split of a legacy free-text address (one part per line, UK
 * postcode recognised on the final line, alone or after the city). Used for
 * migrating old data and as the compatibility path when the API is sent a
 * plain string. New data should always arrive already structured.
 */
const COUNTRY_LINES = new Set([
  "united kingdom",
  "uk",
  "great britain",
  "gb",
  "england",
  "scotland",
  "wales",
  "northern ireland",
]);

export function parseAddress(text: string | null | undefined): Address | null {
  if (!text?.trim()) return null;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const out: Address = { country: DEFAULT_COUNTRY };
  // A trailing country line ("…\nBradford BD3 7DL\nUnited Kingdom") is the
  // country, not the city.
  if (lines.length > 1 && COUNTRY_LINES.has(lines[lines.length - 1].toLowerCase())) {
    out.country = lines.pop()!;
  }
  const last = lines[lines.length - 1];
  const match = last.match(UK_POSTCODE_TAIL);
  let street: string[];
  if (match) {
    out.postcode = match[2].toUpperCase();
    const before = match[1].trim();
    if (before) out.city = before;
    street = lines.slice(0, -1);
    // "…\nBristol\nBS11 8DD": bare postcode line, the city is the line above.
    if (!out.city && street.length > 1) out.city = street.pop();
  } else {
    street = lines.length > 1 ? lines.slice(0, -1) : lines;
    if (lines.length > 1) out.city = last;
  }
  if (street.length > 0) out.line1 = street[0];
  if (street.length > 1) out.line2 = street[1];
  if (street.length > 2) out.line3 = street.slice(2).join(", ");
  return normalizeAddress(out);
}

/**
 * Assemble an Address from a form's addr_* fields (the AddressFields
 * component's uncontrolled mode). Null when every part was left blank.
 */
export function addressFromFormData(formData: FormData, prefix = "addr"): Address | null {
  const part = (key: string) => {
    const v = formData.get(`${prefix}_${key}`);
    return typeof v === "string" ? v : "";
  };
  return normalizeAddress({
    name: part("name"),
    company: part("company"),
    line1: part("line1"),
    line2: part("line2"),
    line3: part("line3"),
    city: part("city"),
    province: part("province"),
    postcode: part("postcode"),
    country: part("country"),
  });
}
