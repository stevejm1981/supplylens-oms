import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getOrdoTheme } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ordo",
  description:
    "Ordo, the order management system by Supply Lens. Every order, in order: POs, landed costs, bundles, batches, and channel stock rules.",
  // Icons live in public/ and are referenced at STABLE URLs on purpose.
  // As src/app file conventions they get a per-build cache-busting query
  // string, which makes every browser drop its cached favicon on every
  // deployment (the tab icon "disappears" until it refetches).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.png", type: "image/png", sizes: "384x384" },
    ],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getOrdoTheme();
  return (
    <html
      lang="en"
      data-theme={theme}
      className={cn("h-full antialiased font-sans", inter.variable, geistMono.variable)}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
