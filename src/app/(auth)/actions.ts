"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export type AuthResult = { ok: false; error: string }; // success redirects

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Sign-up = create the organisation and become its OWNER. */
export async function signUp(input: {
  company: string;
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const company = input.company.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!company || !name) return { ok: false, error: "Company and your name are required" };
  if (!emailOk(email)) return { ok: false, error: "Enter a valid email address" };
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "That email already has an account, sign in instead" };
  }
  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash: hashPassword(input.password),
      memberships: { create: { role: "OWNER", org: { create: { name: company } } } },
    },
  });
  await createSession(user.id);
  redirect("/dashboard");
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  // Same message either way, don't leak which emails exist.
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    return { ok: false, error: "Email or password is incorrect" };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/sign-in");
}

/**
 * Accept an invitation. If the email already has an account the password
 * signs them in and joins the org; otherwise name + password creates one.
 */
export async function acceptInvite(
  token: string,
  input: { name: string; password: string },
): Promise<AuthResult> {
  const invitation = await db.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.acceptedAt) {
    return { ok: false, error: "This invitation is no longer valid" };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This invitation has expired, ask for a new one" };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  let user = await db.user.findUnique({ where: { email: invitation.email } });
  if (user) {
    if (!verifyPassword(input.password, user.passwordHash)) {
      return { ok: false, error: "That email already has an account, the password didn't match" };
    }
  } else {
    if (!input.name.trim()) return { ok: false, error: "Your name is required" };
    user = await db.user.create({
      data: {
        email: invitation.email,
        name: input.name.trim(),
        passwordHash: hashPassword(input.password),
      },
    });
  }

  await db.$transaction([
    db.membership.upsert({
      where: { orgId_userId: { orgId: invitation.orgId, userId: user.id } },
      create: { orgId: invitation.orgId, userId: user.id, role: invitation.role },
      update: {},
    }),
    db.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);
  await createSession(user.id);
  redirect("/dashboard");
}
