// Printable documents carry commercial data (prices, costs, addresses), so
// the whole /print group sits behind the same sign-in gate as the app. The
// pages still render chrome-free for paper.

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return children;
}
