"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addRedLine, deleteRedLine, listRedLines, updateRedLine } from "../../../lib/red-lines/store";
import type { StoredRedLine } from "../../../lib/red-lines/store";
import { checkRedLineText, MAX_RED_LINE_LENGTH } from "../../../lib/red-lines/validate";
import styles from "../app.module.css";
import { useAccount } from "../useAccount";

/** What's wrong with a draft red line, in the Signer's terms, or null when it can be saved. */
function draftProblem(text: string): string | null {
  const check = checkRedLineText(text);
  if ("text" in check) return null;
  return "length" in check
    ? `That's ${check.length} characters. Keep it to ${MAX_RED_LINE_LENGTH} or fewer.`
    : "Write the red line first.";
}

export default function RedLinesPage() {
  const { account, client } = useAccount();

  return (
    <section className={styles.formPage} aria-labelledby="red-lines-heading">
      <h1 id="red-lines-heading" className={styles.heading}>
        Your red lines
      </h1>

      {account.state === "not-configured" && (
        <>
          <p className={styles.lede}>
            Accounts aren&apos;t set up on this server yet, so there&apos;s nowhere to keep red lines. You can still
            check a document. It just won&apos;t be checked against any red lines.
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
            Sign in to keep red lines. Once you&apos;ve added some, every document you check is read against them.
          </p>
          <Link href="/sign-in" className={styles.textLink}>
            Sign in
          </Link>
        </>
      )}

      {account.state === "signed-in" && client && <RedLineEditor client={client} />}
    </section>
  );
}

type Load = { state: "loading" } | { state: "failed" } | { state: "ready"; lines: StoredRedLine[] };

function RedLineEditor({ client }: { client: SupabaseClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      setLoad({ state: "ready", lines: await listRedLines(client) });
    } catch (error) {
      console.error("[red-lines]", error instanceof Error ? error.message : error);
      setLoad({ state: "failed" });
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = draftProblem(draft);
    if (problem) {
      setDraftError(problem);
      return;
    }
    setAdding(true);
    try {
      const added = await addRedLine(client, draft);
      setLoad((current) => (current.state === "ready" ? { state: "ready", lines: [...current.lines, added] } : current));
      setDraft("");
      setDraftError(null);
    } catch (error) {
      console.error("[red-lines]", error instanceof Error ? error.message : error);
      setDraftError("Couldn't save that. Try again.");
    } finally {
      setAdding(false);
    }
  }

  const replace = (line: StoredRedLine) =>
    setLoad((current) =>
      current.state === "ready"
        ? { state: "ready", lines: current.lines.map((candidate) => (candidate.id === line.id ? line : candidate)) }
        : current,
    );
  const remove = (id: string) =>
    setLoad((current) =>
      current.state === "ready" ? { state: "ready", lines: current.lines.filter((line) => line.id !== id) } : current,
    );

  return (
    <>
      <p className={styles.lede}>
        The things you won&apos;t agree to, in your own words. Every document you check is read against this list, and
        any clause that crosses a line says which one.
      </p>

      {load.state === "loading" && (
        <p className={styles.status} role="status">
          <span className={styles.pulse} aria-hidden="true" />
          Loading your red lines…
        </p>
      )}

      {load.state === "failed" && (
        <div className={styles.failure} role="alert">
          <h2 className={styles.failureHeading}>Your red lines didn&apos;t load</h2>
          <p className={styles.failureText}>Check your connection and try again.</p>
          <button type="button" className={styles.textButton} onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}

      {load.state === "ready" &&
        (load.lines.length === 0 ? (
          <div className={styles.redLinesEmpty}>
            <h2 className={styles.failureHeading}>No red lines yet</h2>
            <p className={styles.quiet}>
              Add the first thing you won&apos;t accept, like &ldquo;No personal guarantee&rdquo; or &ldquo;I keep the
              rights to my own tools.&rdquo;
            </p>
          </div>
        ) : (
          <ul className={styles.redLineList} aria-label="Your red lines">
            {load.lines.map((line) => (
              <RedLineItem key={line.id} client={client} line={line} onSaved={replace} onDeleted={remove} />
            ))}
          </ul>
        ))}

      {load.state === "ready" && (
        <form className={styles.paste} onSubmit={handleAdd} noValidate>
          <label htmlFor="red-line-new" className={styles.pasteLabel}>
            Add a red line
          </label>
          <textarea
            id="red-line-new"
            className={styles.redLineInput}
            value={draft}
            rows={2}
            onChange={(event) => {
              setDraft(event.target.value);
              if (draftError) setDraftError(null);
            }}
            disabled={adding}
            aria-invalid={draftError !== null || undefined}
            aria-describedby={draftError ? "red-line-new-error" : "red-line-new-hint"}
          />
          {draftError ? (
            <p id="red-line-new-error" className={styles.pasteError} role="alert">
              {draftError}
            </p>
          ) : (
            <p id="red-line-new-hint" className={styles.meta}>
              Up to {MAX_RED_LINE_LENGTH} characters.
            </p>
          )}
          <button type="submit" className={styles.pasteButton} disabled={adding}>
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      )}
    </>
  );
}

function RedLineItem({
  client,
  line,
  onSaved,
  onDeleted,
}: {
  client: SupabaseClient;
  line: StoredRedLine;
  onSaved: (line: StoredRedLine) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.text);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = `red-line-${line.id}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = draftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      onSaved(await updateRedLine(client, line.id, draft));
      setEditing(false);
      setError(null);
    } catch (failure) {
      console.error("[red-lines]", failure instanceof Error ? failure.message : failure);
      setError("Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteRedLine(client, line.id);
      onDeleted(line.id);
    } catch (failure) {
      console.error("[red-lines]", failure instanceof Error ? failure.message : failure);
      setError("Couldn't delete that. Try again.");
      setBusy(false);
    }
  }

  return (
    <li className={styles.redLine}>
      <span className={styles.redLineTip} aria-hidden="true" />
      {editing ? (
        <form className={styles.redLineEdit} onSubmit={save} noValidate>
          <label htmlFor={inputId} className={styles.visuallyHidden}>
            Edit red line
          </label>
          <textarea
            id={inputId}
            className={styles.redLineInput}
            value={draft}
            rows={2}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
            aria-invalid={error !== null || undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          {error && (
            <p id={`${inputId}-error`} className={styles.pasteError} role="alert">
              {error}
            </p>
          )}
          <div className={styles.redLineActions}>
            <button type="submit" className={styles.navButton} disabled={busy}>
              Save
            </button>
            <button
              type="button"
              className={styles.textButton}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setDraft(line.text);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.redLineBody}>
          <p className={styles.redLineText}>{line.text}</p>
          {error && (
            <p className={styles.pasteError} role="alert">
              {error}
            </p>
          )}
          <div className={styles.redLineActions}>
            <button
              type="button"
              className={styles.textButton}
              disabled={busy}
              onClick={() => {
                setDraft(line.text);
                setEditing(true);
              }}
            >
              Edit
            </button>
            <button type="button" className={styles.textButton} disabled={busy} onClick={() => void remove()}>
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
