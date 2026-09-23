import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignInForm } from "../auth-forms";

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <SignInForm />;
}
