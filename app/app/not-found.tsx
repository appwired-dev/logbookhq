import Link from "next/link";
import { EmptyState, Icon, buttonClass } from "@/components/ui";

/**
 * App-scoped 404 — renders inside the app shell (header + nav) so a bad flight
 * id or unknown /app path stays in the product instead of bouncing to the
 * marketing 404.
 */
export default function AppNotFound() {
  return (
    <div className="py-8 sm:py-12">
      <EmptyState
        icon={Icon.Search}
        headingLevel={1}
        title="Not found"
        body="That page or flight doesn't exist, or it isn't in your logbook."
        primary={
          <Link className={buttonClass("primary")} href="/app/flights">
            Back to flights
          </Link>
        }
        secondary={
          <Link className={buttonClass("ghost")} href="/app">
            Dashboard
          </Link>
        }
      />
    </div>
  );
}
