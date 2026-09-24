// FEED_MODE=simulation (default) serves generated games and picks; FEED_MODE=live uses real providers.
export const SIMULATE = (process.env.FEED_MODE || "simulation") !== "live";
