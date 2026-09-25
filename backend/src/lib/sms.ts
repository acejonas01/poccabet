// Sending SMS. Like the betting feed, this is the one place to plug in a real provider.
// SMS_PROVIDER=demo (the default in simulation mode) sends nothing: the code is logged and
// shown on the OTP screen so the flow can be tested. Real providers go in `providers` below.
import { SIMULATE } from "./feedMode";

export interface SmsSender {
  name: string;
  demo: boolean; // true = nothing is really sent; the caller may show the code on screen
  send(to: string, message: string): Promise<void>;
}

const demo: SmsSender = {
  name: "demo",
  demo: true,
  async send(to, message) {
    console.log(`[sms:demo] to ${to}: ${message}`);
  },
};

// Add a real provider here (e.g. Termii, Africa's Talking) and set SMS_PROVIDER to its name.
const providers: Record<string, () => SmsSender> = {
  demo: () => demo,
};

export function smsSender(): SmsSender | null {
  const name = process.env.SMS_PROVIDER || (SIMULATE ? "demo" : "");
  return providers[name]?.() ?? null;
}
