"use client";

// Organisation details + team management for Settings. Invites produce a
// shareable link locally (no mail server); production emails it via Supabase.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { inviteUser, removeMember, revokeInvitation, saveOrganisation } from "./actions";

export interface MemberView {
  membershipId: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
}
export interface InviteView {
  id: string;
  email: string;
  role: string;
  link: string;
  expired: boolean;
}

export function OrgCard({
  name,
  vatNumber,
  address,
  canEdit,
}: {
  name: string;
  vatNumber: string | null;
  address: string | null;
  canEdit: boolean;
}) {
  const [orgName, setOrgName] = useState(name);
  const [vat, setVat] = useState(vatNumber ?? "");
  const [addr, setAddr] = useState(address ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await saveOrganisation({
        name: orgName,
        vatNumber: vat || null,
        address: addr || null,
      });
      if (result.ok) {
        toast.success("Organisation saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Organisation
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            company details, will print on documents
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="org-name">Company name</Label>
          <Input id="org-name" value={orgName} disabled={!canEdit} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="org-vat">VAT number</Label>
          <Input id="org-vat" placeholder="GB123456789" value={vat} disabled={!canEdit} onChange={(e) => setVat(e.target.value)} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="org-addr">Registered address</Label>
          <Textarea id="org-addr" rows={3} value={addr} disabled={!canEdit} onChange={(e) => setAddr(e.target.value)} />
        </div>
        {canEdit ? (
          <div className="sm:col-span-2">
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save organisation"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const roleStyles: Record<string, string> = {
  OWNER: "border-transparent bg-primary/10 text-primary",
  ADMIN: "border-transparent bg-cyan-100 text-cyan-800",
  MEMBER: "border-transparent bg-muted text-muted-foreground",
};

export function UsersCard({
  members,
  invites,
  canManage,
}: {
  members: MemberView[];
  invites: InviteView[];
  canManage: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteUser({ email, role });
      if (result.ok) {
        const url = `${window.location.origin}${result.link}`;
        setLastLink(url);
        setEmail("");
        toast.success("Invitation created, share the link below");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Users &amp; invitations
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            owners and admins can invite; members use the app
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-2">
          {members.map((m) => (
            <li key={m.membershipId} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{m.name}</span>
                {m.isSelf ? <span className="ml-1.5 text-xs text-muted-foreground">(you)</span> : null}
                <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
              </div>
              <Badge className={roleStyles[m.role] ?? ""}>{m.role.toLowerCase()}</Badge>
              {canManage && !m.isSelf && m.role !== "OWNER" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${m.name}`}
                  disabled={pending}
                  onClick={() => run(() => removeMember(m.membershipId), "Member removed")}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {invites.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pending invitations
            </p>
            <ul className="grid gap-2">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm">{inv.email}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {inv.role.toLowerCase()}
                      {inv.expired ? " · expired" : ""}
                    </span>
                  </div>
                  {canManage ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}${inv.link}`);
                          toast.success("Invite link copied");
                        }}
                      >
                        <Copy className="size-3.5" /> Copy link
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        aria-label="Revoke invitation"
                        disabled={pending}
                        onClick={() => run(() => revokeInvitation(inv.id), "Invitation revoked")}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canManage ? (
          <form onSubmit={invite} className="grid gap-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              <UserPlus className="mr-1.5 inline size-4" />
              Invite someone
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid min-w-56 flex-1 gap-1.5">
                <Label htmlFor="inv-email">Email</Label>
                <Input
                  id="inv-email"
                  type="email"
                  placeholder="andy@equinoxkombucha.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create invite"}
              </Button>
            </div>
            {lastLink ? (
              <div className="flex items-center gap-2 rounded-md bg-background px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-xs">{lastLink}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(lastLink);
                    toast.success("Invite link copied");
                  }}
                >
                  <Copy className="size-3.5" /> Copy
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              No mail server locally, share the link yourself. In production the
              invite is emailed automatically.
            </p>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
