"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  AudioLines,
  BarChart3,
  Languages,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  PhoneCall,
  Settings,
  X,
} from "lucide-react";
import { DemoBadge, Logo } from "@/components/ui";

const nav = [
  { href: "/console", label: "Overview", icon: LayoutDashboard },
  { href: "/simulator", label: "Customer Simulator", icon: PhoneCall },
  { href: "/live-agent", label: "Live Agent", icon: AudioLines },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/language-models", label: "Language Models", icon: Languages },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarInner({ pathname }: { pathname: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <Link href="/console" className="flex items-center gap-3">
          <Logo />
          <span>
            <span className="block text-[15px] font-semibold tracking-tight text-navy-950">
              Afriklang
            </span>
            <span className="block text-[11px] text-slate-500">Enterprise Console</span>
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-navy-50 font-medium text-navy-950"
                  : "text-slate-600 hover:bg-slate-50 hover:text-navy-900"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold-500" />
              )}
              <Icon
                className={`h-4 w-4 ${active ? "text-gold-600" : "text-slate-400 group-hover:text-navy-700"}`}
              />
              {label}
              {href === "/live-agent" && (
                <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-slate-100 px-5 py-4">
        <Link
          href="/customer"
          className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:text-navy-950"
        >
          View customer app <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <DemoBadge compact />
        <p className="text-[11px] leading-relaxed text-slate-400">
          Sandbox tenant · MTN Nigeria & First Unity Bank · v0.4.2
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);

  if (prevPath !== pathname) {
    setPrevPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarInner pathname={pathname} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarInner pathname={pathname} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="flex items-center gap-2 lg:hidden">
              <Logo className="h-7 w-7" />
              <span className="text-sm font-semibold text-navy-950">Afriklang Console</span>
            </span>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden sm:block">
                <DemoBadge />
              </span>
              <span className="sm:hidden">
                <DemoBadge compact />
              </span>
              <span className="hidden items-center gap-2 md:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
                  AO
                </span>
                <span className="text-sm text-navy-900">
                  Ada Obi <span className="text-slate-400">· Ops Lead</span>
                </span>
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
