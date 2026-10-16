import type { City, Facility, FacilityType, Nation, NationId, Game } from "./types";

export const NATION_ORDER: NationId[] = ["ATL", "EUR", "EUF", "PAZ", "IND", "SUD", "AFR"];

interface NationDef {
  name: string;
  color: string;
  aggression: number;
  strength: number;
  blurb: string;
  cities: [string, number, number, number][]; // name, lat, lon, pop (Mio) — erste = Hauptstadt
}

export const NATION_DEFS: Record<NationId, NationDef> = {
  ATL: {
    name: "Atlantische Union",
    color: "#5aa9e6",
    aggression: 0.45,
    strength: 1.25,
    blurb: "Starke Luftwaffe, große Industrie, weit entfernt von den meisten Fronten.",
    cities: [
      ["Washington", 38.9, -77.0, 6],
      ["New York", 40.7, -74.0, 19],
      ["Los Angeles", 34.05, -118.2, 13],
      ["Chicago", 41.9, -87.6, 9],
      ["Toronto", 43.7, -79.4, 6],
    ],
  },
  EUR: {
    name: "Europäischer Bund",
    color: "#9b8cf0",
    aggression: 0.25,
    strength: 1.0,
    blurb: "Dichte Städte, gute Forschung, aber direkte Landgrenze zur Föderation.",
    cities: [
      ["Brüssel", 50.85, 4.35, 2],
      ["Paris", 48.86, 2.35, 11],
      ["Berlin", 52.52, 13.4, 4],
      ["Madrid", 40.4, -3.7, 6],
      ["Rom", 41.9, 12.5, 4],
      ["Warschau", 52.23, 21.0, 3],
    ],
  },
  EUF: {
    name: "Eurasische Föderation",
    color: "#e0564f",
    aggression: 0.75,
    strength: 1.1,
    blurb: "Riesiges Territorium, große Uranvorkommen, viele Fronten.",
    cities: [
      ["Moskau", 55.75, 37.6, 12],
      ["St. Petersburg", 59.9, 30.3, 5],
      ["Nowosibirsk", 55.0, 82.9, 2],
      ["Jekaterinburg", 56.8, 60.6, 2],
      ["Wladiwostok", 43.1, 131.9, 1],
    ],
  },
  PAZ: {
    name: "Pazifische Volksrepublik",
    color: "#f0b44c",
    aggression: 0.6,
    strength: 1.2,
    blurb: "Gewaltige Bevölkerung und Fabriken — aber jede Stadt ist ein Ziel.",
    cities: [
      ["Peking", 39.9, 116.4, 21],
      ["Shanghai", 31.2, 121.5, 25],
      ["Chongqing", 29.6, 106.5, 16],
      ["Guangzhou", 23.1, 113.3, 15],
      ["Wuhan", 30.6, 114.3, 11],
    ],
  },
  IND: {
    name: "Indischer Staatenbund",
    color: "#e98ac0",
    aggression: 0.4,
    strength: 0.95,
    blurb: "Größte Bevölkerung, schwache Bunker, wachsende Rüstung.",
    cities: [
      ["Neu-Delhi", 28.6, 77.2, 30],
      ["Mumbai", 19.1, 72.9, 20],
      ["Kolkata", 22.6, 88.4, 15],
      ["Bangalore", 12.97, 77.6, 12],
      ["Karatschi", 24.9, 67.0, 16],
    ],
  },
  SUD: {
    name: "Südamerikanische Liga",
    color: "#62d39a",
    aggression: 0.3,
    strength: 0.8,
    blurb: "Abgelegen und rohstoffreich, aber militärisch schwach.",
    cities: [
      ["Brasília", -15.8, -47.9, 4],
      ["São Paulo", -23.55, -46.6, 22],
      ["Buenos Aires", -34.6, -58.4, 15],
      ["Lima", -12.05, -77.0, 10],
      ["Bogotá", 4.7, -74.1, 11],
    ],
  },
  AFR: {
    name: "Afrikanische Allianz",
    color: "#d9cf6a",
    aggression: 0.35,
    strength: 0.8,
    blurb: "Reiche Minen, junge Bevölkerung, schwache Luftabwehr.",
    cities: [
      ["Abuja", 9.06, 7.5, 3],
      ["Lagos", 6.5, 3.4, 15],
      ["Kairo", 30.0, 31.2, 21],
      ["Kinshasa", -4.3, 15.3, 15],
      ["Nairobi", -1.3, 36.8, 5],
      ["Johannesburg", -26.2, 28.0, 6],
    ],
  },
};

// Landgrenzen → Bodenfronten möglich
export const ADJACENT: [NationId, NationId][] = [
  ["ATL", "SUD"],
  ["EUR", "EUF"],
  ["EUF", "PAZ"],
  ["PAZ", "IND"],
  ["EUR", "AFR"],
  ["IND", "EUF"],
];

export function areAdjacent(a: NationId, b: NationId) {
  return ADJACENT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

const FACILITY_PLAN: { type: FacilityType; city: number; dLat: number; dLon: number }[] = [
  { type: "mine", city: 2, dLat: 2.6, dLon: -3.1 },
  { type: "mine", city: 3, dLat: -2.4, dLon: 2.7 },
  { type: "factory", city: 1, dLat: 1.2, dLon: 1.6 },
  { type: "factory", city: 0, dLat: -1.4, dLon: -1.8 },
  { type: "silo", city: 0, dLat: 3.2, dLon: 3.6 },
  { type: "silo", city: 2, dLat: -3.0, dLon: 2.2 },
  { type: "airbase", city: 1, dLat: -2.0, dLon: -2.6 },
];

const TYPE_NAME: Record<FacilityType, string> = {
  mine: "Uranmine",
  factory: "Rüstungswerk",
  silo: "Raketensilo",
  airbase: "Fliegerhorst",
};
export const facilityName = (t: FacilityType) => TYPE_NAME[t];

export function createWorld(playerId: NationId): Game {
  const cities: City[] = [];
  const facilities: Facility[] = [];
  const nations = {} as Record<NationId, Nation>;

  for (const id of NATION_ORDER) {
    const def = NATION_DEFS[id];
    def.cities.forEach(([name, lat, lon, pop], i) => {
      cities.push({
        id: `${id}-c${i}`,
        nation: id,
        name,
        lat,
        lon,
        pop,
        initialPop: pop,
        dead: 0,
        sheltered: 0,
        bunkerLevel: i === 0 ? 2 : 1,
        unrest: 0,
        capital: i === 0,
        ruined: false,
      });
    });
    FACILITY_PLAN.forEach((f, i) => {
      const c = def.cities[f.city % def.cities.length]!;
      facilities.push({
        id: `${id}-f${i}`,
        nation: id,
        type: f.type,
        name: `${TYPE_NAME[f.type]} ${c[0]}`,
        lat: c[1] + f.dLat,
        lon: c[2] + f.dLon,
        hp: 100,
      });
    });
    const s = def.strength;
    const initialPop = def.cities.reduce((a, c) => a + c[3], 0);
    nations[id] = {
      id,
      name: def.name,
      color: def.color,
      isPlayer: id === playerId,
      alive: true,
      morale: 68,
      uranium: Math.round(60 * s),
      steel: Math.round(400 * s),
      energy: Math.round(300 * s),
      fighters: Math.round(12 * s),
      bombers: Math.round(6 * s),
      interceptors: Math.round(10 * s),
      warheads: Math.round(3 * s),
      troops: Math.round(100 * s),
      defcon: 5,
      research: { radar: 0, dome: 0, bunker: 0, yield: 0, industry: 0 },
      researching: null,
      aggression: id === playerId ? 0 : def.aggression,
      wars: [],
      allies: [],
      weariness: 0,
      coupCounter: 0,
      initialPop,
    };
  }

  return {
    tick: 0,
    playerId,
    nations,
    cities,
    facilities,
    missiles: [],
    flights: [],
    fronts: [],
    blasts: [],
    log: [
      {
        t: 0,
        level: "info",
        text: `Amtsantritt: Sie übernehmen das Kommando über die ${nations[playerId].name}.`,
      },
    ],
    queue: [],
    offers: [],
    escalation: 8,
    siren: false,
    launchArmed: false,
    status: "playing",
    nextId: 1,
  };
}
