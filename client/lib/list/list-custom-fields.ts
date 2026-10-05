import { randomUUID } from "node:crypto";

import type { CustomFieldType, PrismaClient } from "@/generated/prisma/client";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

export type CreateCustomFieldDefinitionResult =
  | { status: "created"; definitionId: string }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "duplicate-name" }
  | { status: "invalid-type" }
  | { status: "dropdown-requires-options" };

export type UpdateCustomFieldDefinitionResult =
  | { status: "updated" }
  | { status: "definition-not-found" }
  | { status: "forbidden" }
  | { status: "dropdown-requires-options" };

// A List Lead or the Workspace Owner (implicit Lead-equivalent access) can
// define/update Custom Fields on a List (#34). A Workspace Admin has no
// implicit access (ADR 0016) unless explicitly given a List role.
const REQUIRED_ACCESS_LEVEL = "LEAD";

const VALID_TYPES: readonly CustomFieldType[] = ["TEXT", "NUMBER", "DROPDOWN", "DATE"];

export function isValidCustomFieldType(value: string): value is CustomFieldType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

export async function createCustomFieldDefinition(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; name: string; type: string; options?: string[] }
): Promise<CreateCustomFieldDefinitionResult> {
  const { actorUserId, listId, name, type, options } = input;

  if (!isValidCustomFieldType(type)) {
    return { status: "invalid-type" };
  }
  if (type === "DROPDOWN" && (!options || options.length === 0)) {
    return { status: "dropdown-requires-options" };
  }

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  try {
    const definition = await database.customFieldDefinition.create({
      data: { id: randomUUID(), listId, name, type, options: type === "DROPDOWN" ? options : [] },
    });
    return { status: "created", definitionId: definition.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: "duplicate-name" };
    }
    throw error;
  }
}

// type is intentionally not editable here — changing a Custom Field's type
// after values exist could silently corrupt already-stored data (e.g. a
// DROPDOWN value no longer matching new options). Name/options only.
export async function updateCustomFieldDefinition(
  database: PrismaClient,
  input: { actorUserId: string; definitionId: string; name?: string; options?: string[] }
): Promise<UpdateCustomFieldDefinitionResult> {
  const { actorUserId, definitionId, name, options } = input;

  const definition = await database.customFieldDefinition.findUnique({ where: { id: definitionId } });
  if (!definition) {
    return { status: "definition-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId: definition.listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  if (definition.type === "DROPDOWN" && options !== undefined && options.length === 0) {
    return { status: "dropdown-requires-options" };
  }

  await database.customFieldDefinition.update({
    where: { id: definitionId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(options !== undefined ? { options } : {}),
    },
  });

  return { status: "updated" };
}
