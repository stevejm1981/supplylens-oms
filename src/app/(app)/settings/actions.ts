"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth-crypto";
import { requireOrgAdmin } from "@/lib/auth";
import {
  DOC_PREFIX_DEFAULTS,
  STATUS_LABEL_DEFAULTS,
  type DocType,
  type StatusCode,
} from "@/lib/settings";

export type ActionResult = { ok: true } | { ok: false; error: string };

// ── Organisation & users (owner/admin only) ─────────────────────────────────

export async function saveOrganisation(input: {
  name: string;
  vatNumber: string | null;
  address: string | null;
}): Promise<ActionResult> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Company name is required" };
  await db.organisation.update({
    where: { id: admin.orgId },
    data: {
      name,
      vatNumber: input.vatNumber?.trim() || null,
      address: input.address?.trim() || null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const INVITE_DAYS = 7;

export async function inviteUser(input: {
  email: string;
  role: string;
}): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  if (!["ADMIN", "MEMBER"].includes(input.role)) {
    return { ok: false, error: "Role must be admin or member" };
  }
  const alreadyMember = await db.membership.findFirst({
    where: { orgId: admin.orgId, user: { email } },
  });
  if (alreadyMember) return { ok: false, error: "That person is already a member" };

  // Re-inviting replaces the old invitation with a fresh token/expiry.
  const token = generateToken();
  await db.invitation.upsert({
    where: { orgId_email: { orgId: admin.orgId, email } },
    create: {
      orgId: admin.orgId,
      email,
      role: input.role,
      token,
      invitedById: admin.id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    },
    update: {
      role: input.role,
      token,
      invitedById: admin.id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      acceptedAt: null,
    },
  });
  revalidatePath("/settings");
  // Locally there's no mail server, share the link. Production (Supabase)
  // emails it instead.
  return { ok: true, link: `/invite/${token}` };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  await db.invitation.deleteMany({ where: { id, orgId: admin.orgId, acceptedAt: null } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeMember(membershipId: string): Promise<ActionResult> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const membership = await db.membership.findUnique({ where: { id: membershipId } });
  if (!membership || membership.orgId !== admin.orgId) {
    return { ok: false, error: "Member not found" };
  }
  if (membership.userId === admin.id) {
    return { ok: false, error: "You can't remove yourself" };
  }
  if (membership.role === "OWNER") {
    return { ok: false, error: "The owner can't be removed" };
  }
  await db.membership.delete({ where: { id: membershipId } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveSettings(input: {
  prefixes: Record<string, string>;
  statusLabels: Record<string, string>;
  defaultTaxTreatment: string;
}): Promise<ActionResult> {
  const writes: { key: string; value: string }[] = [];

  for (const key of Object.keys(DOC_PREFIX_DEFAULTS) as DocType[]) {
    const raw = (input.prefixes[key] ?? "").trim().toUpperCase();
    if (!raw) return { ok: false, error: `Prefix for ${key} cannot be empty` };
    if (!/^[A-Z0-9]{1,6}$/.test(raw)) {
      return { ok: false, error: `Prefix "${raw}" must be 1 to 6 letters/numbers (no spaces or dashes, the dash is added)` };
    }
    writes.push({ key: `prefix.${key}`, value: raw });
  }
  const seen = new Map<string, string>();
  for (const w of writes) {
    const clash = seen.get(w.value);
    if (clash) return { ok: false, error: `Prefix "${w.value}" is used twice, references must stay unambiguous` };
    seen.set(w.value, w.key);
  }

  for (const code of Object.keys(STATUS_LABEL_DEFAULTS) as StatusCode[]) {
    const label = (input.statusLabels[code] ?? "").trim();
    if (!label) return { ok: false, error: `Label for ${code} cannot be empty` };
    if (label.length > 24) return { ok: false, error: `Label for ${code} is too long (24 max)` };
    writes.push({ key: `statusLabel.${code}`, value: label });
  }

  if (!["EXCLUSIVE", "INCLUSIVE", "NONE"].includes(input.defaultTaxTreatment)) {
    return { ok: false, error: "Invalid default tax treatment" };
  }
  writes.push({ key: "defaultTaxTreatment", value: input.defaultTaxTreatment });

  try {
    await db.$transaction(
      writes.map((w) =>
        db.setting.upsert({
          where: { key: w.key },
          create: w,
          update: { value: w.value },
        }),
      ),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  // Labels appear on every page, refresh the whole layout.
  revalidatePath("/", "layout");
  return { ok: true };
}
