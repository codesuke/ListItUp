import { randomUUID } from "node:crypto";

import type { ItemPriority, ItemState, PrismaClient } from "@/generated/prisma/client";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

import {
  buildReportItemWhere,
  toReportFilter,
  validateReportFilter,
  validateReportName,
  type ReportFilter,
} from "./report-filter";

// Saving/reopening a Report is read-shaped — it never restructures the
// List for anyone else — so any List Member, including a Viewer, may
// create, rename, delete, or run their own Report (#45).
const REQUIRED_ACCESS_LEVEL = "READ";

export type ReportSummary = {
  id: string;
  listId: string;
  name: string;
  filter: ReportFilter;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateReportResult =
  | { status: "created"; reportId: string }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "invalid-name"; reason: string }
  | { status: "invalid-filter"; reason: string };

export async function createReport(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; name: string; filter: unknown }
): Promise<CreateReportResult> {
  const { actorUserId, listId } = input;

  const nameValidation = validateReportName(input.name);
  if (!nameValidation.valid) {
    return { status: "invalid-name", reason: nameValidation.reason };
  }

  const filterValidation = validateReportFilter(input.filter);
  if (!filterValidation.valid) {
    return { status: "invalid-filter", reason: filterValidation.reason };
  }

  const list = await database.list.findUnique({ where: { id: listId }, select: { id: true } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const reportId = randomUUID();
  await database.report.create({
    data: {
      id: reportId,
      listId,
      creatorId: actorUserId,
      name: nameValidation.name,
      filter: filterValidation.filter,
    },
  });

  return { status: "created", reportId };
}

// Shared ownership + live-access gate for every Report read/mutation below.
// A Report belonging to another User, or one whose creator has since lost
// List access, resolves the same as a nonexistent Report (#45's
// private-to-creator default, matching #107/ADR 0021's read-time re-check
// pattern) — it never distinguishes "exists but not yours" from "doesn't
// exist".
async function loadOwnReport(
  database: PrismaClient,
  input: { actorUserId: string; reportId: string }
): Promise<{ id: string; listId: string; name: string; filter: unknown; createdAt: Date; updatedAt: Date } | null> {
  const report = await database.report.findUnique({ where: { id: input.reportId } });
  if (!report || report.creatorId !== input.actorUserId) {
    return null;
  }

  const access = await resolveListAccess(database, { userId: input.actorUserId, listId: report.listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return null;
  }

  return report;
}

export type RenameReportResult =
  | { status: "renamed" }
  | { status: "not-found" }
  | { status: "invalid-name"; reason: string };

export async function renameReport(
  database: PrismaClient,
  input: { actorUserId: string; reportId: string; name: string }
): Promise<RenameReportResult> {
  const nameValidation = validateReportName(input.name);
  if (!nameValidation.valid) {
    return { status: "invalid-name", reason: nameValidation.reason };
  }

  const report = await loadOwnReport(database, input);
  if (!report) {
    return { status: "not-found" };
  }

  await database.report.update({ where: { id: report.id }, data: { name: nameValidation.name } });
  return { status: "renamed" };
}

export type DeleteReportResult = { status: "deleted" } | { status: "not-found" };

export async function deleteReport(
  database: PrismaClient,
  input: { actorUserId: string; reportId: string }
): Promise<DeleteReportResult> {
  const report = await loadOwnReport(database, input);
  if (!report) {
    return { status: "not-found" };
  }

  await database.report.delete({ where: { id: report.id } });
  return { status: "deleted" };
}

export async function getReport(
  database: PrismaClient,
  input: { actorUserId: string; reportId: string }
): Promise<ReportSummary | null> {
  const report = await loadOwnReport(database, input);
  if (!report) {
    return null;
  }

  return {
    id: report.id,
    listId: report.listId,
    name: report.name,
    filter: toReportFilter(report.filter),
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

// Private to the creator by default (#45) — never lists another Member's
// Reports, even to a List Lead or the Workspace Owner.
export async function listReportsForUser(
  database: PrismaClient,
  input: { actorUserId: string; listId: string }
): Promise<ReportSummary[]> {
  const { actorUserId, listId } = input;

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return [];
  }

  const reports = await database.report.findMany({
    where: { listId, creatorId: actorUserId },
    orderBy: { updatedAt: "desc" },
  });

  return reports.map((report) => ({
    id: report.id,
    listId: report.listId,
    name: report.name,
    filter: toReportFilter(report.filter),
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  }));
}

export type ReportResultItem = {
  id: string;
  title: string;
  state: ItemState;
  priority: ItemPriority;
  dueDate: Date | null;
  assigneeNames: string[];
};

export type RunReportResult =
  | { status: "not-found" }
  | { status: "ok"; listId: string; items: ReportResultItem[] };

// Re-executes a saved Report's filter against current Item data — never a
// stored/stale result set (ADR 0012, #45). Called both when a User opens a
// saved Report and, with the same filter, when exporting it as CSV (#47).
export async function runReport(
  database: PrismaClient,
  input: { actorUserId: string; reportId: string }
): Promise<RunReportResult> {
  const report = await getReport(database, input);
  if (!report) {
    return { status: "not-found" };
  }

  const items = await database.item.findMany({
    where: buildReportItemWhere(report.listId, report.filter),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      state: true,
      priority: true,
      dueDate: true,
      assignees: { select: { user: { select: { name: true } } } },
    },
  });

  return {
    status: "ok",
    listId: report.listId,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      state: item.state,
      priority: item.priority,
      dueDate: item.dueDate,
      assigneeNames: item.assignees.map(({ user }) => user.name),
    })),
  };
}
