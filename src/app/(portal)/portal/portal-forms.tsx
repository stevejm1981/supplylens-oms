"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptPortalInvite, portalSignIn } from "./actions";

export function PortalSignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await portalSignIn({ email, password });
      if (result && !result.ok) toast.error(result.error);
    });
  }
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Sign in to your trade account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="p-email">Email</Label>
            <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-pass">Password</Label>
            <Input id="p-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Access is by invitation, ask your account manager for a link.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function PortalAcceptForm({
  token,
  customerName,
  email,
}: {
  token: string;
  customerName: string;
  email: string;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await acceptPortalInvite(token, { name, password });
      if (result && !result.ok) toast.error(result.error);
    });
  }
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Join the {customerName} trade account</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          You&apos;ve been invited as <b>{email}</b>. Choose a password to get started.
        </p>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="a-name">Your name</Label>
            <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="a-pass">Password (8+ characters)</Label>
            <Input id="a-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Joining…" : "Create my access"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
