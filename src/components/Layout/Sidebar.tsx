import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, 
  ShoppingCart, 
  QrCode, 
  Package, 
  Users, 
  Calendar,
  DollarSign,
  UserCircle,
  Settings,
  Store,
  UtensilsCrossed,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureKey } from "@/config/features";
import { featureConfigs } from "@/config/features";
import { useAuth, type UserRole } from "@/hooks/useAuth";

type MenuItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge: string | null;
  featureKey?: FeatureKey;
  visibleFor?: UserRole[];
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", badge: null, visibleFor: ["ADMIN"] },
  { icon: ShoppingCart, label: "POS Terminal", path: "/pos", badge: "Hot" },
  { icon: UtensilsCrossed, label: "Menu Items", path: "/menu-items", badge: null, visibleFor: ["ADMIN"] },
  { icon: ClipboardList, label: "Orders", path: "/orders", badge: null },
  { icon: QrCode, label: "QR Ordering", path: "/qr-menu", badge: null, featureKey: "qrOrdering", visibleFor: ["ADMIN"] },
  { icon: Package, label: "Inventory", path: "/inventory", badge: null, visibleFor: ["ADMIN"] },
  { icon: Users, label: "Staff & HR", path: "/staff", badge: null, featureKey: "staffHr", visibleFor: ["ADMIN"] },
  { icon: Calendar, label: "Attendance", path: "/attendance", badge: null, featureKey: "attendance", visibleFor: ["ADMIN"] },
  { icon: DollarSign, label: "Accounting", path: "/accounting", badge: null, visibleFor: ["ADMIN"] },
  { icon: UserCircle, label: "CRM", path: "/crm", badge: null, featureKey: "crm", visibleFor: ["ADMIN"] },
  { icon: Store, label: "Multi-Branch", path: "/branches", badge: null, featureKey: "multiBranch", visibleFor: ["ADMIN"] },
  { icon: Settings, label: "Settings", path: "/settings", badge: null },
];

export const Sidebar = () => {
  const location = useLocation();
  const { getUserRole } = useAuth();
  const role = getUserRole();
  const visibleMenuItems = menuItems.filter((item) => !item.visibleFor || item.visibleFor.includes(role));
  const displayRole = role === "ADMIN" ? "Admin" : "User";

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-modern-lg">
      {/* Admin Profile Header */}
      <div className="p-8 border-b border-sidebar-border">
        <div className="flex flex-col items-center text-center gap-4">
          <img
            src="/Admin.png"
            alt="Admin avatar"
            className="w-28 h-28 rounded-full ring-2 ring-white/10 shadow-modern object-cover"
          />
          <h2 className="text-xl font-semibold text-white leading-tight">Welcome, {displayRole}</h2>
        </div>
      </div>
      
      {/* Modern Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4">
        <div className="space-y-2">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            const isFeature = item.featureKey !== undefined;
            const isEnabled = isFeature ? featureConfigs[item.featureKey].isEnabled : true;

            const badgeLabel =
              !isEnabled && isFeature
                ? "Upgrade"
                : item.badge;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 modern-button",
                  isActive 
                    ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-modern" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    isActive ? "scale-110" : "group-hover:scale-105"
                  )} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                {badgeLabel && (
                  <span className={cn(
                    "px-2 py-1 text-xs font-semibold rounded-full",
                    badgeLabel === "Hot"
                      ? "bg-red-500 text-white"
                      : badgeLabel === "Upgrade"
                        ? "bg-amber-500 text-white"
                        : "bg-accent text-white"
                  )}>
                    {badgeLabel}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-sidebar-border" />
    </aside>
  );
};
