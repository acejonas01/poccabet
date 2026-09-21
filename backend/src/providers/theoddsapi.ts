import type { OddsProvider, OddsEvent } from "./types";

const BASE_URL = "https://api.the-odds-api.com/v4";

const TOP_SOCCER_LEAGUES = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "soccer_brazil_campeonato",
  "soccer_usa_mls",
];

interface CacheEntry {
  data: OddsEvent[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

export class TheOddsApiProvider implements OddsProvider {
  name = "the-odds-api";
  private apiKey: string;
  private regions: string;

  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || "";
    this.regions = process.env.ODDS_REGIONS || "eu,uk,us";
  }

  async getSupportedSports() {
    const res = await fetch(`${BASE_URL}/sports?apiKey=${this.apiKey}`);
    if (!res.ok) throw new Error(`The Odds API error: ${res.status}`);
    const data: any = await res.json();
    return data.map((s: any) => ({ key: s.key, name: s.title }));
  }

  async fetchEvents(sport?: string): Promise<OddsEvent[]> {
    if (sport) return this.fetchSport(sport);

    const cacheKey = "all-soccer";
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const results: OddsEvent[] = [];
    for (const league of TOP_SOCCER_LEAGUES) {
      try {
        const events = await this.fetchSport(league);
        results.push(...events);
      } catch {
        // skip leagues with no events
      }
      if (results.length >= 15) break;
    }

    cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  }

  private async fetchSport(sportKey: string): Promise<OddsEvent[]> {
    const cacheKey = `sport-${sportKey}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const url = `${BASE_URL}/sports/${sportKey}/odds?apiKey=${this.apiKey}&regions=${this.regions}&markets=h2h&oddsFormat=decimal`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`The Odds API error: ${res.status}`);
    const data: any = await res.json();

    const events = data.map((evt: any) => ({
      externalId: evt.id,
      sport: evt.sport_key,
      league: evt.sport_title,
      homeTeam: evt.home_team,
      awayTeam: evt.away_team,
      startTime: new Date(evt.commence_time),
      markets: this.parseMarkets(evt.bookmakers),
    }));

    cache.set(cacheKey, { data: events, timestamp: Date.now() });
    return events;
  }

  private parseMarkets(bookmakers: any[]): OddsEvent["markets"] {
    if (!bookmakers?.length) return [];
    const bk = bookmakers[0];
    return (bk.markets || []).map((m: any) => ({
      type: m.key === "h2h" ? "MATCH_WINNER" : m.key.toUpperCase(),
      name: m.key === "h2h" ? "Match Winner" : m.key,
      outcomes: (m.outcomes || []).map((o: any) => ({
        label: o.name,
        odds: o.price,
      })),
    }));
  }
}
