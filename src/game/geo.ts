import * as THREE from "three";

export const GLOBE_R = 1;

export function ll(lat: number, lon: number, r = GLOBE_R) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/** Großkreisbogen mit Höhenprofil (ballistisch) */
export function arcPoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  segments: number,
  height: number,
) {
  const a = ll(lat1, lon1).normalize();
  const b = ll(lat2, lon2).normalize();
  const angle = a.angleTo(b);
  const pts: THREE.Vector3[] = [];
  const h = height * Math.max(0.25, angle / Math.PI) * 2;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const v = slerp(a, b, t, angle);
    v.multiplyScalar(GLOBE_R + 0.004 + h * Math.sin(Math.PI * t));
    pts.push(v);
  }
  return pts;
}

export function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number, angle = a.angleTo(b)) {
  if (angle < 1e-5) return a.clone();
  const s = Math.sin(angle);
  return a
    .clone()
    .multiplyScalar(Math.sin((1 - t) * angle) / s)
    .add(b.clone().multiplyScalar(Math.sin(t * angle) / s));
}
