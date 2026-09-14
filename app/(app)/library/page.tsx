"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteSavedDocument, listSavedDocuments } from "../../../lib/library/store";
import type { SavedDocumentSummary } from "../../../lib/library/store";
import styles from "../app.module.css";
import { useAccount } from "../useAccount";
import { formatSavedDate, riskFlagCountCopy } from "./copy";

/** The most tabs drawn on one entry. The count in words always gives the real number. */
const MAX_TABS = 5;

export default function LibraryPage() {
  const { account, client } = useAccount();

  return (
    <section className={styles.formPage} aria-labelledby="library-heading">
      <h1 id="library-heading" className={styles.heading}>
        Library
      </h1>

      {account.state === "not-configured" && (
        <>
          <p className={styles.lede}>
            Accounts aren&apos;t set up on this server yet, so there&apos;s no library to keep documents in. You can
            still check a document, but the result won&apos;t be saved.
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
          <p className={styles.lede}>
            Sign in to see your library. Every document you check while signed in is saved there with its results.
          </p>
          <Link href="/sign-in" className={styles.textLink}>
            Sign in
          </Link>
        </>
      )}

      {account.state === "signed-in" && client && <SavedDocumentList client={client} />}
    </section>
  );
}

type Load = { state: "loading" } | { state: "failed" } | { state: "ready"; documents: SavedDocumentSummary[] };

function SavedDocumentList({ client }: { client: SupabaseClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const refresh = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      setLoad({ state: "ready", documents: await listSavedDocuments(client) });
    } catch (error) {
      console.error("[library]", error instanceof Error ? error.message : error);
      setLoad({ state: "failed" });
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = (id: string) =>
    setLoad((current) =>
      current.state === "ready"
        ? { state: "ready", documents: current.documents.filter((document) => document.id !== id) }
        : current,
    );

  return (
    <>
      <p className={styles.lede}>
        Documents you&apos;ve checked, newest first. Redline keeps each one&apos;s text and results. The file you chose is
        never stored.
      </p>

      {load.state === "loading" && (
        <p className={styles.status} role="status">
          <span className={styles.pulse} aria-hidden="true" />
          Loading your library…
        </p>
      )}

      {load.state === "failed" && (
        <div className={styles.failure} role="alert">
          <h2 className={styles.failureHeading}>Your library didn&apos;t load</h2>
          <p className={styles.failureText}>Check your connection and try again.</p>
          <button type="button" className={styles.textButton} onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}

      {load.state === "ready" &&
        (load.documents.length === 0 ? (
          <div className={styles.libraryEmpty}>
            <span className={styles.libraryEmptySheet} aria-hidden="true" />
            <div>
              <h2 className={styles.failureHeading}>Nothing saved yet</h2>
              <p className={styles.quiet}>
                Documents you check while signed in are saved here with their results, so you can open them again.
              </p>
              <Link href="/app" className={styles.textLink}>
                Check a document
              </Link>
            </div>
          </div>
        ) : (
          <ul className={styles.libraryList} aria-label="Saved documents">
            {load.documents.map((document) => (
              <LibraryEntry key={document.id} client={client} document={document} onDeleted={remove} />
            ))}
          </ul>
        ))}
    </>
  );
}

function LibraryEntry({
  client,
  document,
  onDeleted,
}: {
  client: SupabaseClient;
  document: SavedDocumentSummary;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabs = Math.min(document.riskFlagCount, MAX_TABS);
  const confirmId = `delete-${document.id}`;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteSavedDocument(client, document.id);
      onDeleted(document.id);
    } catch (failure) {
      console.error("[library]", failure instanceof Error ? failure.message : failure);
      setError("Couldn't delete that. Try again.");
      setBusy(false);
    }
  }

  return (
    <li className={styles.libraryEntry}>
      <Link
        href={`/library/${document.id}`}
        className={styles.librarySheet}
        style={{ "--tabs": tabs } as CSSProperties}
      >
        <span className={styles.libraryTitle}>{document.title}</span>
        <span className={styles.libraryMeta}>
          {formatSavedDate(document.createdAt)} · {riskFlagCountCopy(document.riskFlagCount)}
        </span>
        {tabs > 0 && (
          <span className={styles.libraryTabs} aria-hidden="true">
            {Array.from({ length: tabs }, (_, index) => (
              <span key={index} className={styles.libraryTab} />
            ))}
          </span>
        )}
      </Link>

      <div className={styles.libraryActions}>
        {confirming ? (
          <div className={styles.libraryConfirm} role="group" aria-labelledby={confirmId}>
            <p id={confirmId} className={styles.libraryConfirmText}>
              Delete {document.title} and its results? You can&apos;t undo this.
            </p>
            <div className={styles.redLineActions}>
              <button type="button" className={styles.navButton} disabled={busy} onClick={() => void remove()}>
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                className={styles.textButton}
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.textButton} onClick={() => setConfirming(true)}>
            Delete<span className={styles.visuallyHidden}> {document.title}</span>
          </button>
        )}
        {error && (
          <p className={styles.pasteError} role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
