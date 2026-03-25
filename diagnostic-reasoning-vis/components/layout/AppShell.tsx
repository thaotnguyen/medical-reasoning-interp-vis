"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "./Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname, useRouter } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentTab = pathname.startsWith("/agreement")
    ? "agreement"
    : pathname.startsWith("/labeler")
      ? "labeler"
      : pathname === "/browser"
        ? "browser"
        : "explorer";

  const tabRoutes: Record<string, string> = {
    explorer: "/",
    browser: "/browser",
    labeler: "/labeler",
    agreement: "/agreement",
  };

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col overflow-hidden">
        <Header />
        <div className="px-6 py-2 border-b">
          <Tabs
            value={currentTab}
            onValueChange={(val) => router.push(tabRoutes[val] ?? "/")}
          >
            <TabsList className="h-8">
              <TabsTrigger value="explorer" className="text-xs px-3">
                Explorer
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
