"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, buttonClass } from "@/components/ui";
import type { Locale } from "@/lib/i18n";

/**
 * Route-segment error boundary for everything under /app. Renders inside the
 * app shell (header + card frame from app/app/layout.tsx), so it only needs
 * to fill the content area.
 *
 * Strings live here rather than in lib/i18n.ts so this file has no server
 * imports; the locale is read from <html lang> after mount (English on SSR).
 */
const STRINGS: Record<Locale, { title: string; body: string; retry: string; back: string; ref: string }> = {
  en: {
    title: "Something went wrong",
    body: "This page hit an unexpected error. Your logbook data is safe — try again, or head back to the dashboard.",
    retry: "Try again",
    back: "Back to dashboard",
    ref: "Reference",
  },
  ko: {
    title: "문제가 발생했습니다",
    body: "이 페이지에서 예기치 않은 오류가 발생했습니다. 로그북 데이터는 안전합니다. 다시 시도하거나 대시보드로 돌아가세요.",
    retry: "다시 시도",
    back: "대시보드로 돌아가기",
    ref: "참조 번호",
  },
  zh: {
    title: "出了点问题",
    body: "此页面遇到意外错误。您的飞行记录数据是安全的，请重试或返回仪表板。",
    retry: "重试",
    back: "返回仪表板",
    ref: "参考编号",
  },
  es: {
    title: "Algo salió mal",
    body: "Esta página encontró un error inesperado. Tus datos de bitácora están a salvo: inténtalo de nuevo o vuelve al panel.",
    retry: "Reintentar",
    back: "Volver al panel",
    ref: "Referencia",
  },
};

function isLocale(v: string): v is Locale {
  return v === "en" || v === "ko" || v === "zh" || v === "es";
}

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const lang = document.documentElement.lang;
    if (isLocale(lang)) setLocale(lang);
  }, []);

  const s = STRINGS[locale];

  return (
    <Card padding="lg" className="max-w-xl mx-auto mt-10">
      <Alert variant="bad" title={s.title}>
        <p>{s.body}</p>
        {error.digest && (
          <p className="mt-1.5 text-2xs text-ink-3">
            {s.ref}: <span className="mono">{error.digest}</span>
          </p>
        )}
      </Alert>
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <Button variant="primary" onClick={reset}>{s.retry}</Button>
        <Link href="/app" className={buttonClass()}>{s.back}</Link>
      </div>
    </Card>
  );
}
