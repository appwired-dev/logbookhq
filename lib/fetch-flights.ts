/**
 * Fetch ALL flights for the current user via paginated reads.
 * Supabase PostgREST enforces a 1000-row max per request (db-max-rows setting),
 * so we page through with .range() until we've collected everything.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flight } from "./types";

const PAGE = 1000;

export async function fetchAllFlights(
  supabase: SupabaseClient,
  // `userId` adds an explicit user_id filter on top of RLS, for callers that
  // want the row scope stated in the query as well as enforced by the policy.
  opts: { orderAsc?: boolean; userId?: string } = {},
): Promise<Flight[]> {
  const ascending = opts.orderAsc ?? false;
  const all: Flight[] = [];
  let from = 0;
  while (true) {
    let query = supabase.from("flights").select("*");
    if (opts.userId) query = query.eq("user_id", opts.userId);
    const { data, error } = await query
      .order("date", { ascending })
      .order("id", { ascending })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as Flight[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
