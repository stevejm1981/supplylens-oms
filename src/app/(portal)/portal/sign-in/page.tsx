import { redirect } from "next/navigation";
import { getCurrentBuyer } from "@/lib/portal-auth";
import { PortalSignInForm } from "../portal-forms";

export default async function PortalSignInPage() {
  if (await getCurrentBuyer()) redirect("/portal");
  return <PortalSignInForm />;
}
