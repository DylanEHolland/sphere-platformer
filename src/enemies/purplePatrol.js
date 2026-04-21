import * as THREE from "three";
import { scene } from "../renderer.js";
import { toonMat, addOutline } from "../materials.js";
import { PLAYER_RADIUS, GRAVITY, JUMP_V } from "../constants.js";
import { player } from "../player.js";

export function createPurplePatrol(platform) {
  const group = new THREE.Group();
  const baseColor = 0x8b4fd9;

  const back = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 24, 18),
    toonMat(baseColor),
  );
  back.position.z = 0.42;
  back.castShadow = true;
  addOutline(back, 1.08);
  group.add(back);

  const front = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 24, 18),
    toonMat(baseColor),
  );
  front.position.z = -0.35;
  front.castShadow = true;
  addOutline(front, 1.08);
  group.add(front);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.75, 12),
    toonMat(0x5f3aa0),
  );
  rod.rotation.x = Math.PI / 2;
  rod.position.z = 0.03;
  group.add(rod);

  const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupM = new THREE.MeshBasicMaterial({ color: 0x0a0a14 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), eyeW);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), eyeW);
  eyeL.position.set(-0.14, 0.1, -0.66);
  eyeR.position.set(0.14, 0.1, -0.66);
  const pupL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), pupM);
  const pupR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), pupM);
  pupL.position.set(-0.14, 0.1, -0.73);
  pupR.position.set(0.14, 0.1, -0.73);
  group.add(eyeL, eyeR, pupL, pupR);

  return {
    type: "purple",
    group,
    platform,
    baseColor,
    angle: Math.random() * Math.PI * 2,
    radius: Math.max(0.6, platform.userData.radius * 0.55),
    angularSpeed: 0.8 + Math.random() * 0.4,
    dir: Math.random() < 0.5 ? 1 : -1,
    chasing: false,
    bodies: [back, front],
  };
}

export function updatePurple(e, dt) {
  const plat = e.platform;
  if (!plat.userData.active || !plat.visible) {
    e.group.visible = false;
    return;
  }
  e.group.visible = true;

  const pcx = plat.position.x;
  const pcz = plat.position.z;
  const pcy = plat.position.y + plat.userData.halfH;

  const dxp = player.pos.x - pcx;
  const dzp = player.pos.z - pcz;
  const playerOnPlat =
    Math.abs(player.pos.y - (pcy + PLAYER_RADIUS)) < 1.6 &&
    dxp * dxp + dzp * dzp < (plat.userData.radius + 0.8) ** 2;

  const ex = pcx + Math.cos(e.angle) * e.radius;
  const ez = pcz + Math.sin(e.angle) * e.radius;
  const toPX = player.pos.x - ex;
  const toPZ = player.pos.z - ez;
  const dp = Math.hypot(toPX, toPZ);

  e.chasing = playerOnPlat && dp < 5;

  let newX, newZ;
  if (e.chasing) {
    const nx = toPX / (dp || 1);
    const nz = toPZ / (dp || 1);
    const speed = 6.5;
    newX = ex + nx * speed * dt;
    newZ = ez + nz * speed * dt;
  } else {
    e.angle += e.angularSpeed * dt * e.dir;
    newX = pcx + Math.cos(e.angle) * e.radius;
    newZ = pcz + Math.sin(e.angle) * e.radius;
  }

  const cx = newX - pcx;
  const cz = newZ - pcz;
  const d = Math.hypot(cx, cz);
  const maxR = Math.max(0.3, plat.userData.radius - 0.4);
  if (d > maxR) {
    newX = pcx + (cx / (d || 1)) * maxR;
    newZ = pcz + (cz / (d || 1)) * maxR;
  }
  e.angle = Math.atan2(newZ - pcz, newX - pcx);
  e.radius = Math.min(maxR, Math.max(0.3, Math.hypot(newX - pcx, newZ - pcz)));

  e.group.position.set(
    newX,
    pcy + 0.42 + Math.sin(performance.now() * 0.007) * 0.06,
    newZ,
  );

  let faceX, faceZ;
  if (e.chasing) {
    faceX = toPX;
    faceZ = toPZ;
  } else {
    faceX = -Math.sin(e.angle) * e.dir;
    faceZ = Math.cos(e.angle) * e.dir;
  }
  e.group.rotation.y = Math.atan2(faceX, faceZ);

  const target = new THREE.Color(e.chasing ? 0xff3030 : e.baseColor);
  for (const b of e.bodies) b.material.color.lerp(target, Math.min(1, dt * 6));

  if (playerOnPlat && dp < 0.85 + PLAYER_RADIUS) {
    const nx = toPX / (dp || 1);
    const nz = toPZ / (dp || 1);
    const force = e.chasing ? 22 : 10;
    player.vel.x += nx * force;
    player.vel.z += nz * force;
    if (player.onGround) player.vel.y = Math.max(player.vel.y, 7);
  }
}
