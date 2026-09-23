import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptInviteForm } from "../../auth-forms";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });

  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {invitation?.acceptedAt
            ? "This invitation has already been used, sign in instead."
            : "This invitation is invalid or has expired. Ask an owner or admin to send a new one from Settings."}
        </CardContent>
      </Card>
    );
  }

  const existing = await db.user.findUnique({ where: { email: invitation.email } });
  return (
    <AcceptInviteForm
      token={token}
      orgName={invitation.org.name}
      email={invitation.email}
      role={invitation.role}
      existingAccount={Boolean(existing)}
    />
  );
}
