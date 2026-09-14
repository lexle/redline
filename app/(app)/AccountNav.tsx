"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./app.module.css";
import { useAccount } from "./useAccount";

const LINKS = [
  { href: "/app", label: "Check a document" },
  { href: "/library", label: "Library" },
  { href: "/red-lines", label: "Red lines" },
] as const;

function isCurrent(pathname: string | null, href: string): boolean {
  return pathname === href || (href === "/library" && pathname?.startsWith("/library/") === true);
}

/** The shell's navigation and sign-in state. */
export function AccountNav() {
  const pathname = usePathname();
  const { account, client } = useAccount();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function signOut() {
    if (!client) return;
    setSigningOut(true);
    setSignOutFailed(false);
    const { error } = await client.auth.signOut();
    setSigningOut(false);
    if (error) setSignOutFailed(true);
  }

  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.navLinks}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={styles.navLink}
              aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.account}>
        {account.state === "signed-out" && (
          <Link href="/sign-in" className={styles.navLink} aria-current={pathname === "/sign-in" ? "page" : undefined}>
            Sign in
          </Link>
        )}
        {account.state === "signed-in" && (
          <>
            {account.email && <span className={styles.accountEmail}>{account.email}</span>}
            <button type="button" className={styles.navButton} onClick={signOut} disabled={signingOut}>
              Sign out
            </button>
            {signOutFailed && (
              <span className={styles.accountError} role="alert">
                Sign-out didn&apos;t work. Try again.
              </span>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
