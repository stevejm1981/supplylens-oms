"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite, signIn, signUp } from "./actions";

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await signIn({ email, password });
      if (result && !result.ok) toast.error(result.error);
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <Field id="email" label="Email" type="email" value={email} onChange={setEmail} />
          <Field id="password" label="Password" type="password" value={password} onChange={setPassword} />
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            New company?{" "}
            <Link href="/sign-up" className="text-primary hover:underline">
              Create an organisation
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignUpForm() {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await signUp({ company, name, email, password });
      if (result && !result.ok) toast.error(result.error);
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create your organisation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <Field id="company" label="Company name" value={company} onChange={setCompany} placeholder="Equinox Kombucha" />
          <Field id="name" label="Your name" value={name} onChange={setName} placeholder="Ben Costello" />
          <Field id="email" label="Email" type="email" value={email} onChange={setEmail} />
          <Field id="password" label="Password (8+ characters)" type="password" value={password} onChange={setPassword} />
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create organisation"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You become the owner, invite your team from Settings.{" "}
            <Link href="/sign-in" className="text-primary hover:underline">
              Already set up? Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function AcceptInviteForm({
  token,
  orgName,
  email,
  role,
  existingAccount,
}: {
  token: string;
  orgName: string;
  email: string;
  role: string;
  existingAccount: boolean;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await acceptInvite(token, { name, password });
      if (result && !result.ok) toast.error(result.error);
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join {orgName}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          You&apos;ve been invited as <b>{role.toLowerCase()}</b> using <b>{email}</b>.
          {existingAccount
            ? " That email already has an account, enter its password to join."
            : " Choose a password to create your account."}
        </p>
        <form onSubmit={submit} className="grid gap-4">
          {!existingAccount ? (
            <Field id="name" label="Your name" value={name} onChange={setName} />
          ) : null}
          <Field
            id="password"
            label={existingAccount ? "Your password" : "Password (8+ characters)"}
            type="password"
            value={password}
            onChange={setPassword}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Joining…" : `Join ${orgName}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
