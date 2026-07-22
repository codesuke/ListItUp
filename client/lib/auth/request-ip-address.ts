export function requestIpAddress(headers: Headers): string {
  const trustedHeader = process.env.AUTH_TRUSTED_PROXY_IP_HEADER;

  if (!trustedHeader) {
    return "unknown";
  }

  const forwardedFor = headers.get(trustedHeader);

  return forwardedFor ? forwardedFor.split(",", 1)[0].trim() : "unknown";
}
