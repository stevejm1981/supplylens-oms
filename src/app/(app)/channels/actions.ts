"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { RuleStep } from "@/lib/engine/channel-rules";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createChannel(formData: FormData): Promise<ActionResult> {
  const name = ((formData.get("name") as string) ?? "").trim();
  const code = ((formData.get("code") as string) ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (!name || !code) return { ok: false, error: "Name and code are required" };
  try {
    const channel = await db.channel.create({ data: { name, code } });
    revalidatePath("/channels");
    return { ok: true, id: channel.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
}

export async function saveChannelRules(
  id: string,
  steps: RuleStep[],
  includeBundles: boolean,
): Promise<ActionResult> {
  try {
    await db.channel.update({
      where: { id },
      data: { rulesJson: JSON.stringify(steps), includeBundles },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/channels");
  revalidatePath(`/channels/${id}`);
  return { ok: true };
}

export async function deleteChannel(id: string): Promise<ActionResult> {
  const orders = await db.salesOrder.count({ where: { channelId: id } });
  if (orders > 0) {
    return { ok: false, error: "Cannot delete, sales orders reference this channel." };
  }
  try {
    await db.channel.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidatePath("/channels");
  return { ok: true };
}
