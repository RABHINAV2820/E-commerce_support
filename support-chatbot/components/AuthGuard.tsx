"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentUser, User } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);

    // Allow access to login page without authentication
    if (pathname === "/login") {
      return;
    }

    // Redirect to login if not authenticated
    if (!currentUser) {
      router.push("/login");
      return;
    }

    // Redirect admin users to admin dashboard
    if (currentUser.role === "admin" && pathname === "/") {
      router.push("/admin");
      return;
    }

    // Redirect regular users away from admin pages
    if (currentUser.role === "user" && pathname.startsWith("/admin")) {
      router.push("/");
      return;
    }
  }, [pathname, router]);

  if (loading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        fontSize: "1.2rem",
        color: "#64748b"
      }}>
        Loading...
      </div>
    );
  }

  // Don't render children on login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Don't render children if not authenticated
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
