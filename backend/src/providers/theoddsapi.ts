import { cachedFeed } from "../lib/cachedFeed";
import type { OddsProvider, OddsEvent } from "./types";

const BASE_URL = "https://api.the-odds-api.com/v4";

// Free plan = 500 credits/month; each league call costs 1 credit (1 region × h2h).
// 4 leagues every 6h = 16 credits/day ≈ 496/month.
const LEAGUES = (
  process.env.ODDS_LEAGUES ||
  "soccer_epl,soccer_spain_la_liga,soccer_italy_serie_a,soccer_germany_bundesliga"
).split(",").map((l) => l.trim()).filter(Boolean);
const CACHE_TTL = Number(process.env.ODDS_CACHE_SECONDS || 21600) * 1000;
// Out of credits returns 401 until the monthly reset — don't keep knocking.
const ERROR_BACKOFF = 60 * 60 * 1000;

export class TheOddsApiProvider implements OddsProvider {
  name = "the-odds-api";
  private apiKey: string;
  private region: string;
  private leagueFeeds = new Map<string, () => Promise<{ data: OddsEvent[] }>>();

  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || "";
    // Every extra region multiplies the credit cost, and we only read one bookmaker anyway.
    this.region = (process.env.ODDS_REGIONS || "uk").split(",")[0].trim();
  }

  private bigLeagues = cachedFeed({
    ttl: CACHE_TTL,
    backoff: ERROR_BACKOFF,
    load: async () => {
      const results: OddsEvent[] = [];
      for (const league of LEAGUES) {
        try {
          results.push(...(await this.fetchSport(league)));
        } catch (err) {
          // Out of credits / bad key: stop instead of burning the remaining league calls.
          if (results.length === 0) throw err;
          break;
        }
      }
      return results;
    },
  });

  async getSupportedSports() {
    const res = await fetch(`${BASE_URL}/sports?apiKey=${this.apiKey}`);
    if (!res.ok) throw new Error(`The Odds API error: ${res.status}`);
    const data: any = await res.json();
    return data.map((s: any) => ({ key: s.key, name: s.title }));
  }

  async fetchEvents(sport?: string): Promise<OddsEvent[]> {
    if (!sport) return (await this.bigLeagues()).data;

    // Single-league requests get their own cache so they can't burn credits either.
    let feed = this.leagueFeeds.get(sport);
    if (!feed) {
      feed = cachedFeed({ ttl: CACHE_TTL, backoff: ERROR_BACKOFF, load: () => this.fetchSport(sport) });
      this.leagueFeeds.set(sport, feed);
    }
    return (await feed()).data;
  }

  private async fetchSport(sportKey: string): Promise<OddsEvent[]> {
    const url = `${BASE_URL}/sports/${sportKey}/odds?apiKey=${this.apiKey}&regions=${this.region}&markets=h2h&oddsFormat=decimal`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`The Odds API error: ${res.status}`);
    const data: any = await res.json();

    return data.map((evt: any) => ({
      externalId: `toa-${evt.id}`,
      sport: evt.sport_key,
      league: evt.sport_title,
      homeTeam: evt.home_team,
      awayTeam: evt.away_team,
      startTime: new Date(evt.commence_time),
      markets: this.parseMarkets(evt),
    }));
  }

  private parseMarkets(evt: any): OddsEvent["markets"] {
    const bk = evt.bookmakers?.[0];
    if (!bk) return [];
    return (bk.markets || []).map((m: any) => {
      const outcomes = (m.outcomes || []).map((o: any) => ({ label: o.name, odds: o.price }));
      // The board reads 1X2 by position, so force Home, Draw, Away order.
      if (m.key === "h2h") {
        const pos = (label: string) =>
          label === evt.home_team ? 0 : label === "Draw" ? 1 : label === evt.away_team ? 2 : 3;
        outcomes.sort((a: any, b: any) => pos(a.label) - pos(b.label));
      }
      return {
        type: m.key === "h2h" ? "MATCH_WINNER" : m.key.toUpperCase(),
        name: m.key === "h2h" ? "Match Winner" : m.key,
        outcomes,
      };
    });
  }
}
