import assert from "node:assert/strict";

import { isSafeRelativeCallbackUrl } from "./callback-url";

function run() {
  assert.equal(isSafeRelativeCallbackUrl("/my-tasks"), true);
  assert.equal(isSafeRelativeCallbackUrl("/lists/inbox?filter=open"), true);

  assert.equal(
    isSafeRelativeCallbackUrl("//evil.example.com/phish"),
    false,
    "protocol-relative URLs must be rejected"
  );
  assert.equal(
    isSafeRelativeCallbackUrl("\\\\evil.example.com/phish"),
    false,
    "backslash variants must be rejected"
  );
  assert.equal(
    isSafeRelativeCallbackUrl("https://evil.example.com"),
    false,
    "absolute URLs must be rejected"
  );
  assert.equal(
    isSafeRelativeCallbackUrl("my-tasks"),
    false,
    "paths without a leading slash must be rejected"
  );

  console.log("callback url safety test passed");
}

run();
