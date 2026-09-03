import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import UserMenu from "@/components/UserMenu";
import { getT, getLocale } from "@/lib/i18n-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, tier, primary_regime, is_admin")
    .eq("id", user.id)
    .single();

  const t = await getT();
  const locale = await getLocale();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#2b2520]/85 border-b border-amber-900/25">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-6">
          <Link href="/app" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 rounded-xl bg-gradient-cyan shadow-[0_4px_20px_rgba(56,189,248,0.4)] group-hover:shadow-[0_6px_30px_rgba(56,189,248,0.6)] transition-shadow" />
              <div className="absolute inset-0 flex items-center justify-center">
                <PlaneIcon />
              </div>
            </div>
            <div className="leading-tight">
              <div className="font-bold text-white text-[15px] tracking-tight">
                Pilot Logbook <span className="text-sky-300">HQ</span>
              </div>
              <div className="text-[9px] text-sky-300/70 uppercase tracking-[0.12em] flex items-center gap-1.5">
                <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                {profile?.primary_regime ?? "CA"} · {profile?.tier ?? "free"}
              </div>
            </div>
          </Link>
          <nav className="flex gap-0.5 text-sm ml-4">
            <Tab href="/app">{t("nav.dashboard")}</Tab>
            <Tab href="/app/flights">{t("nav.flights")}</Tab>
            <Tab href="/app/charts">{t("nav.charts")}</Tab>
            <Tab href="/app/documents">{t("nav.documents")}</Tab>
            <Tab href="/app/transfer">{t("nav.transfer")}</Tab>
            <Tab href="/app/settings">{t("nav.settings")}</Tab>
            {/* Admin tab — only rendered for admin profiles, styled amber to
                distinguish from regular nav. Non-admins never see it. */}
            {profile?.is_admin && (
              <Tab href="/app/admin">
                <span className="text-amber-300">★ Admin</span>
              </Tab>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LocaleSwitcher current={locale} />
            <UserMenu email={profile?.email ?? user.email ?? ""} locale={locale} signOutAction={logout} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl w-full p-4 sm:p-6 flex-1">
        <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-[0_20px_60px_-15px_rgba(2,12,40,0.45)] border border-white/40 p-4 sm:p-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

function Tab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-sky-100/70 hover:text-white hover:bg-white/10 transition-all duration-200 font-medium"
    >
      {children}
    </Link>
  );
}

function PlaneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}
