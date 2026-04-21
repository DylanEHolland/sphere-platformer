import * as THREE from "three";
import { scene } from "./renderer.js";
import { toonMat, addOutline } from "./materials.js";
import { PLAYER_RADIUS } from "./constants.js";

export const playerGroup = new THREE.Group();
scene.add(playerGroup);

export const ball = new THREE.Mesh(
  new THREE.SphereGeometry(PLAYER_RADIUS, 48, 32),
  toonMat(0xff4ad6),
);
ball.castShadow = true;
playerGroup.add(ball);

const ballOutline = new THREE.Mesh(
  new THREE.SphereGeometry(PLAYER_RADIUS, 48, 32),
  new THREE.MeshBasicMaterial({ color: 0x0a0a14, side: THREE.BackSide }),
);
ballOutline.scale.setScalar(1.06);
playerGroup.add(ballOutline);

const ringGeom = new THREE.RingGeometry(
  PLAYER_RADIUS * 1.1,
  PLAYER_RADIUS * 1.25,
  32,
);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xff9ae6,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
});
const ring = new THREE.Mesh(ringGeom, ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = -PLAYER_RADIUS * 0.95;
playerGroup.add(ring);

export const player = {
  pos: new THREE.Vector3(0, 3, 0),
  vel: new THREE.Vector3(),
  onGround: false,
  squash: 1.0,
  squashTarget: 1.0,
};

/**
 * Set the player's starting position based on the level's startPlatform.
 * Call this after platforms have been built.
 * @param {Array} platforms
 * @param {Object} levelJson
 */
export function initPlayerPosition(platforms, levelJson) {
  const idx = levelJson.startPlatform ?? null;
  if (idx != null && platforms[idx]) {
    const p = platforms[idx];
    const topY =
      p.position.y + (p.userData.halfH ?? p.userData.halfSize?.y ?? 0.5);
    player.pos.set(p.position.x, topY + PLAYER_RADIUS + 0.5, p.position.z);
  } else {
    player.pos.set(0, 3, 0);
  }
}
