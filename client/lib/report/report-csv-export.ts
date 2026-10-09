import type { PrismaClient } from "@/generated/prisma/client";

import { buildExportFilename, buildListExport, loadRawExportSource, serializeListCsv } from "./list-csv-export";
import { buildReportItemWhere } from "./report-filter";
import { getReport } from "./report-crud";

export type ReportCsvExportResult =
  | { status: "not-found" }
  | { status: "ok"; filename: string; body: string };

// A Report's CSV export (#47, ADR 0012's addendum): the same serializer the
// whole-List export (#72) uses, fed the Report's live-filtered Item set
// instead of every Item on the List. Only the Report's creator may export
// it — same private-by-default gate getReport already enforces, so a
// Report belonging to someone else, or one whose List access has lapsed,
// reports not-found rather than leaking that it exists.
export async function exportReportCsv(
  database: PrismaClient,
  input: { actorUserId: string; reportId: string; now?: Date }
): Promise<ReportCsvExportResult> {
  const { actorUserId, reportId, now = new Date() } = input;

  const report = await getReport(database, { actorUserId, reportId });
  if (!report) {
    return { status: "not-found" };
  }

  const itemsWhere = buildReportItemWhere(report.listId, report.filter);
  const listExport = buildListExport(await loadRawExportSource(database, report.listId, itemsWhere));

  return {
    status: "ok",
    filename: buildExportFilename(report.name, now),
    body: serializeListCsv(listExport),
  };
}
