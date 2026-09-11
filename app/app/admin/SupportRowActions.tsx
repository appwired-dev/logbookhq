"use client";

import { useState } from "react";
import { resolveSupport, deleteSupport } from "./actions";

/**
 * Row actions for the admin support inbox, split into a client island so:
 *  - Delete requires an explicit two-tap confirm (a mis-tap on a phone would
 *    otherwise permanently delete a pilot's request), and
 *  - both controls get a 44px touch target.
 * Resolve stays a one-tap action.
 */
const BTN =
  "inline-flex items-center justify-center min-h-[44px] px-2 rounded-control text-xs font-medium cursor-pointer whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50";

export default function SupportRowActions({ id, resolved }: { id: number; resolved: boolean }) {
  const [armed, setArmed] = useState(false);

  return (
    <div className="shrink-0 flex flex-col items-end gap-0.5">
      {!resolved && (
        <form action={resolveSupport}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={`${BTN} text-brand hover:underline`}>Resolve</button>
        </form>
      )}

      {armed ? (
        <>
          <form action={deleteSupport}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className={`${BTN} text-bad-ink font-semibold hover:underline`}>Confirm delete</button>
          </form>
          <button type="button" onClick={() => setArmed(false)} className={`${BTN} text-ink-3 hover:text-ink-1`}>Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setArmed(true)} className={`${BTN} text-ink-3 hover:text-bad-ink`}>Delete</button>
      )}
    </div>
  );
}
