import type { SecurityAlertTransport } from "@/lib/security/security-operations";

export function createDiscordAlertTransport(
  webhookUrl: string,
  send: typeof fetch = fetch
): SecurityAlertTransport {
  return {
    async send(alert) {
      const response = await send(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: [
            `**${alert.title}**`,
            `Email: ${alert.email ?? "unknown"}`,
            `IP: ${alert.ipAddress ?? "unknown"}`,
          ].join("\n"),
        }),
      });
      if (!response.ok)
        throw new Error(`Discord webhook returned ${response.status}.`);
    },
  };
}
