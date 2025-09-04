"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser, logout } from "@/lib/auth";
import { useEffect, useState } from "react";
import { User } from "@/lib/auth";
import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
    router.push("/login");
  }

  if (!user) {
    return null; // Don't show header if not logged in
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Shop brand">ShopX</Link>
        <div className={styles.searchWrap}>
          <input className={styles.search} placeholder="Search products" aria-label="Search products" />
        </div>
        <nav className={styles.nav}>
          {user.role === "user" ? (
            <>
              <Link href="/" className={styles.link} aria-label="Home">Home</Link>
              <Link href="/orders" className={styles.link} aria-label="My Orders">My Orders</Link>
              <Link href="/faq" className={styles.link} aria-label="FAQ">FAQ</Link>
              <button className={styles.iconBtn} aria-label="Cart">🛒</button>
            </>
          ) : (
            <>
              <Link href="/faq" className={styles.link} aria-label="FAQ">FAQ</Link>
            </>
          )}
          <button onClick={handleLogout} className={styles.logoutBtn} aria-label="Logout">Logout</button>
        </nav>
      </div>
    </header>
  );
}

