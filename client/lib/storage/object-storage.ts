import "server-only";

import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// The upload transport for Attachments (#39): private S3-compatible object
// storage, initially MinIO (ADR 0002). Configured entirely from env so the
// same code targets a local MinIO in dev and a hosted S3-compatible bucket
// in production.
function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

let cachedClient: S3Client | null = null;

function getObjectStorageClient(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      endpoint: readRequiredEnv("OBJECT_STORAGE_ENDPOINT"),
      region: process.env.OBJECT_STORAGE_REGION || "us-east-1",
      forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: readRequiredEnv("OBJECT_STORAGE_ACCESS_KEY_ID"),
        secretAccessKey: readRequiredEnv("OBJECT_STORAGE_SECRET_ACCESS_KEY"),
      },
    });
  }
  return cachedClient;
}

// The original file name is untrusted input — strip path separators and
// control characters so it can't reshape the storage key's path, and cap
// its length well under S3's 1024-byte key limit.
const UNSAFE_KEY_CHARACTERS = /[\\/\x00-\x1f]+/g;
const MAX_KEY_FILENAME_LENGTH = 200;

// A storage key scoped under the owning Item, with a random component so
// two Attachments with the same original file name never collide.
export function buildAttachmentStorageKey(itemId: string, fileName: string): string {
  const safeFileName = fileName.replaceAll(UNSAFE_KEY_CHARACTERS, "_").slice(0, MAX_KEY_FILENAME_LENGTH);
  return `items/${itemId}/${randomUUID()}-${safeFileName}`;
}

export async function uploadAttachmentObject(input: {
  storageKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const bucket = readRequiredEnv("OBJECT_STORAGE_BUCKET");
  await getObjectStorageClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.contentType,
    })
  );
}

// Removes a stored Attachment object (#79's Workspace purge) — the DB
// cascade that hard-deletes a Workspace's Attachment rows never touches
// the object itself, so the purge job must call this for each one first.
export async function deleteAttachmentObject(storageKey: string): Promise<void> {
  const bucket = readRequiredEnv("OBJECT_STORAGE_BUCKET");
  await getObjectStorageClient().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })
  );
}

const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

// Issues time-limited download access to a private object (ADR 0002) —
// the app itself remains the authority on whether the caller may have
// this URL at all; lib/item/ enforces that before this is ever called.
export async function getAttachmentDownloadUrl(storageKey: string): Promise<string> {
  const bucket = readRequiredEnv("OBJECT_STORAGE_BUCKET");
  return getSignedUrl(
    getObjectStorageClient(),
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
}
