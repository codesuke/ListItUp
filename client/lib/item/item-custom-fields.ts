import { randomUUID } from "node:crypto";

import type { CustomFieldType, PrismaClient } from "@/generated/prisma/client";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

export type SetCustomFieldValueResult =
  | { status: "set" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "definition-not-found" }
  | { status: "definition-not-in-list" }
  | { status: "invalid-value" };

// Any List Member, Lead, or the Workspace Owner, with Item access can set
// a Custom Field's value — defining the field itself is Lead-only
// (lib/list/list-custom-fields.ts), but setting a value is not (#34).
const REQUIRED_ACCESS_LEVEL = "WRITE";

// Pure — unit tested directly without a database.
export function isValidCustomFieldValue(type: CustomFieldType, value: string, options: string[]): boolean {
  if (type === "NUMBER") {
    return value.trim() !== "" && !Number.isNaN(Number(value));
  }
  if (type === "DATE") {
    return !Number.isNaN(Date.parse(value));
  }
  if (type === "DROPDOWN") {
    return options.includes(value);
  }
  return true; // TEXT accepts any string.
}

export async function setCustomFieldValue(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; definitionId: string; value: string }
): Promise<SetCustomFieldValueResult> {
  const { actorUserId, itemId, definitionId, value } = input;

  const item = await database.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return { status: "item-not-found" };
  }

  const access = await resolveItemAccess(database, { userId: actorUserId, itemId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const definition = await database.customFieldDefinition.findUnique({ where: { id: definitionId } });
  if (!definition) {
    return { status: "definition-not-found" };
  }
  if (definition.listId !== item.listId) {
    return { status: "definition-not-in-list" };
  }

  if (!isValidCustomFieldValue(definition.type, value, definition.options)) {
    return { status: "invalid-value" };
  }

  await database.customFieldValue.upsert({
    where: { itemId_definitionId: { itemId, definitionId } },
    create: { id: randomUUID(), itemId, definitionId, value },
    update: { value },
  });

  return { status: "set" };
}
