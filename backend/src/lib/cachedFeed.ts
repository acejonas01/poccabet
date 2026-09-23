// Shared cache for rate-limited data providers:
// - serves fresh data within `ttl`
// - stale-while-revalidate: once expired, answers instantly with old data and refreshes in the background
// - collapses concurrent refreshes into one upstream call
// - after a failure, waits `backoff` ms before spending more calls
// - `canCall` lets a provider veto calls (e.g. daily budget used up)

export function cachedFeed<T>(opts: {
  ttl: number;
  load: () => Promise<T>;
  canCall?: () => boolean;
  backoff?: number;
}) {
  const { ttl, load, canCall = () => true, backoff = 10 * 60 * 1000 } = opts;
  let cache: { data: T; fetchedAt: number } | null = null;
  let inFlight: Promise<T> | null = null;
  let failure: { error: unknown; at: number } | null = null;

  const refresh = () => {
    inFlight ??= load()
      .then((data) => {
        cache = { data, fetchedAt: Date.now() };
        failure = null;
        return data;
      })
      .catch((err) => {
        failure = { error: err, at: Date.now() };
        throw err;
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  };

  return async (): Promise<{ data: T; fetchedAt: number; stale: boolean }> => {
    if (cache && Date.now() - cache.fetchedAt < ttl) return { ...cache, stale: false };
    const backingOff = failure !== null && Date.now() - failure.at < backoff;
    const allowed = !backingOff && canCall();

    if (cache) {
      if (allowed) refresh().catch(() => {});
      return { ...cache, stale: true };
    }
    if (backingOff) throw failure!.error;
    if (!allowed) throw new Error("Provider call budget used up");
    const data = await refresh();
    return { data, fetchedAt: Date.now(), stale: false };
  };
}
