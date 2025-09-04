"use client";
import Link from "next/link";
import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Shop brand">ShopX</Link>
        <div className={styles.searchWrap}>
          <input className={styles.search} placeholder="Search products" aria-label="Search products" />
        </div>
        <nav className={styles.nav}>
          <Link href="#" className={styles.link} aria-label="Support">Support</Link>
          <Link href="#" className={styles.link} aria-label="My Account">My Account</Link>
          <button className={styles.iconBtn} aria-label="Cart">🛒</button>
        </nav>
      </div>
    </header>
  );
}

