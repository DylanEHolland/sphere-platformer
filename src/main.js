import * as THREE from "three";
import { DEBUG } from "./runtime-env.js";

// --- infrastructure (order matters: renderer before everything that uses scene) ---
import { renderer, scene, camera } from "./renderer.js";

// --- scene dressing ---
import { nebula } from "./scene/starfield.js";
import "./scene/lighting.js";

// --- core systems ---
import "./input.js"; // registers keydown/keyup listeners
import {
  platforms,
  levelJson,
  loadLevel,
  buildLevel,
  updatePlatforms,
  updateVanish,
  getSpawnPos,
  resetPlatforms,
} from "./platforms.js";
import { playerGroup, player } from "./player.js";
import {
  enemyGroup,
  updateEnemies,
  clearEnemies,
  populateEnemies,
  checkEnemyStomp,
} from "./enemies/index.js";
import {
  startIntroFly,
  updateIntroCam,
  stopIntroCam,
  isIntroCamActive,
} from "./camera.js";
import { DYING_DURATION } from "./constants.js";
import { state, triggerDeath, triggerWin, resetGame, update } from "./game.js";
import {
  overworldScene,
  overworldCamera,
  isOverworldActive,
  showOverworld,
  updateOverworld,
  getSelectedLevelId,
} from "./overworld.js";

scene.add(enemyGroup);
let loadingLevel = false;

async function loadAndStartLevel(levelId, startPlatformOverride = null) {
  loadingLevel = true;
  stopIntroCam();

  try {
    await loadLevel(levelId);

    if (Number.isInteger(startPlatformOverride) && startPlatformOverride >= 0) {
      if (startPlatformOverride < levelJson.platforms.length) {
        levelJson.startPlatform = startPlatformOverride;
      } else {
        console.warn(
          `Ignoring debug platform ${startPlatformOverride}; level has ${levelJson.platforms.length} platforms`,
        );
      }
    }

    buildLevel();
    resetGame(getSpawnPos, resetPlatforms);
    startIntroFly(platforms, levelJson);
  } catch (err) {
    console.error("Unable to load selected level", err);
  } finally {
    loadingLevel = false;
  }
}

// ---------- R to reset ----------
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyQ" && !isOverworldActive()) {
    stopIntroCam();
    showOverworld();
    return;
  }

  if (e.code === "KeyR" && !isOverworldActive() && !loadingLevel) {
    stopIntroCam();
    resetGame(getSpawnPos, resetPlatforms);
  }
});

// ---------- clock ----------
const clock = new THREE.Clock();

async function getDebugStartupLevel() {
  const debugUrl = new URL("../debug.json", import.meta.url);
  const response = await fetch(debugUrl);
  if (!response.ok) {
    throw new Error(`Failed to load debug.json: ${response.status}`);
  }

  const data = await response.json();
  const level = Number(data.level);
  if (!Number.isInteger(level) || level < 0) {
    throw new Error("Invalid debug.json: level must be a non-negative integer");
  }

  let platform = null;
  if (data.platform != null) {
    platform = Number(data.platform);
    if (!Number.isInteger(platform) || platform < 0) {
      throw new Error(
        "Invalid debug.json: platform must be a non-negative integer",
      );
    }
  }

  return { level, platform };
}

async function initializeStartupState() {
  if (!DEBUG) {
    showOverworld();
    return;
  }

  try {
    const startupConfig = await getDebugStartupLevel();
    await loadAndStartLevel(startupConfig.level, startupConfig.platform);
  } catch (err) {
    console.error("Debug startup failed, returning to overworld", err);
    showOverworld();
  }
}

// ---------- animate ----------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());

  const overworldWasActive = isOverworldActive();
  if (overworldWasActive) {
    updateOverworld(dt);
    if (isOverworldActive()) {
      renderer.render(overworldScene, overworldCamera);
      return;
    }

    if (!loadingLevel) {
      loadAndStartLevel(getSelectedLevelId());
    }
  }

  if (loadingLevel) {
    renderer.render(scene, camera);
    return;
  }

  // intro fly-through
  if (isIntroCamActive()) {
    updateIntroCam(dt);
    updateEnemies(dt);
    nebula.rotation.y += dt * 0.01;
    renderer.render(scene, camera);
    return;
  }

  // death animation
  if (state.dying) {
    state.dyingT += dt;
    player.squashTarget += (0.08 - player.squashTarget) * Math.min(1, dt * 8);
    player.squash +=
      (player.squashTarget - player.squash) * Math.min(1, dt * 14);
    const sq = Math.max(0.01, player.squash);
    playerGroup.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    playerGroup.position.copy(player.pos);
    if (state.dyingT >= DYING_DURATION) {
      stopIntroCam();
      resetGame(getSpawnPos, resetPlatforms);
    }
    renderer.render(scene, camera);
    return;
  }

  update(dt);
  checkEnemyStomp();
  updateEnemies(dt);
  updatePlatforms(dt);
  updateVanish(dt);
  nebula.rotation.y += dt * 0.01;
  renderer.render(scene, camera);
}

await initializeStartupState();
animate();
