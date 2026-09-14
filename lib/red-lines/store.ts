/**
 * The Signer's red lines in the `red_lines` table, reached from the browser with the anon key.
 * Row-level security limits every call to the signed-in Signer's own rows (see
 * `supabase/migrations/`), so nothing here filters by user: the database does, and `user_id` is
 * filled in by the database from the session.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RedLine } from "../analysis/types";
import { checkRedLineText } from "./validate";

export interface StoredRedLine {
  readonly id: string;
  readonly text: string;
}

/** A read or write on the table failed. The message is Supabase's, for the console only. */
export class RedLineStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedLineStoreError";
  }
}

const COLUMNS = "id, text";

function checked(text: string): string {
  const check = checkRedLineText(text);
  if ("problem" in check) throw new RangeError(`A red line was refused before saving: ${check.problem}.`);
  return text;
}

/** The signed-in Signer's red lines, oldest first, so the ids the analysis gives them stay in the Signer's order. */
export async function listRedLines(client: SupabaseClient): Promise<StoredRedLine[]> {
  const { data, error } = await client
    .from("red_lines")
    .select(COLUMNS)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new RedLineStoreError(error.message);
  return (data ?? []).map((row) => ({ id: String(row.id), text: String(row.text) }));
}

export async function addRedLine(client: SupabaseClient, text: string): Promise<StoredRedLine> {
  const { data, error } = await client.from("red_lines").insert({ text: checked(text) }).select(COLUMNS).single();
  if (error) throw new RedLineStoreError(error.message);
  return { id: String(data.id), text: String(data.text) };
}

export async function updateRedLine(client: SupabaseClient, id: string, text: string): Promise<StoredRedLine> {
  const { data, error } = await client
    .from("red_lines")
    .update({ text: checked(text) })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw new RedLineStoreError(error.message);
  return { id: String(data.id), text: String(data.text) };
}

export async function deleteRedLine(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("red_lines").delete().eq("id", id);
  if (error) throw new RedLineStoreError(error.message);
}

/**
 * The red lines an analysis runs with: none when accounts are not set up or nobody is signed in,
 * otherwise every one the signed-in Signer keeps. A failed read throws rather than returning none,
 * because an analysis silently run without the Signer's red lines would look like one run with them.
 */
export async function redLinesForAnalysis(client: SupabaseClient | null): Promise<RedLine[]> {
  if (!client) return [];
  const { data, error } = await client.auth.getSession();
  if (error) throw new RedLineStoreError(error.message);
  if (!data.session) return [];
  return (await listRedLines(client)).map((line) => ({ text: line.text }));
}
