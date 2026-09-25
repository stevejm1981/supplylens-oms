// Portal (customer buyer) sessions, entirely separate from staff auth: own
// models, own cookie, so a staff login never opens the portal and vice versa.

import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth-crypto";

export const PORTAL_COOKIE = "oms_portal_session";
const SESSION_DAYS = 30;

export async function createPortalSession(portalUserId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.portalSession.create({ data: { token, portalUserId, expiresAt } });
  (await cookies()).set(PORTAL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyPortalSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE)?.value;
  if (token) await db.portalSession.deleteMany({ where: { token } });
  store.delete(PORTAL_COOKIE);
}

export interface PortalBuyer {
  id: string;
  name: string;
  email: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  paymentTermsDays: number;
}

export const getCurrentBuyer = cache(async (): Promise<PortalBuyer | null> => {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  const session = await db.portalSession.findUnique({
    where: { token },
    include: { portalUser: { include: { customer: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return {
    id: session.portalUser.id,
    name: session.portalUser.name,
    email: session.portalUser.email,
    customerId: session.portalUser.customerId,
    customerName: session.portalUser.customer.name,
    customerCode: session.portalUser.customer.code,
    paymentTermsDays: session.portalUser.customer.paymentTermsDays,
  };
});
