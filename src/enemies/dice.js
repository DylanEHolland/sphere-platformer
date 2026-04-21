import * as THREE from "three";
import { gradientMap, madFaceTexture, addOutline } from "../materials.js";
import { PLAYER_RADIUS, GRAVITY, JUMP_V } from "../constants.js";
import { player } from "../player.js";

export function createDice(platform) {
  const size = 3.2;
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshToonMaterial({
      color: 0xa0a4ac,
      map: madFaceTexture,
      gradientMap,
    }),
  );
  body.castShadow = true;
  addOutline(body, 1.05);
  group.add(body);

  return {
    type: "dice",
    group,
    body,
    platform,
    size,
    baseColor: 0xa0a4ac,
    hp: 2,
    x: platform.position.x,
    z: platform.position.z,
    vx: 0,
    vz: 0,
    vy: 0,
    hopT: 0.5 + Math.random() * 0.4,
    hitCooldown: 0,
    dormant: true,
    wasAirborne: false,
    hopContactThisAir: false,
    missCount: 0,
    missesForRage: 3,
    rageT: 0,
    rageDuration: 5,
  };
}

export function updateDice(e, dt, spawnSmokePuff, triggerDeath, defeatEnemy) {
  const plat = e.platform;
  if (!plat.userData.active || !plat.visible) {
    e.group.visible = false;
    return;
  }
  e.group.visible = true;
  if (e.hitCooldown > 0) e.hitCooldown -= dt;

  const topY =
    plat.position.y +
    (plat.userData.shape === "box"
      ? plat.userData.halfSize.y
      : plat.userData.halfH);
  const sc = e.group.scale.x;
  const halfS = Math.max(0.01, (e.size / 2) * sc);
  const restY = topY + halfS;

  if (e.dormant) {
    e.group.position.set(e.x, restY, e.z);
    const pdx = player.pos.x - plat.position.x;
    const pdz = player.pos.z - plat.position.z;
    const onPlat =
      player.onGround &&
      Math.abs(player.pos.y - (topY + PLAYER_RADIUS)) < 1.2 &&
      (plat.userData.shape === "box"
        ? Math.abs(pdx) < plat.userData.halfSize.x + 0.6 &&
          Math.abs(pdz) < plat.userData.halfSize.z + 0.6
        : pdx * pdx + pdz * pdz < (plat.userData.radius + 0.6) ** 2);
    if (onPlat) {
      e.dormant = false;
      e.hopT = 0.8;
    }
    return;
  }

  const inRage = e.rageT > 0;
  if (inRage) {
    e.rageT -= dt;
    const flashT = 0.5 + 0.5 * Math.sin(performance.now() * 0.02);
    e.body.material.color.setHex(e.baseColor);
    e.body.material.color.lerp(new THREE.Color(0xff2020), flashT);
  } else {
    e.body.material.color.setHex(e.baseColor);
  }

  e.vy += GRAVITY * dt;

  const grounded = e.group.position.y <= restY + 0.1;
  if (grounded) {
    if (e.wasAirborne) {
      spawnSmokePuff(new THREE.Vector3(e.x, topY + 0.1, e.z), 4);
      if (!e.hopContactThisAir) {
        e.missCount++;
        if (e.missCount >= e.missesForRage && e.rageT <= 0) {
          e.rageT = e.rageDuration;
          e.missCount = 0;
        }
      }
      e.wasAirborne = false;
    }
    e.hopT -= dt;
    if (e.hopT <= 0) {
      e.vy = inRage ? 18 : 14;
      e.hopT = inRage ? 0.35 + Math.random() * 0.25 : 0.6 + Math.random() * 0.3;
      e.hopContactThisAir = false;
      spawnSmokePuff(new THREE.Vector3(e.x, topY + 0.1, e.z), 5);
    }
  } else {
    e.wasAirborne = true;
  }

  const nextY = e.group.position.y + e.vy * dt;
  if (nextY <= restY && e.vy <= 0) {
    e.group.position.y = restY;
    e.vy = 0;
  } else {
    e.group.position.y = nextY;
  }

  // box drops onto player (crush)
  if (e.vy < -1 && e.group.position.y > restY + 0.2) {
    const boxBottom = e.group.position.y - halfS;
    const playerTop = player.pos.y + PLAYER_RADIUS;
    const horiz = Math.hypot(player.pos.x - e.x, player.pos.z - e.z);
    if (
      horiz < halfS + PLAYER_RADIUS * 0.8 &&
      boxBottom <= playerTop + 0.35 &&
      boxBottom >= playerTop - 0.8
    ) {
      e.hopContactThisAir = true;
      triggerDeath();
      return;
    }
  }

  // player stomps top of dice
  if (player.vel.y < 0 && !player.onGround) {
    const feetY = player.pos.y - PLAYER_RADIUS;
    const diceTopY = e.group.position.y + halfS;
    const horiz = Math.hypot(player.pos.x - e.x, player.pos.z - e.z);
    if (
      horiz < halfS + PLAYER_RADIUS * 0.7 &&
      feetY >= diceTopY - 0.4 &&
      feetY <= diceTopY + 0.6
    ) {
      player.vel.y = JUMP_V * 0.8;
      player.onGround = false;
      player.squashTarget = 1.3;
      if (inRage) {
        e.hopContactThisAir = true;
        defeatEnemy(e);
        return;
      }
    }
  }

  // chase
  const dxp = player.pos.x - e.x;
  const dzp = player.pos.z - e.z;
  const dist = Math.hypot(dxp, dzp);
  const maxSpeed = inRage ? 26 : 6;
  const accelF = inRage ? 44 : 16;
  if (dist > 0.1) {
    e.vx += (dxp / dist) * accelF * dt;
    e.vz += (dzp / dist) * accelF * dt;
    const hs = Math.hypot(e.vx, e.vz);
    if (hs > maxSpeed) {
      e.vx = (e.vx / hs) * maxSpeed;
      e.vz = (e.vz / hs) * maxSpeed;
    }
  }

  // rolling spin
  const hs = Math.hypot(e.vx, e.vz);
  if (hs > 0.05) {
    const rollAxis = new THREE.Vector3(e.vz, 0, -e.vx).normalize();
    e.group.rotateOnWorldAxis(rollAxis, (hs * dt) / halfS);
  }

  e.x += e.vx * dt;
  e.z += e.vz * dt;

  // clamp to platform bounds
  if (plat.userData.shape === "box") {
    const maxX = Math.max(0, plat.userData.halfSize.x - halfS);
    const maxZ = Math.max(0, plat.userData.halfSize.z - halfS);
    const relX = e.x - plat.position.x;
    const relZ = e.z - plat.position.z;
    if (Math.abs(relX) > maxX) {
      e.x = plat.position.x + Math.sign(relX) * maxX;
      e.vx *= -0.6;
    }
    if (Math.abs(relZ) > maxZ) {
      e.z = plat.position.z + Math.sign(relZ) * maxZ;
      e.vz *= -0.6;
    }
  } else {
    const plR = Math.max(0, (plat.userData.radius || 0) - halfS);
    const d = Math.hypot(e.x - plat.position.x, e.z - plat.position.z);
    if (d > plR) {
      const nx = (e.x - plat.position.x) / (d || 1);
      const nz = (e.z - plat.position.z) / (d || 1);
      e.x = plat.position.x + nx * plR;
      e.z = plat.position.z + nz * plR;
      const dot = e.vx * nx + e.vz * nz;
      e.vx = (e.vx - 2 * dot * nx) * 0.6;
      e.vz = (e.vz - 2 * dot * nz) * 0.6;
    }
  }

  e.group.position.x = e.x;
  e.group.position.z = e.z;

  // side contact: AABB vs sphere
  if (e.hitCooldown <= 0) {
    const gy = e.group.position.y;
    const clampedX = Math.max(e.x - halfS, Math.min(player.pos.x, e.x + halfS));
    const clampedY = Math.max(gy - halfS, Math.min(player.pos.y, gy + halfS));
    const clampedZ = Math.max(e.z - halfS, Math.min(player.pos.z, e.z + halfS));
    const contactDist = Math.hypot(
      clampedX - player.pos.x,
      clampedY - player.pos.y,
      clampedZ - player.pos.z,
    );
    if (contactDist < PLAYER_RADIUS * 0.95) {
      const fromAbove = clampedY >= gy + halfS - 0.12 && player.vel.y <= 0;
      if (!fromAbove) {
        const playerWasAirborne = !player.onGround;
        e.hopContactThisAir = true;
        const overlapNX = player.pos.x - e.x;
        const overlapNZ = player.pos.z - e.z;
        const overlapN = Math.max(0.001, Math.hypot(overlapNX, overlapNZ));
        const penetration = halfS + PLAYER_RADIUS - contactDist;
        if (penetration > 0) {
          player.pos.x += (overlapNX / overlapN) * penetration;
          player.pos.z += (overlapNZ / overlapN) * penetration;
        }
        const knockX = overlapNX;
        const knockZ = overlapNZ;
        const knockN = Math.max(0.01, Math.hypot(knockX, knockZ));
        player.vel.x = (knockX / knockN) * 24;
        player.vel.z = (knockZ / knockN) * 24;
        player.vel.y = Math.max(player.vel.y, 10);
        player.onGround = false;
        e.hitCooldown = 0.5;
        if (inRage && playerWasAirborne) {
          e.hp--;
          spawnSmokePuff(e.group.position.clone(), 8);
          if (e.hp <= 0) {
            defeatEnemy(e);
            return;
          }
          e.group.scale.setScalar(0.65);
        }
      }
    }
  }
}
