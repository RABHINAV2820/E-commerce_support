"use client";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import SupportWidget from "./SupportWidget";
import { ChatProvider } from "./ChatContext";

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Don't show SupportWidget on login page or admin pages
  const shouldShowSupportWidget = pathname !== "/login" && !pathname.startsWith("/admin");
  
  return (
    <ChatProvider>
      <div>
        <SiteHeader />
        {children}
        <SiteFooter />
        {shouldShowSupportWidget && <SupportWidget />}
      </div>
    </ChatProvider>
  );
}

