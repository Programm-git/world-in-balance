import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Crosshair, FlaskConical, Shield, Minus, Plus } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Globe } from "./Globe";
import { NATION_DEFS, NATION_ORDER } from "@/game/data";
import { startLoop, useGame } from "@/game/store";
import { audio } from "@/game/audio";
import {
  BUILD, RESEARCH, REBELLION_WARNING, MAX_RESEARCH, bunkerCapacity, bunkerCost, citiesOf, declareWar,
  enqueue, facilitiesOf, hourToDate, launchMissile, mobilize, nationDead, nationPop, nationSheltered,
  proposeAlliance, proposePeace, researchCost, respondOffer, sendBombers, startResearch, targetPos,
} from "@/game/engine";
import type { Layer, NationId, QueueItemKind, ResearchKey } from "@/game/types";

const fmt = (n: number, d = 0) => n.toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d });
const err = (e: string | null | undefined) => { if (e) toast.error(e); else audio.click(); };

function useActiveGame() {
  const g = useGame((s) => s.g);
  if (!g) throw new Error("Keine aktive Partie");
  return g;
}

function HudButton({ className = "", ...props }: ButtonProps) {
  return <Button variant="ghost" className={`h-auto min-h-8 whitespace-normal rounded-sm ${className}`} {...props} />;
}

export function WarRoom() {
  const g = useGame((s) => s.g);
  useEffect(() => startLoop(), []);
  if (!g) return <StartScreen />;
  return (
    <div className="warroom grid min-h-screen grid-rows-[auto_1fr_auto] lg:h-screen lg:overflow-hidden bg-background text-foreground">
      <div className="fixed z-50"><Toaster theme="dark" position="top-center" /></div>
      <TopBar />
      <div className="relative min-h-0">
        <div className="relative h-[320px] min-h-0 lg:h-full">
          <Globe />
          <LayerToggles />
        </div>
      </div>
      <Desk />
      {g.status !== "playing" && <EndScreen />}
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`hud-panel ${className}`}>
      <h3 className="hud-title">{title}</h3>
      {children}
    </section>
  );
}

function Bar({ v, tone }: { v: number; tone: string }) {
  return (
    <div className="h-1.5 w-full bg-muted">
      <div className={`h-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
    </div>
  );
}

function TopBar() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const act = useGame((s) => s.act);
  const p = g.nations[g.playerId];
  const pop = nationPop(g, p.id);
  const mTone = p.morale < REBELLION_WARNING ? "bg-hud-red" : p.morale < 45 ? "bg-hud-amber" : "bg-hud-green";
  return (
    <header className="flex items-center gap-4 overflow-x-auto border-b border-border bg-card px-4 py-2 text-xs [&>div]:shrink-0">
      <div>
        <div className="font-display text-lg leading-none tracking-normal" style={{ color: p.color }}>{p.name.toUpperCase()}</div>
        <div className="text-muted-foreground">Situationszentrum</div>
      </div>
      <Stat label="Bevölkerung" value={`${fmt(pop, 1)} Mio`} />
      <Stat label="Im Bunker" value={`${fmt(nationSheltered(g, p.id), 1)} Mio`} tone="text-hud-green" />
      <Stat label="Gefallene" value={`${fmt(nationDead(g, p.id), 2)} Mio`} tone="text-hud-red" />
      <div className="w-40">
        <div className="flex justify-between text-muted-foreground"><span>Volksmoral</span><span>{fmt(p.morale)}%</span></div>
        <Bar v={p.morale} tone={mTone} />
        {p.morale < REBELLION_WARNING && <div className="mt-0.5 animate-pulse font-bold text-hud-red">⚠ REBELLION DROHT</div>}
      </div>
      <Stat label="Uran" value={`${fmt(p.uranium)} kg`} tone="text-hud-amber" />
      <Stat label="Stahl" value={fmt(p.steel)} />
      <Stat label="Energie" value={fmt(p.energy)} />
      <div className="ml-auto flex items-center gap-1">
        <span className="mr-1 text-muted-foreground">DEFCON</span>
        {[5, 4, 3, 2, 1].map((d) => (
          <HudButton key={d} onClick={() => act((g) => { g.nations[g.playerId].defcon = d; })}
            className={`h-8 w-8 border font-display text-base ${p.defcon === d ? "defcon-on border-transparent" : "border-border text-muted-foreground hover:text-foreground"}`}
            data-level={d}>{d}</HudButton>
        ))}
      </div>
    </header>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div><div className="text-muted-foreground">{label}</div><div className={`font-display text-base ${tone}`}>{value}</div></div>;
}

function LeftMonitor() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const select = useGame((s) => s.select);
  const p = g.nations[g.playerId];
  return (
    <aside className="min-h-0 space-y-2">
      <Panel title="Zivilschutz · Städte">
        {citiesOf(g, p.id).map((c) => {
          const cap = bunkerCapacity(g, c);
          return (
            <HudButton key={c.id} onClick={() => select({ kind: "city", id: c.id })} className="mb-2 block w-full text-left text-xs">
              <div className="flex justify-between">
                <span className={c.ruined ? "text-muted-foreground line-through" : ""}>{c.capital ? "★ " : ""}{c.name}</span>
                <span className="text-muted-foreground">{fmt(c.pop, 1)} Mio</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                Bunker {"■".repeat(c.bunkerLevel)}{"□".repeat(5 - c.bunkerLevel)}
                <span className="ml-auto">{fmt(c.sheltered, 1)}/{fmt(cap, 1)}</span>
              </div>
              <Bar v={c.pop ? (c.sheltered / c.pop) * 100 : 0} tone="bg-hud-green" />
              {p.morale < 25 ? <div className="text-[10px] text-hud-red">STREIK</div> : c.unrest > 40 ? <div className="text-[10px] text-hud-amber">Unruhen {fmt(c.unrest)}%</div> : null}
            </HudButton>
          );
        })}
      </Panel>
    </aside>
  );
}

function RightMonitor() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const p = g.nations[g.playerId];
  const incoming = g.missiles.filter((m) => m.targetNation === p.id && m.detected);
  const bombers = g.flights.filter((f) => f.targetNation === p.id && f.phase === "out");
  return (
    <aside className="grid min-h-0 gap-3 text-xs sm:grid-cols-2">
      <Panel title="Radar · Frühwarnung">
        {incoming.length === 0 && bombers.length === 0 && <div className="text-muted-foreground">Luftraum ruhig.</div>}
        {incoming.map((m) => (
          <div key={m.id} className="flex animate-pulse justify-between text-hud-red">
            <span>☢ {g.nations[m.owner].name.split(" ")[0]} → {targetPos(g, m.targetKind, m.targetId)?.name}</span>
            <span>ETA {m.arriveT - g.tick}h</span>
          </div>
        ))}
        {bombers.map((f) => (
          <div key={f.id} className="flex justify-between text-hud-amber">
            <span>✈ {f.count}× → {targetPos(g, f.targetKind, f.targetId)?.name}</span><span>ETA {f.arriveT - g.tick}h</span>
          </div>
        ))}
      </Panel>
      <Panel title="Militärbereitschaft">
        {[["Jäger", p.fighters], ["Bomber", p.bombers], ["Abfangraketen", p.interceptors], ["Sprengköpfe", p.warheads], ["Bodentruppen", p.troops]].map(([l, v]) => (
          <div key={l as string} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span>{fmt(v as number)}</span></div>
        ))}
      </Panel>
      <Panel title="Silos & Fliegerhorste">
        {g.facilities.filter((f) => f.nation === p.id && (f.type === "silo" || f.type === "airbase")).map((f) => (
          <div key={f.id} className="flex justify-between">
            <span>{f.name}</span>
            <span className={f.hp <= 0 ? "text-hud-red" : "text-hud-green"}>{f.hp <= 0 ? "ZERSTÖRT" : `${fmt(f.hp)}%`}</span>
          </div>
        ))}
      </Panel>
      <Panel title="Fronten">
        {g.fronts.filter((f) => f.a === p.id || f.b === p.id).length === 0 && <div className="text-muted-foreground">Keine Bodenkämpfe.</div>}
        {g.fronts.filter((f) => f.a === p.id || f.b === p.id).map((f) => {
          const mine = f.a === p.id ? f.progress : -f.progress;
          const enemy = g.nations[f.a === p.id ? f.b : f.a];
          return <div key={enemy.id}><div className="flex justify-between"><span>vs {enemy.name}</span><span>{mine > 0 ? "Vormarsch" : "Rückzug"}</span></div><Bar v={50 + mine * 50} tone="bg-hud-amber" /></div>;
        })}
      </Panel>
      <Panel title="Globale Eskalation">
        <Bar v={g.escalation} tone="bg-hud-red" />
        <div className="mt-1 text-muted-foreground">{fmt(g.escalation)}% — {g.escalation > 75 ? "Weltkrieg" : g.escalation > 45 ? "Kriegsgefahr" : "Spannungen"}</div>
      </Panel>
    </aside>
  );
}

function LayerToggles() {
  const layers = useGame((s) => s.layers);
  const toggle = useGame((s) => s.toggleLayer);
  const L: [Layer, string][] = [["military", "Militär"], ["civil", "Zivilschutz"], ["economy", "Wirtschaft"]];
  return (
    <div className="absolute left-1/2 top-3 flex -translate-x-1/2 gap-1">
      {L.map(([k, l]) => (
        <HudButton key={k} onClick={() => toggle(k)} className={`hud-btn ${layers[k] ? "hud-btn-on" : ""}`}>{l}</HudButton>
      ))}
    </div>
  );
}

function TargetCard() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const sel = useGame((s) => s.selected);
  const act = useGame((s) => s.act);
  const [n, setN] = useState(3);
  if (!sel) return <div className="border-l-2 border-hud-teal py-2 pl-3 text-muted-foreground">Kein Angriffsziel ausgewählt.</div>;
  const t = targetPos(g, sel.kind, sel.id);
  if (!t) return null;
  const p = g.nations[g.playerId];
  const own = t.nation === g.playerId;
  const city = sel.kind === "city" ? g.cities.find((c) => c.id === sel.id) : null;
  return (
    <div className="border-l-2 border-hud-teal pl-3 text-xs">
      <div className="flex justify-between">
        <span className="font-display text-base">{t.name}</span>
        <span style={{ color: g.nations[t.nation].color }}>{g.nations[t.nation].name}</span>
      </div>
      {city && <div className="text-muted-foreground">{fmt(city.pop, 1)} Mio Einwohner · Bunkerstufe {city.bunkerLevel}</div>}
      {own ? (
        city && <HudButton className="hud-btn mt-2" onClick={() => err(act((g) => enqueue(g, "bunker", city.id)))}>Bunker ausbauen ({bunkerCost(city.bunkerLevel)} Stahl)</HudButton>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <HudButton className="hud-btn" aria-label="Weniger Bomber" onClick={() => setN(Math.max(1, n - 1))}><Minus /></HudButton>
          <span>{n}</span>
          <HudButton className="hud-btn" aria-label="Mehr Bomber" onClick={() => setN(n + 1)}><Plus /></HudButton>
          <HudButton className="hud-btn" disabled={p.defcon > 3} onClick={() => err(act((g) => sendBombers(g, g.playerId, sel.kind, sel.id, n)))}>
            Konventioneller Bomberangriff {p.defcon > 3 && "(DEFCON ≤3)"}
          </HudButton>
          <HudButton className="hud-btn hud-btn-danger" disabled={p.defcon > 1 || !g.launchArmed}
            onClick={() => err(act((g) => launchMissile(g, g.playerId, sel.kind, sel.id)))}>
            ☢ Atomrakete starten {(p.defcon > 1 || !g.launchArmed) && "(DEFCON 1 + Freigabe)"}
          </HudButton>
        </div>
      )}
    </div>
  );
}

function Desk() {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const tabs = [
    { key: "research" as const, label: "Forschung", Icon: FlaskConical },
    { key: "military" as const, label: "Kriegsführung", Icon: Crosshair },
    { key: "civil" as const, label: "Zivil", Icon: Shield },
  ];
  return (
    <footer className="desk border-t border-border bg-card lg:h-[410px]">
      <div className="grid min-h-0 lg:h-full lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="grid shrink-0 grid-cols-3 border-b border-border" role="tablist" aria-label="Kontrollraum">
            {tabs.map(({ key, label, Icon }) => <HudButton key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-12 rounded-none ${tab === key ? "hud-btn-on" : "text-muted-foreground"}`}><Icon /><span>{label}</span></HudButton>)}
          </div>
          <div role="tabpanel" aria-label={tabs.find((t) => t.key === tab)?.label} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-xs">
            {tab === "research" && <Research />}
            {tab === "military" && <><CommandSection title="Nationen im Spiel"><NationsStatus /></CommandSection><CommandSection title="Bau · Waffenproduktion"><WeaponBuild /></CommandSection><CommandSection title="Angriffe"><AttackOrders /></CommandSection><CommandSection title="Rüstung & Mobilisierung"><Military /></CommandSection><CommandSection title="Diplomatie"><Diplomacy /></CommandSection><CommandSection title="Lage & Bereitschaft"><RightMonitor /></CommandSection></>}
            {tab === "civil" && <><CommandSection title="Evakuierung"><Emergency kind="civil" /></CommandSection><CommandSection title="Bunker ausbauen"><Civil /></CommandSection><CommandSection title="Städte & Bevölkerung"><LeftMonitor /></CommandSection><CommandSection title="Wirtschaft & Infrastruktur"><Economy /></CommandSection></>}
          </div>
        </div>
        <div className="min-h-0 border-t border-border p-3 lg:border-l lg:border-t-0"><TimeAndLog /></div>
      </div>
    </footer>
  );
}

function CommandSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="hud-title mb-2">{title}</h3>{children}</section>;
}

function NationsStatus() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const all = Object.values(g.nations);
  const alive = all.filter((n) => n.alive).length;
  return <div className="space-y-2">
    <div>Noch aktiv: <b className="text-hud-green">{alive}</b> von {all.length} Nationen</div>
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {all.map((n) => <div key={n.id} className={`flex items-center gap-2 ${n.alive ? "" : "text-muted-foreground line-through"}`}>
        <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: n.alive ? n.color : "#444" }} />
        <span className="min-w-0 flex-1 truncate">{n.name}{n.id === g.playerId ? " (Sie)" : ""}</span>
        <span className={n.alive ? "text-hud-green" : "text-hud-red"}>{n.alive ? `${fmt(nationPop(g, n.id), 0)} Mio` : "ZERSTÖRT"}</span>
      </div>)}
    </div>
  </div>;
}

function WeaponBuild() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const p = g.nations[g.playerId];
  const inQueue = g.queue.filter((q) => q.kind === "warhead").length;
  return <div className="space-y-2">
    <div className="text-muted-foreground">Vorrat: <b className="text-foreground">{fmt(p.warheads)}</b> Sprengköpfe{inQueue > 0 ? ` · ${inQueue} in Produktion` : ""} · Uran: {fmt(p.uranium)} kg</div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><BuildBtn k="warhead" /><BuildBtn k="interceptor" /><BuildBtn k="bomber" /><BuildBtn k="fighter" /></div>
    <div className="text-[10px] text-muted-foreground">Uran kommt aus Minen (Zivil → Wirtschaft). Mehr Rüstungswerke = mehr parallele Produktion.</div>
  </div>;
}

function AttackOrders() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const act = useGame((s) => s.act);
  const p = g.nations[g.playerId];
  const targets = [
    ...g.cities.filter((c) => c.nation !== p.id && !c.ruined && g.nations[c.nation].alive).map((c) => ({ ...c, kind: "city" as const })),
    ...g.facilities.filter((f) => f.nation !== p.id && f.hp > 0 && g.nations[f.nation].alive).map((f) => ({ ...f, kind: "facility" as const })),
  ];
  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-muted-foreground">Angriffsziel
        <select aria-label="Angriffsziel" className="h-10 w-full min-w-0 rounded-sm border border-border bg-background px-2 text-foreground" value={selected ? `${selected.kind}:${selected.id}` : ""} onChange={(e) => { const target = targets.find((t) => `${t.kind}:${t.id}` === e.target.value); select(target ? { kind: target.kind, id: target.id } : null); }}>
          <option value="">Ziel auswählen</option>
          {targets.map((t) => <option key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>{g.nations[t.nation].name} · {t.name}</option>)}
        </select>
      </label>
      <div><div className="mb-1 text-muted-foreground">DEFCON</div><div className="flex gap-1">{[5,4,3,2,1].map((d) => <HudButton key={d} aria-label={`DEFCON ${d}`} aria-pressed={p.defcon === d} className={`hud-btn h-10 w-10 ${p.defcon === d ? "defcon-on" : ""}`} data-level={d} onClick={() => act((g) => { g.nations[g.playerId].defcon = d; })}>{d}</HudButton>)}</div></div>
    </div>
    <TargetCard />
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground"><span>Bomber: {fmt(p.bombers)}</span><span>Atomraketen: {fmt(p.warheads)}</span><span>Abfangraketen: {fmt(p.interceptors)} · automatische Verteidigung</span></div>
    <Emergency kind="military" />
  </div>;
}

function BuildBtn({ k }: { k: QueueItemKind }) {
  const act = useGame((s) => s.act);
  const b = BUILD[k];
  const c = Object.entries(b.cost).map(([r, v]) => `${v} ${r === "steel" ? "Stahl" : r === "uranium" ? "kg U" : "Energie"}`).join(", ");
  return <HudButton className="hud-btn text-left" onClick={() => err(act((g) => enqueue(g, k)))}>{b.label}<div className="text-[10px] text-muted-foreground">{c} · {b.ticks}h</div></HudButton>;
}

function Queue() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const lanes = Math.max(1, facilitiesOf(g, g.playerId, "factory").length);
  return (
    <div className="mt-2">
      <div className="text-muted-foreground">Produktion ({lanes} Fertigungslinie{lanes > 1 ? "n" : ""})</div>
      {g.queue.length === 0 && <div className="text-muted-foreground">— leer —</div>}
      {g.queue.map((q, i) => (
        <div key={q.id} className={i < lanes ? "" : "opacity-50"}>{BUILD[q.kind].label} <Bar v={(1 - q.remaining / q.total) * 100} tone="bg-hud-teal" /></div>
      ))}
    </div>
  );
}

function Economy() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><BuildBtn k="mine" /><BuildBtn k="factory" /><BuildBtn k="silo" /></div>
        <Queue />
      </div>
      <div>
        {g.facilities.filter((f) => f.nation === g.playerId && (f.type === "mine" || f.type === "factory")).map((f) => (
          <div key={f.id} className="flex justify-between"><span>{f.name}</span><span className={f.hp <= 0 ? "text-hud-red" : ""}>{f.hp <= 0 ? "zerstört" : `${fmt(f.hp)}%`}</span></div>
        ))}
      </div>
    </div>
  );
}

function Civil() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const act = useGame((s) => s.act);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {citiesOf(g, g.playerId).map((c) => (
        <HudButton key={c.id} className="hud-btn text-left" onClick={() => err(act((g) => enqueue(g, "bunker", c.id)))}>
          {c.name} · Stufe {c.bunkerLevel}/5
          <div className="text-[10px] text-muted-foreground">Ausbau {bunkerCost(c.bunkerLevel)} Stahl · Kapazität {fmt(bunkerCapacity(g, c), 1)} Mio</div>
        </HudButton>
      ))}
    </div>
  );
}

function Military() {
  const act = useGame((s) => s.act);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid grid-cols-2 gap-1">
        <BuildBtn k="fighter" /><BuildBtn k="bomber" /><BuildBtn k="interceptor" /><BuildBtn k="warhead" />
        <HudButton className="hud-btn col-span-2" onClick={() => act((g) => mobilize(g))}>Generalmobilmachung (+20% Truppen, −4 Moral)</HudButton>
      </div>
      <div><Queue /></div>
    </div>
  );
}

function Research() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const act = useGame((s) => s.act);
  const p = g.nations[g.playerId];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {(Object.keys(RESEARCH) as ResearchKey[]).map((k) => {
        const lvl = p.research[k];
        const active = p.researching?.key === k;
        return (
          <HudButton key={k} className={`hud-btn text-left ${active ? "hud-btn-on" : ""}`} onClick={() => err(act((g) => startResearch(g, k)))}>
            {RESEARCH[k].label} {lvl}/{MAX_RESEARCH}
            <div className="text-[10px] text-muted-foreground">{RESEARCH[k].desc}</div>
            {active && p.researching ? <Bar v={(1 - p.researching.remaining / p.researching.total) * 100} tone="bg-hud-teal" /> : lvl < MAX_RESEARCH && <div className="text-[10px]">{researchCost(lvl)} Energie</div>}
          </HudButton>
        );
      })}
    </div>
  );
}

function Diplomacy() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const act = useGame((s) => s.act);
  const p = g.nations[g.playerId];
  return (
    <div>
      {g.offers.map((o) => (
        <div key={o.id} className="mb-1 flex items-center gap-2 text-hud-amber">
          {g.nations[o.from].name}: {o.kind === "peace" ? "Waffenstillstand" : "Bündnis"}?
          <HudButton className="hud-btn" onClick={() => act((g) => respondOffer(g, o.id, true))}>Annehmen</HudButton>
          <HudButton className="hud-btn" onClick={() => act((g) => respondOffer(g, o.id, false))}>Ablehnen</HudButton>
        </div>
      ))}
      {Object.values(g.nations).filter((n) => !n.isPlayer).map((n) => {
        const war = p.wars.includes(n.id), ally = p.allies.includes(n.id);
        return (
          <div key={n.id} className="flex items-center gap-2 border-b border-border py-1">
            <span className="w-48" style={{ color: n.color }}>{n.name}</span>
            <span className="w-28">{!n.alive ? `✝ ${n.defeatedReason}` : war ? <b className="text-hud-red">KRIEG</b> : ally ? <span className="text-hud-green">Verbündet</span> : "Neutral"}</span>
            {n.alive && <span className="w-24 text-muted-foreground">Moral {fmt(n.morale)}%</span>}
            {n.alive && !war && <HudButton className="hud-btn" onClick={() => act((g) => declareWar(g, g.playerId, n.id as NationId))}>Krieg erklären</HudButton>}
            {n.alive && war && <HudButton className="hud-btn" onClick={() => act((g) => proposePeace(g, n.id))}>Frieden anbieten</HudButton>}
            {n.alive && !war && !ally && <HudButton className="hud-btn" onClick={() => act((g) => proposeAlliance(g, n.id))}>Bündnis anbieten</HudButton>}
          </div>
        );
      })}
    </div>
  );
}

function Emergency({ kind }: { kind: "civil" | "military" }) {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const act = useGame((s) => s.act);
  return (
    <div className="flex flex-col gap-2">
      {kind === "civil" && <HudButton onClick={() => { audio.init(); act((g) => { g.siren = !g.siren; }); }}
        className={`emergency ${g.siren ? "emergency-on animate-pulse" : ""}`}>
        {g.siren ? "SIRENEN AKTIV · Evakuierung" : "Zivilschutz-Sirenen"}
      </HudButton>}
      {kind === "military" && <HudButton onClick={() => { audio.init(); act((g) => { g.launchArmed = !g.launchArmed; }); }}
        className={`emergency emergency-red ${g.launchArmed ? "emergency-on" : ""}`}>
        {g.launchArmed ? "☢ ATOMRAKETEN FREIGEGEBEN" : "Atomraketen-Abschussfreigabe"}
      </HudButton>}
    </div>
  );
}

function TimeAndLog() {
  useGame((s) => s.ver);
  const g = useActiveGame();
  const { speed, paused, setSpeed, togglePause } = useGame();
  const d = hourToDate(g.tick);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1">
        <HudButton className="hud-btn" onClick={() => { audio.init(); togglePause(); }}>{paused ? "▶" : "❚❚"}</HudButton>
        {[1, 2, 5].map((s) => <HudButton key={s} className={`hud-btn ${!paused && speed === s ? "hud-btn-on" : ""}`} onClick={() => { audio.init(); setSpeed(s); }}>{s}x</HudButton>)}
        <div className="ml-auto text-right font-display">
          <div>{d.toLocaleDateString("de-DE")}</div>
          <div className="text-xs text-muted-foreground">{String(d.getUTCHours()).padStart(2, "0")}:00 Zulu</div>
        </div>
      </div>
      <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto text-[11px]">
        {g.log.map((l, i) => (
          <div key={i} className={l.level === "crit" ? "text-hud-red" : l.level === "warn" ? "text-hud-amber" : l.level === "good" ? "text-hud-green" : "text-muted-foreground"}>
            [{String(hourToDate(l.t).getUTCHours()).padStart(2, "0")}h] {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function StartScreen() {
  const start = useGame((s) => s.start);
  return (
    <div className="warroom flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-foreground">
      <h1 className="font-display text-3xl sm:text-5xl text-hud-amber">SITUATIONSZENTRUM</h1>
      <p className="max-w-xl text-center text-sm text-muted-foreground">Wählen Sie Ihre Nation. Schützen Sie Ihr Volk, halten Sie die Moral und überstehen Sie die Eskalation zum Weltkrieg.</p>
      <div className="grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4">
        {NATION_ORDER.map((id) => (
          <HudButton key={id} onClick={() => { audio.init(); start(id); }} className="hud-panel text-left hover:border-hud-amber">
            <div className="font-display text-lg" style={{ color: NATION_DEFS[id].color }}>{NATION_DEFS[id].name}</div>
            <div className="text-xs text-muted-foreground">{NATION_DEFS[id].blurb}</div>
          </HudButton>
        ))}
      </div>
    </div>
  );
}

function EndScreen() {
  const g = useActiveGame();
  const reset = useGame((s) => s.reset);
  const won = g.status === "won";
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80">
      <h2 className={`font-display text-6xl tracking-normal ${won ? "text-hud-green" : "text-hud-red"}`}>{won ? "SIEG" : "NIEDERLAGE"}</h2>
      <p>{g.endReason}</p>
      <p className="text-sm text-muted-foreground">Gefallene: {fmt(nationDead(g, g.playerId), 2)} Mio · Tage im Amt: {Math.floor(g.tick / 24)}</p>
      <HudButton className="hud-btn hud-btn-on" onClick={reset}>Neues Spiel</HudButton>
    </div>
  );
}
