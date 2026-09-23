import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignUpForm } from "../auth-forms";

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <SignUpForm />;
}
