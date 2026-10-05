-- Data-only repair migration for the List Lead Rules spec (#94, #103).
-- Hand-written: a schema-diff migration can't express "every Lead-less List
-- gets the Workspace Owner as Lead" or "a Workspace Viewer's LEAD/MEMBER
-- List rows become VIEWER" — both depend on correlated existing data, not a
-- schema change. Order matters: Viewers are downgraded first, which can
-- strip a List's only Lead, so the Lead backfill runs second and picks up
-- any List left without one.

-- Workspace Viewers' LEAD and MEMBER List roles become VIEWER (Q8 option a).
UPDATE "list_member" lm
SET "role" = 'VIEWER'
FROM "list" l, "workspace_member" wm
WHERE lm."listId" = l."id"
  AND wm."workspaceId" = l."workspaceId"
  AND wm."userId" = lm."userId"
  AND wm."role" = 'VIEWER'
  AND lm."role" IN ('LEAD', 'MEMBER');

-- Every List with no explicit Lead gets its Workspace Owner added as Lead
-- (Q8 option a). ON CONFLICT handles an Owner who already holds a
-- non-Lead List row for that List.
INSERT INTO "list_member" ("id", "listId", "userId", "role")
SELECT gen_random_uuid()::text, l."id", owner."userId", 'LEAD'
FROM "list" l
JOIN "workspace_member" owner
  ON owner."workspaceId" = l."workspaceId"
  AND owner."role" = 'OWNER'
WHERE NOT EXISTS (
  SELECT 1 FROM "list_member" lm WHERE lm."listId" = l."id" AND lm."role" = 'LEAD'
)
ON CONFLICT ("listId", "userId") DO UPDATE SET "role" = 'LEAD';
