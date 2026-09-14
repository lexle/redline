"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSavedDocumentRow } from "../../../../lib/library/store";
import styles from "../../app.module.css";
import { useAccount } from "../../useAccount";
import { SavedDocument } from "./SavedDocument";

export default function SavedDocumentPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { account, client } = useAccount();

  if (account.state === "signed-in" && client) return <SavedDocumentLoader client={client} id={id} />;

  return (
    <section className={styles.formPage} aria-labelledby="saved-heading">
      <h1 id="saved-heading" className={styles.heading}>
        Saved document
      </h1>

      {account.state === "not-configured" && (
        <>
          <p className={styles.lede}>
            Accounts aren&apos;t set up on this server yet, so there are no saved documents to open.
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

      {account.state === "signed-out" && (
        <>
          <p className={styles.lede}>Sign in to open the documents in your library.</p>
          <Link href="/sign-in" className={styles.textLink}>
            Sign in
          </Link>
        </>
      )}
    </section>
  );
}

type Load = { state: "loading" } | { state: "failed" } | { state: "missing" } | { state: "ready"; row: unknown };

function SavedDocumentLoader({ client, id }: { client: SupabaseClient; id: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const refresh = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const row = await getSavedDocumentRow(client, id);
      setLoad(row === null ? { state: "missing" } : { state: "ready", row });
    } catch (error) {
      console.error("[library]", error instanceof Error ? error.message : error);
      setLoad({ state: "failed" });
    }
  }, [client, id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (load.state === "ready") return <SavedDocument row={load.row} />;

  return (
    <section className={styles.formPage} aria-labelledby="saved-heading">
      <h1 id="saved-heading" className={styles.heading}>
        Saved document
      </h1>

      {load.state === "loading" && (
        <p className={styles.status} role="status">
          <span className={styles.pulse} aria-hidden="true" />
          Opening the saved document…
        </p>
      )}

      {load.state === "failed" && (
        <div className={styles.failure} role="alert">
          <h2 className={styles.failureHeading}>The saved document didn&apos;t load</h2>
          <p className={styles.failureText}>Check your connection and try again.</p>
          <button type="button" className={styles.textButton} onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}

      {load.state === "missing" && (
        <>
          <p className={styles.lede}>
            There&apos;s no saved document at this address in your library. It may have been deleted.
          </p>
          <Link href="/library" className={styles.textLink}>
            Back to library
          </Link>
        </>
      )}
    </section>
  );
}
