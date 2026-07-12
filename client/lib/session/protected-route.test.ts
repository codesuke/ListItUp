import assert from "node:assert/strict";

import { resolveProtectedRouteRedirect } from "./protected-route";

function run() {
  assert.equal(
    resolveProtectedRouteRedirect(null, "/my-tasks"),
    "/sign-in?callbackURL=%2Fmy-tasks",
    "an unauthenticated visitor must be sent to sign-in with a return URL"
  );

  assert.equal(
    resolveProtectedRouteRedirect(
      { user: { email: "pending@example.test", emailVerified: false } },
      "/lists/inbox"
    ),
    "/verify-email?email=pending%40example.test&returnTo=%2Flists%2Finbox",
    "an unverified session must be sent to the verification screen with a return URL"
  );

  assert.equal(
    resolveProtectedRouteRedirect(
      { user: { email: "verified@example.test", emailVerified: true } },
      "/my-tasks"
    ),
    null,
    "a fully authenticated, verified session must render normally with no redirect"
  );

  console.log("protected route redirect test passed");
}

run();
