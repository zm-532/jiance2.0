import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  FileSearch,
  Wrench,
  Bell,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { key: "/dashboard", icon: LayoutDashboard, label: "总览工作台" },
  { key: "/experiment-db", icon: Database, label: "实验数据库" },
  { key: "/data-judgment", icon: FileSearch, label: "数据源判定" },
  { key: "/device-manage", icon: Wrench, label: "设备管理" },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-white transition-all duration-300 shadow-xl z-20",
          collapsed ? "w-[68px]" : "w-[220px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-white/10 px-4">
          <span className={cn("font-bold tracking-wide", collapsed ? "text-base" : "text-lg")}>
            {collapsed ? "声屏" : "声屏障检测管理平台"}
          </span>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors",
                  active
                    ? "bg-white/10 text-white border-r-2 border-primary"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="size-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 items-center justify-center border-t border-white/10 text-white/40 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border/40 bg-white/80 backdrop-blur-md px-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] z-10 sticky top-0">
          <div className="text-base font-semibold text-gray-800">
            {menuItems.find((m) => m.key === location.pathname)?.label || "声屏障检测管理平台"}
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-500 hover:text-gray-700 transition-colors">
              <Bell className="size-5" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
                <User className="size-4" />
              </div>
              <span className="text-sm text-gray-700">管理员</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
