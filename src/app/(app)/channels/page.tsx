import Link from "next/link";
import { Radio } from "lucide-react";

import { db } from "@/lib/db";
import { describeStep, parseRules } from "@/lib/engine/channel-rules";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChannelFormDialog } from "./channel-form";
import { deleteChannel } from "./actions";

export default async function ChannelsPage() {
  const channels = await db.channel.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { salesOrders: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Channels"
        hint="Each channel gets its own stock feed, shaped by an ordered rule pipeline."
      >
        <ChannelFormDialog />
      </PageHeader>

      {channels.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No channels yet"
          description="Add Very, Frasers or any channel and give it buffer rules, the feature everyone keeps asking for."
        >
          <ChannelFormDialog />
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Channel</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Rules</TableHead>
                  <TableHead>Bundles</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="w-16 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((c) => {
                  const steps = parseRules(c.rulesJson);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/channels/${c.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.code}
                      </TableCell>
                      <TableCell>
                        {steps.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            pass-through (no rules)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {steps.map((s, i) => (
                              <Badge key={i} variant="outline" className="font-normal">
                                {i + 1}. {describeStep(s)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.includeBundles ? "included" : "excluded"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c._count.salesOrders}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <ConfirmDelete id={c.id} label="channel" action={deleteChannel} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
