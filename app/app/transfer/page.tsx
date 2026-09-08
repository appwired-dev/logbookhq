import Link from "next/link";
import { getLocale, getT } from "@/lib/i18n-server";
import { Card, Icon, PageHeader, Pill } from "@/components/ui";
import type { LucideIcon } from "@/components/ui/icons";
import ImportClient from "../import/ImportClient";
import { IMPORT_STRINGS } from "../import/import-strings";
import { exportStrings } from "../export/export-strings";

/** Same list StepUpload shows on the wizard's first step. */
const IMPORT_SUPPORTED = ["ForeFlight", "LogTen", "MyFlightbook", "LogbookHQ", "Apple Numbers"];
const EXPORT_FORMATS = ["PDF", "CSV"];

/**
 * Import & Export hub. Two link cards route to the dedicated pages; the
 * import wizard is still embedded underneath so a pilot who lands here from
 * the nav can start an import without another hop.
 */
export default async function TransferPage() {
  const locale = await getLocale();
  const t = await getT();
  const s = exportStrings(locale);
  const supportedLabel = IMPORT_STRINGS.supported[locale] ?? IMPORT_STRINGS.supported.en;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("nav.transfer")} subtitle={s("hubSubtitle")} />

      <div className="grid gap-3 md:grid-cols-2 [&>*]:min-w-0">
        <HubCard
          href="/app/import"
          icon={Icon.Upload}
          title={s("hubImport")}
          body={s("hubImportBody")}
          pillsLabel={supportedLabel}
          pills={IMPORT_SUPPORTED}
          open={s("hubOpen")}
        />
        <HubCard
          href="/app/export"
          icon={Icon.Download}
          title={s("hubExport")}
          body={s("hubExportBody")}
          pillsLabel={s("hubFormats")}
          pills={EXPORT_FORMATS}
          open={s("hubOpen")}
        />
      </div>

      <section aria-label={s("hubImportHere")} className="pt-6 border-t border-border">
        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-brand-deep mb-3">{s("hubImportHere")}</p>
        <ImportClient locale={locale} />
      </section>
    </div>
  );
}

function HubCard({
  href, icon: HubIcon, title, body, pillsLabel, pills, open,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  body: string;
  pillsLabel: string;
  pills: string[];
  open: string;
}) {
  return (
    <Card as={Link} href={href} interactive padding="lg" className="flex flex-col gap-4 h-full">
      <div className="flex items-start gap-3">
        <span aria-hidden className="w-11 h-11 shrink-0 rounded-xl bg-brand/10 text-brand grid place-items-center">
          <HubIcon size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-md font-semibold text-ink-1 tracking-tight">{title}</h2>
          <p className="text-sm text-ink-2 mt-0.5">{body}</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-brand-deep shrink-0">
          {open}<Icon.ArrowRight size={14} strokeWidth={2} aria-hidden />
        </span>
      </div>
      <div className="mt-auto flex items-center gap-2 flex-wrap">
        <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2 mr-1">{pillsLabel}</span>
        {pills.map((name) => <Pill key={name} variant="neutral">{name}</Pill>)}
      </div>
    </Card>
  );
}
