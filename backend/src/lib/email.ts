// Sending email. Same idea as sms.ts: one place to plug in a real provider (e.g. Resend,
// Postmark, SES) — set EMAIL_PROVIDER to its name. In simulation mode the default "demo"
// sender sends nothing: the code is logged and shown on screen for testing.
import { SIMULATE } from "./feedMode";

export interface EmailSender {
  name: string;
  demo: boolean;
  send(to: string, subject: string, text: string): Promise<void>;
}

const demo: EmailSender = {
  name: "demo",
  demo: true,
  async send(to, subject, text) {
    console.log(`[email:demo] to ${to} — ${subject}: ${text}`);
  },
};

const providers: Record<string, () => EmailSender> = { demo: () => demo };

export function emailSender(): EmailSender | null {
  const name = process.env.EMAIL_PROVIDER || (SIMULATE ? "demo" : "");
  return providers[name]?.() ?? null;
}
