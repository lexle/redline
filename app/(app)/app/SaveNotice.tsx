"use client";

import Link from "next/link";
import styles from "../app.module.css";

export type SaveState =
  | { state: "not-configured" }
  | { state: "checking" }
  | { state: "signed-out" }
  | { state: "saved"; id: string }
  | { state: "failed" };

/**
 * One quiet line under the summary saying whether this result went into the library. With accounts
 * not set up there is no library to mention, so it says nothing. A failed save never hides the
 * result; it only says the result wasn't kept.
 */
export function SaveNotice({ save }: { save: SaveState }) {
  if (save.state === "not-configured") return null;
  return (
    <p className={styles.saveNotice} role="status" data-save={save.state}>
      {/* While the session is read nothing is said, so a signed-out Signer never sees "Saving". */}
      {save.state === "saved" && (
        <>
          Saved to your library.{" "}
          <Link href="/library" className={styles.inlineLink}>
            Open library
          </Link>
        </>
      )}
      {save.state === "signed-out" && (
        <>
          Not saved, because you&apos;re not signed in.{" "}
          <Link href="/sign-in" className={styles.inlineLink}>
            Sign in
          </Link>{" "}
          to keep the documents you check.
        </>
      )}
      {save.state === "failed" && "Couldn't save this to your library. The result is still here."}
    </p>
  );
}
