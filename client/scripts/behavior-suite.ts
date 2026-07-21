import { spawn } from "node:child_process";

import {
  loadTestServiceConfig,
  verifyTestServices,
} from "@/lib/test/test-services";

const TEST_FILES = [
  "app/page.smoke.test.tsx",
  "lib/test/test-services.test.ts",
  "lib/auth/auth-config.test.ts",
  "lib/auth/verification-resend.test.ts",
  "lib/auth/email-request-rate-limit.integration.test.ts",
  "lib/auth/auth-email-request-limits.integration.test.ts",
  "lib/workspace/workspace-provisioning.test.ts",
  "lib/auth/magic-link-tokens.test.ts",
  "lib/auth/password-reset-tokens.test.ts",
  "lib/session/callback-url.test.ts",
  "lib/session/protected-route.test.ts",
  "lib/two-factor/two-factor-verification.test.ts",
  "lib/auth/pending-email-change.test.ts",
  "lib/auth/auth.integration.test.ts",
  "lib/auth/sign-in.integration.test.ts",
  "lib/session/protected-route.integration.test.ts",
  "lib/auth/password-reset.integration.test.ts",
  "lib/two-factor/two-factor.integration.test.ts",
  "lib/auth/security-settings.integration.test.ts",
  "lib/two-factor/two-factor-management.integration.test.ts",
  "lib/workspace/workspace-invitations.test.ts",
  "lib/workspace/workspace-invitation-flow.integration.test.ts",
  "lib/mailer/email-templates/render.test.ts",
  "lib/mailer/email-templates/templates.test.ts",
  "lib/mailer/mailer-core.test.ts",
  "lib/mailer/mailpit.integration.test.ts",
] as const;

function runTestFile(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const child = spawn(command, ["exec", "tsx", file], {
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${file} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function run() {
  await verifyTestServices(loadTestServiceConfig());

  for (const file of TEST_FILES) {
    await runTestFile(file);
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
