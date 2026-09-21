import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HOUR = 1000 * 60 * 60;

type SeedOutcome = { label: string; odds: number };
type SeedMarket = { type: string; name: string; outcomes: SeedOutcome[] };
type SeedEvent = {
  league: string;
  homeTeam: string;
  awayTeam: string;
  startOffsetHours: number; // negative = already live
  status: "SCHEDULED" | "LIVE";
  markets: SeedMarket[];
};

function matchWinner(home: string, away: string, homeOdds: number, drawOdds: number, awayOdds: number): SeedMarket {
  return {
    type: "MATCH_WINNER",
    name: "Match Winner",
    outcomes: [
      { label: home, odds: homeOdds },
      { label: "Draw", odds: drawOdds },
      { label: away, odds: awayOdds },
    ],
  };
}

function overUnder(line: string, overOdds: number, underOdds: number): SeedMarket {
  return {
    type: "OVER_UNDER",
    name: `Total Goals Over/Under ${line}`,
    outcomes: [
      { label: `Over ${line}`, odds: overOdds },
      { label: `Under ${line}`, odds: underOdds },
    ],
  };
}

function headToHead(a: string, b: string, aOdds: number, bOdds: number): SeedMarket {
  return {
    type: "MATCH_WINNER",
    name: "Match Winner",
    outcomes: [
      { label: a, odds: aOdds },
      { label: b, odds: bOdds },
    ],
  };
}

const footballEvents: SeedEvent[] = [
  {
    league: "NPFL",
    homeTeam: "Enyimba",
    awayTeam: "Rivers United",
    startOffsetHours: -1,
    status: "LIVE",
    markets: [matchWinner("Enyimba", "Rivers United", 2.1, 3.2, 3.4), overUnder("2.5", 1.95, 1.85)],
  },
  {
    league: "NPFL",
    homeTeam: "Remo Stars",
    awayTeam: "Kano Pillars",
    startOffsetHours: 3,
    status: "SCHEDULED",
    markets: [matchWinner("Remo Stars", "Kano Pillars", 1.8, 3.1, 4.2)],
  },
  {
    league: "NPFL",
    homeTeam: "Plateau United",
    awayTeam: "Shooting Stars",
    startOffsetHours: 26,
    status: "SCHEDULED",
    markets: [matchWinner("Plateau United", "Shooting Stars", 2.3, 3.0, 3.1)],
  },
  {
    league: "English Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startOffsetHours: 5,
    status: "SCHEDULED",
    markets: [matchWinner("Arsenal", "Chelsea", 1.9, 3.6, 4.0), overUnder("2.5", 1.85, 1.95)],
  },
  {
    league: "English Premier League",
    homeTeam: "Manchester City",
    awayTeam: "Liverpool",
    startOffsetHours: -1,
    status: "LIVE",
    markets: [matchWinner("Manchester City", "Liverpool", 2.0, 3.5, 3.6), overUnder("2.5", 1.7, 2.1)],
  },
  {
    league: "English Premier League",
    homeTeam: "Manchester United",
    awayTeam: "Tottenham",
    startOffsetHours: 30,
    status: "SCHEDULED",
    markets: [matchWinner("Manchester United", "Tottenham", 2.4, 3.3, 2.9)],
  },
  {
    league: "La Liga",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    startOffsetHours: 48,
    status: "SCHEDULED",
    markets: [matchWinner("Real Madrid", "Barcelona", 2.2, 3.4, 3.0), overUnder("2.5", 1.75, 2.05)],
  },
  {
    league: "La Liga",
    homeTeam: "Atletico Madrid",
    awayTeam: "Sevilla",
    startOffsetHours: 52,
    status: "SCHEDULED",
    markets: [matchWinner("Atletico Madrid", "Sevilla", 1.7, 3.7, 4.8)],
  },
  {
    league: "Serie A",
    homeTeam: "Juventus",
    awayTeam: "AC Milan",
    startOffsetHours: 20,
    status: "SCHEDULED",
    markets: [matchWinner("Juventus", "AC Milan", 2.5, 3.1, 2.8)],
  },
  {
    league: "UEFA Champions League",
    homeTeam: "Bayern Munich",
    awayTeam: "PSG",
    startOffsetHours: 72,
    status: "SCHEDULED",
    markets: [matchWinner("Bayern Munich", "PSG", 2.0, 3.8, 3.5), overUnder("2.5", 1.6, 2.25)],
  },
  {
    league: "International Friendly",
    homeTeam: "Nigeria",
    awayTeam: "Ghana",
    startOffsetHours: 40,
    status: "SCHEDULED",
    markets: [matchWinner("Nigeria", "Ghana", 2.05, 3.15, 3.55), overUnder("2.5", 1.9, 1.9)],
  },
  {
    league: "NPFL",
    homeTeam: "Rangers Intl",
    awayTeam: "Heartland",
    startOffsetHours: 26,
    status: "SCHEDULED",
    markets: [
      matchWinner("Rangers Intl", "Heartland", 2.15, 3.05, 3.45),
      overUnder("2.5", 1.85, 1.95),
    ],
  },
  {
    league: "NPFL",
    homeTeam: "Lobi Stars",
    awayTeam: "Akwa United",
    startOffsetHours: 30,
    status: "SCHEDULED",
    markets: [
      matchWinner("Lobi Stars", "Akwa United", 2.6, 3.0, 2.7),
      overUnder("2.5", 2.0, 1.8),
    ],
  },
  {
    league: "English Premier League",
    homeTeam: "Tottenham",
    awayTeam: "Newcastle",
    startOffsetHours: 34,
    status: "SCHEDULED",
    markets: [
      matchWinner("Tottenham", "Newcastle", 2.25, 3.4, 3.0),
      overUnder("2.5", 1.7, 2.1),
    ],
  },
  {
    league: "La Liga",
    homeTeam: "Sevilla",
    awayTeam: "Valencia",
    startOffsetHours: 44,
    status: "SCHEDULED",
    markets: [
      matchWinner("Sevilla", "Valencia", 2.4, 3.2, 2.9),
      overUnder("2.5", 1.95, 1.85),
    ],
  },
];

const basketballEvents: SeedEvent[] = [
  {
    league: "NBA",
    homeTeam: "LA Lakers",
    awayTeam: "Boston Celtics",
    startOffsetHours: -1,
    status: "LIVE",
    markets: [headToHead("LA Lakers", "Boston Celtics", 1.95, 1.85)],
  },
  {
    league: "NBA",
    homeTeam: "Golden State Warriors",
    awayTeam: "Miami Heat",
    startOffsetHours: 6,
    status: "SCHEDULED",
    markets: [headToHead("Golden State Warriors", "Miami Heat", 1.7, 2.15)],
  },
  {
    league: "NBA",
    homeTeam: "Milwaukee Bucks",
    awayTeam: "Phoenix Suns",
    startOffsetHours: 28,
    status: "SCHEDULED",
    markets: [headToHead("Milwaukee Bucks", "Phoenix Suns", 1.8, 2.0)],
  },
];

const tennisEvents: SeedEvent[] = [
  {
    league: "ATP Masters",
    homeTeam: "Carlos Alcaraz",
    awayTeam: "Novak Djokovic",
    startOffsetHours: 8,
    status: "SCHEDULED",
    markets: [headToHead("Carlos Alcaraz", "Novak Djokovic", 2.1, 1.75)],
  },
  {
    league: "ATP Masters",
    homeTeam: "Jannik Sinner",
    awayTeam: "Daniil Medvedev",
    startOffsetHours: 10,
    status: "SCHEDULED",
    markets: [headToHead("Jannik Sinner", "Daniil Medvedev", 1.6, 2.35)],
  },
];

async function seedSport(slug: string, name: string, events: SeedEvent[]) {
  const sport = await prisma.sport.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });

  for (const e of events) {
    const existing = await prisma.event.findFirst({
      where: {
        sportId: sport.id,
        league: e.league,
        homeTeam: e.homeTeam,
        awayTeam: e.awayTeam,
      },
    });
    if (existing) continue;

    await prisma.event.create({
      data: {
        sportId: sport.id,
        league: e.league,
        homeTeam: e.homeTeam,
        awayTeam: e.awayTeam,
        startTime: new Date(Date.now() + e.startOffsetHours * HOUR),
        status: e.status,
        markets: {
          create: e.markets.map((m) => ({
            type: m.type,
            name: m.name,
            outcomes: { create: m.outcomes },
          })),
        },
      },
    });
  }
}


// --- generated filler so every sport has a full board to browse ---
function price(seed: number, min: number, max: number) {
  const x = Math.abs(Math.sin(seed) * 10000) % 1;
  return Math.round((min + x * (max - min)) * 100) / 100;
}

function buildThreeWay(league: string, pairs: [string, string][], startAt: number): SeedEvent[] {
  return pairs.map(([home, away], i) => {
    const s = startAt + i;
    return {
      league,
      homeTeam: home,
      awayTeam: away,
      startOffsetHours: 12 + i * 5,
      status: "SCHEDULED",
      markets: [
        matchWinner(home, away, price(s, 1.5, 3.6), price(s + 91, 2.9, 3.9), price(s + 47, 1.7, 4.8)),
        overUnder("2.5", price(s + 13, 1.55, 2.3), price(s + 29, 1.6, 2.25)),
      ],
    };
  });
}

function buildTwoWay(league: string, pairs: [string, string][], startAt: number): SeedEvent[] {
  return pairs.map(([home, away], i) => {
    const s = startAt + i;
    return {
      league,
      homeTeam: home,
      awayTeam: away,
      startOffsetHours: 9 + i * 4,
      status: "SCHEDULED",
      markets: [headToHead(home, away, price(s, 1.35, 2.6), price(s + 61, 1.4, 2.8))],
    };
  });
}

const extraFootball: SeedEvent[] = [
  ...buildThreeWay("NPFL", [
    ["Kwara United", "Bendel Insurance"], ["Sunshine Stars", "Katsina United"],
    ["Abia Warriors", "Bayelsa United"], ["Doma United", "Niger Tornadoes"],
    ["Gombe United", "El-Kanemi Warriors"],
  ], 101),
  ...buildThreeWay("English Premier League", [
    ["Aston Villa", "Brighton"], ["West Ham", "Everton"], ["Brentford", "Fulham"],
    ["Crystal Palace", "Wolves"], ["Nottingham Forest", "Bournemouth"],
  ], 201),
  ...buildThreeWay("La Liga", [
    ["Real Betis", "Villarreal"], ["Athletic Bilbao", "Girona"], ["Osasuna", "Celta Vigo"],
  ], 301),
  ...buildThreeWay("Serie A", [
    ["Napoli", "Roma"], ["Lazio", "Atalanta"], ["Fiorentina", "Bologna"],
  ], 401),
];

const extraBasketball: SeedEvent[] = buildTwoWay("NBA", [
  ["Denver Nuggets", "Dallas Mavericks"], ["Philadelphia 76ers", "New York Knicks"],
  ["Memphis Grizzlies", "Sacramento Kings"], ["Cleveland Cavaliers", "Orlando Magic"],
  ["Minnesota Timberwolves", "New Orleans Pelicans"], ["LA Clippers", "Portland Trail Blazers"],
  ["Toronto Raptors", "Chicago Bulls"], ["Atlanta Hawks", "Indiana Pacers"],
  ["Houston Rockets", "San Antonio Spurs"], ["Utah Jazz", "Oklahoma City Thunder"],
  ["Brooklyn Nets", "Detroit Pistons"], ["Charlotte Hornets", "Washington Wizards"],
  ["Phoenix Suns", "Golden State Warriors"], ["Boston Celtics", "Miami Heat"],
  ["Milwaukee Bucks", "LA Lakers"], ["Sacramento Kings", "Denver Nuggets"],
  ["New York Knicks", "Cleveland Cavaliers"], ["Dallas Mavericks", "Houston Rockets"],
  ["Orlando Magic", "Atlanta Hawks"], ["Indiana Pacers", "Toronto Raptors"],
  ["Portland Trail Blazers", "Utah Jazz"], ["Chicago Bulls", "Brooklyn Nets"],
], 501);

const extraTennis: SeedEvent[] = buildTwoWay("ATP Masters", [
  ["Jannik Sinner", "Alexander Zverev"], ["Daniil Medvedev", "Andrey Rublev"],
  ["Stefanos Tsitsipas", "Casper Ruud"], ["Taylor Fritz", "Hubert Hurkacz"],
  ["Grigor Dimitrov", "Alex de Minaur"], ["Holger Rune", "Tommy Paul"],
  ["Ben Shelton", "Frances Tiafoe"], ["Karen Khachanov", "Ugo Humbert"],
  ["Sebastian Korda", "Lorenzo Musetti"], ["Felix Auger-Aliassime", "Nicolas Jarry"],
  ["Alejandro Tabilo", "Jack Draper"], ["Arthur Fils", "Matteo Arnaldi"],
  ["Novak Djokovic", "Carlos Alcaraz"], ["Rafael Nadal", "Dominic Thiem"],
  ["Cameron Norrie", "Denis Shapovalov"], ["Adrian Mannarino", "Jan-Lennard Struff"],
  ["Tallon Griekspoor", "Roberto Bautista Agut"], ["Alexander Bublik", "Jiri Lehecka"],
  ["Francisco Cerundolo", "Sebastian Baez"], ["Tomas Machac", "Flavio Cobolli"],
  ["Jordan Thompson", "Zhizhen Zhang"], ["Marcos Giron", "Christopher Eubanks"],
  ["Brandon Nakashima", "Mackenzie McDonald"],
], 601);

async function main() {
  await seedSport("football", "Soccer", [...footballEvents, ...extraFootball]);
  await seedSport("basketball", "Basketball", [...basketballEvents, ...extraBasketball]);
  await seedSport("tennis", "Tennis", [...tennisEvents, ...extraTennis]);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
