import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { isListArchived } from "@/lib/list/list-visibility";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

// A List Member, Lead, or the Workspace Owner, with write access to the
// Item can attach a file to it (#39). This module only ever handles
// metadata + storageKey — the actual upload transport lives in the Route
// Handler that calls createAttachment once the bytes are already in
// S3-compatible storage (ADR 0002).
const REQUIRED_ACCESS_LEVEL = "WRITE";

// ZIP, images, PDFs, and common office documents (#40's storage decision);
// no preview rendering or malware scanning, so the allowlist is the only
// gate against arbitrary file types.
export const ALLOWED_ATTACHMENT_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
]);

export const MAX_ATTACHMENT_SIZE_BYTES = 1024 * 1024 * 1024;

// Shared by the Item detail page and Files view so file sizes read the
// same way in both places. Pure — unit tested directly without a database.
export function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ValidateAttachmentUploadResult =
  | { status: "ok" }
  | { status: "type-not-allowed" }
  | { status: "too-large" };

// Pure — unit tested directly without a database.
export function validateAttachmentUpload(input: {
  contentType: string;
  sizeBytes: number;
}): ValidateAttachmentUploadResult {
  if (!ALLOWED_ATTACHMENT_CONTENT_TYPES.has(input.contentType)) {
    return { status: "type-not-allowed" };
  }
  if (input.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    return { status: "too-large" };
  }
  return { status: "ok" };
}

export type AuthorizeAttachmentUploadResult =
  | { status: "ok" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

// Checked by the Route Handler before it uploads any bytes to storage —
// uploading first and authorizing second would let an unauthorized caller
// write objects into private storage that the metadata write then simply
// discards, leaking storage writes past the Item's access boundary (ADR
// 0002: "Attachment access must be mediated by Workspace and Item
// permissions").
export async function authorizeAttachmentUpload(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string }
): Promise<AuthorizeAttachmentUploadResult> {
  const item = await database.item.findUnique({
    where: { id: input.itemId },
    include: { list: { select: { archivedAt: true } } },
  });
  if (!item) {
    return { status: "item-not-found" };
  }

  if (isListArchived(item.list)) {
    return { status: "list-archived" };
  }

  const access = await resolveItemAccess(database, { userId: input.actorUserId, itemId: input.itemId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  return { status: "ok" };
}

export type CreateAttachmentResult =
  | { status: "created"; attachmentId: string }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "type-not-allowed" }
  | { status: "too-large" }
  | { status: "list-archived" };

export async function createAttachment(
  database: PrismaClient,
  input: {
    actorUserId: string;
    itemId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
  }
): Promise<CreateAttachmentResult> {
  const { actorUserId, itemId, fileName, contentType, sizeBytes, storageKey } = input;

  const authorization = await authorizeAttachmentUpload(database, { actorUserId, itemId });
  if (authorization.status !== "ok") {
    return authorization;
  }

  const validation = validateAttachmentUpload({ contentType, sizeBytes });
  if (validation.status !== "ok") {
    return validation;
  }

  const attachmentId = randomUUID();
  await database.attachment.create({
    data: {
      id: attachmentId,
      itemId,
      uploaderId: actorUserId,
      fileName,
      contentType,
      sizeBytes,
      storageKey,
    },
  });

  return { status: "created", attachmentId };
}

export type GetAttachmentForDownloadResult =
  | { status: "ok"; storageKey: string; fileName: string; contentType: string }
  | { status: "not-found" }
  | { status: "forbidden" };

// Downloading only requires read access to the owning Item — the same
// threshold that gates seeing the Item detail surface at all, not the
// WRITE threshold createAttachment requires.
export async function getAttachmentForDownload(
  database: PrismaClient,
  input: { actorUserId: string; attachmentId: string }
): Promise<GetAttachmentForDownloadResult> {
  const attachment = await database.attachment.findUnique({ where: { id: input.attachmentId } });
  if (!attachment) {
    return { status: "not-found" };
  }

  const access = await resolveItemAccess(database, { userId: input.actorUserId, itemId: attachment.itemId });
  if (!meetsListAccessLevel(access, "READ")) {
    return { status: "forbidden" };
  }

  return {
    status: "ok",
    storageKey: attachment.storageKey,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
  };
}
