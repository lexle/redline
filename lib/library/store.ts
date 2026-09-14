/**
 * The Signer's saved Documents in the `documents` table, reached from the browser with the anon key.
 * Row-level security limits every call to the signed-in Signer's own rows (see
 * `supabase/migrations/`), so nothing here filters by user: the database does, and `user_id` is
 * filled in by the database from the session. There is no update: a saved analysis is never edited.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedDocumentPayload } from "./payload";

export interface SavedDocumentSummary {
  readonly id: string;
  readonly title: string;
  readonly riskFlagCount: number;
  readonly createdAt: string;
}

/** A read or write on the table failed. The message is Supabase's, for the console only. */
export class LibraryStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryStoreError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in Signer's saved Documents, newest first. The text and result are not fetched for the list. */
export async function listSavedDocuments(client: SupabaseClient): Promise<SavedDocumentSummary[]> {
  const { data, error } = await client
    .from("documents")
    .select("id, title, risk_flag_count, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new LibraryStoreError(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    riskFlagCount: Number(row.risk_flag_count),
    createdAt: String(row.created_at),
  }));
}

export async function insertSavedDocument(client: SupabaseClient, payload: SavedDocumentPayload): Promise<{ id: string }> {
  const { data, error } = await client.from("documents").insert(payload).select("id").single();
  if (error) throw new LibraryStoreError(error.message);
  return { id: String(data.id) };
}

export async function deleteSavedDocument(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("documents").delete().eq("id", id);
  if (error) throw new LibraryStoreError(error.message);
}

/**
 * One saved Document's row exactly as stored, for `reopenSavedDocument` to check, or null when the
 * signed-in Signer has no Document with that id (including an id that is not a uuid at all).
 */
export async function getSavedDocumentRow(client: SupabaseClient, id: string): Promise<unknown | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await client
    .from("documents")
    .select("id, title, text, result, risk_flag_count, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new LibraryStoreError(error.message);
  return data ?? null;
}

/**
 * Saves an analysis when a Signer is signed in. Signed out, nothing is written. A failed read of the
 * session or a failed insert throws, so the caller can say the save failed.
 */
export async function saveForSignedInSigner(
  client: SupabaseClient,
  payload: SavedDocumentPayload,
): Promise<{ state: "signed-out" } | { state: "saved"; id: string }> {
  const { data, error } = await client.auth.getSession();
  if (error) throw new LibraryStoreError(error.message);
  if (!data.session) return { state: "signed-out" };
  const { id } = await insertSavedDocument(client, payload);
  return { state: "saved", id };
}
