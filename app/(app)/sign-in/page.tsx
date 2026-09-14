"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import styles from "../app.module.css";
import { useAccount } from "../useAccount";

type Send =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "sending" }
  | { state: "sent"; email: string }
  | { state: "failed" };

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Sign-in by email one-time link. The link comes back to this page, where the Supabase client
 * exchanges its code for a session on its own; Supabase puts an error in the URL when the link has
 * expired or was already used.
 */
export default function SignInPage() {
  const { account, client } = useAccount();
  const [email, setEmail] = useState("");
  const [send, setSend] = useState<Send>({ state: "idle" });
  const [linkFailed, setLinkFailed] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (query.has("error") || query.has("error_description") || hash.has("error") || hash.has("error_description")) {
      setLinkFailed(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const address = email.trim();
    if (!looksLikeEmail(address)) {
      setSend({ state: "invalid" });
      return;
    }
    setSend({ state: "sending" });
    const { error } = await client.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/sign-in`, shouldCreateUser: true },
    });
    if (error) {
      console.error("[sign-in]", error.message);
      setSend({ state: "failed" });
      return;
    }
    setLinkFailed(false);
    setSend({ state: "sent", email: address });
  }

  return (
    <section className={styles.formPage} aria-labelledby="sign-in-heading">
      <h1 id="sign-in-heading" className={styles.heading}>
        Sign in
      </h1>

      {account.state === "not-configured" && (
        <>
          <p className={styles.lede}>
            Accounts aren&apos;t set up on this server yet, so you can&apos;t sign in. You can still check a document
            without an account.
          </p>
          <Link href="/app" className={styles.textLink}>
            Check a document
          </Link>
        </>
      )}

      {account.state === "checking" && (
        <p className={styles.status} role="status">
          <span className={styles.pulse} aria-hidden="true" />
          Checking whether you&apos;re signed in…
        </p>
      )}

      {account.state === "signed-in" && (
        <>
          <p className={styles.lede}>
            {account.email ? `You're signed in as ${account.email}.` : "You're signed in."}
          </p>
          <p className={styles.linkRow}>
            <Link href="/red-lines" className={styles.textLink}>
              Your red lines
            </Link>
            <Link href="/app" className={styles.textLink}>
              Check a document
            </Link>
          </p>
        </>
      )}

      {account.state === "signed-out" &&
        (send.state === "sent" ? (
          <div className={styles.notice} role="status">
            <h2 className={styles.failureHeading}>Check your email</h2>
            <p className={styles.failureText}>
              Redline sent a sign-in link to {send.email}. Open it on this device, in this browser. It only works once.
            </p>
            <button type="button" className={styles.textButton} onClick={() => setSend({ state: "idle" })}>
              Use a different address
            </button>
          </div>
        ) : (
          <>
            <p className={styles.lede}>
              Enter your email and Redline sends you a link that signs you in. There&apos;s no password. You need an
              account to keep red lines.
            </p>
            {linkFailed && (
              <p className={styles.formError} role="alert">
                That sign-in link didn&apos;t work. It may have expired or been used already. Ask for a new one below.
              </p>
            )}
            <form className={styles.paste} onSubmit={handleSubmit} noValidate>
              <label htmlFor="sign-in-email" className={styles.pasteLabel}>
                Email address
              </label>
              <input
                id="sign-in-email"
                className={styles.textInput}
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (send.state === "invalid" || send.state === "failed") setSend({ state: "idle" });
                }}
                disabled={send.state === "sending"}
                aria-invalid={send.state === "invalid" || undefined}
                aria-describedby={send.state === "invalid" || send.state === "failed" ? "sign-in-error" : undefined}
              />
              {send.state === "invalid" && (
                <p id="sign-in-error" className={styles.pasteError} role="alert">
                  Enter an email address, like name@example.com.
                </p>
              )}
              {send.state === "failed" && (
                <p id="sign-in-error" className={styles.pasteError} role="alert">
                  Couldn&apos;t send the link. Check the address and try again in a minute.
                </p>
              )}
              <button type="submit" className={styles.pasteButton} disabled={send.state === "sending"}>
                {send.state === "sending" ? "Sending…" : "Email me a link"}
              </button>
            </form>
          </>
        ))}
    </section>
  );
}
