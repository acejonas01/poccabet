// Link preview image (1200×630) for WhatsApp, X, Facebook…: /og?t=Title&s=Subtitle
import { ImageResponse } from "next/og";

// The site's fonts (Barlow Condensed, Manrope) as TTF from Google Fonts; kept after the first load.
// If they can't be fetched, the image still renders in the default font.
type Font = { name: string; data: ArrayBuffer; weight: 600 | 700 | 800; style: "normal" | "italic" };
let fonts: Promise<Font[]> | null = null;
async function font(family: string, axis: string, weight: Font["weight"], style: Font["style"]): Promise<Font> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:${axis}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error(`No TTF for ${family}`);
  return { name: family.replace(/\+/g, " "), data: await (await fetch(url)).arrayBuffer(), weight, style };
}
const loadFonts = () => (fonts ??= Promise.all([
  font("Barlow+Condensed", "ital,wght@1,800", 800, "italic"),
  font("Barlow+Condensed", "wght@700", 700, "normal"),
  font("Manrope", "wght@600", 600, "normal"),
]).catch(() => { fonts = null; return []; }));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = (q.get("t") || "Football betting odds & live scores").slice(0, 70);
  const sub = (q.get("s") || "Live odds, in-play scores, accumulators and booking codes").slice(0, 110);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#131E24", color: "#FFFFFF", fontFamily: "Manrope" }}>
        <div style={{ display: "flex", fontFamily: "Barlow Condensed", fontSize: 76, fontWeight: 800, fontStyle: "italic" }}>
          <span>Pocca</span>
          <span style={{ color: "#F5C518" }}>bet</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontFamily: "Barlow Condensed", fontSize: title.length > 40 ? 84 : 104, fontWeight: 700, lineHeight: 1 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 34, color: "#A9B4BC" }}>{sub}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 120, height: 10, borderRadius: 5, background: "#F5C518" }} />
          <div style={{ display: "flex", fontSize: 28, color: "#A9B4BC" }}>18+ · Bet responsibly</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await loadFonts(), headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
