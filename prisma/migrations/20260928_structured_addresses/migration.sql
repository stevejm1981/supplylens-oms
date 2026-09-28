-- Structured addresses: the four free-text address columns become JSONB
-- objects ({name, company, line1, line2, line3, city, province, postcode,
-- country}). Existing text is parsed in place with the same best-effort
-- rules as src/lib/address.ts parseAddress (one part per line, UK postcode
-- recognised on the final line, alone or after the city).

CREATE FUNCTION pg_temp.parse_address(txt TEXT) RETURNS JSONB AS $$
DECLARE
  lines TEXT[];
  n INT;
  m TEXT[];
  city TEXT := NULL;
  postcode TEXT := NULL;
  country TEXT := 'United Kingdom';
  street TEXT[];
BEGIN
  IF txt IS NULL OR btrim(txt) = '' THEN RETURN NULL; END IF;
  lines := ARRAY(
    SELECT btrim(t.l)
    FROM unnest(string_to_array(txt, E'\n')) WITH ORDINALITY AS t(l, ord)
    WHERE btrim(t.l) <> ''
    ORDER BY t.ord
  );
  n := coalesce(array_length(lines, 1), 0);
  IF n = 0 THEN RETURN NULL; END IF;

  -- A trailing country line is the country, not the city.
  IF n > 1 AND lower(lines[n]) IN
     ('united kingdom', 'uk', 'great britain', 'gb', 'england', 'scotland', 'wales', 'northern ireland') THEN
    country := lines[n];
    lines := lines[1:n-1];
    n := n - 1;
  END IF;

  m := regexp_match(lines[n], '^(.*?)[,\s]*([A-Za-z]{1,2}[0-9][0-9A-Za-z]?\s?[0-9][A-Za-z]{2})$');
  IF m IS NOT NULL THEN
    postcode := upper(m[2]);
    city := nullif(btrim(m[1]), '');
    street := lines[1:n-1];
    -- bare postcode line: the city is the line above it
    IF city IS NULL AND coalesce(array_length(street, 1), 0) > 1 THEN
      city := street[array_length(street, 1)];
      street := street[1:array_length(street, 1) - 1];
    END IF;
  ELSE
    IF n > 1 THEN
      city := lines[n];
      street := lines[1:n-1];
    ELSE
      street := lines;
    END IF;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'line1', street[1],
    'line2', street[2],
    'line3', CASE WHEN coalesce(array_length(street, 1), 0) > 2
                  THEN array_to_string(street[3:], ', ') ELSE NULL END,
    'city', city,
    'postcode', postcode,
    'country', country
  ));
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "Customer"
  ALTER COLUMN "deliveryAddress" TYPE JSONB USING pg_temp.parse_address("deliveryAddress");

ALTER TABLE "CustomerLocation"
  ALTER COLUMN "address" TYPE JSONB USING pg_temp.parse_address("address");

ALTER TABLE "SalesOrder"
  ALTER COLUMN "deliveryAddress" TYPE JSONB USING pg_temp.parse_address("deliveryAddress");

ALTER TABLE "Organisation"
  ALTER COLUMN "address" TYPE JSONB USING pg_temp.parse_address("address");
