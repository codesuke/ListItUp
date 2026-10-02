import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { globalSearch } from "@/lib/search/global-search";

// Backs the header command palette's live-as-you-type results (#56, #70,
// ADR 0015) — a deliberate, narrow exception to Route Handlers normally
// being for external consumers only, since debounced client-side querying
// has no Server Action equivalent (docs/agents/nextjs-conventions.md).
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) {
    return new NextResponse(null, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const workspaceId = searchParams.get("workspaceId");
  const query = searchParams.get("q");
  if (!workspaceId || !query) {
    return new NextResponse(null, { status: 400 });
  }

  const results = await globalSearch(prisma, { userId: session.user.id, workspaceId, query });
  return NextResponse.json(results);
}
