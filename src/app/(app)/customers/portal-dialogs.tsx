"use client";

// Per-customer B2B portal management: the price list they buy at, and the
// buyers who can sign in. Same dialog patterns as delivery locations.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, PoundSterling, Trash2, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProductCombobox } from "@/components/product-combobox";
import { formatPence } from "@/lib/money";
import {
  deleteCustomerPrice,
  invitePortalUser,
  removePortalUser,
  revokePortalInvitation,
  saveCustomerPrice,
} from "./actions";

type Result = { ok: boolean } & { error?: string };

function useRun() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<Result>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  return { pending, run };
}

export interface PriceRow {
  id: string;
  sku: string;
  name: string;
  unitPricePence: number;
  sellPricePence: number;
}

export function PriceListDialog({
  customerId,
  customerName,
  prices,
  products,
}: {
  customerId: string;
  customerName: string;
  prices: PriceRow[];
  products: { id: string; sku: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [price, setPrice] = useState("");
  const { pending, run } = useRun();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Price list for ${customerName}`}>
          <PoundSterling className="text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Price list, {customerName}</DialogTitle>
          <DialogDescription>
            The price this customer pays per each. Products without a row fall
            back to the standard sell price, in the portal, on order forms, and
            for API orders sent without a price.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {prices.length > 0 ? (
            <ul className="grid max-h-60 gap-1.5 overflow-y-auto">
              {prices.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                  <span className="font-mono text-xs font-medium">{p.sku}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{p.name}</span>
                  <span className="font-semibold tabular-nums">{formatPence(p.unitPricePence)}</span>
                  <span className="text-xs text-muted-foreground line-through tabular-nums">
                    {formatPence(p.sellPricePence)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => run(() => deleteCustomerPrice(p.id), "Price removed")}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No list prices yet, everything is at standard price.
            </p>
          )}
          <div className="grid grid-cols-[1fr_110px_auto] items-end gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-0">
              <ProductCombobox products={products} value={productId} onChange={setProductId} />
            </div>
            <Input
              inputMode="decimal"
              placeholder="£ each"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Button
              size="sm"
              disabled={pending || !productId || !price}
              onClick={() =>
                run(
                  () => saveCustomerPrice({ customerId, productId, pricePounds: price }),
                  "Price saved",
                )
              }
            >
              Set price
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface PortalUserRow {
  id: string;
  name: string;
  email: string;
}
export interface PortalInviteRow {
  id: string;
  email: string;
  link: string;
  expired: boolean;
}

export function PortalAccessDialog({
  customerId,
  customerName,
  users,
  invites,
}: {
  customerId: string;
  customerName: string;
  users: PortalUserRow[];
  invites: PortalInviteRow[];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { run } = useRun();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await invitePortalUser({ customerId, email });
      if (result.ok) {
        setLastLink(`${window.location.origin}${result.link}`);
        setEmail("");
        toast.success("Portal invite created, share the link");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Portal access for ${customerName}`}>
          <UserRound className="text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Portal access, {customerName}</DialogTitle>
          <DialogDescription>
            Buyers you invite can sign in at /portal to browse the catalogue at
            this customer&apos;s prices, place orders, and track everything.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
              <span className="font-medium">{u.name}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{u.email}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() => run(() => removePortalUser(u.id), "Access removed")}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{inv.email}</span>
              {inv.expired ? <Badge variant="outline">expired</Badge> : <Badge variant="outline">invited</Badge>}
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${inv.link}`);
                  toast.success("Invite link copied");
                }}
              >
                <Copy className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() => run(() => revokePortalInvitation(inv.id), "Invite revoked")}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
          <form onSubmit={invite} className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-0 flex-1">
              <Input
                type="email"
                placeholder="buyer@customer.co.uk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Invite
            </Button>
          </form>
          {lastLink ? (
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs">{lastLink}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(lastLink);
                  toast.success("Copied");
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
