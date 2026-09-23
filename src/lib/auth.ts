// Prototype credential layer, deliberately thin so Supabase Auth can replace
// it at deployment without touching the Organisation/Membership model.
// Passwords: scrypt (Node built-in, no dependency). Sessions: random token in
// an httpOnly cookie, backed by a Session row so sign-out works everywhere.

import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "oms_session";
const SESSION_DAYS = 30;

import { generateToken } from "@/lib/auth-crypto";

export { hashPassword, verifyPassword } from "@/lib/auth-crypto";

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { token } });
  store.delete(SESSION_COOKIE);
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string; // in the current org
  orgId: string;
  orgName: string;
}

/** The signed-in user + their organisation, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: { memberships: { include: { org: true }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  const membership = session.user.memberships[0];
  if (!membership) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: membership.role,
    orgId: membership.orgId,
    orgName: membership.org.name,
  };
});

/** For actions that manage the organisation, Owner/Admin only. */
export async function requireOrgAdmin(): Promise<CurrentUser | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return { error: "Only owners and admins can manage the organisation" };
  }
  return user;
}
