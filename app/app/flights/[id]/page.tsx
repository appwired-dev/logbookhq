import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FlightForm from "../FlightForm";
import { getLocale } from "@/lib/i18n-server";
import type { Flight } from "@/lib/types";

export default async function EditFlightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  // `/app/flights/abc` would otherwise blow up Postgres with an invalid
  // bigint cast; treat any non-numeric slug as a 404.
  if (!Number.isFinite(numericId) || numericId <= 0) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("flights").select("*").eq("id", numericId).single();
  if (!data) notFound();
  const locale = await getLocale();
  return <FlightForm flight={data as Flight} locale={locale} />;
}
