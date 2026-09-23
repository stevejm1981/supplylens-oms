import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { getAvailableEffectiveStockMap } from "@/lib/queries";
import { parseRules } from "@/lib/engine/channel-rules";
import { PageHeader } from "@/components/page-header";
import { RuleBuilder, type FeedItem } from "./rule-builder";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [channel, products, effective] = await Promise.all([
    db.channel.findUnique({ where: { id } }),
    db.product.findMany({ orderBy: { sku: "asc" } }),
    getAvailableEffectiveStockMap(),
  ]);
  if (!channel) notFound();

  const items: FeedItem[] = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    isBundle: p.type === "BUNDLE",
    effectiveQty: effective.get(p.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title={channel.name}
        description={`Channel code "${channel.code}"`}
        hint="Edit the rule steps and watch the live preview change, the CSV feed uses the saved rules."
      />
      <RuleBuilder
        channelId={channel.id}
        channelCode={channel.code}
        initialSteps={parseRules(channel.rulesJson)}
        initialIncludeBundles={channel.includeBundles}
        items={items}
      />
    </div>
  );
}
