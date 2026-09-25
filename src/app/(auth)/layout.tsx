// The staff signed-out surface, the shared dark scene with OMS branding.

import { AuthScene } from "@/components/auth-scene";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthScene heading="SupplyLens" accent="OMS" sub="Prototype · not production">
      {children}
    </AuthScene>
  );
}
