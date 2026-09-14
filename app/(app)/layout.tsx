import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./app.module.css";
import { AccountNav } from "./AccountNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link href="/" className={styles.wordmark} aria-label="Redline home">
          Redline
          <span className={styles.wordmarkFlag} aria-hidden="true" />
        </Link>
        <AccountNav />
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        Redline explains what a document says. It is not legal advice.
      </footer>
    </div>
  );
}
