import * as THREE from "three";
import { scene } from "../renderer.js";

scene.add(new THREE.AmbientLight(0x8899ff, 0.45));

export const sun = new THREE.DirectionalLight(0xfff2d0, 1.3);
sun.position.set(40, 70, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const s = 120;
sun.shadow.camera.left = -s;
sun.shadow.camera.right = s;
sun.shadow.camera.top = s;
sun.shadow.camera.bottom = -s;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;
sun.shadow.bias = -0.0005;
scene.add(sun);

const rim = new THREE.DirectionalLight(0x88aaff, 0.4);
rim.position.set(-30, 20, -40);
scene.add(rim);
