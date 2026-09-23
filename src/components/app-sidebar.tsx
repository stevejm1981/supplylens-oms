"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Braces,
  Building2,
  Cable,
  ClipboardEdit,
  Container,
  DatabaseBackup,
  Factory,
  FileText,
  History,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Package,
  Radio,
  Receipt,
  RotateCcw,
  ScanBarcode,
  Settings,
  ShoppingCart,
  Telescope,
  TrendingUp,
  Truck,
  Undo2,
  UserRound,
  Users,
  Warehouse,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const sections: { label: string; items: { title: string; href: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Customers", href: "/customers", icon: Users },
      { title: "Sales Orders", href: "/sales-orders", icon: ShoppingCart },
      { title: "Despatches", href: "/despatches", icon: Truck },
      { title: "Invoices", href: "/invoices", icon: FileText },
      { title: "Returns", href: "/returns", icon: RotateCcw },
      { title: "Credits", href: "/credits", icon: Undo2 },
      { title: "Salespeople", href: "/salespeople", icon: UserRound },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { title: "Suppliers", href: "/suppliers", icon: Factory },
      { title: "Products", href: "/products", icon: Package },
      { title: "Bundles", href: "/bundles", icon: Boxes },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { title: "Purchase Orders", href: "/purchase-orders", icon: Container },
      { title: "Cost Invoices", href: "/cost-invoices", icon: Receipt },
      { title: "Replenishment", href: "/replenishment", icon: TrendingUp },
    ],
  },
  {
    label: "Warehouse",
    items: [{ title: "Despatch Station", href: "/despatch-station", icon: ScanBarcode }],
  },
  {
    label: "Inventory",
    items: [
      { title: "Stock", href: "/stock", icon: Warehouse },
      { title: "Movements", href: "/movements", icon: History },
      { title: "Adjustments", href: "/adjustments", icon: ClipboardEdit },
      { title: "Transfers", href: "/transfers", icon: ArrowLeftRight },
      { title: "Reservations", href: "/reservations", icon: LockKeyhole },
      { title: "Warehouses", href: "/warehouses", icon: Building2 },
      { title: "Channels", href: "/channels", icon: Radio },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
      { title: "Integrations", href: "/integrations", icon: Cable },
      { title: "Import / Export", href: "/data", icon: DatabaseBackup },
      { title: "API Docs", href: "/api-docs", icon: Braces },
    ],
  },
];

export interface SidebarUser {
  name: string;
  orgName: string;
  role: string;
}

export function AppSidebar({ user }: { user?: SidebarUser }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Telescope className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">SupplyLens</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    OMS
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-semibold">
              {user.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium">{user.name}</p>
              <p className="truncate text-[10px] text-sidebar-foreground/60">
                {user.orgName} · {user.role.toLowerCase()}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        ) : null}
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          Prototype · not production
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
