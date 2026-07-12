import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

const html = renderToStaticMarkup(<Home />);

assert.match(html, /ListItUp/);
assert.match(html, /Sign in/);
assert.match(html, /Sign up/);
assert.match(html, /Email magic link/);
assert.doesNotMatch(html, /Sign in to My Tasks/);
assert.doesNotMatch(html, /Inbox List/);
assert.doesNotMatch(html, /Verification path/);

console.log("page smoke test passed");
