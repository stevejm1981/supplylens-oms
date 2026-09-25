import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PortalAcceptForm } from "../../portal-forms";

export default async function PortalInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await db.portalInvitation.findUnique({
    where: { token },
    include: { customer: { select: { name: true } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {invitation?.acceptedAt
            ? "This invitation has already been used, sign in instead."
            : "This invitation is invalid or has expired, ask your account manager for a new link."}
        </CardContent>
      </Card>
    );
  }
  return (
    <PortalAcceptForm
      token={token}
      customerName={invitation.customer.name}
      email={invitation.email}
    />
  );
}
