// The staff signed-out surface, the shared dark scene with Ordo branding.

import { AuthScene } from "@/components/auth-scene";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthScene wordmark sub="Order management by Supply Lens">
      {children}
    </AuthScene>
  );
}
