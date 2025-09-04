import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav className={styles.links} aria-label="Footer">
          <a href="#" className={styles.link}>About</a>
          <a href="#" className={styles.link}>Contact</a>
          <a href="#" className={styles.link}>Privacy</a>
        </nav>
        <div className={styles.copy}>© {new Date().getFullYear()} ShopX</div>
      </div>
    </footer>
  );
}

