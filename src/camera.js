import * as THREE from "three";
import { camera } from "./renderer.js";
import { player } from "./player.js";
import {
  PLAYER_RADIUS,
  CAM_DIST,
  CAM_HEIGHT,
  INTRO_DURATION,
} from "./constants.js";

export let cameraAngle = 0;

export function setCameraAngle(v) {
  cameraAngle = v;
}

// Intro fly-through state
let introCam = false;
let introT = 0;
const introCamFrom = new THREE.Vector3();
const introCamTo = new THREE.Vector3();
const introLookFrom = new THREE.Vector3();
const introLookTo = new THREE.Vector3();

export function isIntroCamActive() {
  return introCam;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * @param {Array} platforms
 * @param {Object} levelJson
 */
export function startIntroFly(platforms, levelJson) {
  const goalIdx = levelJson.platforms.findIndex((p) => p.goal);
  if (goalIdx === -1) return;
  const goalPlat = platforms[goalIdx];
  const spawnPos = getSpawnPos(platforms, levelJson);

  const gTopY =
    goalPlat.position.y +
    (goalPlat.userData.halfH ?? goalPlat.userData.halfSize?.y ?? 0.5);

  introCamFrom.set(
    goalPlat.position.x + Math.sin(cameraAngle) * CAM_DIST * 1.6,
    gTopY + CAM_HEIGHT * 2.5,
    goalPlat.position.z + Math.cos(cameraAngle) * CAM_DIST * 1.6,
  );
  introLookFrom.set(goalPlat.position.x, gTopY + 1.5, goalPlat.position.z);

  introCamTo.set(
    spawnPos.x + Math.sin(cameraAngle) * CAM_DIST,
    spawnPos.y + CAM_HEIGHT,
    spawnPos.z + Math.cos(cameraAngle) * CAM_DIST,
  );
  introLookTo.set(spawnPos.x, spawnPos.y + 1.2, spawnPos.z);

  camera.position.copy(introCamFrom);
  camera.lookAt(introLookFrom);

  introCam = true;
  introT = 0;
  document.getElementById("info").style.opacity = "0";
}

function getSpawnPos(platforms, levelJson) {
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

/**
 * Returns true while the intro is still playing.
 * @param {number} dt
 */
export function updateIntroCam(dt) {
  if (!introCam) return false;
  introT += dt;
  const t = Math.min(1, introT / INTRO_DURATION);
  const et = easeInOut(t);
  camera.position.lerpVectors(introCamFrom, introCamTo, et);
  const lookAt = new THREE.Vector3().lerpVectors(
    introLookFrom,
    introLookTo,
    et,
  );
  camera.lookAt(lookAt);
  if (t >= 1) {
    introCam = false;
    const info = document.getElementById("info");
    info.style.transition = "opacity 0.6s";
    info.style.opacity = "1";
  }
  return true;
}

export function stopIntroCam() {
  introCam = false;
  document.getElementById("info").style.opacity = "";
}

export function updateFollowCamera() {
  const camOffset = new THREE.Vector3(
    Math.sin(cameraAngle) * CAM_DIST,
    CAM_HEIGHT,
    Math.cos(cameraAngle) * CAM_DIST,
  );
  camera.position.copy(player.pos).add(camOffset);
  camera.lookAt(player.pos.x, player.pos.y + 1.2, player.pos.z);
}
