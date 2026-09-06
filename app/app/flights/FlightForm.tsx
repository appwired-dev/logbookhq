"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition,
  type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createFlight, updateFlight, deleteFlight, lookupRegistration } from "./actions";
import { makeT, type Locale } from "@/lib/i18n";
import type { Category, Flight, Role } from "@/lib/types";
import { Alert, Button, Card, CardHeader, Field, Icon, buttonClass } from "@/components/ui";
import { formStrings, type FormStringKey, type FormT } from "./form-strings";
import {
  type CountField, type ErrorKey, type FlightFormValues, type HourField, type TextField,
  blankFlightValues, flightToValues, valuesToFlightInput, validateFlightValues, summariseFlight,
  normaliseHours, normaliseCount, parseCount, formatCount,
} from "./flight-validation";
import { FlightSummaryCard, FlightActionBar, type SummaryStatus } from "./FlightSummaryCard";

/* ------------------------------------------------------------------------ */
/* Constants                                                                 */
/* ------------------------------------------------------------------------ */

/** `.input` is h-10; phones get the 44px touch target. */
const INPUT = "input h-11 sm:h-10";

const ERROR_STRING: Record<ErrorKey, FormStringKey> = {
  required: "errRequired",
  invalidDate: "errInvalidDate",
  futureDate: "errFutureDate",
  enterSomeTime: "errEnterSomeTime",
  invalidNumber: "errInvalidNumber",
  maxHours: "errMaxHours",
  wholeNumber: "errWholeNumber",
  maxCount: "errMaxCount",
};

/** Selected-chip tones. Full class strings so Tailwind keeps them; SES/MES share the heli hue like the pills do. */
const CAT_TONE: Record<Category, string> = {
  SE: "bg-cat-se/10 text-cat-se-ink border-cat-se/40",
  ME: "bg-cat-me/10 text-cat-me-ink border-cat-me/40",
  SES: "bg-cat-heli/10 text-cat-heli-ink border-cat-heli/40",
  MES: "bg-cat-heli/15 text-cat-heli-ink border-cat-heli/50",
  HELI: "bg-cat-heli/10 text-cat-heli-ink border-cat-heli/40",
  SIM: "bg-cat-sim/10 text-cat-sim-ink border-cat-sim/40",
};
const ROLE_TONE: Record<Role, string> = {
  PIC: "bg-role-pic/10 text-role-pic-ink border-role-pic/40",
  DUAL: "bg-role-dual/10 text-role-dual-ink border-role-dual/40",
  FO: "bg-role-fo/10 text-role-fo-ink border-role-fo/40",
  SIC: "bg-role-sic/10 text-role-sic-ink border-role-sic/40",
  CHECK: "bg-role-check/10 text-role-check-ink border-role-check/40",
};

const SEG_BASE =
  "inline-flex items-center gap-1.5 h-11 sm:h-9 px-3 rounded-control border text-sm font-medium whitespace-nowrap " +
  "cursor-pointer select-none transition-[background-color,border-color,color,box-shadow] duration-fast ease-out motion-reduce:transition-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const SEG_IDLE = "border-border bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink-1";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** "# Precision Approaches" → "Precision Approaches"; the label style already sets these apart. */
const stripHash = (s: string) => s.replace(/^#\s*/, "");
/** "Single Engine Sea (SES)" → "Single Engine Sea" when the chip already shows the code. */
const stripCode = (label: string, code: string) => label.replace(new RegExp(`\\s*\\(${code}\\)$`), "");

/* ------------------------------------------------------------------------ */
/* Local today (client clock) without a hydration mismatch                   */
/* ------------------------------------------------------------------------ */

const subscribeNoop = () => () => {};
const emptyString = () => "";
function localTodayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** "" during SSR/hydration, the browser's local date afterwards. */
function useLocalToday(): string {
  return useSyncExternalStore(subscribeNoop, localTodayISO, emptyString);
}

/* ------------------------------------------------------------------------ */
/* Registration lookup state                                                 */
/* ------------------------------------------------------------------------ */

type RegMatch = NonNullable<Awaited<ReturnType<typeof lookupRegistration>>>;
type RegLookup =
  | { status: "idle" }
  | { status: "loading"; tail: string }
  | { status: "none"; tail: string }
  | { status: "found"; tail: string; model: string; category: Category; source: RegMatch["source"] };

/** Which link opened the unsaved-changes prompt; `null` = closed. */
type DiscardSource = "back" | "cancel" | null;

/* ------------------------------------------------------------------------ */
/* Form                                                                      */
/* ------------------------------------------------------------------------ */

export default function FlightForm({
  flight, locale, header,
}: {
  flight?: Flight;
  locale: Locale;
  /** The page's title block. Rendered beside the back link so both sit inside the form's unsaved-changes guard. */
  header: ReactNode;
}) {
  const t = makeT(locale);
  const s = formStrings(locale);
  const router = useRouter();
  const editing = !!flight;
  const today = useLocalToday();

  const [initial] = useState<FlightFormValues>(() => (flight ? flightToValues(flight) : blankFlightValues()));
  const [values, setValues] = useState<FlightFormValues>(initial);
  const [dateEdited, setDateEdited] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [reg, setReg] = useState<RegLookup>({ status: "idle" });
  const [discardSource, setDiscardSource] = useState<DiscardSource>(null);
  const [leaving, startLeaving] = useTransition();

  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const remarksRef = useRef<HTMLTextAreaElement>(null);
  const lookupSeq = useRef(0);
  /** Once the pilot picks a category (or we're editing) the lookup must not change it. */
  const categoryTouched = useRef(editing);
  const backRef = useRef<HTMLAnchorElement>(null);
  const cancelCardRef = useRef<HTMLAnchorElement>(null);
  const cancelBarRef = useRef<HTMLAnchorElement>(null);
  /** Set by Keep editing / Escape so the close effect knows which trigger gets focus back (auto-dismiss leaves it null). */
  const returnFocusTo = useRef<DiscardSource>(null);

  // A new flight defaults to the client's local date until the pilot touches the field.
  const effective: FlightFormValues = dateEdited || values.date ? values : { ...values, date: today };
  const errors = validateFlightValues(effective, today);
  const errorCount = Object.keys(errors).length;
  const summary = summariseFlight(effective);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const busy = saving || deleting || leaving;
  /** Something to lose: edits exist and the action hasn't redirected yet. */
  const guarded = dirty && !saved;

  const set = useCallback(<K extends keyof FlightFormValues>(k: K, v: FlightFormValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
  }, []);
  const touch = useCallback((k: string) => {
    setTouched((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
  }, []);
  const visibleError = (k: keyof FlightFormValues): string | undefined => {
    const key = errors[k];
    if (!key || !(attempted || touched.has(k))) return undefined;
    return s(ERROR_STRING[key]);
  };

  /* ---- unsaved-changes guard ---- */
  // Hard navigations / tab close: the browser's own prompt.
  useEffect(() => {
    if (!guarded) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [guarded]);

  // In-app links (header back, Cancel): a two-step inline prompt instead.
  // Once there is nothing left to lose (edits reverted, or saved) it closes
  // on its own without moving focus.
  useEffect(() => {
    if (!guarded) setDiscardSource(null);
  }, [guarded]);

  // Keep editing / Escape hand focus back to the trigger that opened the
  // prompt. Cancel remounts on close (the prompt replaces it), so this waits
  // for the commit; only the visible breakpoint's Cancel can take focus.
  useEffect(() => {
    if (discardSource) return;
    const src = returnFocusTo.current;
    returnFocusTo.current = null;
    if (src === "back") backRef.current?.focus();
    else if (src === "cancel") {
      cancelCardRef.current?.focus();
      cancelBarRef.current?.focus();
    }
  }, [discardSource]);

  /** Click handler for the guarded links: a plain click opens the prompt while there is something to lose. */
  function guardLink(source: Exclude<DiscardSource, null>) {
    return (e: ReactMouseEvent<HTMLAnchorElement>) => {
      if (!guarded) return; // nothing to lose — ordinary navigation
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab/window: leave this one alone
      e.preventDefault();
      setDiscardSource((cur) => (cur === source ? null : source));
    };
  }
  function keepEditing() {
    returnFocusTo.current = discardSource;
    setDiscardSource(null);
  }
  function confirmDiscard() {
    startLeaving(() => {
      router.push("/app/flights");
    });
  }

  /* ---- server errors: announce + focus ---- */
  useEffect(() => {
    if (serverError) errorRef.current?.focus();
  }, [serverError]);

  /* ---- remarks: auto-grow to six rows ---- */
  const growRemarks = useCallback(() => {
    const el = remarksRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 18;
    const chrome =
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const max = lineHeight * 6 + chrome;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, []);
  useLayoutEffect(() => {
    growRemarks();
  }, [growRemarks, values.remarks]);

  /* ---- registration lookup (blur) ---- */
  async function onRegistrationBlur() {
    touch("registration");
    const tail = values.registration.trim().toUpperCase();
    if (tail !== values.registration) set("registration", tail);
    if (tail.length < 3) {
      setReg({ status: "idle" });
      return;
    }
    if (reg.status !== "idle" && reg.tail === tail) return; // same tail — keep the current hint

    const seq = ++lookupSeq.current;
    setReg({ status: "loading", tail });
    let match: RegMatch | null | undefined; // undefined = lookup failed
    try {
      match = await lookupRegistration(tail);
    } catch {
      match = undefined;
    }
    if (seq !== lookupSeq.current) return; // a newer lookup superseded this one
    if (match === undefined) {
      setReg({ status: "idle" });
      return;
    }
    if (match === null) {
      setReg({ status: "none", tail });
      return;
    }
    const hit = match;
    setReg({ status: "found", tail, model: hit.make_model, category: hit.category, source: hit.source });
    // Prefill only an empty make/model — never overwrite what the pilot typed.
    setValues((prev) => {
      if (prev.make_model.trim()) return prev;
      const next = { ...prev, make_model: hit.make_model };
      if (hit.source === "history" && !categoryTouched.current) next.category = hit.category;
      return next;
    });
  }

  function applySuggestion() {
    if (reg.status !== "found") return;
    const hit = reg;
    setValues((prev) => {
      const next = { ...prev, make_model: hit.model };
      if (hit.source === "history" && !categoryTouched.current) next.category = hit.category;
      return next;
    });
  }

  function registrationHint(): ReactNode {
    switch (reg.status) {
      case "idle":
        return undefined;
      case "loading":
        return s("regLookingUp", { reg: reg.tail });
      case "none":
        return t("form.regHint.new");
      case "found": {
        const typed = values.make_model.trim();
        const differs = typed !== "" && typed !== reg.model;
        return (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-good-ink">{s("regFound", { reg: reg.tail, model: reg.model })}</span>
            <span>· {reg.source === "history" ? s("regFromLogbook") : s("regFromRegistry")}</span>
            {differs && (
              <button
                type="button"
                onClick={applySuggestion}
                className={buttonClass("ghost", "sm", "h-11 sm:h-8 text-brand-deep")}
              >
                {s("regUse", { reg: reg.tail, model: reg.model })}
              </button>
            )}
          </span>
        );
      }
    }
  }

  /* ---- approaches: total tracks precision + non-precision until overridden ---- */
  function setApproachPart(k: "precision_approaches" | "non_precision_approaches", raw: string) {
    setValues((prev) => {
      const prevSum = (parseCount(prev.precision_approaches) ?? 0) + (parseCount(prev.non_precision_approaches) ?? 0);
      const linked = (parseCount(prev.ifr_approaches) ?? 0) === prevSum;
      const next = { ...prev, [k]: raw };
      if (linked) {
        const sum = (parseCount(next.precision_approaches) ?? 0) + (parseCount(next.non_precision_approaches) ?? 0);
        next.ifr_approaches = formatCount(sum);
      }
      return next;
    });
  }

  /* ---- input prop factories ---- */
  function textInput(k: TextField) {
    return {
      className: INPUT,
      value: values[k],
      onChange: (e: ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
      onBlur: () => touch(k),
    };
  }
  function hourInput(k: HourField) {
    return {
      type: "text" as const,
      inputMode: "decimal" as const,
      autoComplete: "off",
      placeholder: "0.0",
      className: `${INPUT} num`,
      value: values[k],
      onChange: (e: ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
      onBlur: () => {
        setValues((prev) => ({ ...prev, [k]: normaliseHours(prev[k]) }));
        touch(k);
      },
    };
  }
  function countInput(k: CountField) {
    return {
      type: "text" as const,
      inputMode: "numeric" as const,
      pattern: "[0-9]*",
      autoComplete: "off",
      placeholder: "0",
      className: `${INPUT} num`,
      value: values[k],
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        k === "precision_approaches" || k === "non_precision_approaches"
          ? setApproachPart(k, e.target.value)
          : set(k, e.target.value),
      onBlur: () => {
        setValues((prev) => ({ ...prev, [k]: normaliseCount(prev[k]) }));
        touch(k);
      },
    };
  }

  /* ---- submit / delete ---- */
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setAttempted(true);
    setServerError(null);
    if (errorCount > 0) {
      // aria-invalid lands after this render; focus the first offender once it has.
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }
    const input = valuesToFlightInput(effective);
    startSaving(async () => {
      try {
        const r = flight ? await updateFlight(flight.id, input) : await createFlight(input);
        if (r?.error) setServerError(r.error);
        else setSaved(true); // the action redirects to /app/flights
      } catch {
        setServerError(s("errUnexpected"));
      }
    });
  }

  function onConfirmDelete() {
    if (!flight) return;
    setServerError(null);
    startDeleting(async () => {
      try {
        const r = await deleteFlight(flight.id);
        if (r?.error) {
          setServerError(r.error);
          setConfirmingDelete(false);
        } else {
          setSaved(true);
        }
      } catch {
        setServerError(s("errUnexpected"));
        setConfirmingDelete(false);
      }
    });
  }

  function onRemarksKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  /* ---- option sets (values identical to the previous <select>s) ---- */
  const categoryOptions: SegOption<Category>[] = [
    { value: "SE", label: t("dash.singleEngine"), tone: CAT_TONE.SE },
    { value: "ME", label: t("dash.multiEngine"), tone: CAT_TONE.ME },
    { value: "SES", label: stripCode(t("cat.ses"), "SES"), tone: CAT_TONE.SES },
    { value: "MES", label: stripCode(t("cat.mes"), "MES"), tone: CAT_TONE.MES },
    { value: "HELI", label: t("cat.heli"), tone: CAT_TONE.HELI },
    { value: "SIM", label: t("bd.sim"), tone: CAT_TONE.SIM },
  ];
  const roleOptions: SegOption<Role>[] = [
    { value: "PIC", label: t("form.pic"), tone: ROLE_TONE.PIC },
    { value: "DUAL", label: t("role.dual"), tone: ROLE_TONE.DUAL },
    { value: "FO", label: t("role.foCopilot"), tone: ROLE_TONE.FO },
    { value: "SIC", label: t("form.thirdPilot"), tone: ROLE_TONE.SIC },
    { value: "CHECK", label: t("form.checkPilot"), tone: ROLE_TONE.CHECK },
  ];
  const categoryTitle = categoryOptions.find((o) => o.value === values.category)?.label ?? values.category;
  const roleTitle = roleOptions.find((o) => o.value === values.role)?.label ?? values.role;

  const status: SummaryStatus =
    errorCount === 0
      ? { ready: true, text: s("readyToSave") }
      : { ready: false, text: errorCount === 1 ? s("needsAttentionOne") : s("needsAttention", { n: errorCount }) };
  const saveLabel = saving ? t("common.saving") : editing ? s("saveChanges") : s("saveFlight");
  const hoursUnit = t("limits.hrs");

  const deleteControl = editing ? (
    <DeleteControl
      open={confirmingDelete}
      deleting={deleting}
      disabled={saving}
      onOpen={() => setConfirmingDelete(true)}
      onCancel={() => setConfirmingDelete(false)}
      onConfirm={onConfirmDelete}
      s={s}
    />
  ) : null;

  const discardPrompt = (layout: "stack" | "row") => (
    <DiscardPrompt layout={layout} leaving={leaving} onConfirm={confirmDiscard} onCancel={keepEditing} s={s} />
  );

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Header: guarded back link + the page's title block                */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-start gap-2">
        <Link
          ref={backRef}
          href="/app/flights"
          aria-label={s("backToFlights")}
          title={s("backToFlights")}
          aria-expanded={guarded ? discardSource === "back" : undefined}
          onClick={guardLink("back")}
          className={buttonClass("ghost", "md", "btn-icon h-11 w-11 sm:h-9 sm:w-9 shrink-0 -ml-2 text-ink-2 hover:text-ink-1")}
        >
          <Icon.ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
        </Link>
        {header}
      </div>
      {discardSource === "back" && discardPrompt("stack")}

    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-busy={busy || undefined}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
    >
      {/* ---------------------------------------------------------------- */}
      {/* Left: stacked cards                                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="min-w-0 space-y-4">
        {serverError && (
          <div
            ref={errorRef}
            tabIndex={-1}
            className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <Alert variant="bad">{serverError}</Alert>
          </div>
        )}

        {/* Flight */}
        <Card>
          <CardHeader title={t("form.section.flight")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("flights.date")} required error={visibleError("date")}>
              <input
                type="date"
                className={`${INPUT} num`}
                value={effective.date}
                max={today || undefined}
                onChange={(e) => {
                  setDateEdited(true);
                  set("date", e.target.value);
                }}
                onBlur={() => touch("date")}
              />
            </Field>
            <Field label={t("form.registration")} hint={registrationHint()}>
              <input
                className={`${INPUT} mono uppercase`}
                value={values.registration}
                placeholder="C-GXBG"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => {
                  set("registration", e.target.value);
                  if (reg.status !== "idle") setReg({ status: "idle" });
                }}
                onBlur={onRegistrationBlur}
              />
            </Field>
            <Field label={t("form.makeModel")} required error={visibleError("make_model")}>
              <input {...textInput("make_model")} placeholder="Cessna 172" autoComplete="off" />
            </Field>
            <Field label={t("flights.route")} hint={s("hintRoute")}>
              <input
                className={`${INPUT} mono`}
                value={values.route}
                placeholder="CYVR-CYYZ"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => set("route", e.target.value)}
                onBlur={() => {
                  setValues((prev) => ({ ...prev, route: prev.route.trim().toUpperCase() }));
                  touch("route");
                }}
              />
            </Field>
          </div>
        </Card>

        {/* Crew */}
        <Card>
          <CardHeader title={s("sectionCrew")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("form.pic")}><input {...textInput("pic")} /></Field>
            <Field label={t("form.copilot")}><input {...textInput("copilot")} /></Field>
            <Field label={t("form.thirdPilot")}><input {...textInput("third_pilot")} /></Field>
            <Field label={t("form.checkPilot")}><input {...textInput("check_pilot")} /></Field>
            <Field label={t("form.role")} required composite className="sm:col-span-2" error={visibleError("role")}>
              <Segmented
                options={roleOptions}
                value={values.role}
                onChange={(v) => set("role", v)}
              />
            </Field>
          </div>
        </Card>

        {/* Time */}
        <Card>
          <CardHeader title={t("form.section.time")} meta={s("timeMeta")} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label={t("form.category")} required composite className="col-span-2 sm:col-span-3" error={visibleError("category")}>
              <Segmented
                options={categoryOptions}
                value={values.category}
                onChange={(v) => {
                  categoryTouched.current = true;
                  set("category", v);
                }}
              />
            </Field>
            <Field label={t("form.dayTime")} error={visibleError("day_time")}>
              <input {...hourInput("day_time")} />
            </Field>
            <Field label={t("form.nightTime")} error={visibleError("night_time")}>
              <input {...hourInput("night_time")} />
            </Field>
            <Field label={t("form.xc")} className="col-span-2 sm:col-span-1">
              <Switch checked={values.is_xcountry} onChange={(v) => set("is_xcountry", v)}>
                {t("form.xcCheck")}
              </Switch>
            </Field>
            <Field label={t("form.dutyTime")} error={visibleError("duty_time")}>
              <input {...hourInput("duty_time")} />
            </Field>
            <Field label={t("form.cfiTime")} error={visibleError("cfi_time")}>
              <input {...hourInput("cfi_time")} />
            </Field>
          </div>
        </Card>

        {/* Instrument & approaches */}
        <Card>
          <CardHeader title={t("form.section.inst")} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label={t("bd.actual")} error={visibleError("actual_inst")}>
              <input {...hourInput("actual_inst")} />
            </Field>
            <Field
              label={t("bd.hood")}
              error={visibleError("hood_inst")}
              hint={summary.instrumentExceeds ? <span className="text-warn-ink">{s("warnInstrument")}</span> : undefined}
            >
              <input {...hourInput("hood_inst")} />
            </Field>
            <Field label={t("bd.sim")} error={visibleError("sim_inst")}>
              <input {...hourInput("sim_inst")} />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label={t("bd.approaches")} hint={s("hintApproaches")} error={visibleError("ifr_approaches")}>
              <input {...countInput("ifr_approaches")} />
            </Field>
            <Field label={stripHash(t("form.precApproaches"))} error={visibleError("precision_approaches")}>
              <input {...countInput("precision_approaches")} />
            </Field>
            <Field label={stripHash(t("form.nonPrecApproaches"))} error={visibleError("non_precision_approaches")}>
              <input {...countInput("non_precision_approaches")} />
            </Field>
            <Field label={t("form.holds")} error={visibleError("holds")}>
              <input {...countInput("holds")} />
            </Field>
          </div>
        </Card>

        {/* Takeoffs & landings */}
        <Card>
          <CardHeader title={t("form.section.tol")} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label={s("takeoffsDay")} error={visibleError("takeoffs_day")}>
              <input {...countInput("takeoffs_day")} />
            </Field>
            <Field label={s("takeoffsNight")} error={visibleError("takeoffs_night")}>
              <input {...countInput("takeoffs_night")} />
            </Field>
            <Field label={s("landingsDay")} error={visibleError("landings_day")}>
              <input {...countInput("landings_day")} />
            </Field>
            <Field label={s("landingsNight")} error={visibleError("landings_night")}>
              <input {...countInput("landings_night")} />
            </Field>
          </div>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader title={t("form.remarks")} />
          <Field label={<span className="sr-only">{t("form.remarks")}</span>} hint={s("hintRemarks")}>
            <textarea
              ref={remarksRef}
              rows={2}
              className="input resize-none"
              value={values.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              onBlur={() => touch("remarks")}
              onKeyDown={onRemarksKeyDown}
            />
          </Field>
        </Card>

        {/* Delete lives in the summary footer on lg+; below that it sits here. */}
        {deleteControl && <div className="lg:hidden">{deleteControl}</div>}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Right: sticky live summary (lg+)                                  */}
      {/* ---------------------------------------------------------------- */}
      <aside className="hidden lg:block lg:sticky lg:top-[calc(4rem+1rem)]">
        <FlightSummaryCard
          summary={summary}
          category={values.category}
          role={values.role}
          categoryTitle={categoryTitle}
          roleTitle={roleTitle}
          status={status}
          strings={{
            title: s("summaryTitle"),
            totalTime: s("totalTime"),
            unit: hoursUnit,
            night: t("flights.night"),
            instrument: s("statInstrument"),
            approaches: t("bd.approaches"),
            xc: t("form.xc"),
            xcShort: s("xcShort"),
            yes: s("yes"),
            no: s("no"),
          }}
          actions={
            <>
              <Button type="submit" variant="primary" loading={saving} disabled={deleting || leaving} className="w-full">
                {saveLabel}
              </Button>
              {discardSource === "cancel" ? (
                discardPrompt("stack")
              ) : (
                <Link
                  ref={cancelCardRef}
                  href="/app/flights"
                  onClick={guardLink("cancel")}
                  className={buttonClass("ghost", "md", "w-full")}
                >
                  {t("common.cancel")}
                </Link>
              )}
            </>
          }
          footer={deleteControl ?? undefined}
        />
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* Below lg: sticky bottom action bar                                */}
      {/* ---------------------------------------------------------------- */}
      <FlightActionBar
        className="lg:hidden"
        total={summary.total}
        unit={hoursUnit}
        totalLabel={s("totalTime")}
        status={status}
        prompt={discardSource === "cancel" ? discardPrompt("row") : undefined}
      >
        <Link ref={cancelBarRef} href="/app/flights" onClick={guardLink("cancel")} className={buttonClass("ghost", "md", "h-11")}>
          {t("common.cancel")}
        </Link>
        <Button type="submit" variant="primary" loading={saving} disabled={deleting || leaving} className="h-11">
          {saveLabel}
        </Button>
      </FlightActionBar>
    </form>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Segmented radio group                                                     */
/* ------------------------------------------------------------------------ */

type SegOption<T extends string> = { value: T; label: string; tone: string };

/**
 * Pill-styled radiogroup with roving tabindex: Tab lands on the checked
 * option, arrows move + select, Home/End jump. `Field` (with `composite`)
 * injects id, aria-labelledby, aria-describedby, aria-invalid and required
 * via cloneElement — a radiogroup div isn't labelable, so htmlFor would be inert.
 */
function Segmented<T extends string>({
  id, options, value, onChange, required,
  "aria-labelledby": labelledBy, "aria-describedby": describedBy, "aria-invalid": invalid,
}: {
  id?: string;
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  required?: boolean;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      aria-required={required || undefined}
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        const showLabel = o.label.toUpperCase() !== o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            title={showLabel ? o.label : undefined}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onClick={() => onChange(o.value)}
            className={`${SEG_BASE} ${checked ? `${o.tone} font-semibold shadow-sm` : SEG_IDLE}`}
          >
            {checked && <Icon.Check size={14} strokeWidth={2.5} aria-hidden className="shrink-0" />}
            <span>{o.value}</span>
            {showLabel && <span className="hidden sm:inline text-xs font-normal text-ink-3">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Switch (cross-country)                                                    */
/* ------------------------------------------------------------------------ */

function Switch({
  id, checked, onChange, children, "aria-describedby": describedBy,
}: {
  id?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  "aria-describedby"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-11 sm:h-10 max-w-full items-center gap-3 rounded-control -mx-1 px-1 text-left text-sm text-ink-1 cursor-pointer select-none ${FOCUS_RING}`}
    >
      <span
        aria-hidden
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-fast ease-out motion-reduce:transition-none ${
          checked ? "bg-brand border-brand" : "bg-surface-2 border-border-strong"
        }`}
      >
        <span
          className={`absolute left-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform duration-fast ease-out motion-reduce:transition-none ${
            checked ? "translate-x-3.5" : ""
          }`}
        />
      </span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Two-step delete                                                           */
/* ------------------------------------------------------------------------ */

function DeleteControl({
  open, deleting, disabled, onOpen, onCancel, onConfirm, s,
}: {
  open: boolean;
  deleting: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  s: FormT;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);

  // Opening focuses the safe option; closing returns focus to the trigger.
  // (Two instances render — one per breakpoint — but only the visible one can take focus.)
  useEffect(() => {
    if (open && !wasOpen.current) keepRef.current?.focus();
    if (!open && wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className={buttonClass("ghost", "md", "h-11 sm:h-10 text-bad-ink hover:bg-bad/10 hover:text-bad-ink")}
      >
        {s("deleteFlight")}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={s("deleteQuestion")}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !deleting) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      className="w-full rounded-control border border-bad/30 bg-bad/5 p-3"
    >
      <p className="text-sm font-semibold text-ink-1">{s("deleteQuestion")}</p>
      <p className="mt-0.5 text-xs text-ink-2">{s("deleteHelp")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="danger" size="sm" className="h-11 sm:h-8" loading={deleting} onClick={onConfirm}>
          {deleting ? s("deleting") : s("confirmDelete")}
        </Button>
        <button
          ref={keepRef}
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className={buttonClass("ghost", "sm", "h-11 sm:h-8")}
        >
          {s("keep")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Two-step discard (unsaved changes)                                        */
/* ------------------------------------------------------------------------ */

/**
 * Inline "Discard unsaved changes?" note — the open state of DeleteControl,
 * reused for Cancel and the header back link. The form owns open/closed and
 * focus return; this focuses the safe option on mount and turns Escape into
 * Keep editing. `row` is the compact one-line variant that takes over the
 * phone action bar; `stack` is the boxed note used in the summary card and
 * under the header. (Two `cancel` instances render — one per breakpoint —
 * but only the visible one can take focus.)
 */
function DiscardPrompt({
  layout, leaving, onConfirm, onCancel, s,
}: {
  layout: "stack" | "row";
  leaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  s: FormT;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keepRef.current?.focus();
  }, []);

  const row = layout === "row";
  const size = row ? "md" : "sm";
  const height = row ? "h-11" : "h-11 sm:h-8";

  return (
    <div
      role="group"
      aria-label={s("discardQuestion")}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !leaving) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      className={
        row
          ? "flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
          : "w-full rounded-control border border-warn/30 bg-warn/5 p-3"
      }
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-1">
          <Icon.TriangleAlert size={14} strokeWidth={2} aria-hidden className="shrink-0 text-warn-ink" />
          <span>{s("discardQuestion")}</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-2">{s("discardHelp")}</p>
      </div>
      <div className={row ? "flex items-center gap-2 shrink-0" : "mt-3 flex flex-wrap items-center gap-2"}>
        <Button variant="danger" size={size} className={height} loading={leaving} onClick={onConfirm}>
          {leaving ? s("discarding") : s("discard")}
        </Button>
        <button
          ref={keepRef}
          type="button"
          onClick={onCancel}
          disabled={leaving}
          className={buttonClass("ghost", size, height)}
        >
          {s("keepEditing")}
        </button>
      </div>
    </div>
  );
}
