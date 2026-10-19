import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import borders from "@/game/borders.json";
import { arcPoints, ll, slerp } from "@/game/geo";
import { clock, useGame } from "@/game/store";
import { bunkerCapacity, frontCities } from "@/game/engine";
import type { Blast, City, Facility, Flight, Front, Game, Missile } from "@/game/types";

const VEC = "#3fd0c9"; // Vektorlinien
const HOSTILE = "#ff4b3e";

export function Globe() {
  const g = useGame((s) => s.g);
  const cap = g?.cities.find((c) => c.capital && c.nation === g.playerId);
  const camPos = useMemo(() => {
    const v = cap ? ll(cap.lat, cap.lon).multiplyScalar(2.9) : new THREE.Vector3(0, 0, 3);
    return v.toArray() as [number, number, number];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.playerId]);
  return (
    <Canvas camera={{ position: camPos, fov: 45, near: 0.01, far: 100 }} dpr={[1, 2]}>
      <color attach="background" args={["#03070b"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={0.8} />
      <Stars radius={40} depth={20} count={1500} factor={2} fade speed={0.3} />
      <Earth />
      <Atmosphere />
      <Graticule />
      <Borders />
      <Dynamic />
      <OrbitControls
        enablePan={false}
        minDistance={1.35}
        maxDistance={5}
        rotateSpeed={0.45}
        zoomSpeed={0.7}
        enableDamping
      />
    </Canvas>
  );
}

function Earth() {
  const select = useGame((s) => s.select);
  return (
    <mesh onClick={() => select(null)}>
      <sphereGeometry args={[1, 96, 96]} />
      <meshStandardMaterial color="#06121a" roughness={0.9} metalness={0.1} emissive="#031016" />
    </mesh>
  );
}

function Atmosphere() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { c: { value: new THREE.Color(VEC) } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 c; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(c, f*0.55); }`,
      }),
    [],
  );
  return (
    <mesh material={mat} scale={1.12}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

function Graticule() {
  const obj = useMemo(() => {
    const pts: number[] = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (let lat = -75; lat <= 75; lat += 15)
      for (let lon = -180; lon < 180; lon += 3) push(ll(lat, lon, 1.001), ll(lat, lon + 3, 1.001));
    for (let lon = -180; lon < 180; lon += 15)
      for (let lat = -87; lat < 87; lat += 3) push(ll(lat, lon, 1.001), ll(lat + 3, lon, 1.001));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: VEC, transparent: true, opacity: 0.07 }),
    );
  }, []);
  return <primitive object={obj} />;
}

function Borders() {
  const obj = useMemo(() => {
    const pts: number[] = [];
    for (const line of borders as number[][]) {
      for (let i = 0; i + 3 < line.length; i += 2) {
        const a = ll(line[i + 1]!, line[i]!, 1.002);
        const b = ll(line[i + 3]!, line[i + 2]!, 1.002);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: VEC, transparent: true, opacity: 0.55 }),
    );
  }, []);
  return <primitive object={obj} />;
}

// ---------- dynamische Ebene ----------
function Dynamic() {
  useGame((s) => s.ver);
  const g = useGame((s) => s.g);
  const layers = useGame((s) => s.layers);
  const selected = useGame((s) => s.selected);
  if (!g) return null;
  const showFac = (f: Facility) =>
    f.type === "mine" || f.type === "factory" ? layers.economy : layers.military;
  return (
    <group>
      {g.cities.map((c) => (
        <Territory key={`t-${c.id}`} c={c} color={g.nations[c.nation].alive ? g.nations[c.nation].color : "#3a3a3a"} capital={c.capital} dead={!g.nations[c.nation].alive} />
      ))}
      {g.cities.map((c) => (
        <CityMarker key={c.id} g={g} c={c} labels={layers.civil} selected={selected?.id === c.id} />
      ))}
      {g.facilities.filter(showFac).map((f) => (
        <FacilityMarker key={f.id} g={g} f={f} selected={selected?.id === f.id} />
      ))}
      {layers.military && g.fronts.map((fr) => <FrontLine key={`${fr.a}-${fr.b}`} g={g} fr={fr} />)}
      {layers.military &&
        g.facilities
          .filter((f) => f.type === "airbase" && f.hp > 0)
          .map((f) => (
            <FighterPatrol
              key={`p-${f.id}`}
              f={f}
              color={g.nations[f.nation].color}
              n={Math.min(4, Math.ceil(g.nations[f.nation].fighters / 6))}
            />
          ))}
      {g.missiles.map((m) => (
        <MissileArc key={m.id} m={m} color={m.targetNation === g.playerId ? HOSTILE : g.nations[m.owner].color} />
      ))}
      {g.flights.map((f) => (
        <FlightPath key={f.id} f={f} color={f.targetNation === g.playerId && f.phase === "out" ? HOSTILE : g.nations[f.owner].color} />
      ))}
      {g.blasts.map((b, i) => (
        <BlastFx key={`${b.t}-${i}-${b.lat}`} b={b} />
      ))}
    </group>
  );
}

function Territory({ c, color, capital, dead }: { c: City; color: string; capital: boolean; dead: boolean }) {
  const pos = useMemo(() => ll(c.lat, c.lon, 1.0012), [c.lat, c.lon]);
  const q = useSurfaceQuat(c.lat, c.lon);
  const r = capital ? 0.2 : 0.13;
  return (
    <group position={pos} quaternion={q}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[r, 40]} />
        <meshBasicMaterial color={color} transparent opacity={dead ? 0.35 : 0.22} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {dead && capital && (
        <Html position={[0, 0.03, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="globe-label" style={{ color: "#ff4b3e" }}>✕ ZERSTÖRT</div>
        </Html>
      )}
    </group>
  );
}

function useSurfaceQuat(lat: number, lon: number) {
  return useMemo(() => {
    const n = ll(lat, lon).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  }, [lat, lon]);
}

function CityMarker({ g, c, labels, selected }: { g: Game; c: City; labels: boolean; selected: boolean }) {
  const select = useGame((s) => s.select);
  const pos = useMemo(() => ll(c.lat, c.lon, 1.003), [c.lat, c.lon]);
  const q = useSurfaceQuat(c.lat, c.lon);
  const nation = g.nations[c.nation];
  const color = c.ruined ? "#555" : nation.color;
  const size = 0.006 + Math.sqrt(Math.max(c.pop, 0.2)) * 0.0035;
  const isPlayer = c.nation === g.playerId;
  const capPct = c.pop > 0 ? Math.min(100, (bunkerCapacity(g, c) / c.pop) * 100) : 0;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select({ kind: "city", id: c.id });
  };
  return (
    <group position={pos} quaternion={q}>
      <mesh onClick={onClick}>
        <cylinderGeometry args={[size, size, 0.004, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {c.capital && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
          <ringGeometry args={[size * 1.6, size * 2, 4]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
      )}
      {labels && isPlayer && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
          <ringGeometry args={[size * 2.4, size * 2.4 + 0.004, 32, 1, 0, (Math.PI * 2 * capPct) / 100]} />
          <meshBasicMaterial color="#62d39a" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
      {selected && <SelectRing r={size * 3} />}
      {(labels || c.capital) && (
        <Html position={[0, 0.01, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="globe-label" style={{ color }}>
            {c.name}
            {labels && isPlayer && c.sheltered > 0.01 && (
              <span className="text-hud-green"> ▼{Math.round((c.sheltered / Math.max(0.01, c.pop)) * 100)}%</span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function SelectRing({ r }: { r: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock: c }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(c.elapsedTime * 5) * 0.15);
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={0.003}>
      <ringGeometry args={[r, r + 0.005, 32]} />
      <meshBasicMaterial color="#ffb547" side={THREE.DoubleSide} />
    </mesh>
  );
}

function FacilityMarker({ g, f, selected }: { g: Game; f: Facility; selected: boolean }) {
  const select = useGame((s) => s.select);
  const pos = useMemo(() => ll(f.lat, f.lon, 1.002), [f.lat, f.lon]);
  const q = useSurfaceQuat(f.lat, f.lon);
  const dead = f.hp <= 0;
  const color = dead ? "#3a3f44" : g.nations[f.nation].color;
  const s = 0.012;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select({ kind: "facility", id: f.id });
  };
  return (
    <group position={pos} quaternion={q}>
      <mesh onClick={onClick} position-y={s * 0.6}>
        {f.type === "mine" && <octahedronGeometry args={[s * 0.8]} />}
        {f.type === "factory" && <boxGeometry args={[s * 1.2, s * 0.8, s * 1.2]} />}
        {f.type === "silo" && <coneGeometry args={[s * 0.55, s * 1.8, 6]} />}
        {f.type === "airbase" && <tetrahedronGeometry args={[s * 0.9]} />}
        <meshBasicMaterial color={color} wireframe={!dead && f.type !== "silo"} />
      </mesh>
      {selected && <SelectRing r={s * 1.8} />}
    </group>
  );
}

function FrontLine({ g, fr }: { g: Game; fr: Front }) {
  const obj = useMemo(() => {
    const pair = frontCities(g, fr.a, fr.b);
    if (!pair) return null;
    const a = ll(pair[0].lat, pair[0].lon).normalize();
    const b = ll(pair[1].lat, pair[1].lon).normalize();
    const center = slerp(a, b, 0.5 + fr.progress * 0.38);
    const dir = b.clone().sub(a).normalize();
    const perp = new THREE.Vector3().crossVectors(center, dir).normalize();
    const pts: THREE.Vector3[] = [];
    const L = 0.16;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12 - 0.5;
      const zig = (i % 2 === 0 ? 1 : -1) * 0.008;
      pts.push(
        center
          .clone()
          .add(perp.clone().multiplyScalar(t * L))
          .add(dir.clone().multiplyScalar(zig))
          .normalize()
          .multiplyScalar(1.004),
      );
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: HOSTILE }));
  }, [g, fr.a, fr.b, fr.progress]);
  if (!obj) return null;
  return <primitive object={obj} />;
}

function FighterPatrol({ f, color, n }: { f: Facility; color: string; n: number }) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => ll(f.lat, f.lon, 1.02), [f.lat, f.lon]);
  const q = useSurfaceQuat(f.lat, f.lon);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.8;
  });
  return (
    <group position={pos} quaternion={q}>
      <group ref={ref}>
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04]} rotation-y={-a}>
              <coneGeometry args={[0.004, 0.012, 3]} />
              <meshBasicMaterial color={color} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

const SEG = 80;
function useArc(fromLat: number, fromLon: number, toLat: number, toLon: number, height: number) {
  return useMemo(() => arcPoints(fromLat, fromLon, toLat, toLon, SEG, height), [fromLat, fromLon, toLat, toLon, height]);
}

function MissileArc({ m, color }: { m: Missile; color: string }) {
  const pts = useArc(m.fromLat, m.fromLon, m.toLat, m.toLon, 0.35);
  const head = useRef<THREE.Mesh>(null);
  const { line, ghost } = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    const ghost = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color, dashSize: 0.02, gapSize: 0.02, transparent: true, opacity: 0.25 }),
    );
    ghost.computeLineDistances();
    return { line, ghost };
  }, [pts, color]);
  useFrame(() => {
    const p = Math.min(1, Math.max(0, (clock.t - m.launchT) / Math.max(1, m.arriveT - m.launchT)));
    const idx = Math.floor(p * SEG);
    line.geometry.setDrawRange(0, idx + 1);
    if (head.current) {
      const a = pts[idx];
      const b = pts[Math.min(SEG, idx + 1)];
      if (!a || !b) return;
      head.current.position.lerpVectors(a, b, p * SEG - idx);
    }
  });
  return (
    <group>
      <primitive object={ghost} />
      <primitive object={line} />
      <mesh ref={head}>
        <sphereGeometry args={[0.009, 10, 10]} />
        <meshBasicMaterial color="#fff3d6" />
      </mesh>
    </group>
  );
}

function FlightPath({ f, color }: { f: Flight; color: string }) {
  const pts = useArc(f.fromLat, f.fromLon, f.toLat, f.toLon, 0.03);
  const head = useRef<THREE.Mesh>(null);
  const line = useMemo(() => {
    const l = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color, dashSize: 0.012, gapSize: 0.01, transparent: true, opacity: 0.7 }),
    );
    l.computeLineDistances();
    return l;
  }, [pts, color]);
  useFrame(() => {
    const p = Math.min(1, Math.max(0, (clock.t - f.launchT) / Math.max(1, f.arriveT - f.launchT)));
    const idx = Math.min(SEG - 1, Math.floor(p * SEG));
    if (head.current) {
      head.current.position.lerpVectors(pts[idx]!, pts[idx + 1]!, p * SEG - idx);
      head.current.lookAt(pts[idx + 1]!);
      head.current.rotateX(Math.PI / 2);
    }
  });
  return (
    <group>
      <primitive object={line} />
      <mesh ref={head}>
        <coneGeometry args={[0.008, 0.024, 3]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function BlastFx({ b }: { b: Blast }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const pos = useMemo(() => ll(b.lat, b.lon, b.intercepted ? 1.12 : 1.0), [b]);
  const max = b.nuclear ? 0.09 : b.intercepted ? 0.03 : 0.035;
  useFrame(() => {
    const age = Math.max(0, clock.t - b.t);
    const k = Math.min(1, age / 3);
    if (ref.current) ref.current.scale.setScalar(0.1 + Math.sqrt(k) * 1);
    if (mat.current) mat.current.opacity = 1 - k;
  });
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[max, 20, 20]} />
      <meshBasicMaterial
        ref={mat}
        color={b.nuclear ? "#ffd29a" : b.intercepted ? "#9ff0ff" : "#ff8a3d"}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
