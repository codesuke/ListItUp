import "server-only";

import { createAuth } from "@/lib/auth/auth-core";
import { prisma } from "@/lib/prisma";
import { mailer } from "@/lib/mailer/mailer";

export const auth = createAuth(prisma, mailer);
