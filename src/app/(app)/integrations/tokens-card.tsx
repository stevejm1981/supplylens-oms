"use client";

// API token management. The full token is displayed exactly once, on
// creation, after that only the prefix exists anywhere.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, KeyRound, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiToken, revokeApiToken } from "./actions";

export interface TokenView {
  id: string;
  name: string;
  prefix: string;
  created: string; // pre-formatted server-side (hydration-safe)
  lastUsed: string | null;
  revoked: boolean;
}

export function TokensCard({ tokens, canManage }: { tokens: TokenView[]; canManage: boolean }) {
  const [name, setName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function generate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createApiToken(name);
      if (result.ok) {
        setFreshToken(result.token);
        setName("");
        toast.success("Token generated, copy it now, it won't be shown again");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeApiToken(id);
      if (result.ok) {
        toast.success("Token revoked, requests with it now get 401");
        router.refresh();
      } else {
        toast.error(result.error ?? "Revoke failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          API tokens
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            machine credentials for integrations, send as{" "}
            <code className="text-[11px]">Authorization: Bearer &lt;token&gt;</code>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {tokens.length > 0 ? (
          <ul className="grid gap-2">
            {tokens.map((t) => (
              <li
                key={t.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${t.revoked ? "opacity-60" : ""}`}
              >
                <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{t.prefix}</span>
                  <span className="block text-xs text-muted-foreground">
                    created {t.created}
                    {t.lastUsed ? ` · last used ${t.lastUsed}` : " · never used"}
                  </span>
                </div>
                {t.revoked ? (
                  <Badge className="border-transparent bg-rose-100 text-rose-800">revoked</Badge>
                ) : canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => revoke(t.id)}
                  >
                    <ShieldOff className="size-3.5" /> Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No tokens yet. The fixed development key works locally; generate a named
            token per integration so each can be revoked on its own.
          </p>
        )}

        {canManage ? (
          <form onSubmit={generate} className="grid gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid min-w-56 flex-1 gap-1.5">
                <Label htmlFor="tok-name">What will use this token?</Label>
                <Input
                  id="tok-name"
                  placeholder="3PL warehouse sync"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Generating…" : "Generate token"}
              </Button>
            </div>
            {freshToken ? (
              <div className="grid gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  Copy this now, it is shown once and stored only as a hash:
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                    {freshToken}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(freshToken);
                      toast.success("Token copied");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
