import { create } from "zustand";
import { createWorld } from "./data";
import { step } from "./engine";
import { audio } from "./audio";
import type { Game, Layer, NationId } from "./types";

export type Tab = "economy" | "civil" | "military" | "research" | "diplomacy";
export interface Selection {
  kind: "city" | "facility";
  id: string;
}

// Kontinuierliche Zeit (Tick + Bruchteil) für flüssige Animationen — nicht reaktiv
export const clock = { t: 0 };

interface Store {
  g: Game | null;
  ver: number;
  speed: number;
  paused: boolean;
  layers: Record<Layer, boolean>;
  selected: Selection | null;
  tab: Tab;
  start: (id: NationId) => void;
  reset: () => void;
  act: <T>(fn: (g: Game) => T) => T | undefined;
  setSpeed: (s: number) => void;
  togglePause: () => void;
  toggleLayer: (l: Layer) => void;
  select: (s: Selection | null) => void;
  setTab: (t: Tab) => void;
}

export const useGame = create<Store>((set, get) => ({
  g: null,
  ver: 0,
  speed: 1,
  paused: false,
  layers: { military: true, civil: true, economy: false },
  selected: null,
  tab: "military",
  start: (id) => {
    const g = createWorld(id);
    clock.t = 0;
    set({ g, ver: get().ver + 1, paused: false, speed: 1, selected: null });
  },
  reset: () => {
    audio.setSiren(false);
    set({ g: null, ver: get().ver + 1, selected: null });
  },
  act: (fn) => {
    const g = get().g;
    if (!g) return undefined;
    const r = fn(g);
    set({ ver: get().ver + 1 });
    return r;
  },
  setSpeed: (speed) => set({ speed, paused: false }),
  togglePause: () => set({ paused: !get().paused }),
  toggleLayer: (l) => set({ layers: { ...get().layers, [l]: !get().layers[l] } }),
  select: (selected) => set({ selected }),
  setTab: (tab) => set({ tab }),
}));

/** Hauptschleife: läuft per requestAnimationFrame, 1 Tick = 1 Spielstunde = 1 s bei 1x */
export function startLoop() {
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const s = useGame.getState();
    const g = s.g;
    if (g && g.status === "playing" && !s.paused) {
      acc += dt * s.speed;
      let stepped = false;
      while (acc >= 1) {
        step(g);
        acc -= 1;
        stepped = true;
        for (const b of g.blasts) if (b.t === g.tick) audio.boom(b.nuclear, !!b.intercepted);
      }
      clock.t = g.tick + acc;
      if (stepped) useGame.setState({ ver: s.ver + 1 });
      audio.setSiren(g.siren && g.status === "playing");
    } else if (g) {
      clock.t = g.tick + acc;
      if (g.status !== "playing") audio.setSiren(false);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
