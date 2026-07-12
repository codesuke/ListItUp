export function isSafeRelativeCallbackUrl(value: string): boolean {
  // Must be a same-origin path. Reject protocol-relative URLs ("//host/..."),
  // which browsers treat as absolute, and backslash variants some parsers
  // normalize to "//" (a classic open-redirect bypass of a bare startsWith("/")).
  return value.startsWith("/") && !/^[/\\]{2}/.test(value);
}
