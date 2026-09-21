import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import eventsRoutes from "./routes/events";
import betsRoutes from "./routes/bets";

const app = express();

// Comma-separated list of allowed site origins; unset means allow all (local dev).
const allowedOrigins = process.env.FRONTEND_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/bets", betsRoutes);

export default app;
