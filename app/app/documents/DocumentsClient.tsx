"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createDocument, deleteDocument, signedUrlFor, updateDocument } from "./actions";
import { makeT, type Locale, type TranslationKey } from "@/lib/i18n";
import type { PilotDocument, DocumentType } from "@/lib/types";
import { daysUntil, expiryStatus, type ExpiryStatus } from "@/lib/dates";
import { Alert, Button, Card, CardFooter, CardHeader, EmptyState, Field, Icon, PageHeader, Pill, buttonClass } from "@/components/ui";
import type { LucideIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { docStrings, EXPIRY_REQUIRED, type DocT } from "./documents-strings";

/* ------------------------------------------------------------------------ */
/* Constants                                                                 */
/* ------------------------------------------------------------------------ */

const TYPE_ICON: Record<DocumentType, LucideIcon> = {
  MEDICAL: Icon.HeartPulse, LICENSE: Icon.FileBadge, TYPE_RATING: Icon.Plane, IPC: Icon.CloudFog,
  RECURRENT: Icon.GraduationCap, PASSPORT: Icon.ScanFace, VISA: Icon.Map, OTHER: Icon.Paperclip,
};
const TYPE_LABEL_KEY: Record<DocumentType, TranslationKey> = {
  MEDICAL: "docs.type.medical", LICENSE: "docs.type.license",
  TYPE_RATING: "docs.type.typeRating", IPC: "docs.type.ipc",
  RECURRENT: "docs.type.recurrent", PASSPORT: "docs.type.passport",
  VISA: "docs.type.visa", OTHER: "docs.type.other",
};
const TYPE_ORDER: DocumentType[] = ["MEDICAL", "LICENSE", "TYPE_RATING", "IPC", "RECURRENT", "PASSPORT", "VISA", "OTHER"];

/** `.input` is h-10; phones get the 44px touch target. */
const INPUT = "input h-11 sm:h-10";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** lib/dates uses "ok" for the green state; the Pill variant is "good". */
const STATUS_PILL: Record<ExpiryStatus, "good" | "warn" | "bad"> = { ok: "good", warn: "warn", bad: "bad" };

/* ------------------------------------------------------------------------ */
/* Form state                                                                */
/* ------------------------------------------------------------------------ */

type Values = {
  doc_type: DocumentType;
  name: string;
  reference: string;
  issued_on: string;
  expires_on: string;
  notes: string;
};
type ErrorKey = "name" | "expires_on" | "file";
type Errors = Partial<Record<ErrorKey, string>>;

const blank = (): Values => ({ doc_type: "MEDICAL", name: "", reference: "", issued_on: "", expires_on: "", notes: "" });
const fromDoc = (d: PilotDocument): Values => ({
  doc_type: d.doc_type,
  name: d.name,
  reference: d.reference ?? "",
  issued_on: d.issued_on ?? "",
  expires_on: d.expires_on ?? "",
  notes: d.notes ?? "",
});

function validate(v: Values, file: File | null, editing: boolean, s: DocT): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = s("errRequired");
  if (!v.expires_on && EXPIRY_REQUIRED.has(v.doc_type)) errors.expires_on = s("errExpiryRequired");
  else if (v.expires_on && v.issued_on && v.expires_on <= v.issued_on) errors.expires_on = s("errExpiryBeforeIssue");
  if (!editing) {
    if (!file) errors.file = s("errFileRequired");
    else if (file.size > MAX_FILE_BYTES) errors.file = s("errFileTooLarge");
  } else if (file && file.size > MAX_FILE_BYTES) {
    errors.file = s("errFileTooLarge");
  }
  return errors;
}

/* ------------------------------------------------------------------------ */
/* Page                                                                      */
/* ------------------------------------------------------------------------ */

/** `null` = closed, `"new"` = add form, a document = edit form. */
type Editor = null | "new" | PilotDocument;

export default function DocumentsClient({ documents, locale }: { documents: PilotDocument[]; locale: Locale }) {
  const t = makeT(locale);
  const s = docStrings(locale);
  const toast = useToast();
  const [editor, setEditor] = useState<Editor>(null);
  // `deleteTarget` outlives `deleteOpen` so the dialog keeps its copy while it animates closed.
  const [deleteTarget, setDeleteTarget] = useState<PilotDocument | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, startDeleting] = useTransition();
  const [openingId, setOpeningId] = useState<number | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const expiring = documents.filter((d) => d.expires_on && expiryStatus(daysUntil(d.expires_on)) === "warn").length;
  const expired = documents.filter((d) => d.expires_on && expiryStatus(daysUntil(d.expires_on)) === "bad").length;

  function closeEditor() {
    setEditor(null);
    // Return focus to the header trigger so keyboard users don't land at the top of the document.
    requestAnimationFrame(() => addRef.current?.focus());
  }

  async function view(d: PilotDocument) {
    // Open the tab synchronously so Safari's pop-up blocker doesn't eat the
    // navigation that happens after the await; fall back to a plain open.
    const win = window.open("", "_blank");
    setOpeningId(d.id);
    try {
      const r = await signedUrlFor(d.storage_path);
      if ("error" in r || !r.url) {
        win?.close();
        toast.push({ tone: "bad", title: s("openFailed"), description: "error" in r ? r.error : undefined });
        return;
      }
      if (win) win.location.href = r.url;
      else if (!window.open(r.url, "_blank")) toast.push({ tone: "warn", title: s("popupBlocked") });
    } catch (e) {
      win?.close();
      toast.push({ tone: "bad", title: s("openFailed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setOpeningId(null);
    }
  }

  function confirmDelete() {
    const d = deleteTarget;
    if (!d) return;
    startDeleting(async () => {
      try {
        const r = await deleteDocument(d.id, d.storage_path);
        if (r && "error" in r && r.error) {
          toast.push({ tone: "bad", title: s("deleteFailed"), description: r.error });
        } else {
          toast.push({ tone: "good", title: s("deleted"), description: s("deletedBody", { name: d.name }) });
          if (editor && editor !== "new" && editor.id === d.id) setEditor(null);
        }
      } catch {
        toast.push({ tone: "bad", title: s("deleteFailed"), description: s("errUnexpected") });
      } finally {
        setDeleteOpen(false);
      }
    });
  }

  function askDelete(d: PilotDocument) {
    setDeleteTarget(d);
    setDeleteOpen(true);
  }

  // Plain <button>: the shared Button doesn't forward refs, and this one needs
  // to take focus back when the editor closes.
  const addButton = (
    <button
      ref={addRef}
      type="button"
      className={buttonClass(editor === "new" ? "default" : "primary", "md", "h-11 sm:h-10")}
      aria-expanded={editor === "new"}
      onClick={() => (editor === "new" ? closeEditor() : setEditor("new"))}
    >
      {editor === "new" ? <><Icon.X size={16} strokeWidth={2} aria-hidden />{t("common.cancel")}</>
                        : <><Icon.Plus size={16} strokeWidth={2} aria-hidden />{s("addDocument")}</>}
    </button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("docs.title")}
        subtitle={<>
          <span>{documents.length === 1 ? s("summaryOne") : s("summary", { n: documents.length })}</span>
          {expiring > 0 && <span className="text-warn-ink">· {s("summaryExpiring", { n: expiring })}</span>}
          {expired > 0 && <span className="text-bad-ink">· {s("summaryExpired", { n: expired })}</span>}
        </>}
        actions={addButton}
      />

      {editor && (
        <DocumentForm
          key={editor === "new" ? "new" : editor.id}
          doc={editor === "new" ? null : editor}
          locale={locale}
          onDone={closeEditor}
        />
      )}

      {documents.length === 0 && !editor && (
        <EmptyState
          icon={Icon.FolderOpen}
          title={t("docs.empty.title")}
          body={t("docs.empty.body")}
          primary={
            <Button variant="primary" className="h-11 sm:h-10" onClick={() => setEditor("new")}>
              <Icon.Plus size={16} strokeWidth={2} aria-hidden />{s("addDocument")}
            </Button>
          }
        />
      )}

      {documents.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {documents.map((d) => (
            <li key={d.id} className="min-w-0">
              <DocumentCard
                d={d}
                t={t}
                s={s}
                opening={openingId === d.id}
                onView={() => view(d)}
                onEdit={() => setEditor(d)}
                onDelete={() => askDelete(d)}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={s("deleteTitle")}
        body={s("deleteBody", { name: deleteTarget?.name ?? "" })}
        confirmLabel={s("deleteConfirm")}
        tone="danger"
        pending={deleting}
        locale={locale}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteOpen(false); }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Card                                                                      */
/* ------------------------------------------------------------------------ */

function DocumentCard({
  d, t, s, opening, onView, onEdit, onDelete,
}: {
  d: PilotDocument;
  t: ReturnType<typeof makeT>;
  s: DocT;
  opening: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const TypeIcon = TYPE_ICON[d.doc_type] ?? Icon.Paperclip;
  const days = d.expires_on ? daysUntil(d.expires_on) : null;
  const status = days == null ? null : expiryStatus(days);
  const statusLabel =
    days == null ? null
    : days < 0 ? t("docs.expired", { days: -days })
    : days === 0 ? s("expiresToday")
    : t("docs.daysLeft", { days });

  return (
    <Card padding="md" className="h-full flex flex-col">
      <div className="flex items-start gap-3">
        <span aria-hidden className="w-10 h-10 shrink-0 rounded-xl bg-brand/10 text-brand grid place-items-center">
          <TypeIcon size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-brand-deep">{t(TYPE_LABEL_KEY[d.doc_type])}</div>
          <h2 className="text-sm font-semibold text-ink-1 truncate" title={d.name}>{d.name}</h2>
          {d.reference && <div className="mono text-xs text-ink-3 truncate mt-0.5">{d.reference}</div>}
        </div>
        {status && statusLabel && <Pill variant={STATUS_PILL[status]} className="shrink-0">{statusLabel}</Pill>}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs flex-1">
        <div>
          <dt className="text-ink-3">{t("docs.issued")}</dt>
          <dd className="mono text-ink-1">{d.issued_on ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-3">{t("docs.expires")}</dt>
          <dd className={`mono ${status === "bad" ? "text-bad-ink font-semibold" : status === "warn" ? "text-warn-ink font-semibold" : "text-ink-1"}`}>
            {d.expires_on ?? s("noExpiry")}
          </dd>
        </div>
        {d.notes && (
          <div className="col-span-2 mt-1">
            <dt className="sr-only">{t("docs.notes")}</dt>
            <dd className="text-ink-2 line-clamp-2">{d.notes}</dd>
          </div>
        )}
      </dl>

      <CardFooter>
        <Button size="sm" className="h-11 sm:h-8 flex-1" loading={opening} onClick={onView}>
          {opening ? s("opening") : <><Icon.Eye size={14} strokeWidth={2} aria-hidden />{s("view")}</>}
        </Button>
        <Button size="sm" variant="ghost" className="h-11 sm:h-8" onClick={onEdit} aria-label={`${s("edit")}: ${d.name}`}>
          <Icon.Pencil size={14} strokeWidth={2} aria-hidden />{s("edit")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-11 sm:h-8 text-bad-ink hover:bg-bad/10 hover:text-bad-ink"
          onClick={onDelete}
          aria-label={`${t("docs.delete")}: ${d.name}`}
        >
          <Icon.X size={14} strokeWidth={2} aria-hidden />{t("docs.delete")}
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/* Add / edit form                                                           */
/* ------------------------------------------------------------------------ */

function DocumentForm({ doc, locale, onDone }: { doc: PilotDocument | null; locale: Locale; onDone: () => void }) {
  const t = makeT(locale);
  const s = docStrings(locale);
  const toast = useToast();
  const editing = doc !== null;
  const [values, setValues] = useState<Values>(() => (doc ? fromDoc(doc) : blank()));
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const errors = validate(values, file, editing, s);
  const errorCount = Object.keys(errors).length;

  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((prev) => ({ ...prev, [k]: v }));
  const touch = (k: string) => setTouched((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
  const visibleError = (k: ErrorKey): string | undefined =>
    errors[k] && (attempted || touched.has(k)) ? errors[k] : undefined;

  useEffect(() => { firstFieldRef.current?.focus(); }, []);
  useEffect(() => { if (serverError) errorRef.current?.focus(); }, [serverError]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setAttempted(true);
    setServerError(null);
    if (errorCount > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const fd = new FormData(e.currentTarget);
    startSaving(async () => {
      try {
        const r = doc ? await updateDocument(doc.id, fd) : await createDocument(fd);
        if (r && "error" in r && r.error) {
          setServerError(r.error);
          return;
        }
        toast.push({
          tone: "good",
          title: s(doc ? "updated" : "saved"),
          description: s(doc ? "updatedBody" : "savedBody", { name: values.name.trim() }),
        });
        onDone();
      } catch {
        setServerError(s("errUnexpected"));
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={saving || undefined} className="card p-4 animate-fade-up motion-reduce:animate-none">
      <CardHeader
        title={editing ? s("editDocument") : t("docs.new")}
        meta={editing ? s("editDocumentDesc") : s("newDocumentDesc")}
      />

      {serverError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="mb-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Alert variant="bad">{serverError}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("docs.type")} hint={s("typeHint")} required>
          <select
            ref={firstFieldRef}
            name="doc_type"
            className={INPUT}
            value={values.doc_type}
            onChange={(e) => set("doc_type", e.target.value as DocumentType)}
          >
            {TYPE_ORDER.map((v) => <option key={v} value={v}>{t(TYPE_LABEL_KEY[v])}</option>)}
          </select>
        </Field>
        <Field label={t("docs.name")} required error={visibleError("name")}>
          <input
            name="name"
            className={INPUT}
            value={values.name}
            placeholder={t("docs.namePh")}
            autoComplete="off"
            onChange={(e) => set("name", e.target.value)}
            onBlur={() => touch("name")}
          />
        </Field>
        <Field label={t("docs.reference")}>
          <input
            name="reference"
            className={`${INPUT} mono`}
            value={values.reference}
            placeholder={t("docs.referencePh")}
            autoComplete="off"
            onChange={(e) => set("reference", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("docs.issued")}>
            <input
              name="issued_on"
              type="date"
              className={`${INPUT} num`}
              value={values.issued_on}
              onChange={(e) => set("issued_on", e.target.value)}
              onBlur={() => touch("expires_on")}
            />
          </Field>
          <Field label={t("docs.expires")} required={EXPIRY_REQUIRED.has(values.doc_type)} error={visibleError("expires_on")}>
            <input
              name="expires_on"
              type="date"
              className={`${INPUT} num`}
              value={values.expires_on}
              min={values.issued_on || undefined}
              onChange={(e) => set("expires_on", e.target.value)}
              onBlur={() => touch("expires_on")}
            />
          </Field>
        </div>
        <Field label={t("docs.notes")} className="sm:col-span-2">
          <input
            name="notes"
            className={INPUT}
            value={values.notes}
            placeholder={t("docs.notesPh")}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
        {editing ? (
          <p className="sm:col-span-2 flex items-center gap-1.5 text-xs text-ink-3">
            <Icon.Paperclip size={14} strokeWidth={2} aria-hidden />{s("fileKept")}
          </p>
        ) : (
          <Field label={t("docs.file")} hint={s("fileHint")} required error={visibleError("file")} className="sm:col-span-2">
            <input
              name="file"
              type="file"
              accept=".pdf,image/*"
              className="input-file"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); touch("file"); }}
            />
          </Field>
        )}
      </div>

      <CardFooter className="justify-end">
        <Button variant="ghost" className="h-11 sm:h-10" onClick={onDone} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" className="h-11 sm:h-10" loading={saving}>
          {saving ? (editing ? t("common.saving") : t("docs.uploading")) : t("common.save")}
        </Button>
      </CardFooter>
    </form>
  );
}
