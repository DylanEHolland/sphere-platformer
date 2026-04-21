import * as THREE from "three";

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

scene.add(enemyGroup);

// ---------- build level ----------
buildLevel(clearEnemies, populateEnemies);

// ---------- R to reset ----------
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    stopIntroCam();
    resetGame(getSpawnPos, resetPlatforms);
  }
});

// ---------- intro cinematic ----------
startIntroFly(platforms, levelJson);

// ---------- clock ----------
const clock = new THREE.Clock();

// ---------- animate ----------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());

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

animate();
