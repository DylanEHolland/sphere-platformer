import * as THREE from "three";
import { gradientMap, madFaceTexture } from "../materials.js";
import { GRAVITY, PLAYER_RADIUS } from "../constants.js";
import { player } from "../player.js";

export function makePyramidGeometry(radius, height) {
  const r = radius;
  const h = height;
  const apex = [0, h * 0.5, 0];
  const c1 = [r, -h * 0.5, r];
  const c2 = [-r, -h * 0.5, r];
  const c3 = [-r, -h * 0.5, -r];
  const c4 = [r, -h * 0.5, -r];
  const positions = [],
    uvs = [],
    normals = [];
  function face(a, b, c) {
    positions.push(...a, ...b, ...c);
    uvs.push(0.5, 1, 0, 0, 1, 0);
    const v1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0],
    ];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n[0] /= l;
    n[1] /= l;
    n[2] /= l;
    for (let i = 0; i < 3; i++) normals.push(n[0], n[1], n[2]);
  }
  face(apex, c2, c1);
  face(apex, c3, c2);
  face(apex, c4, c3);
  face(apex, c1, c4);
  positions.push(...c1, ...c3, ...c2);
  positions.push(...c1, ...c4, ...c3);
  uvs.push(0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1);
  for (let i = 0; i < 6; i++) normals.push(0, -1, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

export function createPyramid(platform, spawnSmokePuff) {
  const group = new THREE.Group();
  const geom = makePyramidGeometry(0.6, 1.2);
  const mat = new THREE.MeshToonMaterial({
    color: 0xf4c430,
    map: madFaceTexture,
    gradientMap,
  });
  const body = new THREE.Mesh(geom, mat);
  body.castShadow = true;
  group.add(body);
  const outline = new THREE.Mesh(
    geom,
    new THREE.MeshBasicMaterial({ color: 0x0a0a14, side: THREE.BackSide }),
  );
  outline.scale.setScalar(1.05);
  group.add(outline);

  return {
    type: "pyramid",
    group,
    body,
    platform,
    baseColor: 0xf4c430,
    phase: "idle",
    phaseT: 0.8 + Math.random() * 1.2,
    x: platform.position.x,
    z: platform.position.z,
    vy: 0,
    vx: 0,
    vz: 0,
    smashed: false,
  };
}

export function updatePyramid(e, dt, spawnSmokePuff, onPlayerSmashed) {
  const plat = e.platform;
  if (!plat.userData.active || !plat.visible) {
    e.group.visible = false;
    return;
  }
  e.group.visible = true;

  const topY =
    plat.position.y +
    (plat.userData.shape === "box"
      ? plat.userData.halfSize.y
      : plat.userData.halfH);
  const baseY = topY + 0.6;
  const dxp = player.pos.x - e.x;
  const dzp = player.pos.z - e.z;
  const dist = Math.hypot(dxp, dzp);
  const near = dist < 4.2 && Math.abs(player.pos.y - topY) < 4;

  const target =
    e.phase === "charging" || e.phase === "airborne" ? 0xff3030 : e.baseColor;
  e.body.material.color.lerp(new THREE.Color(target), Math.min(1, dt * 6));

  if (e.phase === "idle") {
    e.phaseT -= dt;
    const bob = Math.abs(Math.sin(performance.now() * 0.005)) * 0.18;
    e.group.position.set(e.x, baseY + bob, e.z);
    e.group.scale.set(1, 1, 1);
    e.group.rotation.y += dt * 0.6;

    if (near) {
      e.phase = "charging";
      e.phaseT = 0.45;
      spawnSmokePuff(e.group.position.clone().setY(topY + 0.15), 14);
    } else if (e.phaseT <= 0) {
      e.phase = "airborne";
      e.vy = 7;
      e.vx = 0;
      e.vz = 0;
      e.phaseT = 0;
    }
  } else if (e.phase === "charging") {
    e.phaseT -= dt;
    const shake = (Math.random() - 0.5) * 0.18;
    e.group.position.set(e.x + shake, baseY - 0.1, e.z + shake);
    e.group.scale.set(1.15, 0.72, 1.15);

    if (e.phaseT <= 0) {
      e.phase = "airborne";
      e.vy = 17;
      const nx = dxp / (dist || 1);
      const nz = dzp / (dist || 1);
      const leap = Math.min(6.5, dist * 3.2);
      e.vx = nx * leap;
      e.vz = nz * leap;
      e.group.scale.set(1, 1, 1);
      spawnSmokePuff(e.group.position.clone().setY(topY + 0.1), 10);
    }
  } else if (e.phase === "airborne") {
    e.vy += GRAVITY * dt;
    e.x += e.vx * dt;
    e.z += e.vz * dt;

    const dx2 = e.x - plat.position.x;
    const dz2 = e.z - plat.position.z;
    const plR =
      plat.userData.shape === "box"
        ? Math.min(plat.userData.halfSize.x, plat.userData.halfSize.z) - 0.1
        : plat.userData.radius - 0.3;
    const d2 = Math.hypot(dx2, dz2);
    if (d2 > plR) {
      e.x = plat.position.x + (dx2 / (d2 || 1)) * plR;
      e.z = plat.position.z + (dz2 / (d2 || 1)) * plR;
      e.vx *= 0.5;
      e.vz *= 0.5;
    }

    const curY = e.group.position.y + e.vy * dt;
    e.group.position.set(e.x, Math.max(baseY, curY), e.z);
    e.group.rotation.x += dt * 4;
    e.group.rotation.z += dt * 3;

    if (!e.smashed) {
      const horiz = Math.hypot(e.x - player.pos.x, e.z - player.pos.z);
      const vert = e.group.position.y - player.pos.y;
      if (
        horiz < 0.75 + PLAYER_RADIUS * 0.7 &&
        vert > -0.2 &&
        vert < 1.4 &&
        e.vy < 4
      ) {
        e.smashed = true;
        onPlayerSmashed();
      }
    }

    if (curY <= baseY && e.vy <= 0) {
      e.group.position.y = baseY;
      e.vy = 0;
      e.vx = 0;
      e.vz = 0;
      e.phase = "idle";
      e.phaseT = near ? 0.9 : 1.6 + Math.random() * 1.2;
      e.group.rotation.set(0, e.group.rotation.y, 0);
      spawnSmokePuff(e.group.position.clone().setY(topY + 0.1), 10);
    }
  }
}
