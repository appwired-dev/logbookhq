import Link from "next/link";
import Brand from "@/components/Brand";
import { EmptyState, Icon, buttonClass } from "@/components/ui";
import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";

/**
 * Root 404. Full-page, centred on the canvas, brand lockup top-left. Strings
 * are local (lib/i18n.ts is owned by another workstream) and resolved from
 * the locale cookie via getLocale().
 */
const STRINGS: Record<Locale, { title: string; body: string; dashboard: string; home: string }> = {
  en: {
    title: "Page not found",
    body: "That route isn't on the chart. The link may be outdated, or the page may have moved.",
    dashboard: "Go to dashboard",
    home: "Home",
  },
  ko: {
    title: "페이지를 찾을 수 없습니다",
    body: "요청하신 페이지가 존재하지 않습니다. 링크가 오래되었거나 페이지가 이동되었을 수 있습니다.",
    dashboard: "대시보드로 이동",
    home: "홈",
  },
  zh: {
    title: "页面未找到",
    body: "找不到该页面。链接可能已过期，或者页面已被移动。",
    dashboard: "前往仪表板",
    home: "首页",
  },
  es: {
    title: "Página no encontrada",
    body: "Esa ruta no está en la carta. Puede que el enlace esté desactualizado o que la página se haya movido.",
    dashboard: "Ir al panel",
    home: "Inicio",
  },
};

export default async function NotFound() {
  const locale = await getLocale();
  const s = STRINGS[locale];

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <header className="px-6 py-5">
        <Brand tone="dark" href="/" />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <EmptyState headingLevel={1}
          className="w-full max-w-md"
          icon={Icon.Map}
          title={s.title}
          body={s.body}
          primary={<Link href="/app" className={buttonClass("primary")}>{s.dashboard}</Link>}
          secondary={<Link href="/" className={buttonClass()}>{s.home}</Link>}
        />
      </main>
    </div>
  );
}
