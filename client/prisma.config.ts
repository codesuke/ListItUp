import { defineConfig } from "prisma/config";

// Generating the client only reads the schema; it should not require a runtime
// database URL. Commands that connect to Postgres still fail without one.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://listitup:listitup@localhost:5432/listitup?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
