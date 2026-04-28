import * as THREE from "three";
import overworldLevels from "../data/overworld.json" with { type: "json" };
import { keys } from "./input.js";

const nodes = [];
let overworldActive = false;
let bgImageSize = { w: 0, h: 0 };
const baseViewport = { w: window.innerWidth, h: window.innerHeight };

const NODE_RADIUS = 25;
const PLAYER_RADIUS = 18;
const PLAYER_REST_Y_OFFSET = 52;
const IDLE_BOUNCE_AMPLITUDE = 4;
const IDLE_BOUNCE_SPEED = 4.5;
const JUMP_DURATION = 0.34;
const JUMP_ARC_HEIGHT = 26;

export const overworldScene = new THREE.Scene();

const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x3a86ff });
const playerMesh = new THREE.Mesh(
  new THREE.CircleGeometry(PLAYER_RADIUS, 32),
  playerMaterial,
);
overworldScene.add(playerMesh);

let focusedIndex = 0;
let idleTime = 0;
let prevUp = false;
let prevDown = false;
let prevSpace = false;

const jumpState = {
  active: false,
  t: 0,
  start: new THREE.Vector2(),
  end: new THREE.Vector2(),
};

const halfW = () => window.innerWidth / 2;
const halfH = () => window.innerHeight / 2;

export const overworldCamera = new THREE.OrthographicCamera(
  -halfW(),
  halfW(),
  halfH(),
  -halfH(),
  0.1,
  10,
);
overworldCamera.position.set(0, 0, 1);
overworldCamera.lookAt(0, 0, 0);

const textureUrl = new URL("../assets/overworld-prototype.png", import.meta.url)
  .href;
const loader = new THREE.TextureLoader();
overworldScene.background = loader.load(textureUrl, (texture) => {
  const { image } = texture;
  if (image && image.width && image.height) {
    bgImageSize = { w: image.width, h: image.height };
    rebuildNodePositions();
  }
});

function getCoverProjection() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const iw = bgImageSize.w || vw;
  const ih = bgImageSize.h || vh;

  const scale = Math.max(vw / iw, vh / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const offsetX = (vw - drawW) / 2;
  const offsetY = (vh - drawH) / 2;

  return { scale, offsetX, offsetY };
}

function toWorldFromScreen(screenX, screenY) {
  const x = screenX - halfW();
  const y = halfH() - screenY;
  return { x, y };
}

function toImageScreenPosition(location) {
  const { scale, offsetX, offsetY } = getCoverProjection();
  const screenX = offsetX + location[0] * scale;
  const screenY = offsetY + location[1] * scale;
  return { screenX, screenY };
}

function toViewportRelativeScreenPosition(location) {
  const sx = (window.innerWidth / baseViewport.w) * location[0];
  const sy = (window.innerHeight / baseViewport.h) * location[1];
  return { screenX: sx, screenY: sy };
}

function isOnscreen(screenX, screenY) {
  return (
    screenX >= -50 &&
    screenX <= window.innerWidth + 50 &&
    screenY >= -50 &&
    screenY <= window.innerHeight + 50
  );
}

function toWorldPosition(location) {
  const imagePos = toImageScreenPosition(location);
  if (isOnscreen(imagePos.screenX, imagePos.screenY)) {
    return toWorldFromScreen(imagePos.screenX, imagePos.screenY);
  }

  const viewportPos = toViewportRelativeScreenPosition(location);
  return toWorldFromScreen(viewportPos.screenX, viewportPos.screenY);
}

function getNodeAnchor(index) {
  const node = nodes[index];
  return new THREE.Vector2(
    node.position.x,
    node.position.y + PLAYER_REST_Y_OFFSET,
  );
}

function updatePlayerRestPose(dt) {
  idleTime += dt;
  const anchor = getNodeAnchor(focusedIndex);
  const bounce = Math.sin(idleTime * IDLE_BOUNCE_SPEED) * IDLE_BOUNCE_AMPLITUDE;
  const squash = 0.92 + 0.08 * Math.cos(idleTime * IDLE_BOUNCE_SPEED * 2);
  playerMesh.position.set(anchor.x, anchor.y + bounce, 0);
  playerMesh.scale.set(1 / Math.sqrt(squash), squash, 1);
}

function beginJump(nextIndex) {
  const startAnchor = getNodeAnchor(focusedIndex);
  const endAnchor = getNodeAnchor(nextIndex);

  jumpState.active = true;
  jumpState.t = 0;
  jumpState.start.copy(startAnchor);
  jumpState.end.copy(endAnchor);
  focusedIndex = nextIndex;
}

function updateJump(dt) {
  jumpState.t = Math.min(1, jumpState.t + dt / JUMP_DURATION);
  const t = jumpState.t;
  const x = THREE.MathUtils.lerp(jumpState.start.x, jumpState.end.x, t);
  const yBase = THREE.MathUtils.lerp(jumpState.start.y, jumpState.end.y, t);
  const y = yBase + Math.sin(t * Math.PI) * JUMP_ARC_HEIGHT;

  const stretch = 1 + 0.25 * Math.sin(t * Math.PI);
  const squash = t < 0.15 || t > 0.85 ? 0.8 : 1 / stretch;
  const yScale = t < 0.15 || t > 0.85 ? squash : stretch;
  const xScale = 1 / Math.sqrt(yScale);

  playerMesh.position.set(x, y, 0);
  playerMesh.scale.set(xScale, yScale, 1);

  if (t >= 1) {
    jumpState.active = false;
  }
}

function updateInput() {
  const upPressed = keys["ArrowUp"] && !prevUp;
  const downPressed = keys["ArrowDown"] && !prevDown;
  const spacePressed = keys["Space"] && !prevSpace;

  prevUp = !!keys["ArrowUp"];
  prevDown = !!keys["ArrowDown"];
  prevSpace = !!keys["Space"];

  if (spacePressed) {
    hideOverworld();
    return;
  }

  if (jumpState.active) return;

  if (upPressed && focusedIndex < nodes.length - 1) {
    beginJump(focusedIndex + 1);
  } else if (downPressed && focusedIndex > 0) {
    beginJump(focusedIndex - 1);
  }
}

function updatePlayerPositionAfterLayout() {
  if (nodes.length === 0) return;
  if (jumpState.active) return;
  const anchor = getNodeAnchor(focusedIndex);
  playerMesh.position.set(anchor.x, anchor.y, 0);
}

function rebuildNodePositions() {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const world = toWorldPosition(node.userData.location);
    node.position.set(world.x, world.y, 0);
  }

  updatePlayerPositionAfterLayout();
}

function buildNodes() {
  const geometry = new THREE.CircleGeometry(NODE_RADIUS, 32);

  for (const level of overworldLevels) {
    const material = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const node = new THREE.Mesh(geometry, material);
    node.userData.level = level.level;
    node.userData.name = level.name;
    node.userData.location = level.location;
    nodes.push(node);
    overworldScene.add(node);
  }

  rebuildNodePositions();
}

function updateOrthoBounds() {
  overworldCamera.left = -halfW();
  overworldCamera.right = halfW();
  overworldCamera.top = halfH();
  overworldCamera.bottom = -halfH();
  overworldCamera.updateProjectionMatrix();
}

window.addEventListener("resize", () => {
  updateOrthoBounds();
  rebuildNodePositions();
});

buildNodes();

function resetOverworldState() {
  focusedIndex = 0;
  idleTime = 0;
  jumpState.active = false;
  jumpState.t = 0;
  updatePlayerPositionAfterLayout();
}

resetOverworldState();

export function isOverworldActive() {
  return overworldActive;
}

export function showOverworld() {
  overworldActive = true;
  resetOverworldState();
}

export function hideOverworld() {
  overworldActive = false;
}

export function getSelectedLevelId() {
  if (nodes.length === 0) return 0;
  return nodes[focusedIndex]?.userData.level ?? 0;
}

export function updateOverworld(dt) {
  if (!overworldActive || nodes.length === 0) return;

  updateInput();
  if (!overworldActive) return;

  if (jumpState.active) {
    updateJump(dt);
  } else {
    updatePlayerRestPose(dt);
  }
}
