"use client";

import { useEffect, useState } from "react";

const TEXT: Record<string, string> = { en: "Loading…", ko: "불러오는 중…", zh: "加载中…", es: "Cargando…" };

/** Visually-hidden, localized loading announcement for route skeletons. */
export default function LoadingStatus() {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    const l = document.documentElement.lang?.slice(0, 2);
    if (l && TEXT[l]) setLang(l);
  }, []);
  return <span role="status" className="sr-only">{TEXT[lang]}</span>;
}
