export type NationId = "ATL" | "EUR" | "EUF" | "PAZ" | "IND" | "SUD" | "AFR";
export type FacilityType = "mine" | "factory" | "silo" | "airbase";
export type ResearchKey = "radar" | "dome" | "bunker" | "yield" | "industry";
export type Layer = "military" | "civil" | "economy";

export interface City {
  id: string;
  nation: NationId;
  name: string;
  lat: number;
  lon: number;
  pop: number; // Millionen
  initialPop: number;
  dead: number;
  sheltered: number;
  bunkerLevel: number; // 0..5
  unrest: number; // 0..100
  capital: boolean;
  ruined: boolean;
}

export interface Facility {
  id: string;
  nation: NationId;
  type: FacilityType;
  name: string;
  lat: number;
  lon: number;
  hp: number; // 0..100
}

export interface Nation {
  id: NationId;
  name: string;
  color: string;
  isPlayer: boolean;
  alive: boolean;
  defeatedReason?: string;
  morale: number;
  uranium: number;
  steel: number;
  energy: number;
  fighters: number;
  bombers: number;
  interceptors: number;
  warheads: number;
  troops: number;
  defcon: number;
  research: Record<ResearchKey, number>;
  researching: { key: ResearchKey; remaining: number; total: number } | null;
  aggression: number;
  wars: NationId[];
  allies: NationId[];
  weariness: number;
  coupCounter: number;
  initialPop: number;
}

export interface Missile {
  id: number;
  owner: NationId;
  targetNation: NationId;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  targetKind: "city" | "facility";
  targetId: string;
  launchT: number;
  arriveT: number;
  detected: boolean;
}

export interface Flight {
  id: number;
  owner: NationId;
  count: number;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  targetKind: "city" | "facility";
  targetId: string;
  targetNation: NationId;
  launchT: number;
  arriveT: number;
  phase: "out" | "back";
}

export interface Front {
  a: NationId;
  b: NationId;
  progress: number; // -1..1, positiv = a rückt vor
}

export interface Blast {
  lat: number;
  lon: number;
  t: number;
  nuclear: boolean;
  intercepted?: boolean;
}

export interface LogEntry {
  t: number;
  text: string;
  level: "info" | "warn" | "crit" | "good";
}

export type QueueItemKind =
  | "fighter"
  | "bomber"
  | "interceptor"
  | "warhead"
  | "silo"
  | "mine"
  | "factory"
  | "bunker";

export interface QueueItem {
  id: number;
  kind: QueueItemKind;
  remaining: number;
  total: number;
  cityId?: string;
}

export interface Offer {
  id: number;
  from: NationId;
  kind: "peace" | "alliance";
  expires: number;
}

export interface Game {
  tick: number;
  playerId: NationId;
  nations: Record<NationId, Nation>;
  cities: City[];
  facilities: Facility[];
  missiles: Missile[];
  flights: Flight[];
  fronts: Front[];
  blasts: Blast[];
  log: LogEntry[];
  queue: QueueItem[];
  offers: Offer[];
  escalation: number;
  siren: boolean;
  launchArmed: boolean;
  status: "playing" | "won" | "lost";
  endReason?: string;
  nextId: number;
}
