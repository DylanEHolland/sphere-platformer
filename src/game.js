import * as THREE from "three";
import {
  GRAVITY,
  MOVE_SPEED,
  JUMP_V,
  BOUNCE_MIN_V,
  PLAYER_RADIUS,
  DYING_DURATION,
} from "./constants.js";
import { player, playerGroup, ball } from "./player.js";
import { platforms } from "./platforms.js";
import { keys } from "./input.js";
import {
  cameraAngle,
  setCameraAngle,
  isIntroCamActive,
  updateFollowCamera,
} from "./camera.js";
import {
  clearEnemies,
  populateEnemies,
  setDeathCallback,
  setLevelCompleteCallback,
} from "./enemies/index.js";

// ---------- game state ----------
// Use a mutable object so consumers can read live values without re-importing
export const state = {
  won: false,
  dying: false,
  dyingT: 0,
};
let winTimer = 0;

export function triggerDeath() {
  if (state.dying || state.won) return;
  state.dying = true;
  state.dyingT = 0;
  player.vel.set(0, 0, 0);
  player.squashTarget = 0.1;
  document.getElementById("dead").classList.add("show");
}

// Wire the callbacks into the enemy system
setDeathCallback(triggerDeath);
setLevelCompleteCallback(triggerWin);

export function triggerWin(finalP) {
  state.won = true;
  winTimer = 0;
  document.getElementById("win").classList.add("show");
  for (const p of platforms) {
    if (p === finalP) continue;
    p.userData.active = false;
    p.userData.vanishing = true;
    p.userData.vanishTime = 0;
    p.material.transparent = true;
  }
}

export function resetGame(getSpawnPos, resetPlatforms, startIntroFly) {
  const spawn = getSpawnPos();
  player.pos.copy(spawn);
  player.vel.set(0, 0, 0);
  player.onGround = false;
  player.squash = 1;
  player.squashTarget = 1;
  setCameraAngle(0);
  state.won = false;
  state.dying = false;
  state.dyingT = 0;
  document.getElementById("win").classList.remove("show");
  document.getElementById("dead").classList.remove("show");

  resetPlatforms();
  ball.rotation.set(0, 0, 0);
  clearEnemies();
  populateEnemies();
}

// ---------- main physics update ----------
export function update(dt) {
  const orbitSpeed = 2.2;
  if (!isIntroCamActive() && keys["ArrowLeft"])
    setCameraAngle(cameraAngle + orbitSpeed * dt);
  if (!isIntroCamActive() && keys["ArrowRight"])
    setCameraAngle(cameraAngle - orbitSpeed * dt);

  const fx = -Math.sin(cameraAngle);
  const fz = -Math.cos(cameraAngle);

  let mx = 0,
    mz = 0;
  if (!state.won && !isIntroCamActive()) {
    if (keys["ArrowUp"]) {
      mx += fx;
      mz += fz;
    }
    if (keys["ArrowDown"]) {
      mx -= fx;
      mz -= fz;
    }
  }
  const mag = Math.hypot(mx, mz);
  if (mag > 0) {
    mx /= mag;
    mz /= mag;
  }

  const targetVx = mx * MOVE_SPEED;
  const targetVz = mz * MOVE_SPEED;
  const accel = player.onGround ? 16 : 9;
  player.vel.x += (targetVx - player.vel.x) * Math.min(1, accel * dt);
  player.vel.z += (targetVz - player.vel.z) * Math.min(1, accel * dt);

  if (!state.won && !isIntroCamActive() && keys["Space"] && player.onGround) {
    player.vel.y = JUMP_V;
    player.onGround = false;
    player.squashTarget = 1.35;
  }

  player.vel.y += GRAVITY * dt;
  player.pos.addScaledVector(player.vel, dt);

  let landed = false;
  for (const p of platforms) {
    if (!p.userData.active) continue;

    const topY =
      p.position.y +
      (p.userData.shape === "box" ? p.userData.halfSize.y : p.userData.halfH);
    let overFoot = false;
    const dx = player.pos.x - p.position.x;
    const dz = player.pos.z - p.position.z;
    if (p.userData.shape === "box") {
      const pad = PLAYER_RADIUS * 0.55;
      if (
        Math.abs(dx) < p.userData.halfSize.x + pad &&
        Math.abs(dz) < p.userData.halfSize.z + pad
      )
        overFoot = true;
    } else {
      const rr = p.userData.radius + PLAYER_RADIUS * 0.4;
      if (dx * dx + dz * dz < rr * rr) overFoot = true;
    }

    if (overFoot) {
      const feetY = player.pos.y - PLAYER_RADIUS;
      if (feetY <= topY + 0.05 && feetY >= topY - 1.8 && player.vel.y <= 0.5) {
        player.pos.y = topY + PLAYER_RADIUS;
        const impact = -player.vel.y;
        if (impact > 9) {
          player.vel.y = BOUNCE_MIN_V + Math.min(6, impact * 0.22);
          player.onGround = false;
          player.squashTarget = 0.65;
        } else {
          player.vel.y = 0;
          player.onGround = true;
          player.squashTarget = 0.82;
        }
        landed = true;

        if (p.userData.type === "red" && p.userData.timer === null) {
          p.userData.timer = 0;
        }
      }
    }
  }

  if (!landed && player.vel.y < 0) player.onGround = false;

  if (player.pos.y < -40) triggerDeath();

  // squash spring
  player.squashTarget += (1.0 - player.squashTarget) * Math.min(1, dt * 6);
  player.squash += (player.squashTarget - player.squash) * Math.min(1, dt * 14);
  const sq = player.squash;
  playerGroup.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));

  // roll the ball
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (hSpeed > 0.05) {
    const axis = new THREE.Vector3(player.vel.z, 0, -player.vel.x).normalize();
    const angle = (hSpeed * dt) / PLAYER_RADIUS;
    ball.rotateOnWorldAxis(axis, angle);
  }

  playerGroup.position.copy(player.pos);
  updateFollowCamera();
}
