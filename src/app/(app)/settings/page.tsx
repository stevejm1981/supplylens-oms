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
import { AppearanceCard } from "./appearance";
import { PlanUsageCard } from "./plan-card";
import { getOrdoTheme } from "@/lib/theme";
import { channelHeadroom, getPlan, usageCharge, PLANS } from "@/lib/plans";

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
  // Plan & usage: everything derived live for the current calendar month.
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [ordersThisMonth, channelsInUse, apiCallsThisMonth] = await Promise.all([
    db.salesOrder.count({ where: { createdAt: { gte: monthStart } } }),
    db.channel.count(),
    db.apiRequestLog.count({ where: { createdAt: { gte: monthStart } } }),
  ]);
  const plan = getPlan(org.plan);
  const charge = usageCharge(org.plan, ordersThisMonth);
  const headroom = channelHeadroom(org.plan, channelsInUse);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    new Date(),
  );

  const counts: Record<DocType, number> = {
    salesOrder: await db.salesOrder.count(),
    despatch: await db.despatch.count(),
    invoice: await db.invoice.count(),
    creditNote: await db.creditNote.count(),
    purchaseOrder: await db.purchaseOrder.count(),
    goodsReceipt: await db.goodsReceipt.count(),
    customerReturn: await db.customerReturn.count(),
    supplierReturn: await db.supplierReturn.count(),
    adjustment: await db.stockAdjustment.count(),
    transfer: await db.warehouseTransfer.count(),
    reservation: await db.stockReservation.count(),
    stockJournal: await db.stockJournal.count(),
    productionOrder: await db.productionOrder.count(),
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        hint="Make the paperwork yours: document number prefixes, the display names of statuses, the default VAT treatment, plus your organisation details and team. Renaming a status changes what people see, never how the system behaves, so every integration stays stable while the screens speak your language."
      />
      <div className="mb-6 grid gap-6">
        <PlanUsageCard
          canManage={canManage}
          planCode={plan.code}
          planName={plan.name}
          monthLabel={monthLabel}
          monthlyPence={plan.monthlyPence}
          includedOrders={plan.includedOrders}
          extraOrderPence={plan.extraOrderPence}
          channelLimit={plan.channelLimit}
          ordersThisMonth={ordersThisMonth}
          extraOrders={charge.extraOrders}
          overagePence={charge.overagePence}
          totalPence={charge.totalPence}
          betterPlanName={charge.betterPlan?.name ?? null}
          channelsInUse={channelsInUse}
          channelsOver={headroom.over}
          apiCallsThisMonth={apiCallsThisMonth}
          plans={PLANS.map((pl) => ({
            code: pl.code,
            name: pl.name,
            pricePence: pl.monthlyPence,
            includedOrders: pl.includedOrders,
          }))}
        />
        <AppearanceCard theme={await getOrdoTheme()} />
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
