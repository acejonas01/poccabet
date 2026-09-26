import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import eventsRoutes from "./routes/events";
import betsRoutes from "./routes/bets";
import oddsRoutes from "./routes/odds";
import liveRoutes from "./routes/live";
import picksRoutes from "./routes/picks";
import meRoutes from "./routes/me";
import adminRoutes from "./routes/admin";

const app = express();

// Comma-separated list of allowed site origins; unset means allow all (local dev).
const allowedOrigins = process.env.FRONTEND_ORIGIN?.split(",").map((o) => o.trim());
app.use(helmet()); // security headers (no sniffing, no framing, HSTS…)
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
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

export default app;
