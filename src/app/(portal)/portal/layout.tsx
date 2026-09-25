// The trade portal shell: clean light top-nav branded with the selling
// organisation, no staff chrome. Nav renders only for a signed-in buyer;
// each protected page also gates itself.

import Link from "next/link";
import { LogOut, Telescope } from "lucide-react";

import { db } from "@/lib/db";
import { getCurrentBuyer } from "@/lib/portal-auth";
import { portalSignOut } from "./actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [buyer, org] = await Promise.all([getCurrentBuyer(), db.organisation.findFirst()]);
  const brand = org?.name ?? "SupplyLens OMS";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href="/portal" className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #2dd4bf, #0891b2)" }}
            >
              <Telescope className="size-4" style={{ color: "#fff" }} />
            </span>
            <span className="text-sm font-semibold">
              {brand} <span className="font-normal text-muted-foreground">Trade Portal</span>
            </span>
          </Link>
          {buyer ? (
            <>
              <nav className="flex flex-1 items-center gap-4 text-sm">
                <Link href="/portal/catalogue" className="text-muted-foreground hover:text-foreground">
                  Catalogue
                </Link>
                <Link href="/portal/orders" className="text-muted-foreground hover:text-foreground">
                  Orders
                </Link>
                <Link href="/portal/invoices" className="text-muted-foreground hover:text-foreground">
                  Invoices
                </Link>
              </nav>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {buyer.name} · {buyer.customerName}
                </span>
                <form action={portalSignOut}>
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <LogOut className="size-4" />
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
