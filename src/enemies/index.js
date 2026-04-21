import * as THREE from "three";
import { scene } from "../renderer.js";
import { PLAYER_RADIUS, JUMP_V } from "../constants.js";
import { player } from "../player.js";
import { platforms, levelJson } from "../platforms.js";
import { createPurplePatrol, updatePurple } from "./purplePatrol.js";
import { createPyramid, updatePyramid } from "./pyramid.js";
import { createDice, updateDice } from "./dice.js";

export const enemies = [];
export const enemyGroup = new THREE.Group();

/** Set from game.js after init to avoid circular dependency */
let _onPlayerDeath = () => {};
let _onLevelComplete = (_platform) => {};

export function setDeathCallback(fn) {
  _onPlayerDeath = fn;
}

export function setLevelCompleteCallback(fn) {
  _onLevelComplete = fn;
}

// ----- smoke particles -----
const smokeParticles = [];

export function spawnSmokePuff(position, count = 10) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xc8ccd4,
      transparent: true,
      opacity: 0.75,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
    mesh.position.copy(position);
    const theta = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 2.2;
    mesh.userData.vel = new THREE.Vector3(
      Math.cos(theta) * speed,
      Math.random() * 2.4,
      Math.sin(theta) * speed,
    );
    mesh.userData.life = 0;
    mesh.userData.lifespan = 0.6 + Math.random() * 0.35;
    scene.add(mesh);
    smokeParticles.push(mesh);
  }
}

function updateSmoke(dt) {
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const s = smokeParticles[i];
    s.userData.life += dt;
    s.position.addScaledVector(s.userData.vel, dt);
    s.userData.vel.multiplyScalar(0.9);
    const t = s.userData.life / s.userData.lifespan;
    s.material.opacity = Math.max(0, 0.75 * (1 - t));
    s.scale.setScalar(1 + t * 1.6);
    if (t >= 1) {
      scene.remove(s);
      s.geometry.dispose();
      s.material.dispose();
      smokeParticles.splice(i, 1);
    }
  }
}

export function defeatEnemy(e) {
  spawnSmokePuff(e.group.position.clone(), 12);
  enemyGroup.remove(e.group);
  e.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose?.();
    if (o.material) o.material.dispose?.();
  });
  const idx = enemies.indexOf(e);
  if (idx !== -1) enemies.splice(idx, 1);
  if (e.onDefeat === "LEVEL_COMPLETED") {
    _onLevelComplete(e.platform);
  }
}

export function populateEnemies() {
  for (let i = 0; i < platforms.length; i++) {
    const npcs = levelJson.platforms[i]?.npcs ?? [];
    if (!npcs.length) continue;
    const plat = platforms[i];
    for (const npc of npcs) {
      let e;
      if (npc.type === "purple") e = createPurplePatrol(plat);
      else if (npc.type === "pyramid") e = createPyramid(plat, spawnSmokePuff);
      else if (npc.type === "dice") e = createDice(plat);
      if (e) {
        if (npc.onDefeat) e.onDefeat = npc.onDefeat;
        enemyGroup.add(e.group);
        enemies.push(e);
      }
    }
  }
}

let pyramidSmashedPlayer = false;

export function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.type === "purple") updatePurple(e, dt);
    else if (e.type === "pyramid")
      updatePyramid(e, dt, spawnSmokePuff, () => {
        pyramidSmashedPlayer = true;
      });
    else if (e.type === "dice")
      updateDice(e, dt, spawnSmokePuff, _onPlayerDeath, defeatEnemy);
  }
  updateSmoke(dt);
  if (pyramidSmashedPlayer) {
    pyramidSmashedPlayer = false;
    _onPlayerDeath();
  }
}

export function clearEnemies() {
  for (const e of enemies) {
    enemyGroup.remove(e.group);
    e.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) o.material.dispose?.();
    });
  }
  enemies.length = 0;
  for (const s of smokeParticles) {
    scene.remove(s);
    s.geometry.dispose();
    s.material.dispose();
  }
  smokeParticles.length = 0;
  pyramidSmashedPlayer = false;
}

export function checkEnemyStomp() {
  if (player.vel.y >= 0) return;
  const feetY = player.pos.y - PLAYER_RADIUS;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.group.visible) continue;
    if (e.type === "dice") continue;
    let topH, horizRadius;
    if (e.type === "pyramid") {
      topH = 0.6;
      horizRadius = PLAYER_RADIUS + 0.7;
    } else {
      topH = 0.45;
      horizRadius = PLAYER_RADIUS + 0.7;
    }
    const enemyTop = e.group.position.y + topH;
    const horiz = Math.hypot(
      player.pos.x - e.group.position.x,
      player.pos.z - e.group.position.z,
    );
    if (
      horiz < horizRadius &&
      feetY >= enemyTop - 0.4 &&
      feetY <= enemyTop + 0.6
    ) {
      player.vel.y = JUMP_V * 0.8;
      player.onGround = false;
      player.squashTarget = 1.3;
      defeatEnemy(e);
    }
  }
}
