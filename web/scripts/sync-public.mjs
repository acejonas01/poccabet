// The Next.js site serves the same images and icons as the Vite site: copy frontend/public
// into web/public (not committed) before dev and build. Design source files are skipped.
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
const from = fileURLToPath(new URL("../../frontend/public", import.meta.url));
const to = fileURLToPath(new URL("../public", import.meta.url));
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true, filter: (src) => !src.endsWith(".psd") });
console.log("public/ synced from frontend/public");
