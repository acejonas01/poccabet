// Unknown URLs: HTTP 404. The app in the layout shows its "Page not found" screen.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found | Poccabet", robots: { index: false, follow: true } };

export default function NotFound() {
  return null;
}
