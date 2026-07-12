import "server-only";

import nodemailer from "nodemailer";

import { createMailer } from "@/lib/mailer/mailer-core";
import { loadMailerConfig } from "@/lib/mailer/mailer-config";

const config = loadMailerConfig();
const transport = nodemailer.createTransport({
  host: config.host,
  port: config.port,
  secure: config.secure,
  auth: { user: config.user, pass: config.password },
});

export const mailer = createMailer(config, transport);
