import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  DOC_PREFIX_DEFAULTS,
  DOC_TYPE_TITLES,
  STATUS_GROUPS,
  getSettings,
  type DocType,
} from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";
import { OrgCard, UsersCard } from "./org-users";

export default async function SettingsPage() {
  const settings = await getSettings();
  const user = (await getCurrentUser())!;
  const canManage = user.role === "OWNER" || user.role === "ADMIN";
  const [org, memberships, invitations] = await Promise.all([
    db.organisation.findUniqueOrThrow({ where: { id: user.orgId } }),
    db.membership.findMany({
      where: { orgId: user.orgId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: { orgId: user.orgId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const counts: Record<DocType, number> = {
    salesOrder: await db.salesOrder.count(),
    despatch: await db.despatch.count(),
    invoice: await db.invoice.count(),
    creditNote: await db.creditNote.count(),
    purchaseOrder: await db.purchaseOrder.count(),
    customerReturn: await db.customerReturn.count(),
    supplierReturn: await db.supplierReturn.count(),
    adjustment: await db.stockAdjustment.count(),
    transfer: await db.warehouseTransfer.count(),
    reservation: await db.stockReservation.count(),
    stockJournal: await db.stockJournal.count(),
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        hint="Make the OMS speak your language without bending its rules. Number prefixes brand your references; status labels rename what people see while the canonical codes underneath, the path every order walks, and what the API returns, never change. That split is deliberate: integrations stay stable however the labels read."
      />
      <div className="mb-6 grid gap-6">
        <OrgCard
          name={org.name}
          vatNumber={org.vatNumber}
          address={org.address}
          canEdit={canManage}
        />
        <UsersCard
          canManage={canManage}
          members={memberships.map((m) => ({
            membershipId: m.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            isSelf: m.userId === user.id,
          }))}
          invites={invitations.map((inv) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role,
            link: `/invite/${inv.token}`,
            expired: inv.expiresAt.getTime() < Date.now(),
          }))}
        />
      </div>
      <SettingsForm
        prefixFields={(Object.keys(DOC_PREFIX_DEFAULTS) as DocType[]).map((key) => ({
          key,
          title: DOC_TYPE_TITLES[key],
          value: settings.prefixes[key],
          nextNumber: counts[key] + 1,
        }))}
        statusGroups={STATUS_GROUPS.map((g) => ({
          title: g.title,
          note: g.note,
          codes: g.codes.map((code) => ({ code, label: settings.statusLabels[code] })),
        }))}
        defaultTaxTreatment={settings.defaultTaxTreatment}
      />
    </div>
  );
}
