import { spawn } from "node:child_process";

import {
  loadTestServiceConfig,
  verifyTestServices,
} from "@/lib/test/test-services";

const TEST_FILES = [
  "lib/test/test-services.test.ts",
  "lib/seo/site-metadata.test.ts",
  "lib/ui/member-display.test.ts",
  "lib/list/list-timeline.test.ts",
  "lib/report/list-dashboard.test.ts",
  "lib/auth/auth-config.test.ts",
  "lib/auth/verification-resend.test.ts",
  "lib/auth/email-request-rate-limit.integration.test.ts",
  "lib/auth/progressive-sign-in-rate-limit.integration.test.ts",
  "lib/security/platform-operations.integration.test.ts",
  "lib/security/security-notice-outbox.integration.test.ts",
  "lib/security/security-operations.integration.test.ts",
  "lib/auth/auth-email-request-limits.integration.test.ts",
  "lib/auth/auth-email-delivery-failure.integration.test.ts",
  "lib/workspace/workspace-provisioning.test.ts",
  "lib/workspace/demo-workspace.test.ts",
  "lib/workspace/workspace-ownership.test.ts",
  "lib/workspace/default-workspace.test.ts",
  "lib/workspace/workspace-peer-comparison.test.ts",
  "app/workspaces/[workspaceId]/lists/[listId]/page.smoke.test.tsx",
  "app/workspaces/[workspaceId]/lists/[listId]/items/[itemId]/page.smoke.test.tsx",
  "app/workspaces/[workspaceId]/layout.smoke.test.tsx",
  "app/my-tasks/page.smoke.test.tsx",
  "lib/item/item-my-tasks.test.ts",
  "lib/item/item-my-tasks.integration.test.ts",
  "lib/item/item-my-tasks-board.test.ts",
  "lib/item/item-my-tasks-calendar.test.ts",
  "lib/item/item-my-tasks-files.test.ts",
  "lib/calendar/month-grid.test.ts",
  "lib/list/list-calendar.test.ts",
  "lib/auth/magic-link-tokens.test.ts",
  "lib/auth/password-reset-tokens.test.ts",
  "lib/session/callback-url.test.ts",
  "lib/session/protected-route.test.ts",
  "lib/session/root-landing.test.ts",
  "lib/two-factor/two-factor-verification.test.ts",
  "lib/two-factor/two-factor-enrollment.test.ts",
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
