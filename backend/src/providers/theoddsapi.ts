import type { OddsProvider, OddsEvent } from "./types";

const BASE_URL = "https://api.the-odds-api.com/v4";

export class TheOddsApiProvider implements OddsProvider {
  name = "the-odds-api";
  private apiKey: string;
  private regions: string;

  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || "";
    this.regions = process.env.ODDS_REGIONS || "us";
  }

  async getSupportedSports() {
    const res = await fetch(`${BASE_URL}/sports?apiKey=${this.apiKey}`);
    if (!res.ok) throw new Error(`The Odds API error: ${res.status}`);
    const data: any = await res.json();
    return data.map((s: any) => ({ key: s.key, name: s.title }));
  }

  async fetchEvents(sport?: string): Promise<OddsEvent[]> {
    const sportKey = sport || "upcoming";
    const url = `${BASE_URL}/sports/${sportKey}/odds?apiKey=${this.apiKey}&regions=${this.regions}&markets=h2h&oddsFormat=decimal`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`The Odds API error: ${res.status}`);
    const data: any = await res.json();

    return data.map((evt: any) => ({
      externalId: evt.id,
      sport: evt.sport_key,
      league: evt.sport_title,
      homeTeam: evt.home_team,
      awayTeam: evt.away_team,
      startTime: new Date(evt.commence_time),
      markets: this.parseMarkets(evt.bookmakers),
    }));
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
