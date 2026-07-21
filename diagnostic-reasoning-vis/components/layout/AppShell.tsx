"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "./Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentTab = pathname.startsWith("/agreement")
    ? "agreement"
    : pathname.startsWith("/labeler")
      ? "labeler"
      : pathname === "/browser"
        ? "browser"
        : pathname === "/plots"
          ? "plots"
          : "explorer";

  const tabRoutes: Record<string, string> = {
    explorer: "/",
    plots: "/plots",
    browser: "/browser",
    labeler: "/labeler",
    agreement: "/agreement",
  };

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col overflow-hidden">
        <Header />
        <div className="px-3 md:px-6 py-2 border-b overflow-x-auto">
          <Tabs
            value={currentTab}
            onValueChange={(val) => {
              const next = tabRoutes[val] ?? "/";
              const qs = searchParams.toString();
              router.push(qs ? `${next}?${qs}` : next);
            }}
          >
            <TabsList className="h-8 w-max">
              <TabsTrigger value="explorer" className="text-xs px-3">
                Explorer
              </TabsTrigger>
              <TabsTrigger value="plots" className="text-xs px-3">
                Plots
              </TabsTrigger>
              <TabsTrigger value="browser" className="text-xs px-3">
                Cluster & Taxonomy Browser
              </TabsTrigger>
              <TabsTrigger value="labeler" className="text-xs px-3">
                Labeler
              </TabsTrigger>
              <TabsTrigger value="agreement" className="text-xs px-3">
                Agreement
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </TooltipProvider>
  );
}
