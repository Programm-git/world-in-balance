import { areAdjacent, facilityName } from "./data";
import type {
  City,
  Facility,
  Game,
  LogEntry,
  Nation,
  NationId,
  QueueItemKind,
  ResearchKey,
} from "./types";

// ---------- Regeln / Konstanten ----------
export const REBELLION_WARNING = 25; // Moral < 25% → Rebellionswarnung
export const STRIKE_THRESHOLD = 25;
export const COUP_THRESHOLD = 10; // Moral < 10% über COUP_TICKS → Putsch
export const COUP_TICKS = 48;
export const MAX_BUNKER = 5;
export const MAX_RESEARCH = 3;

export interface Cost {
  steel?: number;
  uranium?: number;
  energy?: number;
}

export const BUILD: Record<QueueItemKind, { label: string; cost: Cost; ticks: number }> = {
  fighter: { label: "Jägerstaffel", cost: { steel: 40, energy: 20 }, ticks: 6 },
  bomber: { label: "Bomberstaffel", cost: { steel: 60, energy: 30 }, ticks: 10 },
  interceptor: { label: "Abfangrakete", cost: { steel: 15, energy: 10 }, ticks: 3 },
  warhead: { label: "Nuklearsprengkopf", cost: { uranium: 25, steel: 20 }, ticks: 12 },
  silo: { label: "Raketensilo", cost: { steel: 150, energy: 40 }, ticks: 24 },
  mine: { label: "Uranmine", cost: { steel: 80 }, ticks: 16 },
  factory: { label: "Rüstungswerk", cost: { steel: 120, energy: 30 }, ticks: 20 },
  bunker: { label: "Bunker-Ausbau", cost: { steel: 50 }, ticks: 8 },
};

export const RESEARCH: Record<ResearchKey, { label: string; desc: string }> = {
  radar: { label: "Radar-Frühwarnung", desc: "Raketen früher erkennen, bessere Abfangquote" },
  dome: { label: "Abwehrschirm", desc: "Höhere Trefferquote der Abfangraketen" },
  bunker: { label: "Tiefbunker", desc: "+25% Schutzraumkapazität pro Stufe" },
  yield: { label: "Sprengkraft", desc: "Stärkere Nuklearsprengköpfe" },
  industry: { label: "Industrieautomation", desc: "+20% Produktion pro Stufe" },
};

export const researchCost = (lvl: number) => 100 * (lvl + 1);
export const researchTicks = (lvl: number) => 24 * (lvl + 1);
export const bunkerCost = (lvl: number) => 50 * (lvl + 1);

// ---------- Helfer ----------
const rand = () => Math.random();
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function angularDist(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function log(g: Game, text: string, level: LogEntry["level"] = "info") {
  g.log.unshift({ t: g.tick, text, level });
  if (g.log.length > 80) g.log.length = 80;
}

export const citiesOf = (g: Game, id: NationId) => g.cities.filter((c) => c.nation === id);
export const facilitiesOf = (g: Game, id: NationId, type?: Facility["type"]) =>
  g.facilities.filter((f) => f.nation === id && f.hp > 0 && (!type || f.type === type));
export const nationPop = (g: Game, id: NationId) =>
  citiesOf(g, id).reduce((a, c) => a + c.pop, 0);
export const nationDead = (g: Game, id: NationId) =>
  g.cities.filter((c) => c.nation === id).reduce((a, c) => a + c.dead, 0);
export const nationSheltered = (g: Game, id: NationId) =>
  citiesOf(g, id).reduce((a, c) => a + c.sheltered, 0);

export function bunkerCapacity(g: Game, c: City) {
  const n = g.nations[c.nation];
  return c.pop * 0.12 * c.bunkerLevel * (1 + 0.25 * n.research.bunker);
}

export function canAfford(n: Nation, cost: Cost) {
  return (
    n.steel >= (cost.steel ?? 0) &&
    n.uranium >= (cost.uranium ?? 0) &&
    n.energy >= (cost.energy ?? 0)
  );
}
function pay(n: Nation, cost: Cost) {
  n.steel -= cost.steel ?? 0;
  n.uranium -= cost.uranium ?? 0;
  n.energy -= cost.energy ?? 0;
}

export const atWar = (g: Game, a: NationId, b: NationId) => g.nations[a].wars.includes(b);
export const allied = (g: Game, a: NationId, b: NationId) => g.nations[a].allies.includes(b);

function readiness(defcon: number) {
  return defcon >= 5 ? 0.3 : defcon === 4 ? 0.6 : defcon === 3 ? 0.85 : 1;
}

export function flightTicks(dist: number, kind: "missile" | "bomber") {
  return kind === "missile" ? Math.round(3 + dist * 6) : Math.round(3 + dist * 12);
}

export function hourToDate(tick: number) {
  const d = new Date(Date.UTC(2031, 3, 1, 6, 0, 0) + tick * 3600_000);
  return d;
}

// ---------- Diplomatie ----------
export function declareWar(g: Game, a: NationId, b: NationId) {
  if (a === b || atWar(g, a, b)) return;
  const A = g.nations[a];
  const B = g.nations[b];
  if (!A.alive || !B.alive) return;
  A.allies = A.allies.filter((x) => x !== b);
  B.allies = B.allies.filter((x) => x !== a);
  A.wars.push(b);
  B.wars.push(a);
  g.escalation = clamp(g.escalation + 7, 0, 100);
  if (areAdjacent(a, b)) g.fronts.push({ a, b, progress: 0 });
  const involvesPlayer = a === g.playerId || b === g.playerId;
  log(g, `KRIEGSERKLÄRUNG: ${A.name} erklärt ${B.name} den Krieg.`, involvesPlayer ? "crit" : "warn");
  // Bündnisverpflichtungen
  for (const allyId of B.allies) {
    const ally = g.nations[allyId];
    if (ally.alive && !atWar(g, allyId, a) && rand() < (allyId === g.playerId ? 0 : 0.55)) {
      declareWar(g, allyId, a);
    }
  }
}

export function makePeace(g: Game, a: NationId, b: NationId) {
  const A = g.nations[a];
  const B = g.nations[b];
  A.wars = A.wars.filter((x) => x !== b);
  B.wars = B.wars.filter((x) => x !== a);
  g.fronts = g.fronts.filter((f) => !((f.a === a && f.b === b) || (f.a === b && f.b === a)));
  A.weariness *= 0.6;
  B.weariness *= 0.6;
  g.escalation = clamp(g.escalation - 4, 0, 100);
  log(g, `Waffenstillstand zwischen ${A.name} und ${B.name}.`, "good");
}

export function makeAlliance(g: Game, a: NationId, b: NationId) {
  if (allied(g, a, b)) return;
  g.nations[a].allies.push(b);
  g.nations[b].allies.push(a);
  log(g, `Bündnis geschlossen: ${g.nations[a].name} & ${g.nations[b].name}.`, "good");
}

// ---------- Angriffe ----------
function nearestFacility(g: Game, id: NationId, type: Facility["type"], lat: number, lon: number) {
  let best: Facility | null = null;
  let bd = Infinity;
  for (const f of facilitiesOf(g, id, type)) {
    const d = angularDist(f.lat, f.lon, lat, lon);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

export function targetPos(g: Game, kind: "city" | "facility", id: string) {
  if (kind === "city") {
    const c = g.cities.find((x) => x.id === id);
    return c ? { lat: c.lat, lon: c.lon, nation: c.nation, name: c.name } : null;
  }
  const f = g.facilities.find((x) => x.id === id);
  return f ? { lat: f.lat, lon: f.lon, nation: f.nation, name: f.name } : null;
}

export function launchMissile(
  g: Game,
  owner: NationId,
  kind: "city" | "facility",
  targetId: string,
): string | null {
  const n = g.nations[owner];
  const t = targetPos(g, kind, targetId);
  if (!t) return "Kein Ziel";
  if (t.nation === owner) return "Eigenes Ziel";
  if (n.warheads < 1) return "Keine Sprengköpfe";
  const silo = nearestFacility(g, owner, "silo", t.lat, t.lon);
  if (!silo) return "Kein einsatzfähiges Silo";
  if (!atWar(g, owner, t.nation)) declareWar(g, owner, t.nation);
  n.warheads -= 1;
  const dist = angularDist(silo.lat, silo.lon, t.lat, t.lon);
  g.missiles.push({
    id: g.nextId++,
    owner,
    targetNation: t.nation,
    fromLat: silo.lat,
    fromLon: silo.lon,
    toLat: t.lat,
    toLon: t.lon,
    targetKind: kind,
    targetId,
    launchT: g.tick,
    arriveT: g.tick + flightTicks(dist, "missile"),
    detected: false,
  });
  g.escalation = clamp(g.escalation + 5, 0, 100);
  const lvl = owner === g.playerId ? "crit" : t.nation === g.playerId ? "crit" : "warn";
  log(g, `Abschuss: ${n.name} feuert Atomrakete auf ${t.name}.`, lvl);
  return null;
}

export function sendBombers(
  g: Game,
  owner: NationId,
  kind: "city" | "facility",
  targetId: string,
  count: number,
): string | null {
  const n = g.nations[owner];
  const t = targetPos(g, kind, targetId);
  if (!t) return "Kein Ziel";
  if (t.nation === owner) return "Eigenes Ziel";
  count = Math.min(count, Math.floor(n.bombers));
  if (count < 1) return "Keine Bomber verfügbar";
  const base = nearestFacility(g, owner, "airbase", t.lat, t.lon);
  if (!base) return "Kein Fliegerhorst";
  if (!atWar(g, owner, t.nation)) declareWar(g, owner, t.nation);
  n.bombers -= count;
  const dist = angularDist(base.lat, base.lon, t.lat, t.lon);
  g.flights.push({
    id: g.nextId++,
    owner,
    count,
    fromLat: base.lat,
    fromLon: base.lon,
    toLat: t.lat,
    toLon: t.lon,
    targetKind: kind,
    targetId,
    targetNation: t.nation,
    launchT: g.tick,
    arriveT: g.tick + flightTicks(dist, "bomber"),
    phase: "out",
  });
  g.escalation = clamp(g.escalation + 1.5, 0, 100);
  log(
    g,
    `${n.name}: ${count} Bomberstaffel(n) Richtung ${t.name} gestartet.`,
    t.nation === g.playerId ? "warn" : "info",
  );
  return null;
}

function moraleHit(g: Game, id: NationId, amount: number) {
  const n = g.nations[id];
  n.morale = clamp(n.morale - amount, 0, 100);
}

function killInCity(g: Game, c: City, unshelteredFrac: number, shelteredFrac: number) {
  const unsheltered = Math.max(0, c.pop - c.sheltered);
  const k = unsheltered * unshelteredFrac + c.sheltered * shelteredFrac;
  const kShel = c.sheltered * shelteredFrac;
  c.pop = Math.max(0, c.pop - k);
  c.sheltered = Math.max(0, c.sheltered - kShel);
  c.dead += k;
  return k;
}

function resolveMissile(g: Game, m: Game["missiles"][number]) {
  const def = g.nations[m.targetNation];
  const att = g.nations[m.owner];
  const t = targetPos(g, m.targetKind, m.targetId);
  const name = t?.name ?? "Ziel";
  // Abfangversuch
  if (def.alive && def.interceptors > 0 && facilitiesOf(g, def.id).length > 0) {
    const ready = readiness(def.defcon);
    const chance = clamp((0.25 + def.research.dome * 0.12 + def.research.radar * 0.04) * ready, 0, 0.85);
    def.interceptors -= 1;
    if (rand() < chance) {
      g.blasts.push({ lat: m.toLat, lon: m.toLon, t: g.tick, nuclear: false, intercepted: true });
      log(
        g,
        `Abfangerfolg über ${name}: Rakete der ${att.name} zerstört.`,
        m.targetNation === g.playerId ? "good" : "info",
      );
      def.morale = clamp(def.morale + 1.5, 0, 100);
      return;
    }
  }
  g.blasts.push({ lat: m.toLat, lon: m.toLon, t: g.tick, nuclear: true });
  const yieldMult = 1 + att.research.yield * 0.15;
  let killed = 0;
  for (const c of g.cities) {
    const d = angularDist(c.lat, c.lon, m.toLat, m.toLon) * 57.3;
    if (d < 0.5) {
      killed += killInCity(g, c, clamp(0.4 * yieldMult, 0, 0.9), 0.03);
      c.bunkerLevel = Math.max(0, c.bunkerLevel - 1);
      if (c.capital && c.pop < c.initialPop * 0.5) c.ruined = true;
      if (c.pop < c.initialPop * 0.2) c.ruined = true;
    } else if (d < 3) {
      killed += killInCity(g, c, 0.05, 0);
    }
  }
  for (const f of g.facilities) {
    const d = angularDist(f.lat, f.lon, m.toLat, m.toLon) * 57.3;
    if (d < 3) f.hp = 0;
  }
  const frac = killed / Math.max(1, def.initialPop);
  moraleHit(g, def.id, 5 + frac * 250);
  att.morale = clamp(att.morale - 1, 0, 100); // auch eigene Bevölkerung erschrickt
  g.escalation = clamp(g.escalation + 6, 0, 100);
  for (const n of Object.values(g.nations)) if (n.alive && n.id !== def.id) n.morale -= 0.8;
  log(
    g,
    `NUKLEARER EINSCHLAG in ${name} (${def.name}): ${killed.toFixed(2)} Mio. Tote.`,
    m.targetNation === g.playerId || m.owner === g.playerId ? "crit" : "warn",
  );
}

function resolveBomberArrival(g: Game, f: Game["flights"][number]) {
  const def = g.nations[f.targetNation];
  const ready = readiness(def.defcon);
  const defF = def.fighters * ready;
  const lossFrac = clamp((defF / (defF + f.count * 2)) * 0.7, 0, 0.9);
  const lost = Math.round(f.count * lossFrac * (0.6 + rand() * 0.6));
  const survivors = Math.max(0, f.count - lost);
  def.fighters = Math.max(0, def.fighters - lost * 0.3);
  const t = targetPos(g, f.targetKind, f.targetId);
  const name = t?.name ?? "Ziel";
  if (lost > 0)
    log(
      g,
      `Luftkampf über ${name}: ${lost} Bomber der ${g.nations[f.owner].name} abgeschossen.`,
      f.targetNation === g.playerId ? "good" : "info",
    );
  if (survivors > 0) {
    g.blasts.push({ lat: f.toLat, lon: f.toLon, t: g.tick, nuclear: false });
    if (f.targetKind === "facility") {
      const fac = g.facilities.find((x) => x.id === f.targetId);
      if (fac && fac.hp > 0) {
        fac.hp = Math.max(0, fac.hp - 28 * survivors);
        log(
          g,
          `Bombardement: ${fac.name} ${fac.hp <= 0 ? "zerstört" : `beschädigt (${Math.round(fac.hp)}%)`}.`,
          f.targetNation === g.playerId ? "warn" : "info",
        );
      }
      moraleHit(g, def.id, 1.5);
    } else {
      const c = g.cities.find((x) => x.id === f.targetId);
      if (c) {
        const k = killInCity(g, c, 0.004 * survivors, 0.0002);
        c.unrest = clamp(c.unrest + 10, 0, 100);
        moraleHit(g, def.id, 2.5 + (k / Math.max(1, def.initialPop)) * 300);
        log(
          g,
          `Bombenangriff auf ${c.name}: ${(k * 1000).toFixed(0)} Tsd. Tote.`,
          f.targetNation === g.playerId ? "crit" : "info",
        );
      }
    }
  }
  f.count = survivors;
  f.phase = "back";
  const dur = f.arriveT - f.launchT;
  f.launchT = g.tick;
  f.arriveT = g.tick + dur;
  [f.fromLat, f.toLat] = [f.toLat, f.fromLat];
  [f.fromLon, f.toLon] = [f.toLon, f.fromLon];
}

// ---------- Spieleraktionen ----------
export function enqueue(g: Game, kind: QueueItemKind, cityId?: string): string | null {
  const n = g.nations[g.playerId];
  let cost = BUILD[kind].cost;
  if (kind === "bunker") {
    const c = g.cities.find((x) => x.id === cityId);
    if (!c) return "Keine Stadt";
    const pending = g.queue.filter((q) => q.kind === "bunker" && q.cityId === cityId).length;
    if (c.bunkerLevel + pending >= MAX_BUNKER) return "Maximale Ausbaustufe";
    cost = { steel: bunkerCost(c.bunkerLevel + pending) };
  }
  if (!canAfford(n, cost)) return "Nicht genug Ressourcen";
  pay(n, cost);
  const ticks = BUILD[kind].ticks;
  g.queue.push({ id: g.nextId++, kind, remaining: ticks, total: ticks, cityId });
  return null;
}

export function startResearch(g: Game, key: ResearchKey): string | null {
  const n = g.nations[g.playerId];
  if (n.researching) return "Forschung läuft bereits";
  const lvl = n.research[key];
  if (lvl >= MAX_RESEARCH) return "Maximalstufe erreicht";
  const c = researchCost(lvl);
  if (n.energy < c) return "Nicht genug Energie";
  n.energy -= c;
  n.researching = { key, remaining: researchTicks(lvl), total: researchTicks(lvl) };
  return null;
}

export function mobilize(g: Game) {
  const n = g.nations[g.playerId];
  n.troops *= 1.2;
  n.morale = clamp(n.morale - 4, 0, 100);
  log(g, "Generalmobilmachung angeordnet. Truppenstärke +20%.", "warn");
}

export function proposePeace(g: Game, target: NationId): boolean {
  const t = g.nations[target];
  const p = g.nations[g.playerId];
  const chance = clamp(0.15 + t.weariness / 120 + (60 - t.morale) / 150 - t.aggression * 0.2, 0.05, 0.9);
  if (rand() < chance) {
    makePeace(g, g.playerId, target);
    return true;
  }
  log(g, `${t.name} lehnt Ihr Friedensangebot ab.`, "warn");
  p.morale = clamp(p.morale - 0.5, 0, 100);
  return false;
}

export function proposeAlliance(g: Game, target: NationId): boolean {
  const t = g.nations[target];
  if (atWar(g, g.playerId, target)) return false;
  const sharedEnemy = t.wars.some((w) => g.nations[g.playerId].wars.includes(w));
  const chance = clamp((sharedEnemy ? 0.6 : 0.15) + (0.5 - t.aggression) * 0.4, 0.05, 0.85);
  if (rand() < chance) {
    makeAlliance(g, g.playerId, target);
    return true;
  }
  log(g, `${t.name} lehnt ein Bündnis ab.`, "info");
  return false;
}

export function respondOffer(g: Game, offerId: number, accept: boolean) {
  const o = g.offers.find((x) => x.id === offerId);
  if (!o) return;
  g.offers = g.offers.filter((x) => x.id !== offerId);
  if (!accept) {
    log(g, `Angebot der ${g.nations[o.from].name} abgelehnt.`, "info");
    return;
  }
  if (o.kind === "peace") makePeace(g, g.playerId, o.from);
  else makeAlliance(g, g.playerId, o.from);
}

// ---------- KI ----------
function aiTurn(g: Game, n: Nation) {
  const mult = 1 + g.tick / 1500; // Welt rüstet auf
  // Produktion
  const buys: QueueItemKind[] = ["interceptor", "fighter", "bomber", "interceptor"];
  for (let i = 0; i < 2; i++) {
    const k = buys[Math.floor(rand() * buys.length)];
    const cost = BUILD[k].cost;
    if (canAfford(n, cost)) {
      pay(n, cost);
      if (k === "interceptor") n.interceptors += 1;
      if (k === "fighter") n.fighters += 1;
      if (k === "bomber") n.bombers += 1;
    }
  }
  if (n.uranium >= 25 && n.steel >= 20 && rand() < 0.4 * mult) {
    n.uranium -= 25;
    n.steel -= 20;
    n.warheads += 1;
  }
  if (rand() < 0.08) {
    const cs = citiesOf(g, n.id).filter((c) => c.bunkerLevel < MAX_BUNKER);
    const c = cs[Math.floor(rand() * cs.length)];
    if (c && n.steel > bunkerCost(c.bunkerLevel) + 50) {
      n.steel -= bunkerCost(c.bunkerLevel);
      c.bunkerLevel += 1;
    }
  }
  // DEFCON
  const base = 5 - Math.floor(g.escalation / 22);
  n.defcon = clamp(n.wars.length > 0 ? Math.min(base, 3) : base, 1, 5);
  // Sirenen der KI: bei Krieg Teil der Bevölkerung schützen
  // Kriegserklärung
  const others = Object.values(g.nations).filter(
    (o) => o.alive && o.id !== n.id && !n.allies.includes(o.id) && !n.wars.includes(o.id),
  );
  const pWar = n.aggression * (g.escalation / 100) * 0.06 * mult;
  if (others.length && rand() < pWar && n.morale > 30) {
    const weights = others.map(
      (o) =>
        (areAdjacent(n.id, o.id) ? 2 : 1) *
        (o.isPlayer ? 1 + g.tick / 600 : 1) *
        (1.5 - o.morale / 100),
    );
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rand() * sum;
    for (let i = 0; i < others.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        declareWar(g, n.id, others[i].id);
        break;
      }
    }
  }
  // Bündnisse
  if (rand() < 0.02) {
    const cand = Object.values(g.nations).filter(
      (o) =>
        o.alive &&
        !o.isPlayer &&
        o.id !== n.id &&
        !n.allies.includes(o.id) &&
        !n.wars.includes(o.id) &&
        o.wars.some((w) => n.wars.includes(w)),
    );
    if (cand.length) makeAlliance(g, n.id, cand[0].id);
  }
  // Angebote an Spieler
  const P = g.playerId;
  if (rand() < 0.012 && !g.offers.some((o) => o.from === n.id)) {
    if (n.wars.includes(P) && (n.weariness > 40 || n.morale < 35)) {
      g.offers.push({ id: g.nextId++, from: n.id, kind: "peace", expires: g.tick + 24 });
      log(g, `${n.name} bietet einen Waffenstillstand an.`, "good");
    } else if (
      !n.wars.includes(P) &&
      !n.allies.includes(P) &&
      n.wars.some((w) => g.nations[P].wars.includes(w))
    ) {
      g.offers.push({ id: g.nextId++, from: n.id, kind: "alliance", expires: g.tick + 24 });
      log(g, `${n.name} schlägt ein Bündnis vor.`, "info");
    }
  }
  // KI untereinander: Frieden bei Erschöpfung
  for (const w of [...n.wars]) {
    const o = g.nations[w];
    if (!o.isPlayer && n.weariness > 70 && o.weariness > 50 && rand() < 0.03) makePeace(g, n.id, w);
  }
  // Angriffe
  for (const w of n.wars) {
    const enemy = g.nations[w];
    if (!enemy.alive) continue;
    if (n.bombers >= 2 && rand() < 0.12 * mult) {
      const facs = facilitiesOf(g, w);
      const useCity = rand() < 0.3 || facs.length === 0;
      if (useCity) {
        const cs = citiesOf(g, w);
        const c = cs[Math.floor(rand() * cs.length)];
        if (c) sendBombers(g, n.id, "city", c.id, Math.ceil(n.bombers * 0.4));
      } else {
        const f = facs[Math.floor(rand() * facs.length)];
        sendBombers(g, n.id, "facility", f.id, Math.ceil(n.bombers * 0.4));
      }
    }
    if (
      n.warheads > 0 &&
      g.escalation > 55 &&
      n.defcon <= 2 &&
      rand() < (g.escalation / 100) * 0.05 * n.aggression * mult
    ) {
      const silos = facilitiesOf(g, w, "silo");
      if (silos.length && rand() < 0.5) launchMissile(g, n.id, "facility", silos[0].id);
      else {
        const cs = citiesOf(g, w).sort((a, b) => b.pop - a.pop);
        const c = rand() < 0.4 ? cs.find((x) => x.capital) : cs[0];
        if (c) launchMissile(g, n.id, "city", c.id);
      }
    }
  }
}

// ---------- Siegbedingungen ----------
function checkNation(g: Game, n: Nation) {
  if (!n.alive) return;
  const cap = g.cities.find((c) => c.nation === n.id && c.capital);
  const pop = nationPop(g, n.id);
  let reason: string | null = null;
  if (!cap || cap.ruined) reason = "Hauptstadt vernichtet";
  else if (pop < n.initialPop * 0.12) reason = "Militärisch besiegt";
  else if (n.morale <= 0) reason = "Regierung durch Volksaufstand gestürzt";
  else if (n.coupCounter >= COUP_TICKS) reason = "Gewaltsamer Putsch";
  if (!reason) return;
  n.alive = false;
  n.defeatedReason = reason;
  for (const o of Object.values(g.nations)) {
    o.wars = o.wars.filter((x) => x !== n.id);
    o.allies = o.allies.filter((x) => x !== n.id);
  }
  g.fronts = g.fronts.filter((f) => f.a !== n.id && f.b !== n.id);
  g.offers = g.offers.filter((o) => o.from !== n.id);
  n.wars = [];
  n.allies = [];
  if (n.isPlayer) {
    g.status = "lost";
    g.endReason = reason;
    log(g, `NIEDERLAGE: ${reason}.`, "crit");
  } else {
    log(g, `${n.name} ist gefallen: ${reason}.`, "warn");
  }
}

export function checkVictory(g: Game) {
  if (g.status !== "playing") return;
  const p = g.nations[g.playerId];
  if (!p.alive) return;
  const others = Object.values(g.nations).filter((n) => !n.isPlayer);
  const defeated = others.filter((n) => !n.alive).length;
  const remainingHostile = others.filter((n) => n.alive && !p.allies.includes(n.id));
  if (remainingHostile.length === 0 && defeated >= 1) {
    g.status = "won";
    g.endReason = "Alle feindlichen Nationen sind besiegt oder gestürzt.";
    log(g, "SIEG: Die Welt ordnet sich unter Ihrer Führung neu.", "good");
  }
}

// ---------- Simulationsschritt (1 Tick = 1 Stunde) ----------
export function step(g: Game) {
  if (g.status !== "playing") return;
  g.tick += 1;
  const P = g.playerId;
  const scarcity = 1 - Math.min(0.5, g.tick / 4000);

  // Eskalation
  const wars = Object.values(g.nations).reduce((a, n) => a + n.wars.length, 0) / 2;
  g.escalation = clamp(g.escalation + (0.012 + wars * 0.01) * (1 + g.tick / 600), 0, 100);

  for (const n of Object.values(g.nations)) {
    if (!n.alive) continue;
    const mines = facilitiesOf(g, n.id, "mine").length;
    const factories = facilitiesOf(g, n.id, "factory").length;
    const strike = n.morale < STRIKE_THRESHOLD ? 0.5 : 1;
    const shelter = n.isPlayer && g.siren ? 0.6 : 1;
    const ind = (1 + 0.2 * n.research.industry) * strike * shelter;
    const aiMult = n.isPlayer ? 1 : 0.9 + g.tick / 2000;
    n.steel += (mines * 0.8 * scarcity + factories * 0.9 + 0.5) * ind * aiMult;
    n.uranium += mines * 0.22 * scarcity * ind * aiMult;
    n.energy += (1.5 + factories * 0.5) * ind * aiMult;
    n.troops += (nationPop(g, n.id) / 100) * 0.02;
    if (n.isPlayer) {
      if (g.siren) n.energy -= 0.6;
      if (n.defcon <= 2) {
        n.energy -= 0.4;
        g.escalation = clamp(g.escalation + 0.01, 0, 100);
      }
    }
    n.energy = Math.max(0, n.energy);

    // Forschung
    if (n.researching) {
      n.researching.remaining -= 1;
      if (n.researching.remaining <= 0) {
        n.research[n.researching.key] += 1;
        if (n.isPlayer)
          log(g, `Forschung abgeschlossen: ${RESEARCH[n.researching.key].label} Stufe ${n.research[n.researching.key]}.`, "good");
        n.researching = null;
      }
    } else if (!n.isPlayer && rand() < 0.01) {
      const keys = Object.keys(n.research) as ResearchKey[];
      const k = keys[Math.floor(rand() * keys.length)];
      if (n.research[k] < MAX_RESEARCH && n.energy > researchCost(n.research[k])) {
        n.energy -= researchCost(n.research[k]);
        n.researching = { key: k, remaining: researchTicks(n.research[k]), total: researchTicks(n.research[k]) };
      }
    }

    // Moral
    n.weariness = clamp(n.weariness + n.wars.length * 0.03 - (n.wars.length === 0 ? 0.05 : 0), 0, 100);
    const deadFrac = nationDead(g, n.id) / Math.max(1, n.initialPop);
    const target = clamp(64 + n.allies.length * 3 - n.weariness * 0.35 - deadFrac * 120, 0, 85);
    n.morale = clamp(n.morale + (target - n.morale) * 0.01, 0, 100);
    if (n.isPlayer && g.siren) {
      const threat = g.missiles.some((m) => m.targetNation === P) || g.flights.some((f) => f.targetNation === P && f.phase === "out");
      if (!threat) n.morale = clamp(n.morale - 0.03, 0, 100);
    }
    if (n.morale < COUP_THRESHOLD) n.coupCounter += 1;
    else n.coupCounter = Math.max(0, n.coupCounter - 2);

    // Städte: Unruhe & Schutzräume
    const isSiren = n.isPlayer
      ? g.siren
      : g.missiles.some((m) => m.targetNation === n.id) && n.defcon <= 3;
    for (const c of citiesOf(g, n.id)) {
      const cap = bunkerCapacity(g, c);
      if (isSiren) c.sheltered = Math.min(cap, c.pop, c.sheltered + cap * 0.25);
      else c.sheltered = Math.max(0, c.sheltered - cap * 0.2);
      const unrestTarget = clamp((45 - n.morale) * 2.2, 0, 100);
      c.unrest = clamp(c.unrest + (unrestTarget - c.unrest) * 0.04, 0, 100);
    }
    if (!n.isPlayer && g.tick % 6 === (NATION_IDX[n.id] ?? 0) % 6) aiTurn(g, n);
  }

  // Spieler-Produktion (parallel = Anzahl Rüstungswerke)
  const player = g.nations[P];
  const lanes = Math.max(1, facilitiesOf(g, P, "factory").length);
  const speed = (player.morale < STRIKE_THRESHOLD ? 0.5 : 1) * (1 + 0.2 * player.research.industry);
  for (const q of g.queue.slice(0, lanes)) q.remaining -= speed;
  for (const q of g.queue.filter((x) => x.remaining <= 0)) {
    completeItem(g, q.kind, q.cityId);
  }
  g.queue = g.queue.filter((x) => x.remaining > 0);

  // Raketen
  const radar = player.research.radar;
  for (const m of g.missiles) {
    if (m.targetNation === P && !m.detected) {
      const prog = (g.tick - m.launchT) / Math.max(1, m.arriveT - m.launchT);
      if (prog >= Math.max(0, 0.45 - radar * 0.15)) {
        m.detected = true;
        log(g, `RADARALARM: Anfliegende Rakete der ${g.nations[m.owner].name} — ETA ${m.arriveT - g.tick} Std.`, "crit");
      }
    }
  }
  const arrived = g.missiles.filter((m) => g.tick >= m.arriveT);
  g.missiles = g.missiles.filter((m) => g.tick < m.arriveT);
  for (const m of arrived) resolveMissile(g, m);

  // Flüge
  for (const f of g.flights) {
    if (g.tick >= f.arriveT) {
      if (f.phase === "out") resolveBomberArrival(g, f);
      else {
        g.nations[f.owner].bombers += f.count;
        f.count = 0;
      }
    }
  }
  g.flights = g.flights.filter((f) => f.count > 0 && !(f.phase === "back" && g.tick >= f.arriveT));

  // Fronten
  for (const fr of g.fronts) {
    const A = g.nations[fr.a];
    const B = g.nations[fr.b];
    const ratio = (A.troops - B.troops) / Math.max(1, A.troops + B.troops);
    fr.progress += ratio * 0.012 + (rand() - 0.5) * 0.01;
    A.troops *= 0.9985;
    B.troops *= 0.9985;
    if (Math.abs(fr.progress) >= 1) {
      const winner = fr.progress > 0 ? A : B;
      const loser = fr.progress > 0 ? B : A;
      const pair = frontCities(g, fr.a, fr.b);
      const lost = pair ? (fr.progress > 0 ? pair[1] : pair[0]) : null;
      if (lost && !lost.capital) {
        lost.nation = winner.id;
        lost.sheltered = 0;
        loser.morale = clamp(loser.morale - 8, 0, 100);
        winner.morale = clamp(winner.morale + 3, 0, 100);
        log(g, `FRONT: ${winner.name} erobert ${lost.name}.`, loser.isPlayer ? "crit" : winner.isPlayer ? "good" : "warn");
      } else if (lost && lost.capital) {
        lost.ruined = true;
        log(g, `FRONT: ${winner.name} nimmt die Hauptstadt ${lost.name} ein!`, "crit");
      }
      fr.progress = 0;
    }
  }

  // Abgelaufene Angebote & alte Explosionen
  g.offers = g.offers.filter((o) => o.expires > g.tick);
  g.blasts = g.blasts.filter((b) => g.tick - b.t < 4);

  // Warnungen für Spieler
  if (player.morale < REBELLION_WARNING && g.tick % 24 === 0)
    log(g, "WARNUNG: Unruhen und Streiks im ganzen Land. Rebellion droht!", "crit");

  for (const n of Object.values(g.nations)) checkNation(g, n);
  checkVictory(g);
}

const NATION_IDX: Record<string, number> = { ATL: 0, EUR: 1, EUF: 2, PAZ: 3, IND: 4, SUD: 5, AFR: 6 };

function completeItem(g: Game, kind: QueueItemKind, cityId?: string) {
  const P = g.playerId;
  const n = g.nations[P];
  switch (kind) {
    case "fighter":
      n.fighters += 1;
      break;
    case "bomber":
      n.bombers += 1;
      break;
    case "interceptor":
      n.interceptors += 1;
      break;
    case "warhead":
      n.warheads += 1;
      break;
    case "bunker": {
      const c = g.cities.find((x) => x.id === cityId);
      if (c && c.nation === P) {
        c.bunkerLevel = Math.min(MAX_BUNKER, c.bunkerLevel + 1);
        log(g, `Bunker in ${c.name} auf Stufe ${c.bunkerLevel} ausgebaut.`, "good");
      }
      break;
    }
    default: {
      const cs = citiesOf(g, P);
      const base = cs[Math.floor(rand() * cs.length)] ?? g.cities.find((c) => c.capital && c.nation === P)!;
      const f: Facility = {
        id: `${P}-n${g.nextId++}`,
        nation: P,
        type: kind as Facility["type"],
        name: `${facilityName(kind as Facility["type"])} ${base.name} ${g.nextId}`,
        lat: base.lat + (rand() - 0.5) * 5,
        lon: base.lon + (rand() - 0.5) * 6,
        hp: 100,
      };
      g.facilities.push(f);
      log(g, `${f.name} in Betrieb genommen.`, "good");
    }
  }
}

export function frontCities(g: Game, a: NationId, b: NationId): [City, City] | null {
  const ca = citiesOf(g, a);
  const cb = citiesOf(g, b);
  let best: [City, City] | null = null;
  let bd = Infinity;
  for (const x of ca)
    for (const y of cb) {
      const d = angularDist(x.lat, x.lon, y.lat, y.lon);
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    }
  return best;
}
