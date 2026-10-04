"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { useFormStatus } from "react-dom";
import type { Locale } from "@/lib/i18n";
import { adminStrings } from "./admin-strings";
import { resolveSupport, reopenSupport, deleteSupport } from "./actions";

/**
 * Row actions for the admin support inbox, split into a client island so:
 *  - Delete requires an explicit two-tap confirm (a mis-tap on a phone would
 *    otherwise permanently delete a pilot's request), and
 *  - every control gets a 44px touch target.
 * Resolve / Reopen stay one-tap actions (both are reversible).
 *
 * Keyboard: arming Delete moves focus to Cancel (the safe choice, as in the
 * danger ConfirmDialog); Cancel or Escape disarms and returns focus to
 * Delete. Submit buttons disable while their action is in flight so a double
 * tap can't send it twice.
 */
const BTN =
  "inline-flex items-center justify-center min-h-[44px] px-2 rounded-control text-xs font-medium cursor-pointer whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:cursor-wait disabled:opacity-60";

function SubmitButton({ className, describedBy, children }: {
  className: string;
  describedBy?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-describedby={describedBy}
      className={`${BTN} ${className}`}
    >
      {children}
    </button>
  );
}

function IdForm({ action, id, children }: {
  action: (formData: FormData) => Promise<void>;
  id: number;
  children: ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {children}
    </form>
  );
}

export default function SupportRowActions({
  id, resolved, locale, describedBy,
}: {
  id: number;
  resolved: boolean;
  locale: Locale;
  /** Id of the row's subject, so each button announces which request it acts on. */
  describedBy?: string;
}) {
  const s = adminStrings(locale);
  const [armed, setArmed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (armed) {
      cancelRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      deleteRef.current?.focus();
    }
  }, [armed]);

  function disarm() {
    restoreFocus.current = true;
    setArmed(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (armed && e.key === "Escape") {
      e.preventDefault();
      disarm();
    }
  }

  return (
    <div className="shrink-0 flex flex-col items-end gap-0.5" onKeyDown={onKeyDown}>
      {resolved ? (
        <IdForm action={reopenSupport} id={id}>
          <SubmitButton className="text-brand-deep hover:underline" describedBy={describedBy}>
            {s("supportReopen")}
          </SubmitButton>
        </IdForm>
      ) : (
        <IdForm action={resolveSupport} id={id}>
          <SubmitButton className="text-brand-deep hover:underline" describedBy={describedBy}>
            {s("supportResolve")}
          </SubmitButton>
        </IdForm>
      )}

      {armed ? (
        <>
          <IdForm action={deleteSupport} id={id}>
            <SubmitButton className="text-bad-ink font-semibold hover:underline" describedBy={describedBy}>
              {s("supportConfirmDelete")}
            </SubmitButton>
          </IdForm>
          <PlainButton buttonRef={cancelRef} onClick={disarm} className="text-ink-3 hover:text-ink-1">
            {s("cancel")}
          </PlainButton>
        </>
      ) : (
        <PlainButton
          buttonRef={deleteRef}
          onClick={() => setArmed(true)}
          className="text-ink-3 hover:text-bad-ink"
          describedBy={describedBy}
        >
          {s("supportDelete")}
        </PlainButton>
      )}
    </div>
  );
}

function PlainButton({ buttonRef, onClick, className, describedBy, children }: {
  buttonRef: Ref<HTMLButtonElement>;
  onClick: () => void;
  className: string;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-describedby={describedBy}
      className={`${BTN} ${className}`}
    >
      {children}
    </button>
  );
}
