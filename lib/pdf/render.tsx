/**
 * Server-side PDF rendering. The only place LogbookPDF is turned into bytes;
 * reached solely from app/api/export/pdf/route.ts, after the entitlement
 * check. Next keeps @react-pdf/renderer external on the server (it is on
 * Next's built-in serverExternalPackages list), so it runs from node_modules.
 */
import "server-only";
import type { ComponentProps } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { LogbookPDF } from "./LogbookPDF";

export function renderLogbookPdf(props: ComponentProps<typeof LogbookPDF>): Promise<Buffer> {
  return renderToBuffer(<LogbookPDF {...props} />);
}
