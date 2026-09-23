import { redirect } from "next/navigation";

// The front door: signed-in visitors land on the dashboard, everyone else is
// bounced to sign-in by the app layout's gate.
export default function RootPage() {
  redirect("/dashboard");
}
