import express, { type NextFunction, type Request, type Response } from "express";
import { Sentry } from "./instrument";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth";
import walletRoutes, { paystackWebhook } from "./routes/wallet";
import eventsRoutes from "./routes/events";
import betsRoutes from "./routes/bets";
import oddsRoutes from "./routes/odds";
import liveRoutes from "./routes/live";
import picksRoutes from "./routes/picks";
import meRoutes from "./routes/me";
import adminRoutes from "./routes/admin";
import chatRoutes from "./routes/chat";

const app = express();

// Comma-separated list of allowed site origins; unset means allow all (local dev).
const allowedOrigins = process.env.FRONTEND_ORIGIN?.split(",").map((o) => o.trim());
app.use(helmet()); // security headers (no sniffing, no framing, HSTS…)
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
// Paystack's webhook needs the exact bytes it sent (signature check), so it goes before the JSON parser.
app.post("/api/payments/paystack/webhook", express.raw({ type: "application/json", limit: "100kb" }), paystackWebhook);
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/bets", betsRoutes);
app.use("/api/odds", oddsRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/picks", picksRoutes);
app.use("/api/me", meRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);

// Unexpected errors: reported to Sentry (when on), then a plain JSON answer instead of an HTML page.
Sentry.setupExpressErrorHandler(app);
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("unhandled", err);
  if (!res.headersSent) res.status(500).json({ error: "Something went wrong. Please try again.", code: "SERVER_ERROR" });
});

export default app;
