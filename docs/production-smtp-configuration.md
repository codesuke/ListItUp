# Production SMTP Provider Configuration

How to point ListItUp's mailer (`client/lib/mailer.ts`, see `docs/ADR` and issue #2) at a production SMTP provider. This is **configuration only** — creating the actual Mailgun or Brevo provider account, verifying the sending domain with that provider, and provisioning SPF/DKIM/DMARC records are out of scope for this document and for this release. Do that setup directly with the provider first; this doc only covers the environment variables ListItUp itself reads.

The mailer is provider-neutral: it always speaks plain SMTP through `nodemailer`, so switching providers is only ever a matter of changing these environment variables — no code changes. Exactly one provider is active per environment.

## Environment Variables

| Variable          | Purpose                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAIL_PROVIDER`   | Label only (`google`, `mailgun`, `brevo`, or `custom`) — used for logging/diagnostics, not branching logic.                                                          |
| `SMTP_HOST`       | The provider's SMTP relay hostname.                                                                                                                                  |
| `SMTP_PORT`       | SMTP port. Use `587` (STARTTLS) unless the provider tells you otherwise.                                                                                             |
| `SMTP_SECURE`     | `"true"` for implicit TLS (typically port `465`), `"false"` for STARTTLS (port `587`).                                                                               |
| `SMTP_USER`       | SMTP username issued by the provider.                                                                                                                                |
| `SMTP_PASSWORD`   | SMTP password / API key issued by the provider.                                                                                                                      |
| `MAIL_FROM_NAME`  | Display name used for every transactional email (verification, magic link, password reset, email change, 2FA notices, recovery-code notices, Workspace invitations). |
| `MAIL_FROM_EMAIL` | The single sender identity for the environment. Must be a mailbox/domain the provider has verified you're authorized to send from.                                   |

These are read by `client/lib/mailer-config.ts` and validated at startup — the app fails fast if any are missing. See `client/.env.example` for the full variable list alongside the rest of the app's configuration.

## Mailgun

1. In the Mailgun dashboard, go to **Sending → Domain settings** for your verified sending domain and open **SMTP credentials**. Create (or reuse) an SMTP user for ListItUp.
2. Set:

   ```bash
   MAIL_PROVIDER="mailgun"
   SMTP_HOST="smtp.mailgun.org"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="postmaster@your-verified-domain.example"
   SMTP_PASSWORD="the-smtp-password-mailgun-generated"
   MAIL_FROM_NAME="ListItUp"
   MAIL_FROM_EMAIL="no-reply@your-verified-domain.example"
   ```

3. `MAIL_FROM_EMAIL` must be an address on the domain you verified with Mailgun (SPF/DKIM configured there) — sending from an unverified domain will be rejected or land in spam.
4. If your Mailgun account is on the EU region, use `smtp.eu.mailgun.org` for `SMTP_HOST` instead.

## Brevo

1. In the Brevo dashboard, go to **SMTP & API → SMTP** and note your SMTP login (usually your Brevo account email) and generate an SMTP key (this is the `SMTP_PASSWORD`, not your Brevo account password).
2. Set:

   ```bash
   MAIL_PROVIDER="brevo"
   SMTP_HOST="smtp-relay.brevo.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="your-brevo-account-email@example.com"
   SMTP_PASSWORD="the-smtp-key-brevo-generated"
   MAIL_FROM_NAME="ListItUp"
   MAIL_FROM_EMAIL="no-reply@your-verified-domain.example"
   ```

3. `MAIL_FROM_EMAIL` must be a sender you've verified in Brevo under **Senders, Domains & Dedicated IPs**.

## Rollback

Switching back to Google SMTP for a lower-volume or test environment only requires reverting to the `google` block already documented in `client/.env.example` — no code or deploy changes either way.
