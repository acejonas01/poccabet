import "dotenv/config";
import app from "./app";
import { startSettlementLoop } from "./betting/settle";
import { purgeExpiredArchives } from "./lib/closeAccount";
import { purgeOldChat } from "./routes/chat";

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  startSettlementLoop(); // grades finished matches and pays out, every minute
  // Closed-account identity records past their retention period: purged at start-up and daily.
  const purge = () => {
    purgeExpiredArchives().catch((err) => console.error("archive purge failed:", err));
    purgeOldChat().catch((err) => console.error("chat purge failed:", err));
  };
  purge();
  setInterval(purge, 24 * 3600_000).unref();
});
