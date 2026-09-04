import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import Brand from "@/components/Brand";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import NavTabs, { type NavItem } from "@/components/NavTabs";
import UserMenu from "@/components/UserMenu";
import { Pill } from "@/components/ui";
import { getT, getLocale } from "@/lib/i18n-server";
import HtmlLang from "@/components/HtmlLang";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, tier, primary_regime, is_admin, avatar_url")
    .eq("id", user.id)
    .single();

  const t = await getT();
  const locale = await getLocale();

  const items: NavItem[] = [
    { href: "/app", label: t("nav.dashboard"), icon: "LayoutDashboard", exact: true },
    { href: "/app/flights", label: t("nav.flights"), icon: "PlaneTakeoff" },
    { href: "/app/charts", label: t("nav.charts"), icon: "ChartSpline" },
    { href: "/app/documents", label: t("nav.documents"), icon: "FileBadge" },
    { href: "/app/transfer", label: t("nav.transfer"), icon: "ArrowLeftRight", also: ["/app/import", "/app/export"] },
    { href: "/app/settings", label: t("nav.settings"), icon: "Settings" },
  ];
  // Admin tab — only rendered for admin profiles; amber accent distinguishes
  // it from regular nav. Non-admins never see it.
  if (profile?.is_admin) {
    items.push({ href: "/app/admin", label: "Admin", icon: "ShieldCheck", tone: "accent" });
  }

  const regime = profile?.primary_regime ?? "CA";
  const tier = profile?.tier ?? "free";

  return (
    <div className="min-h-screen flex flex-col">
      <HtmlLang locale={locale} />
      <header className="sticky top-0 z-30 h-16 bg-surface-inverse/90 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto h-full max-w-[1440px] px-4 sm:px-6 flex items-center gap-4">
          <Brand
            tone="light"
            subtitle={
              <span className="mt-0.5 inline-flex">
                <Pill variant="inverse">{regime} · {tier}</Pill>
              </span>
            }
          />
          <NavTabs
            items={items}
            newFlight={{ href: "/app/flights/new", label: t("flights.new") }}
            locale={locale}
          />
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <LocaleSwitcher current={locale} />
            <UserMenu
              email={profile?.email ?? user.email ?? ""}
              avatarUrl={profile?.avatar_url ?? null}
              locale={locale}
              signOutAction={logout}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-6 flex-1">
        {children}
      </main>
    </div>
  );
}
