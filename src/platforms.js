import * as THREE from "three";
import { scene } from "./renderer.js";
import { toonMat, addOutline } from "./materials.js";
import { PLAYER_RADIUS, GRAVITY, PLATFORM_ACTIONS } from "./constants.js";

export let levelJson = { startPlatform: 0, platforms: [] };
export let LEVEL_DATA = [];

function hexStr(s) {
  return parseInt(s.replace("#", ""), 16);
}

function normalizeLevelData(data) {
  if (!data || !Array.isArray(data.platforms)) {
    throw new Error("Invalid level JSON: missing platforms array");
  }

  return data.platforms.map((p) =>
    Object.assign({}, p, { color: hexStr(p.color) }),
  );
}

function setLevelData(data) {
  levelJson = data;
  LEVEL_DATA = normalizeLevelData(data);
}

async function fetchLevelById(levelId) {
  const levelUrl = new URL(`../data/levels/${levelId}.json`, import.meta.url);
  const response = await fetch(levelUrl);
  if (!response.ok) {
    throw new Error(`Failed to load level ${levelId}: ${response.status}`);
  }
  return response.json();
}

export async function loadLevel(levelId) {
  try {
    const data = await fetchLevelById(levelId);
    setLevelData(data);
    return levelId;
  } catch (err) {
    if (levelId === 0) throw err;
    console.warn(`Level ${levelId} not found, falling back to level 0`, err);
    const fallbackData = await fetchLevelById(0);
    setLevelData(fallbackData);
    return 0;
  }
}

export const platforms = [];
export const platformGroup = new THREE.Group();
scene.add(platformGroup);

export let endPlatform = null;

function normalizePlatformActions(actions) {
  if (!actions || typeof actions !== "object") return null;

  const onLand = actions.onLand;
  if (onLand == null) return null;

  if (onLand === PLATFORM_ACTIONS.LEVEL_COMPLETED) {
    return { onLand };
  }

  return null;
}

export function addPlatform(cfg) {
  let mesh;
  const mat = toonMat(cfg.color);
  if (cfg.shape === "box") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), mat);
    mesh.userData.halfSize = { x: cfg.w / 2, y: cfg.h / 2, z: cfg.d / 2 };
    mesh.userData.shape = "box";
  } else if (cfg.shape === "cyl") {
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.r, cfg.r, cfg.h, 48),
      mat,
    );
    mesh.userData.radius = cfg.r;
    mesh.userData.halfH = cfg.h / 2;
    mesh.userData.shape = "cyl";
  } else if (cfg.shape === "hex") {
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.r, cfg.r, cfg.h, 6),
      mat,
    );
    mesh.userData.radius = cfg.r * 0.92;
    mesh.userData.halfH = cfg.h / 2;
    mesh.userData.shape = "hex";
  }
  mesh.position.set(cfg.x, cfg.y, cfg.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.type = cfg.type;
  mesh.userData.actions = normalizePlatformActions(cfg.actions);
  mesh.userData.baseY = cfg.y;
  mesh.userData.active = true;
  mesh.userData.baseColor = cfg.color;
  if (cfg.type === "red") {
    mesh.userData.timer = null;
    mesh.userData.falling = false;
    mesh.userData.fallVel = 0;
  }
  if (cfg.type === "yellow") {
    mesh.userData.spin = 1.0 + Math.random() * 1.4;
  }
  if (cfg.type === "move-cycle") {
    mesh.userData.startPos = new THREE.Vector3(cfg.x, cfg.y, cfg.z);
    mesh.userData.endPos = new THREE.Vector3(cfg.endX, cfg.endY, cfg.endZ);
    mesh.userData.speed = cfg.speed;
    mesh.userData.pauseMs = cfg.pause;
    mesh.userData.movingToEnd = true;
    mesh.userData.paused = true;
    mesh.userData.pauseTimer = 0;
    mesh.userData.platformVel = new THREE.Vector3();
  }
  addOutline(mesh);
  platformGroup.add(mesh);
  platforms.push(mesh);
  return mesh;
}

export function buildLevel(
  clearEnemiesFn = () => {},
  populateEnemiesFn = () => {},
) {
  for (const p of platforms) platformGroup.remove(p);
  platforms.length = 0;

  for (const cfg of LEVEL_DATA) {
    addPlatform(cfg);
  }
  endPlatform = platforms[platforms.length - 1];

  clearEnemiesFn();
  populateEnemiesFn();
}

/**
 * Per-frame platform updates: yellow spin, red countdown/fall.
 * Returns an array of platforms landing was detected on (for collision resolution
 * that lives in game.js).
 */
export function updatePlatforms(dt) {
  for (const p of platforms) {
    if (p.userData.type === "yellow" && p.userData.active) {
      p.rotation.y += p.userData.spin * dt;
    }

    if (p.userData.type === "move-cycle" && p.userData.active) {
      const ud = p.userData;
      if (ud.paused) {
        ud.pauseTimer += dt * 1000;
        if (ud.pauseTimer >= ud.pauseMs) {
          ud.paused = false;
          ud.pauseTimer = 0;
        }
        ud.platformVel.set(0, 0, 0);
      } else {
        const target = ud.movingToEnd ? ud.endPos : ud.startPos;
        const toTarget = new THREE.Vector3().subVectors(target, p.position);
        const dist = toTarget.length();
        const step = ud.speed * dt;
        if (dist < 0.0001 || step >= dist) {
          p.position.copy(target);
          ud.movingToEnd = !ud.movingToEnd;
          ud.paused = true;
          ud.pauseTimer = 0;
          ud.platformVel.set(0, 0, 0);
        } else {
          const dir = toTarget.normalize();
          p.position.addScaledVector(dir, step);
          ud.platformVel.copy(dir).multiplyScalar(ud.speed);
        }
      }
    }

    if (
      p.userData.type === "red" &&
      p.userData.timer !== null &&
      !p.userData.falling
    ) {
      p.userData.timer += dt;
      if (p.userData.timer > 5) {
        p.material.transparent = true;
        const remaining = Math.max(0, 10 - p.userData.timer);
        const flashHz = 4 + (1 - remaining / 5) * 14;
        const f = 0.5 + 0.5 * Math.sin(p.userData.timer * flashHz);
        p.material.opacity = 0.35 + f * 0.65;
        const base = new THREE.Color(p.userData.baseColor);
        const bright = new THREE.Color(0xffffff);
        p.material.color.copy(base).lerp(bright, 0.3 * f);
      }
      if (p.userData.timer >= 10) {
        p.userData.falling = true;
        p.userData.active = false;
      }
    }
    if (p.userData.falling) {
      p.userData.fallVel += GRAVITY * dt;
      p.position.y += p.userData.fallVel * dt;
      if (p.position.y < -80) p.visible = false;
    }
  }
}

export function getSpawnPos() {
  const idx = levelJson.startPlatform ?? null;
  if (idx != null && platforms[idx]) {
    const p = platforms[idx];
    const topY =
      p.position.y + (p.userData.halfH ?? p.userData.halfSize?.y ?? 0.5);
    return new THREE.Vector3(
      p.position.x,
      topY + PLAYER_RADIUS + 0.5,
      p.position.z,
    );
  }
  return new THREE.Vector3(0, 3, 0);
}

export function updateVanish(dt) {
  for (const p of platforms) {
    if (!p.userData.vanishing) continue;
    p.userData.vanishTime += dt;
    const t = Math.min(1, p.userData.vanishTime / 0.7);
    p.scale.setScalar(1 + t * 0.3);
    p.material.opacity = 1 - t;
    if (t >= 1) p.visible = false;
  }
}

export function resetPlatforms() {
  for (const p of platforms) {
    p.userData.active = true;
    p.userData.vanishing = false;
    p.userData.vanishTime = 0;
    p.visible = true;
    p.position.y = p.userData.baseY;
    p.scale.setScalar(1);
    if (p.userData.type === "move-cycle") {
      p.position.copy(p.userData.startPos);
      p.userData.movingToEnd = true;
      p.userData.paused = true;
      p.userData.pauseTimer = 0;
      p.userData.platformVel.set(0, 0, 0);
      p.material.transparent = false;
      p.material.opacity = 1;
      p.material.color.setHex(p.userData.baseColor);
    } else if (p.userData.type === "red") {
      p.userData.timer = null;
      p.userData.falling = false;
      p.userData.fallVel = 0;
      p.material.transparent = false;
      p.material.opacity = 1;
      p.material.color.setHex(p.userData.baseColor);
    } else if (p.userData.type !== "orange") {
      p.material.transparent = false;
      p.material.opacity = 1;
      p.material.color.setHex(p.userData.baseColor);
    }
  }
}
