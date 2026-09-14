"use client";

import { useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase/client";

export type Account =
  | { state: "not-configured" }
  | { state: "checking" }
  | { state: "signed-out" }
  | { state: "signed-in"; email: string | null };

function fromSession(session: Session | null): Account {
  return session ? { state: "signed-in", email: session.user.email ?? null } : { state: "signed-out" };
}

/**
 * Whether a Signer is signed in, from the real Supabase session. With the Supabase variables absent
 * there is no client and the state is "not-configured"; nothing is faked.
 */
export function useAccount(): { account: Account; client: SupabaseClient | null } {
  // The client exists only in the browser. On the server this is null and no effect runs.
  const [client] = useState(() => (typeof window === "undefined" ? null : getSupabaseClient()));
  const [account, setAccount] = useState<Account>(() =>
    isSupabaseConfigured() ? { state: "checking" } : { state: "not-configured" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) setAccount(fromSession(data.session));
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setAccount(fromSession(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  return { account, client };
}
