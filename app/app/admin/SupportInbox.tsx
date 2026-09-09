import { Card, CardHeader, Pill } from "@/components/ui";
import { resolveSupport, deleteSupport } from "./actions";

export type SupportRow = {
  id: number;
  email: string | null;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
};

/**
 * Admin support inbox — every message from the in-app Support form, newest
 * first, with the sender's email as a mailto so you can reply directly, and a
 * one-click Resolve. Server-rendered; the service-role read happens in the page.
 */
export default function SupportInbox({ requests, locale }: { requests: SupportRow[]; locale: string }) {
  const open = requests.filter((r) => r.status !== "resolved").length;
  return (
    <div className="mt-6">
      <Card padding="md">
        <CardHeader title="Support inbox" meta={`${open} open · ${requests.length} total`} />
        {requests.length === 0 ? (
          <p className="text-sm text-ink-3">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-ink-1">{r.subject || "(no subject)"}</span>
                      {r.status === "resolved"
                        ? <Pill variant="neutral">resolved</Pill>
                        : <Pill variant="warn">open</Pill>}
                    </div>
                    <p className="mt-1 text-sm text-ink-2 whitespace-pre-wrap break-words">{r.message}</p>
                    <p className="mt-1 text-2xs text-ink-3">
                      {r.email
                        ? <a className="text-brand hover:underline" href={`mailto:${r.email}?subject=Re: ${encodeURIComponent(r.subject || "your message")}`}>{r.email}</a>
                        : "unknown sender"}
                      {" · "}
                      {new Date(r.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {r.status !== "resolved" && (
                      <form action={resolveSupport}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-xs font-medium text-brand hover:underline whitespace-nowrap">
                          Resolve
                        </button>
                      </form>
                    )}
                    <form action={deleteSupport}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-xs text-ink-3 hover:text-bad-ink hover:underline whitespace-nowrap">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
