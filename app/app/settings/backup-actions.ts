"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllFlights } from "@/lib/fetch-flights";
import type { Flight } from "@/lib/types";

/**
 * Load the full logbook for the signed-in user. Called ONLY when the user
 * clicks "Backup now" — so a routine Settings visit (change a name, view
 * billing) no longer streams every flight row on page load. RLS scopes the
 * rows to the caller.
 */
export async function getBackupFlights(): Promise<Flight[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return fetchAllFlights(supabase, { orderAsc: true });
}
