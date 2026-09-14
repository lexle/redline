import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase/client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the browser Supabase client", () => {
  it("is null when the URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-test");
    expect(getSupabaseClient()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is null when the anon key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getSupabaseClient()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is null when both are missing or only whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "  ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    expect(getSupabaseClient()).toBeNull();
  });
});
