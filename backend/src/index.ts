import "dotenv/config";
import app from "./app";
import { startSettlementLoop } from "./betting/settle";

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  startSettlementLoop(); // grades finished matches and pays out, every minute
});
