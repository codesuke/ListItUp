import assert from "node:assert/strict";

import { hasSavedRecoveryCodesAcknowledgement } from "./two-factor-enrollment";

assert.equal(hasSavedRecoveryCodesAcknowledgement(new FormData()), false);

const acknowledged = new FormData();
acknowledged.set("recoveryCodesSaved", "true");
assert.equal(hasSavedRecoveryCodesAcknowledgement(acknowledged), true);

console.log("two-factor enrollment acknowledgement test passed");
