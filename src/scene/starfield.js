import * as THREE from "three";
import { scene } from "../renderer.js";

function buildStars() {
  const count = 3000;
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 220 + Math.random() * 140;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    const c = 0.7 + Math.random() * 0.3;
    const tint = Math.random();
    col[i * 3 + 0] = c * (tint < 0.1 ? 1 : 0.95);
    col[i * 3 + 1] = c * (tint < 0.2 ? 0.8 : 0.98);
    col[i * 3 + 2] = c + Math.random() * 0.15;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.1,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
  });
  return new THREE.Points(geom, mat);
}

scene.add(buildStars());

export const nebula = new THREE.Mesh(
  new THREE.SphereGeometry(360, 32, 16),
  new THREE.MeshBasicMaterial({
    color: 0x4422aa,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.12,
  }),
);
scene.add(nebula);
