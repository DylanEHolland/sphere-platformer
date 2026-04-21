import * as THREE from "three";

function makeToonGradient() {
  const data = new Uint8Array([
    70, 70, 70, 255, 150, 150, 150, 255, 220, 220, 220, 255, 255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export const gradientMap = makeToonGradient();

export function toonMat(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap });
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return c.getHex();
}

export function addOutline(mesh, scale = 1.04) {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: 0x0a0a14, side: THREE.BackSide }),
  );
  outline.scale.setScalar(scale);
  mesh.add(outline);
}

function buildMadFaceTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 128);
  // angry slanted eyebrows
  ctx.strokeStyle = "#0a0a14";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(24, 50);
  ctx.lineTo(56, 64);
  ctx.moveTo(104, 50);
  ctx.lineTo(72, 64);
  ctx.stroke();
  // eyes
  ctx.fillStyle = "#0a0a14";
  ctx.beginPath();
  ctx.arc(48, 76, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, 76, 6, 0, Math.PI * 2);
  ctx.fill();
  // jagged mouth
  ctx.strokeStyle = "#0a0a14";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(38, 104);
  ctx.lineTo(48, 94);
  ctx.lineTo(56, 102);
  ctx.lineTo(64, 93);
  ctx.lineTo(72, 102);
  ctx.lineTo(80, 94);
  ctx.lineTo(92, 104);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const madFaceTexture = buildMadFaceTexture();
