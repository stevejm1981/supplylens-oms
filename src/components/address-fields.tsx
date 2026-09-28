"use client";

// The one address fieldset used everywhere an address is entered: customer
// default, delivery locations, the order's ship-to, the organisation.
// Controlled (value + onChange) or uncontrolled (defaultValue; inputs get
// addr_* names for FormData submission via addressFromFormData).

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_COUNTRY, type Address } from "@/lib/address";

interface AddressFieldsProps {
  idPrefix: string;
  value?: Address | null; // controlled mode
  onChange?: (address: Address) => void;
  defaultValue?: Address | null; // uncontrolled mode, named addr_* inputs
  namePrefix?: string;
}

export function AddressFields({
  idPrefix,
  value,
  onChange,
  defaultValue,
  namePrefix = "addr",
}: AddressFieldsProps) {
  const controlled = onChange !== undefined;

  const field = (key: keyof Address, label: string) => (
    <div key={key} className="grid gap-1.5">
      <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
      <Input
        id={`${idPrefix}-${key}`}
        {...(controlled
          ? {
              value: value?.[key] ?? "",
              onChange: (e) => onChange!({ ...value, [key]: e.target.value }),
            }
          : {
              name: `${namePrefix}_${key}`,
              defaultValue:
                defaultValue?.[key] ?? (key === "country" ? DEFAULT_COUNTRY : ""),
            })}
      />
    </div>
  );

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        {field("name", "Name")}
        {field("company", "Company")}
      </div>
      {field("line1", "Address line 1")}
      <div className="grid grid-cols-2 gap-3">
        {field("line2", "Address line 2")}
        {field("line3", "Address line 3")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("city", "City")}
        {field("province", "County / province")}
      </div>
      <div className="grid grid-cols-[140px_1fr] gap-3">
        {field("postcode", "Postcode")}
        {field("country", "Country")}
      </div>
    </div>
  );
}
