export interface OddsEvent {
  externalId: string;
  sport: string;
  league: string;
  country?: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  startTime: Date;
  markets: OddsMarket[];
}

export interface OddsMarket {
  type: string;
  name: string;
  outcomes: OddsOutcome[];
}

export interface OddsOutcome {
  label: string;
  odds: number;
}

export interface OddsProvider {
  name: string;
  fetchEvents(sport?: string): Promise<OddsEvent[]>;
  getSupportedSports(): Promise<{ key: string; name: string }[]>;
}
