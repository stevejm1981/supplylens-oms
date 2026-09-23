"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth";
import { generateApiToken } from "@/lib/auth-crypto";

export async function createApiToken(
  name: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the token a name, what will use it?" };
  const { token, tokenHash, prefix } = generateApiToken();
  await db.apiToken.create({
    data: { name: trimmed, prefix, tokenHash, createdById: admin.id },
  });
  revalidatePath("/integrations");
  // The only moment the full token exists outside the caller's clipboard.
  return { ok: true, token };
}

export async function revokeApiToken(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const record = await db.apiToken.findUnique({ where: { id } });
  if (!record) return { ok: false, error: "Token not found" };
  if (record.revokedAt) return { ok: false, error: "Already revoked" };
  await db.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath("/integrations");
  return { ok: true };
}
