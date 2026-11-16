import * as THREE from 'three';
import {
  EnemyKind,
  TowerKind,
  ALL_TOWERS,
  ENEMY_SPECS,
  MapConfig,
  TowerCosmeticSkinSpec,
} from '../types/game';

const TILE_SIZE = 2.0;

export interface CharacterRig {
  bodyGroup: THREE.Group;
  torso: THREE.Group;
  head: THREE.Object3D;
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  extraArms?: THREE.Group[];
  extraLegs?: THREE.Group[];
  jaw?: THREE.Group;
  tail?: THREE.Group;
  eyelids?: THREE.Object3D[];
  eyeStalks?: THREE.Object3D[];
  wingsOrHalo?: THREE.Group;
  coreMesh?: THREE.Object3D;
  spriteBillboard?: THREE.Sprite;
  isFloating?: boolean;
  baseY: number;
}

const textureCache = new Map<string, THREE.CanvasTexture>();
const externalSpriteCache = new Map<string, THREE.Texture>();
const spriteTextureLoader = new THREE.TextureLoader();

/**
 * Loads and caches a character sprite PNG from /public/assets/characters/ with sRGB color space.
 */
export function getCharacterSpriteTexture(url: string): THREE.Texture {
  if (externalSpriteCache.has(url)) {
    return externalSpriteCache.get(url)!;
  }
  const tex = spriteTextureLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  externalSpriteCache.set(url, tex);
  return tex;
}

/**
 * Generates a procedural radial contact shadow texture in memory (zero external URLs).
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const key = 'contact_shadow';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

function hash2(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function valueNoise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2(x: number, y: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * valueNoise2(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return v;
}

/**
 * Returns [minDist1, minDist2, cellId] for cellular Voronoi stone/scale tessellation.
 */
function voronoi2(x: number, y: number): [number, number, number] {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  let d1 = 8.0;
  let d2 = 8.0;
  let cellHash = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const rx = i + hash2(ix + i, iy + j) * 0.82 - fx;
      const ry = j + hash2(ix + i + 31.7, iy + j + 57.3) * 0.82 - fy;
      const d = Math.hypot(rx, ry);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cellHash = hash2(ix + i + 11.3, iy + j + 89.1);
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return [d1, d2, cellHash];
}

function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

/**
 * Shared high-frequency organic dermal & stone micro-relief bump map for 3D creatures and armor.
 */
function getMonsterMicroBumpTexture(): THREE.CanvasTexture {
  const key = 'monster_micro_bump_512';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const [d1, d2] = voronoi2(u * 18, v * 18);
      const edge = Math.min(1, (d2 - d1) * 3.5);
      const n = fbm2(u * 24, v * 24, 4);
      const h = Math.floor(Math.min(255, Math.max(0, (edge * 0.55 + n * 0.45) * 255)));
      const idx = (y * size + x) * 4;
      data[idx] = h;
      data[idx + 1] = h;
      data[idx + 2] = h;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a high-definition glossy eyeball texture (sclera, capillaries, radial iris fibers, pupil & catchlight).
 */
function createEyeballTexture(irisHex: string, slitPupil = false): THREE.CanvasTexture {
  const key = `eye_${irisHex}_${slitPupil ? 'slit' : 'round'}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Warm off-white sclera base with subtle radial depth
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  const scleraGrad = ctx.createRadialGradient(128, 128, 42, 128, 128, 128);
  scleraGrad.addColorStop(0, 'rgba(255,255,255,0)');
  scleraGrad.addColorStop(0.68, 'rgba(226,232,240,0.45)');
  scleraGrad.addColorStop(1, 'rgba(159,18,57,0.28)');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, 256, 256);

  // Outer dark limbal ring
  ctx.beginPath();
  ctx.arc(128, 128, 66, 0, Math.PI * 2);
  ctx.fillStyle = '#090d16';
  ctx.fill();

  // Multi-stop luminous iris gradient
  const irisGrad = ctx.createRadialGradient(128, 128, 14, 128, 128, 62);
  irisGrad.addColorStop(0, '#fef08a');
  irisGrad.addColorStop(0.32, irisHex);
  irisGrad.addColorStop(0.82, irisHex);
  irisGrad.addColorStop(1, '#020617');
  ctx.beginPath();
  ctx.arc(128, 128, 62, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Dense 96-fiber radial iris stroma & crypts
  ctx.save();
  ctx.translate(128, 128);
  for (let i = 0; i < 96; i++) {
    const a = (i * Math.PI * 2) / 96;
    const jitter = Math.sin(i * 7.3) * 4;
    ctx.strokeStyle =
      i % 3 === 0
        ? 'rgba(255,255,255,0.34)'
        : i % 3 === 1
        ? 'rgba(2,6,23,0.42)'
        : 'rgba(254,240,138,0.22)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (16 + jitter * 0.4), Math.sin(a) * (16 + jitter * 0.4));
    ctx.lineTo(Math.cos(a + 0.03) * (59 + jitter * 0.5), Math.sin(a + 0.03) * (59 + jitter * 0.5));
    ctx.stroke();
  }
  ctx.restore();

  // Pupil (round or reptilian slit) with inner golden-void rim
  ctx.fillStyle = '#020617';
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  if (slitPupil) {
    ctx.ellipse(128, 128, 10, 46, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(128, 128, 25, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();

  // Corneal dual specular highlights
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.beginPath();
  ctx.arc(106, 104, 11.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.beginPath();
  ctx.arc(148, 149, 5.5, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a high-density FBM & anisotropic strand fur texture for beasts and colossi.
 */
function createSpottedFurTexture(baseHex: string, spotHex: string): THREE.CanvasTexture {
  const key = `fur_${baseHex}_${spotHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const [br, bg, bb] = hexToRgb(baseHex);
  const [sr, sg, sb] = hexToRgb(spotHex);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const [d1, , cellId] = voronoi2(u * 4.5 + 1.3, v * 4.5 + 2.7);
      const spotMask = cellId > 0.35 ? Math.max(0, 1 - Math.pow(d1 / 0.42, 2.2)) : 0;
      const strandNoise = fbm2(u * 38, v * 9.5, 4);
      const microStrand = valueNoise2(u * 96, v * 18);
      const shade = 0.62 + strandNoise * 0.38 + (microStrand - 0.5) * 0.22;

      const r = (br * (1 - spotMask) + sr * spotMask) * shade;
      const g = (bg * (1 - spotMask) + sg * spotMask) * shade;
      const b = (bb * (1 - spotMask) + sb * spotMask) * shade;

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.floor(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a cellular Voronoi armored reptile scale texture with per-scale 3D bevel shading.
 */
function createReptileScalesTexture(baseHex: string, accentHex: string): THREE.CanvasTexture {
  const key = `scales_${baseHex}_${accentHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const [br, bg, bb] = hexToRgb(baseHex);
  const [ar, ag, ab] = hexToRgb(accentHex);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const [d1, d2, cellId] = voronoi2(u * 14, v * 16);
      const crevice = Math.min(1, Math.max(0, (d2 - d1) * 4.2));
      const dome = Math.max(0, 1 - d1 * 1.45);
      const spec = Math.pow(dome, 3.2) * 0.35;
      const blend = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 + cellId * 4.0);

      const cr = (br * (1 - blend) + ar * blend) * (0.35 + crevice * 0.65) + spec * 255;
      const cg = (bg * (1 - blend) + ag * blend) * (0.35 + crevice * 0.65) + spec * 255;
      const cb = (bb * (1 - blend) + ab * blend) * (0.35 + crevice * 0.65) + spec * 255;

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.floor(cr)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(cg)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(cb)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a realistic multi-octave FBM & Voronoi pebbled monster dermis texture.
 */
function createMonsterSkinTexture(baseHex: string, highlightHex: string): THREE.CanvasTexture {
  const key = `skin_${baseHex}_${highlightHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const [br, bg, bb] = hexToRgb(baseHex);
  const [hr, hg, hb] = hexToRgb(highlightHex);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = fbm2(u * 8.5, v * 8.5, 4);
      const [d1, d2] = voronoi2(u * 22, v * 22);
      const pebble = Math.min(1, (d2 - d1) * 3.2) * (1 - d1 * 0.8);
      const mixFactor = Math.min(1, Math.max(0, n * 0.65 + pebble * 0.35));
      const creviceShadow = 0.58 + pebble * 0.48;

      const r = (br * (1 - mixFactor) + hr * mixFactor) * creviceShadow;
      const g = (bg * (1 - mixFactor) + hg * mixFactor) * creviceShadow;
      const b = (bb * (1 - mixFactor) + hb * mixFactor) * creviceShadow;

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.floor(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a procedural runic stone tile texture for buildable terrace tiles.
 */
export function createRunicTileTexture(
  baseHex: string,
  borderHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let i = 0; i < 140; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    ctx.fillRect(x, y, 4, 4);
  }

  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 236, 236);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 3;
  const corners = [
    [26, 26],
    [230, 26],
    [26, 230],
    [230, 230],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a carved arcane stone road texture for the fixed static enemy path.
 */
export function createPathTileTexture(
  baseHex: string,
  runeHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 16, 104, 104);
  ctx.strokeRect(136, 16, 104, 104);
  ctx.strokeRect(16, 136, 104, 104);
  ctx.strokeRect(136, 136, 104, 104);

  ctx.strokeStyle = runeHex;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 248);

  ctx.beginPath();
  ctx.moveTo(128, 36);
  ctx.lineTo(156, 128);
  ctx.lineTo(128, 220);
  ctx.lineTo(100, 128);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowMesh(radius: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.02;
  return mesh;
}

/**
 * Generates the circular arcane rune ring texture inlaid on the Frost Pillar's stone base.
 */
function createFrostRuneRingTexture(): THREE.CanvasTexture {
  const key = 'frost_rune_ring_tex';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);
  const cx = 256;
  const cy = 256;

  // Dark carved slate ring band
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.arc(cx, cy, 172, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fill();

  // Concentric engraved ring borders
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 236, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 178, 0, Math.PI * 2);
  ctx.stroke();

  // 24 Arcane Elder-style runic glyphs around the perimeter (cyan & violet glow)
  const numRunes = 24;
  for (let i = 0; i < numRunes; i++) {
    const angle = (i / numRunes) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * 207, cy + Math.sin(angle) * 207);
    ctx.rotate(angle + Math.PI / 2);

    const isCyan = i % 3 !== 0;
    ctx.strokeStyle = isCyan ? '#38bdf8' : '#c084fc';
    ctx.shadowColor = isCyan ? '#22d3ee' : '#a855f7';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    // Vertical rune stem
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    // Diagonal rune branches
    if (i % 4 === 0) {
      ctx.moveTo(0, -10);
      ctx.lineTo(8, -2);
      ctx.moveTo(0, 2);
      ctx.lineTo(8, 10);
    } else if (i % 4 === 1) {
      ctx.moveTo(-7, -8);
      ctx.lineTo(7, 4);
      ctx.moveTo(0, -12);
      ctx.lineTo(7, -6);
    } else if (i % 4 === 2) {
      ctx.moveTo(0, -8);
      ctx.lineTo(-8, 0);
      ctx.lineTo(0, 8);
    } else {
      ctx.moveTo(-7, -10);
      ctx.lineTo(7, -10);
      ctx.moveTo(0, -2);
      ctx.lineTo(7, 8);
    }
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Builds a crouched stone gargoyle / wyvern guardian statue with folded wings and snow cap
 * for the corners of the Frost Pillar plinth.
 */
function createStoneGargoyleStatue(
  stoneMat: THREE.Material,
  darkStoneMat: THREE.Material,
  snowMat: THREE.Material,
  eyeGlowMat: THREE.Material
): THREE.Group {
  const gargoyle = new THREE.Group();

  // Small stone pedestal under gargoyle
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.22), darkStoneMat);
  base.position.y = 0.04;
  base.castShadow = true;
  gargoyle.add(base);

  // Crouched muscular stone torso
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), stoneMat);
  body.scale.set(0.95, 1.25, 0.9);
  body.position.set(0, 0.16, 0.01);
  body.castShadow = true;
  gargoyle.add(body);

  // Haunches / clawed front legs
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.13, 0.065), stoneMat);
    leg.position.set(side * 0.065, 0.11, 0.06);
    leg.rotation.x = -0.2;
    gargoyle.add(leg);

    // Folded bat/wyvern stone wing
    const wingGroup = new THREE.Group();
    wingGroup.position.set(side * 0.085, 0.2, -0.02);
    wingGroup.rotation.y = -side * 0.35;
    wingGroup.rotation.z = -side * 0.22;

    const wingBlade = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 4), darkStoneMat);
    wingBlade.scale.set(0.45, 1.0, 1.15);
    wingBlade.rotation.x = -0.35;
    wingBlade.castShadow = true;
    wingGroup.add(wingBlade);

    // Snow dusting on top of wing ridge
    const wingSnow = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), snowMat);
    wingSnow.position.set(0, 0.09, 0.02);
    wingGroup.add(wingSnow);

    gargoyle.add(wingGroup);
  });

  // Horned gargoyle head
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), stoneMat);
  head.scale.set(0.95, 0.9, 1.2);
  head.position.set(0, 0.27, 0.06);
  head.castShadow = true;
  gargoyle.add(head);

  // Snow cap on head/shoulders
  const headSnow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), snowMat);
  headSnow.scale.set(1.2, 0.45, 1.0);
  headSnow.position.set(0, 0.32, 0.04);
  gargoyle.add(headSnow);

  // Horns & glowing cyan eyes
  [-1, 1].forEach((side) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 4), darkStoneMat);
    horn.position.set(side * 0.045, 0.32, 0.02);
    horn.rotation.x = -0.45;
    horn.rotation.z = -side * 0.3;
    gargoyle.add(horn);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeGlowMat);
    eye.position.set(side * 0.028, 0.275, 0.12);
    gargoyle.add(eye);
  });

  return gargoyle;
}

/**
 * Custom 3D Helix curve for the twin spiral metal bands wrapping the Frost Pillar's crystal core.
 */
class HelixCurve extends THREE.Curve<THREE.Vector3> {
  private radiusBottom: number;
  private radiusTop: number;
  private yStart: number;
  private yEnd: number;
  private turns: number;
  private phaseOffset: number;

  constructor(
    radiusBottom: number,
    radiusTop: number,
    yStart: number,
    yEnd: number,
    turns: number,
    phaseOffset = 0
  ) {
    super();
    this.radiusBottom = radiusBottom;
    this.radiusTop = radiusTop;
    this.yStart = yStart;
    this.yEnd = yEnd;
    this.turns = turns;
    this.phaseOffset = phaseOffset;
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const angle = this.phaseOffset + t * Math.PI * 2 * this.turns;
    const r = THREE.MathUtils.lerp(this.radiusBottom, this.radiusTop, t);
    const y = THREE.MathUtils.lerp(this.yStart, this.yEnd, t);
    return optionalTarget.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
  }
}

/**
 * Builds the bespoke multi-tiered 3D Frost Pillar (Pilar de Escarcha) & Glacial Prism Supertower
 * modeled directly after the user's concept illustration:
 * - Stepped snow-dusted slate stone foundation with corner stairs & 3 perched stone gargoyle statues
 * - Engraved glowing cyan/violet rune circle around the terrace
 * - Fortified stone bastion with violet/cyan runic pilasters, gothic arches & erupting ice crystal clusters
 * - Open central cage housing a radiant faceted starburst Heart Crystal wrapped by twin spiral metal bands with icicles
 * - Upper crenellated battlements with dual flanking cylindrical cryo-vents emitting rising frost vapor
 * - Top rotatable Gyroscopic Cryo-Lens Concentrator Cannon with front focusing ring & crystalline prism barrel
 */
function buildFrostPillarModel(
  root: THREE.Group,
  turret: THREE.Group,
  isSuper: boolean,
  isSoftwareGl: boolean
): void {
  const slateStoneMat = new THREE.MeshStandardMaterial({
    color: 0x3b495e,
    roughness: 0.84,
    metalness: 0.16,
  });
  const darkBastionMat = new THREE.MeshStandardMaterial({
    color: 0x262f3f,
    roughness: 0.78,
    metalness: 0.25,
  });
  const runicPilasterMat = new THREE.MeshStandardMaterial({
    color: 0x43354b,
    roughness: 0.65,
    metalness: 0.35,
  });
  const spiralMetalMat = new THREE.MeshStandardMaterial({
    color: isSuper ? 0x64748b : 0x52475c,
    roughness: 0.36,
    metalness: 0.82,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    emissive: 0xbae6fd,
    emissiveIntensity: 0.12,
    roughness: 0.9,
    metalness: 0.02,
  });

  const iceShardMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    emissive: 0x0284c7,
    emissiveIntensity: isSuper ? 0.62 : 0.45,
    roughness: 0.1,
    metalness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.68,
    transparent: true,
    opacity: isSoftwareGl ? 0.9 : 0.96,
    ior: 1.52,
    clearcoat: 1.0,
  });

  const iceBrightCoreMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: isSuper ? 1.55 : 1.25,
    roughness: 0.12,
    metalness: 0.15,
  });

  const runeVioletMat = new THREE.MeshStandardMaterial({
    color: 0xd8b4fe,
    emissive: 0xa855f7,
    emissiveIntensity: 1.15,
    roughness: 0.2,
  });

  const runeCyanMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  // ==========================================================================
  // 1. STEPPED SNOW-DUSTED STONE CITADEL BASE, STAIRS, RUNE CIRCLE & GARGOYLES
  // ==========================================================================
  const lowerRockPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.96, 0.18, 10),
    darkBastionMat
  );
  lowerRockPlinth.position.y = 0.09;
  lowerRockPlinth.castShadow = true;
  lowerRockPlinth.receiveShadow = true;
  root.add(lowerRockPlinth);

  const midTerracePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.84, 0.16, 10),
    slateStoneMat
  );
  midTerracePlinth.position.y = 0.24;
  midTerracePlinth.castShadow = true;
  midTerracePlinth.receiveShadow = true;
  root.add(midTerracePlinth);

  // Carved stone steps on 3 sides + snow drifts around the base
  for (let s = 0; s < 4; s++) {
    const stepAngle = (s * Math.PI) / 2 + Math.PI / 4;
    const stairGroup = new THREE.Group();
    stairGroup.rotation.y = stepAngle;
    for (let st = 0; st < 3; st++) {
      const stepBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.32 - st * 0.03, 0.06, 0.12),
        slateStoneMat
      );
      stepBlock.position.set(0, 0.05 + st * 0.065, 0.88 - st * 0.08);
      stepBlock.castShadow = true;
      stepBlock.receiveShadow = true;
      stairGroup.add(stepBlock);
    }
    root.add(stairGroup);

    // Sculpted snow patches on the stone terrace ledges
    const snowDrift = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), snowMat);
    snowDrift.scale.set(1.6, 0.32, 0.95);
    const driftAngle = stepAngle + 0.38;
    snowDrift.position.set(
      Math.cos(driftAngle) * 0.72,
      0.32,
      Math.sin(driftAngle) * 0.72
    );
    snowDrift.rotation.y = -driftAngle;
    root.add(snowDrift);
  }

  // Engraved Glowing Arcane Rune Disc on the stone terrace floor
  const runeRingGeo = new THREE.PlaneGeometry(1.52, 1.52);
  runeRingGeo.rotateX(-Math.PI / 2);
  const runeRingMat = new THREE.MeshBasicMaterial({
    map: createFrostRuneRingTexture(),
    transparent: true,
    depthWrite: false,
  });
  const runeRingMesh = new THREE.Mesh(runeRingGeo, runeRingMat);
  runeRingMesh.position.y = 0.326;
  root.add(runeRingMesh);

  // 3 Perched Stone Gargoyle / Wyvern Statues guarding the outer plinth
  const gargoyleAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  gargoyleAngles.forEach((gAngle) => {
    const gargoyle = createStoneGargoyleStatue(
      slateStoneMat,
      darkBastionMat,
      snowMat,
      runeCyanMat
    );
    const r = 0.74;
    gargoyle.position.set(Math.cos(gAngle) * r, 0.31, Math.sin(gAngle) * r);
    gargoyle.rotation.y = -gAngle + Math.PI / 2;
    root.add(gargoyle);
  });

  // ==========================================================================
  // 2. FORTIFIED RUNIC BASTION WALL & LOWER ICE CRYSTAL CLUSTER
  // ==========================================================================
  const bastionWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.56, 0.42, 8),
    darkBastionMat
  );
  bastionWall.position.y = 0.52;
  bastionWall.castShadow = true;
  bastionWall.receiveShadow = true;
  root.add(bastionWall);

  // 6 Vertical Runic Stone Pilasters with glowing violet/magenta & cyan runes + Gothic Arch Slits
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const pilasterGroup = new THREE.Group();
    pilasterGroup.rotation.y = -a;

    // Buttress pilaster column
    const pilaster = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.48, 0.16),
      runicPilasterMat
    );
    pilaster.position.set(0.51, 0.54, 0);
    pilaster.castShadow = true;
    pilasterGroup.add(pilaster);

    // Snow cap on pilaster top
    const pilasterSnow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.17), snowMat);
    pilasterSnow.position.set(0.51, 0.79, 0);
    pilasterGroup.add(pilasterSnow);

    // 3 Glowing violet/magenta rune glyphs carved vertically down each pilaster face
    for (let r = 0; r < 3; r++) {
      const runeGlyph = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.065, 0.055),
        i % 2 === 0 ? runeVioletMat : runeCyanMat
      );
      runeGlyph.position.set(0.572, 0.42 + r * 0.11, (r - 1) * 0.015);
      runeGlyph.rotation.x = (r - 1) * 0.35;
      pilasterGroup.add(runeGlyph);
    }

    // Glowing cyan diamond crystal slit in the recessed wall between pilasters
    const midAngle = a + Math.PI / 6;
    const archDiamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055, 0),
      runeCyanMat
    );
    archDiamond.scale.set(0.6, 1.45, 0.6);
    archDiamond.position.set(Math.cos(midAngle) * 0.52, 0.5, Math.sin(midAngle) * 0.52);
    root.add(archDiamond);

    root.add(pilasterGroup);
  }

  // Ring of 12 Jagged Ice Crystal Shards erupting around the lower bastion collar
  for (let c = 0; c < 12; c++) {
    const cAngle = (c / 12) * Math.PI * 2;
    const isLarge = c % 2 === 0;
    const shardH = isLarge ? 0.46 : 0.3;
    const shardR = isLarge ? 0.11 : 0.075;
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(shardR, shardH, 5),
      isLarge ? iceShardMat : iceBrightCoreMat
    );
    const radialDist = isLarge ? 0.48 : 0.41;
    shard.position.set(
      Math.cos(cAngle) * radialDist,
      0.74 + shardH * 0.32,
      Math.sin(cAngle) * radialDist
    );
    // Tilt outward like erupting glacial crystals
    const tilt = isLarge ? 0.44 : 0.25;
    shard.rotation.z = -Math.cos(cAngle) * tilt;
    shard.rotation.x = Math.sin(cAngle) * tilt;
    shard.castShadow = true;
    root.add(shard);
  }

  // ==========================================================================
  // 3. CENTRAL HEART-CRYSTAL CHAMBER & TWIN SPIRAL METAL BANDS WITH ICICLES
  // ==========================================================================
  // 4 Internal dark-stone frame columns supporting the upper crown
  for (let p = 0; p < 4; p++) {
    const pAngle = (p * Math.PI) / 2 + Math.PI / 4;
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.86, 6),
      darkBastionMat
    );
    strut.position.set(Math.cos(pAngle) * 0.34, 1.12, Math.sin(pAngle) * 0.34);
    strut.castShadow = true;
    root.add(strut);
  }

  // Radiant Faceted Starburst Heart Crystal pulsing inside the chamber
  const heartCrystalGroup = new THREE.Group();
  heartCrystalGroup.position.set(0, 1.12, 0);

  const innerHeartCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    iceBrightCoreMat
  );
  innerHeartCore.scale.set(0.95, 1.45, 0.95);
  heartCrystalGroup.add(innerHeartCore);

  const outerHeartFacet = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.33, 1),
    iceShardMat
  );
  outerHeartFacet.scale.set(0.92, 1.38, 0.92);
  outerHeartFacet.castShadow = true;
  heartCrystalGroup.add(outerHeartFacet);

  // 8 Radial crystalline star points jutting out of the central Heart Crystal
  for (let sp = 0; sp < 8; sp++) {
    const spAngle = (sp / 8) * Math.PI * 2;
    const starSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.28, 4),
      sp % 2 === 0 ? iceBrightCoreMat : iceShardMat
    );
    starSpike.position.set(
      Math.cos(spAngle) * 0.2,
      (sp % 2 === 0 ? 0.06 : -0.06),
      Math.sin(spAngle) * 0.2
    );
    starSpike.rotation.z = -Math.cos(spAngle) * 1.15;
    starSpike.rotation.x = Math.sin(spAngle) * 1.15;
    heartCrystalGroup.add(starSpike);
  }
  root.add(heartCrystalGroup);
  root.userData.heartCrystal = heartCrystalGroup;

  // Twin Helical / Spiral Runic Metal Ribbons wrapping diagonally around the crystal chamber
  [0, Math.PI].forEach((phaseOff) => {
    const helix = new HelixCurve(0.49, 0.44, 0.66, 1.54, 0.95, phaseOff);
    const ribbonGeo = new THREE.TubeGeometry(helix, 36, 0.048, 6, false);
    const ribbonMesh = new THREE.Mesh(ribbonGeo, spiralMetalMat);
    ribbonMesh.castShadow = true;
    root.add(ribbonMesh);

    // Snow/frost trim along the top ridge of the spiral band
    const snowHelix = new HelixCurve(0.495, 0.445, 0.695, 1.575, 0.95, phaseOff);
    const snowRibbonGeo = new THREE.TubeGeometry(snowHelix, 28, 0.024, 5, false);
    const snowRibbonMesh = new THREE.Mesh(snowRibbonGeo, snowMat);
    root.add(snowRibbonMesh);

    // Small icicles hanging along the underside of the spiral metal band
    for (let ic = 1; ic <= 5; ic++) {
      const t = ic / 6;
      const pt = helix.getPoint(t);
      const icicle = new THREE.Mesh(
        new THREE.ConeGeometry(0.028, 0.12 + (ic % 2) * 0.05, 4),
        iceBrightCoreMat
      );
      icicle.position.set(pt.x * 1.03, pt.y - 0.07, pt.z * 1.03);
      icicle.rotation.x = Math.PI;
      root.add(icicle);
    }
  });

  // ==========================================================================
  // 4. UPPER CRENELLATED CROWN & DUAL FLANKING CRYO-VENT BRAZIERS WITH STEAM
  // ==========================================================================
  const upperCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.44, 0.18, 8),
    darkBastionMat
  );
  upperCrown.position.y = 1.54;
  upperCrown.castShadow = true;
  root.add(upperCrown);

  // 8 Crenellated Stone Merlons + Upper Ice Shards around the crown rim
  for (let m = 0; m < 8; m++) {
    const mAngle = (m / 8) * Math.PI * 2;
    const merlon = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.16, 0.11),
      runicPilasterMat
    );
    merlon.position.set(Math.cos(mAngle) * 0.46, 1.64, Math.sin(mAngle) * 0.46);
    merlon.rotation.y = -mAngle;
    merlon.castShadow = true;
    root.add(merlon);

    const merlonSnow = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.035, 0.115), snowMat);
    merlonSnow.position.set(Math.cos(mAngle) * 0.46, 1.73, Math.sin(mAngle) * 0.46);
    merlonSnow.rotation.y = -mAngle;
    root.add(merlonSnow);

    // Upper jagged ice crystal between merlons
    const iceA = mAngle + Math.PI / 8;
    const crownShard = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.28 + (m % 2) * 0.1, 5),
      m % 2 === 0 ? iceShardMat : iceBrightCoreMat
    );
    crownShard.position.set(Math.cos(iceA) * 0.4, 1.7, Math.sin(iceA) * 0.4);
    crownShard.rotation.z = -Math.cos(iceA) * 0.28;
    crownShard.rotation.x = Math.sin(iceA) * 0.28;
    root.add(crownShard);
  }

  // Dual Flanking Cylindrical Cryo-Braziers / Steam Vents (Left & Right)
  const steamPuffs: THREE.Mesh[] = [];
  const mistMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  [-1, 1].forEach((side) => {
    const ventGroup = new THREE.Group();
    ventGroup.position.set(side * 0.62, 1.38, 0);

    // Horizontal iron support strut connecting to the tower shaft
    const armStrut = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.07, 0.08),
      spiralMetalMat
    );
    armStrut.position.set(-side * 0.12, 0.02, 0);
    ventGroup.add(armStrut);

    // Cylindrical stone/iron cryo-brazier body
    const canister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.105, 0.26, 10),
      slateStoneMat
    );
    canister.castShadow = true;
    ventGroup.add(canister);

    // Upper & lower metallic collar bands
    [-0.11, 0.11].forEach((ry) => {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.02, 6, 16),
        spiralMetalMat
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = ry;
      ventGroup.add(band);
    });

    // Hanging icicle spike under the cryo-brazier
    const bottomIcicle = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.22, 5),
      iceShardMat
    );
    bottomIcicle.rotation.x = Math.PI;
    bottomIcicle.position.y = -0.22;
    ventGroup.add(bottomIcicle);

    // Glowing cyan cryo-vent nozzle on top
    const topNozzle = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.1, 6),
      iceBrightCoreMat
    );
    topNozzle.position.y = 0.16;
    ventGroup.add(topNozzle);

    // 3 Rising Frost Steam Puffs per vent
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.065 + p * 0.025, 8, 8),
        mistMat
      );
      puff.position.set(side * p * 0.04, 0.24 + p * 0.13, 0);
      puff.userData.ventSide = side;
      puff.userData.puffIndex = p;
      steamPuffs.push(puff);
      ventGroup.add(puff);
    }

    root.add(ventGroup);
  });
  root.userData.steamPuffs = steamPuffs;

  // ==========================================================================
  // 5. TOP ROTATABLE GYROSCOPIC CRYO-LENS CONCENTRATOR CANNON (TURRET)
  // ==========================================================================
  turret.position.y = 1.96;
  turret.userData.baseY = 1.96;

  // Heavy Outer Dark-Iron Gyroscope Wheel (vertical plane facing +Z)
  const outerWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.055, 10, 28),
    spiralMetalMat
  );
  outerWheel.castShadow = true;
  turret.add(outerWheel);

  // 8 Radial Gear Notches / Armor Plates around the outer gyroscope wheel
  for (let g = 0; g < 8; g++) {
    const gAngle = (g / 8) * Math.PI * 2;
    const cog = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.09, 0.11),
      darkBastionMat
    );
    cog.position.set(Math.cos(gAngle) * 0.36, Math.sin(gAngle) * 0.36, 0);
    cog.rotation.z = gAngle;
    turret.add(cog);
  }

  // Jagged Ice Crystal Crest jutting from the upper-left/rear of the gyroscope wheel
  for (let cr = 0; cr < 3; cr++) {
    const crAngle = Math.PI * 0.62 + cr * 0.24;
    const wheelIce = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.28 - cr * 0.04, 5),
      cr === 1 ? iceBrightCoreMat : iceShardMat
    );
    wheelIce.position.set(
      Math.cos(crAngle) * 0.39,
      Math.sin(crAngle) * 0.39,
      -0.02
    );
    wheelIce.rotation.z = crAngle - Math.PI / 2;
    turret.add(wheelIce);
  }

  // Left & Right Gimbal Mount Hubs with Inset Glowing Cyan Diamond Nodes
  [-1, 1].forEach((side) => {
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.12, 8),
      darkBastionMat
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * 0.35, -0.02, 0);
    turret.add(hub);

    const diamondNode = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.068, 0),
      runeCyanMat
    );
    diamondNode.position.set(side * 0.41, -0.02, 0);
    turret.add(diamondNode);
  });

  // Concentric Inner Glowing Cyan Cryo-Ring
  const innerCryoRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.032, 8, 24),
    runeCyanMat
  );
  turret.add(innerCryoRing);

  // Central Pulsing Cryo-Energy Core inside the Gyroscope
  const lensCoreOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 16, 14),
    iceBrightCoreMat
  );
  turret.add(lensCoreOrb);

  // Rear Counterweight Ice Fin (-Z)
  const rearFin = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.26, 5),
    iceShardMat
  );
  rearFin.rotation.x = -Math.PI / 2;
  rearFin.position.set(0, 0.02, -0.18);
  turret.add(rearFin);

  // Forward Focusing Lens Assembly (+Z direction, exactly as in the reference image)
  const forwardLensGroup = new THREE.Group();
  forwardLensGroup.position.set(0, 0, 0.28);

  // Twin metallic struts connecting outer wheel to the front focusing ring
  [-1, 1].forEach((side) => {
    const lensStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 0.3, 6),
      spiralMetalMat
    );
    lensStrut.rotation.x = Math.PI / 2;
    lensStrut.rotation.z = side * 0.25;
    lensStrut.position.set(side * 0.18, 0.04, -0.14);
    forwardLensGroup.add(lensStrut);
  });

  // Front Metallic Focusing Ring
  const frontFocusRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.155, 0.028, 8, 20),
    spiralMetalMat
  );
  forwardLensGroup.add(frontFocusRing);

  const frontInnerGlowRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.018, 8, 18),
    runeCyanMat
  );
  forwardLensGroup.add(frontInnerGlowRing);

  // 6 Faceted Ice Prongs framing the focusing lens
  for (let fp = 0; fp < 6; fp++) {
    const fpA = (fp / 6) * Math.PI * 2;
    const prong = new THREE.Mesh(
      new THREE.ConeGeometry(0.038, 0.14, 4),
      fp % 2 === 0 ? iceShardMat : iceBrightCoreMat
    );
    prong.position.set(Math.cos(fpA) * 0.14, Math.sin(fpA) * 0.14, 0.04);
    prong.rotation.x = Math.PI / 2.4;
    prong.rotation.z = fpA;
    forwardLensGroup.add(prong);
  }

  // Focused Crystalline Prism Emitter Beam Tip (+Z)
  const internalBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.075, 0.46, 8),
    iceBrightCoreMat
  );
  internalBeam.rotation.x = Math.PI / 2;
  internalBeam.position.set(0, 0, -0.02);
  forwardLensGroup.add(internalBeam);

  const prismTip = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.075, 0),
    iceShardMat
  );
  prismTip.scale.set(0.85, 0.85, 1.65);
  prismTip.position.set(0, 0, 0.24);
  forwardLensGroup.add(prismTip);

  turret.add(forwardLensGroup);

  // Extra ascended halo rings for Glacial Prism Supertower
  if (isSuper) {
    const superHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.54, 0.026, 8, 28),
      runeCyanMat
    );
    superHalo.rotation.x = Math.PI / 2;
    superHalo.position.y = -0.18;
    turret.add(superHalo);
  }
}

/**
 * Generates the circular volcanic rune ring texture inlaid on the Magma Mortar's obsidian base.
 */
function createMagmaRuneRingTexture(): THREE.CanvasTexture {
  const key = 'magma_rune_ring_tex';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);
  const cx = 256;
  const cy = 256;

  // Deep obsidian carved stone ring band
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.arc(cx, cy, 172, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(20, 16, 24, 0.95)';
  ctx.fill();

  // Inner molten lava glow border
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 176, 0, Math.PI * 2);
  ctx.stroke();

  // Outer ember-red engraved border
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 236, 0, Math.PI * 2);
  ctx.stroke();

  // 24 Glowing Volcanic Runes around the perimeter (Magma Orange, Solar Gold & Ember Red)
  const numRunes = 24;
  for (let i = 0; i < numRunes; i++) {
    const angle = (i / numRunes) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * 207, cy + Math.sin(angle) * 207);
    ctx.rotate(angle + Math.PI / 2);

    const isGold = i % 3 === 0;
    ctx.strokeStyle = isGold ? '#fde047' : '#f97316';
    ctx.shadowColor = isGold ? '#facc15' : '#ef4444';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    if (i % 4 === 0) {
      ctx.moveTo(-7, -6);
      ctx.lineTo(0, -12);
      ctx.lineTo(7, -6);
      ctx.moveTo(-6, 4);
      ctx.lineTo(6, 4);
    } else if (i % 4 === 1) {
      ctx.moveTo(0, -10);
      ctx.lineTo(8, -2);
      ctx.lineTo(0, 6);
    } else if (i % 4 === 2) {
      ctx.moveTo(-7, -9);
      ctx.lineTo(7, 9);
      ctx.moveTo(7, -9);
      ctx.lineTo(-7, 9);
    } else {
      ctx.moveTo(0, -11);
      ctx.lineTo(-8, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(8, 10);
    }
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a pixel-shader-grade swirling solar-magma & plasma accretion vortex texture for the Blaze Core chamber.
 */
function createMagmaVortexTexture(): THREE.CanvasTexture {
  const key = 'magma_vortex_spiral_tex';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const r = Math.hypot(dx, dy);
      const theta = Math.atan2(dy, dx);

      const n = fbm2(dx * 3.8 + 4.1, dy * 3.8 + 1.9, 4);
      const spiralPhase = theta * 4.0 - Math.log(Math.max(0.04, r)) * 6.5 + n * 4.2;
      const arm1 = Math.pow(0.5 + 0.5 * Math.sin(spiralPhase), 2.4);
      const arm2 = Math.pow(0.5 + 0.5 * Math.cos(spiralPhase * 1.5 - n * 3.0), 3.0);

      const coreHot = Math.exp(-r * r * 9.0);
      const radialFalloff = Math.max(0, 1 - Math.pow(r, 1.35));
      const heat = Math.min(
        1,
        coreHot * 1.15 + (arm1 * 0.72 + arm2 * 0.45 + n * 0.25) * radialFalloff
      );

      const red = Math.min(255, Math.floor(65 + heat * 190));
      const green = Math.min(255, Math.floor(10 + Math.pow(heat, 1.55) * 235));
      const blue = Math.min(255, Math.floor(6 + Math.pow(heat, 3.2) * 185));

      const idx = (y * size + x) * 4;
      data[idx] = red;
      data[idx + 1] = green;
      data[idx + 2] = blue;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Builds the bespoke multi-tiered 3D Volcanic Blaze Tower (Mortero de Magma & Coloso de Plasma Solar)
 * modeled directly after the "VOLCANIC BLAZE TOWER - ART OF DEFENSE" concept sheet:
 * - Stepped dark volcanic rock & deep obsidian foundation with corner stairs, molten lava moat & 3 obsidian wyvern gargoyles
 * - Engraved glowing orange/red volcanic rune circle around the terrace
 * - Fortified volcanic bastion with ember-red runic pilasters, gothic lava slits & 12 jagged black obsidian spires
 * - Open central chamber housing a Swirling Solar-Magma Fire Vortex wrapped by twin lava-cracked spiral metal bands with dripping magma stalactites
 * - Upper crenellated obsidian crown with dual flanking fire-braziers emitting dark volcanic smoke & glowing embers
 * - Top rotatable "Blaze Core" Gyroscopic Flame-Projector Cannon with X-clamped bullseye core & forward focusing fire lens
 */
function buildMagmaVolcanicTowerModel(
  root: THREE.Group,
  turret: THREE.Group,
  isSuper: boolean
): void {
  // Concept sheet color swatches: Deep Obsidian, Volcanic Rock, Magma Orange, Ember Red, Ash Gray
  const deepObsidianMat = new THREE.MeshPhysicalMaterial({
    color: 0x161620,
    roughness: 0.28,
    metalness: 0.45,
    clearcoat: 0.65,
  });
  const volcanicRockMat = new THREE.MeshStandardMaterial({
    color: 0x2e2736,
    roughness: 0.85,
    metalness: 0.18,
  });
  const darkBastionMat = new THREE.MeshStandardMaterial({
    color: 0x211c27,
    roughness: 0.8,
    metalness: 0.25,
  });
  const ashPilasterMat = new THREE.MeshStandardMaterial({
    color: 0x3b3042,
    roughness: 0.68,
    metalness: 0.32,
  });
  const charredIronMat = new THREE.MeshStandardMaterial({
    color: isSuper ? 0x574136 : 0x443845,
    roughness: 0.38,
    metalness: 0.82,
  });
  const volcanicAshMat = new THREE.MeshStandardMaterial({
    color: 0x3f3a45,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.18,
    roughness: 0.92,
  });

  const magmaOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: isSuper ? 1.45 : 1.2,
    roughness: 0.18,
  });
  const emberRedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.15,
    roughness: 0.22,
  });
  const blazeYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: isSuper ? 1.75 : 1.45,
    roughness: 0.12,
  });

  // ==========================================================================
  // 1. STEPPED VOLCANIC ROCK BASE, LAVA MOAT, RUNE CIRCLE & OBSIDIAN GARGOYLES
  // ==========================================================================
  const lowerRockPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.96, 0.18, 10),
    darkBastionMat
  );
  lowerRockPlinth.position.y = 0.09;
  lowerRockPlinth.castShadow = true;
  lowerRockPlinth.receiveShadow = true;
  root.add(lowerRockPlinth);

  const midTerracePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.84, 0.16, 10),
    volcanicRockMat
  );
  midTerracePlinth.position.y = 0.24;
  midTerracePlinth.castShadow = true;
  midTerracePlinth.receiveShadow = true;
  root.add(midTerracePlinth);

  // Carved volcanic stone steps on 4 corners + glowing lava cracks & ash drifts
  for (let s = 0; s < 4; s++) {
    const stepAngle = (s * Math.PI) / 2 + Math.PI / 4;
    const stairGroup = new THREE.Group();
    stairGroup.rotation.y = stepAngle;
    for (let st = 0; st < 3; st++) {
      const stepBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.32 - st * 0.03, 0.06, 0.12),
        volcanicRockMat
      );
      stepBlock.position.set(0, 0.05 + st * 0.065, 0.88 - st * 0.08);
      stepBlock.castShadow = true;
      stepBlock.receiveShadow = true;
      stairGroup.add(stepBlock);
    }
    root.add(stairGroup);

    // Volcanic ash & glowing ember crust on the stone terrace ledges
    const ashDrift = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), volcanicAshMat);
    ashDrift.scale.set(1.55, 0.3, 0.95);
    const driftAngle = stepAngle + 0.38;
    ashDrift.position.set(
      Math.cos(driftAngle) * 0.72,
      0.32,
      Math.sin(driftAngle) * 0.72
    );
    ashDrift.rotation.y = -driftAngle;
    root.add(ashDrift);
  }

  // Engraved Glowing Volcanic Rune Disc on the stone terrace floor
  const runeRingGeo = new THREE.PlaneGeometry(1.52, 1.52);
  runeRingGeo.rotateX(-Math.PI / 2);
  const runeRingMat = new THREE.MeshBasicMaterial({
    map: createMagmaRuneRingTexture(),
    transparent: true,
    depthWrite: false,
  });
  const runeRingMesh = new THREE.Mesh(runeRingGeo, runeRingMat);
  runeRingMesh.position.y = 0.326;
  root.add(runeRingMesh);

  // Glowing Molten Lava Pool Seam around the base of the bastion wall
  const lavaMoat = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.042, 8, 24),
    blazeYellowMat
  );
  lavaMoat.rotation.x = Math.PI / 2;
  lavaMoat.position.y = 0.33;
  root.add(lavaMoat);

  // 3 Perched Dark Obsidian Wyvern/Gargoyle Statues guarding the outer plinth
  const gargoyleAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  gargoyleAngles.forEach((gAngle) => {
    const gargoyle = createStoneGargoyleStatue(
      volcanicRockMat,
      deepObsidianMat,
      volcanicAshMat,
      magmaOrangeMat
    );
    const r = 0.74;
    gargoyle.position.set(Math.cos(gAngle) * r, 0.31, Math.sin(gAngle) * r);
    gargoyle.rotation.y = -gAngle + Math.PI / 2;
    root.add(gargoyle);
  });

  // ==========================================================================
  // 2. FORTIFIED VOLCANIC BASTION WALL & JAGGED DEEP-OBSIDIAN SPIRES
  // ==========================================================================
  const bastionWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.56, 0.42, 8),
    darkBastionMat
  );
  bastionWall.position.y = 0.52;
  bastionWall.castShadow = true;
  bastionWall.receiveShadow = true;
  root.add(bastionWall);

  // 6 Vertical Runic Volcanic Pilasters with glowing Ember-Red & Magma-Orange runes + Gothic Lava Slits
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const pilasterGroup = new THREE.Group();
    pilasterGroup.rotation.y = -a;

    const pilaster = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.48, 0.16),
      ashPilasterMat
    );
    pilaster.position.set(0.51, 0.54, 0);
    pilaster.castShadow = true;
    pilasterGroup.add(pilaster);

    // 3 Glowing Ember-Red / Magma-Orange rune glyphs carved vertically down each pilaster face
    for (let r = 0; r < 3; r++) {
      const runeGlyph = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.065, 0.055),
        i % 2 === 0 ? emberRedMat : magmaOrangeMat
      );
      runeGlyph.position.set(0.572, 0.42 + r * 0.11, (r - 1) * 0.015);
      runeGlyph.rotation.x = (r - 1) * 0.35;
      pilasterGroup.add(runeGlyph);
    }

    // Glowing orange fire-diamond slit in the gothic arch between pilasters
    const midAngle = a + Math.PI / 6;
    const archDiamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055, 0),
      magmaOrangeMat
    );
    archDiamond.scale.set(0.6, 1.45, 0.6);
    archDiamond.position.set(Math.cos(midAngle) * 0.52, 0.5, Math.sin(midAngle) * 0.52);
    root.add(archDiamond);

    root.add(pilasterGroup);
  }

  // Ring of 12 Jagged Black Obsidian Spires & Glowing Magma Shards erupting around the bastion collar
  for (let c = 0; c < 12; c++) {
    const cAngle = (c / 12) * Math.PI * 2;
    const isLargeObsidian = c % 2 === 0;
    const shardH = isLargeObsidian ? 0.48 : 0.32;
    const shardR = isLargeObsidian ? 0.115 : 0.08;
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(shardR, shardH, 5),
      isLargeObsidian ? deepObsidianMat : magmaOrangeMat
    );
    const radialDist = isLargeObsidian ? 0.48 : 0.42;
    shard.position.set(
      Math.cos(cAngle) * radialDist,
      0.74 + shardH * 0.32,
      Math.sin(cAngle) * radialDist
    );
    const tilt = isLargeObsidian ? 0.46 : 0.26;
    shard.rotation.z = -Math.cos(cAngle) * tilt;
    shard.rotation.x = Math.sin(cAngle) * tilt;
    shard.castShadow = true;
    root.add(shard);
  }

  // ==========================================================================
  // 3. CENTRAL SWIRLING SOLAR-MAGMA VORTEX CORE & LAVA-CRACKED SPIRAL BANDS
  // ==========================================================================
  // 4 Internal obsidian frame columns supporting the upper crown
  for (let p = 0; p < 4; p++) {
    const pAngle = (p * Math.PI) / 2 + Math.PI / 4;
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.86, 6),
      darkBastionMat
    );
    strut.position.set(Math.cos(pAngle) * 0.34, 1.12, Math.sin(pAngle) * 0.34);
    strut.castShadow = true;
    root.add(strut);
  }

  // Swirling Solar-Magma Fire Vortex Core inside the open central chamber
  const magmaVortexGroup = new THREE.Group();
  magmaVortexGroup.position.set(0, 1.12, 0);

  const vortexCoreMat = new THREE.MeshBasicMaterial({
    map: createMagmaVortexTexture(),
  });
  const vortexSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 20, 16),
    vortexCoreMat
  );
  vortexSphere.scale.set(0.95, 1.32, 0.95);
  magmaVortexGroup.add(vortexSphere);

  // 3 Tilted Concentric Swirling Fire-Ribbon Rings wrapping the vortex core
  for (let vr = 0; vr < 3; vr++) {
    const ringMat = vr === 0 ? blazeYellowMat : vr === 1 ? magmaOrangeMat : emberRedMat;
    const fireRibbon = new THREE.Mesh(
      new THREE.TorusGeometry(0.32 + vr * 0.04, 0.026, 8, 24),
      ringMat
    );
    fireRibbon.rotation.x = Math.PI / 3 + vr * 0.55;
    fireRibbon.rotation.y = vr * 0.8;
    magmaVortexGroup.add(fireRibbon);
  }

  // 6 Orbiting 3D Flame Tongues spiraling around the magma vortex
  for (let ft = 0; ft < 6; ft++) {
    const ftAngle = (ft / 6) * Math.PI * 2;
    const flameCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.28, 5),
      ft % 2 === 0 ? magmaOrangeMat : blazeYellowMat
    );
    flameCone.position.set(
      Math.cos(ftAngle) * 0.28,
      ((ft % 3) - 1) * 0.14,
      Math.sin(ftAngle) * 0.28
    );
    flameCone.rotation.z = -Math.cos(ftAngle) * 0.45;
    flameCone.rotation.x = Math.sin(ftAngle) * 0.45;
    magmaVortexGroup.add(flameCone);
  }

  root.add(magmaVortexGroup);
  root.userData.heartCrystal = magmaVortexGroup;

  // Twin Helical / Spiral Obsidian-Iron Ribbons with Glowing Orange Lava Cracks & Magma Stalactites
  [0, Math.PI].forEach((phaseOff) => {
    const helix = new HelixCurve(0.49, 0.44, 0.66, 1.54, 0.95, phaseOff);
    const ribbonGeo = new THREE.TubeGeometry(helix, 36, 0.05, 6, false);
    const ribbonMesh = new THREE.Mesh(ribbonGeo, charredIronMat);
    ribbonMesh.castShadow = true;
    root.add(ribbonMesh);

    // Incandescent orange magma fissure vein running along the spiral band
    const lavaVeinHelix = new HelixCurve(0.505, 0.455, 0.675, 1.555, 0.95, phaseOff);
    const lavaVeinGeo = new THREE.TubeGeometry(lavaVeinHelix, 28, 0.022, 5, false);
    const lavaVeinMesh = new THREE.Mesh(lavaVeinGeo, magmaOrangeMat);
    root.add(lavaVeinMesh);

    // Dripping molten magma spikes hanging along the underside of the spiral band
    for (let ic = 1; ic <= 5; ic++) {
      const t = ic / 6;
      const pt = helix.getPoint(t);
      const drip = new THREE.Mesh(
        new THREE.ConeGeometry(0.028, 0.13 + (ic % 2) * 0.05, 4),
        ic % 2 === 0 ? blazeYellowMat : magmaOrangeMat
      );
      drip.position.set(pt.x * 1.03, pt.y - 0.07, pt.z * 1.03);
      drip.rotation.x = Math.PI;
      root.add(drip);
    }
  });

  // ==========================================================================
  // 4. UPPER CRENELLATED OBSIDIAN CROWN & DUAL FIRE-BRAZIER CHIMNEYS WITH SMOKE
  // ==========================================================================
  const upperCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.44, 0.18, 8),
    darkBastionMat
  );
  upperCrown.position.y = 1.54;
  upperCrown.castShadow = true;
  root.add(upperCrown);

  // Glowing molten magma pool inside the upper crown bowl
  const upperLavaBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.41, 0.41, 0.04, 12),
    magmaOrangeMat
  );
  upperLavaBowl.position.y = 1.63;
  root.add(upperLavaBowl);

  // 8 Crenellated Obsidian Merlons + Jagged Black Obsidian Spikes around the crown rim
  for (let m = 0; m < 8; m++) {
    const mAngle = (m / 8) * Math.PI * 2;
    const merlon = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.16, 0.11),
      ashPilasterMat
    );
    merlon.position.set(Math.cos(mAngle) * 0.46, 1.64, Math.sin(mAngle) * 0.46);
    merlon.rotation.y = -mAngle;
    merlon.castShadow = true;
    root.add(merlon);

    // Jagged black obsidian spike between merlons
    const spikeA = mAngle + Math.PI / 8;
    const crownSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.3 + (m % 2) * 0.1, 5),
      m % 3 === 0 ? magmaOrangeMat : deepObsidianMat
    );
    crownSpike.position.set(Math.cos(spikeA) * 0.41, 1.7, Math.sin(spikeA) * 0.41);
    crownSpike.rotation.z = -Math.cos(spikeA) * 0.3;
    crownSpike.rotation.x = Math.sin(spikeA) * 0.3;
    root.add(crownSpike);
  }

  // Dual Flanking Cylindrical Volcanic Fire-Braziers / Chimneys (Left & Right)
  const smokePuffs: THREE.Mesh[] = [];
  const darkSmokeMat = new THREE.MeshBasicMaterial({
    color: 0x27272a,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const emberPuffMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });

  [-1, 1].forEach((side) => {
    const ventGroup = new THREE.Group();
    ventGroup.position.set(side * 0.62, 1.38, 0);

    // Horizontal dark-iron strut connecting to the tower shaft
    const armStrut = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.07, 0.08),
      charredIronMat
    );
    armStrut.position.set(-side * 0.12, 0.02, 0);
    ventGroup.add(armStrut);

    // Cylindrical obsidian brazier canister with glowing orange rune ring
    const canister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.105, 0.26, 10),
      darkBastionMat
    );
    canister.castShadow = true;
    ventGroup.add(canister);

    const runeBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.118, 0.118, 0.05, 10),
      magmaOrangeMat
    );
    ventGroup.add(runeBand);

    [-0.11, 0.11].forEach((ry) => {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.02, 6, 16),
        charredIronMat
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = ry;
      ventGroup.add(band);
    });

    // Glowing molten magma spike dripping under the brazier
    const bottomMagmaSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.22, 5),
      magmaOrangeMat
    );
    bottomMagmaSpike.rotation.x = Math.PI;
    bottomMagmaSpike.position.y = -0.22;
    ventGroup.add(bottomMagmaSpike);

    // Blazing fire flame tongue on top of the brazier
    const topFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.16, 6),
      blazeYellowMat
    );
    topFlame.position.y = 0.18;
    ventGroup.add(topFlame);

    // 3 Rising Volcanic Smoke & Ember Puffs per chimney
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.065 + p * 0.028, 8, 8),
        p === 0 ? emberPuffMat : darkSmokeMat
      );
      puff.position.set(side * p * 0.04, 0.26 + p * 0.13, 0);
      puff.userData.ventSide = side;
      puff.userData.puffIndex = p;
      smokePuffs.push(puff);
      ventGroup.add(puff);
    }

    root.add(ventGroup);
  });
  root.userData.steamPuffs = smokePuffs;

  // ==========================================================================
  // 5. TOP ROTATABLE "BLAZE CORE" GYROSCOPIC FLAME-PROJECTOR CANNON (TURRET)
  // ==========================================================================
  turret.position.y = 1.96;
  turret.userData.baseY = 1.96;

  // Heavy Outer Obsidian-Iron Gyroscope Wheel
  const outerWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.058, 10, 28),
    charredIronMat
  );
  outerWheel.castShadow = true;
  turret.add(outerWheel);

  // 8 Radial Armor Notches around the outer wheel
  for (let g = 0; g < 8; g++) {
    const gAngle = (g / 8) * Math.PI * 2;
    const cog = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.095, 0.115),
      deepObsidianMat
    );
    cog.position.set(Math.cos(gAngle) * 0.37, Math.sin(gAngle) * 0.37, 0);
    cog.rotation.z = gAngle;
    turret.add(cog);
  }

  // Jagged Black Obsidian Spikes jutting from the upper-left/rear of the wheel
  for (let cr = 0; cr < 3; cr++) {
    const crAngle = Math.PI * 0.62 + cr * 0.24;
    const wheelSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.3 - cr * 0.04, 5),
      deepObsidianMat
    );
    wheelSpike.position.set(
      Math.cos(crAngle) * 0.4,
      Math.sin(crAngle) * 0.4,
      -0.02
    );
    wheelSpike.rotation.z = crAngle - Math.PI / 2;
    turret.add(wheelSpike);
  }

  // Left & Right Gimbal Mount Hubs with Inset Glowing Magma-Orange Diamond Nodes
  [-1, 1].forEach((side) => {
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.125, 8),
      deepObsidianMat
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * 0.36, -0.02, 0);
    turret.add(hub);

    const diamondNode = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07, 0),
      blazeYellowMat
    );
    diamondNode.position.set(side * 0.42, -0.02, 0);
    turret.add(diamondNode);
  });

  // Concentric "Blaze Core" Bullseye Rings (Ember Red -> Magma Orange -> Solar Yellow Core)
  const outerBlazeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.03, 8, 24),
    emberRedMat
  );
  turret.add(outerBlazeRing);

  const midBlazeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.028, 8, 24),
    magmaOrangeMat
  );
  turret.add(midBlazeRing);

  const blazeCoreOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 16, 14),
    blazeYellowMat
  );
  turret.add(blazeCoreOrb);

  // 4 Diagonal Dark-Iron X-Brackets clamping the Blaze Core (matching the "Blaze Core" diagram!)
  for (let b = 0; b < 4; b++) {
    const bAngle = Math.PI / 4 + (b * Math.PI) / 2;
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.16, 0.09),
      deepObsidianMat
    );
    bracket.position.set(Math.cos(bAngle) * 0.24, Math.sin(bAngle) * 0.24, 0);
    bracket.rotation.z = bAngle - Math.PI / 2;
    turret.add(bracket);
  }

  // Forward Focusing Fire-Lens Assembly (+Z direction, projecting the flame stream)
  const forwardLensGroup = new THREE.Group();
  forwardLensGroup.position.set(0, 0, 0.28);

  [-1, 1].forEach((side) => {
    const lensStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.03, 0.3, 6),
      charredIronMat
    );
    lensStrut.rotation.x = Math.PI / 2;
    lensStrut.rotation.z = side * 0.25;
    lensStrut.position.set(side * 0.18, 0.04, -0.14);
    forwardLensGroup.add(lensStrut);
  });

  const frontFocusRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.032, 8, 20),
    charredIronMat
  );
  forwardLensGroup.add(frontFocusRing);

  const frontInnerLavaRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.022, 8, 18),
    magmaOrangeMat
  );
  forwardLensGroup.add(frontInnerLavaRing);

  // 6 Obsidian Claws framing the front fire lens
  for (let fp = 0; fp < 6; fp++) {
    const fpA = (fp / 6) * Math.PI * 2;
    const claw = new THREE.Mesh(
      new THREE.ConeGeometry(0.038, 0.13, 4),
      fp % 2 === 0 ? deepObsidianMat : magmaOrangeMat
    );
    claw.position.set(Math.cos(fpA) * 0.15, Math.sin(fpA) * 0.15, 0.03);
    claw.rotation.x = Math.PI / 2.3;
    claw.rotation.z = fpA;
    forwardLensGroup.add(claw);
  }

  // Internal & Protruding Focused Flame-Jet Cone (+Z)
  const internalFireStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.08, 0.48, 8),
    blazeYellowMat
  );
  internalFireStream.rotation.x = Math.PI / 2;
  internalFireStream.position.set(0, 0, 0.0);
  forwardLensGroup.add(internalFireStream);

  const flameJetTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.32, 7),
    magmaOrangeMat
  );
  flameJetTip.rotation.x = Math.PI / 2;
  flameJetTip.position.set(0, 0, 0.26);
  forwardLensGroup.add(flameJetTip);

  turret.add(forwardLensGroup);

  if (isSuper) {
    const solarHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.028, 8, 28),
      blazeYellowMat
    );
    solarHalo.rotation.x = Math.PI / 2;
    solarHalo.position.y = -0.18;
    turret.add(solarHalo);
  }
}


/**
 * Generates a glowing Void-Purple & Arcane-Gold runic circle texture for the Obelisco de Cuarzo (Runic Void-Spire Tower) base.
 */
let cachedVoidSpireRuneRingTex: THREE.CanvasTexture | null = null;
function createVoidSpireRuneRingTexture(): THREE.CanvasTexture {
  if (cachedVoidSpireRuneRingTex) return cachedVoidSpireRuneRingTex;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Outer stone groove shadow & dark void aura ring
  ctx.strokeStyle = 'rgba(15, 10, 28, 0.92)';
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.arc(cx, cy, 206, 0, Math.PI * 2);
  ctx.stroke();

  // Outer & inner glowing Void-Purple & Arcane-Gold containment rings
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 220, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 190, 0, Math.PI * 2);
  ctx.stroke();

  // 16 Angular Void-Spire Runes around the perimeter ring
  const numRunes = 16;
  for (let i = 0; i < numRunes; i++) {
    const angle = (i / numRunes) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * 205, cy + Math.sin(angle) * 205);
    ctx.rotate(angle + Math.PI / 2);

    const isGold = i % 3 === 0;
    ctx.strokeStyle = isGold ? '#fbbf24' : '#d8b4fe';
    ctx.shadowColor = isGold ? '#f59e0b' : '#9333ea';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    const glyphType = i % 4;
    if (glyphType === 0) {
      // Piercing void spear rune
      ctx.moveTo(0, -10);
      ctx.lineTo(-6, 4);
      ctx.lineTo(0, 10);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
    } else if (glyphType === 1) {
      // Runic hourglass sigil
      ctx.moveTo(-6, -9);
      ctx.lineTo(6, -9);
      ctx.lineTo(-6, 9);
      ctx.lineTo(6, 9);
      ctx.closePath();
    } else if (glyphType === 2) {
      // Forked void trident rune
      ctx.moveTo(0, 10);
      ctx.lineTo(0, -10);
      ctx.moveTo(-6, -3);
      ctx.lineTo(0, -10);
      ctx.lineTo(6, -3);
      ctx.moveTo(-5, 4);
      ctx.lineTo(5, 4);
    } else {
      // Arcane chevron & eye diamond
      ctx.moveTo(-7, 6);
      ctx.lineTo(0, -10);
      ctx.lineTo(7, 6);
      ctx.moveTo(-4, 2);
      ctx.lineTo(4, 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedVoidSpireRuneRingTex = tex;
  return tex;
}

/**
 * Generates a pixel-shader-grade swirling Violet-Indigo & White-Lavender Void Singularity texture for the Obelisco de Cuarzo central chamber.
 */
let cachedVoidSpireVortexTex: THREE.CanvasTexture | null = null;
function createVoidSpireVortexTexture(): THREE.CanvasTexture {
  if (cachedVoidSpireVortexTex) return cachedVoidSpireVortexTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const r = Math.hypot(dx, dy);
      const theta = Math.atan2(dy, dx);

      const n = fbm2(dx * 4.2 + 2.7, dy * 4.2 + 5.3, 4);
      const spiral = theta * 5.0 - Math.log(Math.max(0.035, r)) * 7.2 + n * 4.5;
      const filament = Math.pow(0.5 + 0.5 * Math.sin(spiral), 2.6);
      const subFilament = Math.pow(0.5 + 0.5 * Math.cos(spiral * 2.0 + n * 3.0), 3.4);

      const coreWhite = Math.exp(-r * r * 11.0);
      const falloff = Math.max(0, 1 - Math.pow(r, 1.3));
      const energy = Math.min(
        1,
        coreWhite * 1.2 + (filament * 0.75 + subFilament * 0.42 + n * 0.22) * falloff
      );

      const red = Math.min(255, Math.floor(24 + Math.pow(energy, 1.35) * 231));
      const green = Math.min(255, Math.floor(14 + Math.pow(energy, 1.85) * 225));
      const blue = Math.min(255, Math.floor(58 + Math.pow(energy, 0.85) * 197));

      const idx = (y * size + x) * 4;
      data[idx] = red;
      data[idx + 1] = green;
      data[idx + 2] = blue;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedVoidSpireVortexTex = tex;
  return tex;
}

/**
 * Builds the bespoke "Obelisco de Cuarzo" (Runic Void-Spire Tower) 3D model inspired by the
 * Runic Void-Spire Tower Concept Sheet:
 *  - Stepped Ancient-Stone & Dark-Obsidian foundation with corner stairs, engraved Void-Purple & Arcane-Gold
 *    rune circle, 3 perched dark-obsidian wyvern gargoyles, 2 front-step armored Gremlin guardians with glowing
 *    cyan eyes, and dark void-shadow wisps rising around the base
 *  - Fortified obsidian bastion with 6 vertical Void-Purple runic pilasters, Arcane-Gold chevron trim & 12 jagged obsidian spires
 *  - Open central chamber housing a Swirling Violet-White Void Singularity wrapped by twin ribbed Copper-Gold Tesla/Void conduits
 *  - Towering Sharp 4-Sided / Octagonal Dark Obsidian Obelisk Spire carved with glowing purple runes, golden gable trim,
 *    and inset circular void-crystal focusing lenses
 *  - Dual flanking copper-wound void coils topped with sweeping 7-spear Crystalline Void-Shard Fans
 *  - Rotatable "Void-Spire Core" Gyroscopic Focusing Lens Assembly that projects piercing crystalline void-shard volleys
 */
function buildQuartzVoidSpireModel(
  root: THREE.Group,
  turret: THREE.Group,
  isSuper: boolean
): void {
  // --- PALETTE FROM CONCEPT SHEET: Dark Obsidian, Obsidian Stone, Ancient Stone, Void Purple, Arcane Gold, Void-Ash Gray ---
  const darkObsidianMat = new THREE.MeshStandardMaterial({
    color: 0x171524,
    roughness: 0.42,
    metalness: 0.65,
  });
  const obsidianStoneMat = new THREE.MeshStandardMaterial({
    color: 0x262338,
    roughness: 0.68,
    metalness: 0.35,
  });
  const ancientStoneMat = new THREE.MeshStandardMaterial({
    color: 0x464259,
    roughness: 0.78,
    metalness: 0.22,
  });
  const voidAshGrayMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.72,
    metalness: 0.28,
  });
  const arcaneCopperGoldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97706,
    emissive: 0x78350f,
    emissiveIntensity: 0.28,
    roughness: 0.24,
    metalness: 0.9,
    clearcoat: 0.65,
  });
  const brightGoldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.88,
  });
  const voidPurpleMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0x9333ea,
    emissiveIntensity: isSuper ? 1.7 : 1.4,
    roughness: 0.14,
  });
  const crystalShardLavenderMat = new THREE.MeshStandardMaterial({
    color: 0xf3e8ff,
    emissive: 0xa855f7,
    emissiveIntensity: isSuper ? 1.85 : 1.55,
    roughness: 0.1,
    metalness: 0.2,
  });
  const voidCyanCoreMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
    roughness: 0.12,
  });
  const shadowSmokeMat = new THREE.MeshBasicMaterial({
    color: 0x1e1b2e,
    transparent: true,
    opacity: 0.62,
  });

  // ==========================================================================
  // 1. STEPPED ANCIENT-STONE BASE, VOID RUNE CIRCLE, GARGOYLES & GREMLINS
  // ==========================================================================
  const lowerRockPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.96, 0.18, 10),
    darkObsidianMat
  );
  lowerRockPlinth.position.y = 0.09;
  lowerRockPlinth.castShadow = true;
  lowerRockPlinth.receiveShadow = true;
  root.add(lowerRockPlinth);

  const midTerracePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.84, 0.16, 10),
    ancientStoneMat
  );
  midTerracePlinth.position.y = 0.24;
  midTerracePlinth.castShadow = true;
  midTerracePlinth.receiveShadow = true;
  root.add(midTerracePlinth);

  // Carved ancient-stone corner stairs
  for (let s = 0; s < 4; s++) {
    const stepAngle = (s * Math.PI) / 2 + Math.PI / 4;
    const stairGroup = new THREE.Group();
    stairGroup.rotation.y = stepAngle;
    for (let st = 0; st < 3; st++) {
      const stepBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.32 - st * 0.03, 0.06, 0.12),
        ancientStoneMat
      );
      stepBlock.position.set(0, 0.05 + st * 0.065, 0.88 - st * 0.08);
      stepBlock.castShadow = true;
      stepBlock.receiveShadow = true;
      stairGroup.add(stepBlock);
    }
    root.add(stairGroup);
  }

  // Engraved Glowing Void-Purple & Arcane-Gold Rune Disc on the terrace floor
  const runeRingGeo = new THREE.PlaneGeometry(1.52, 1.52);
  runeRingGeo.rotateX(-Math.PI / 2);
  const runeRingMat = new THREE.MeshBasicMaterial({
    map: createVoidSpireRuneRingTexture(),
    transparent: true,
    depthWrite: false,
  });
  const runeRingMesh = new THREE.Mesh(runeRingGeo, runeRingMat);
  runeRingMesh.position.y = 0.326;
  root.add(runeRingMesh);

  // Glowing Void-Purple & Gold Induction Ring at the base of the bastion wall
  const voidMoat = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.036, 8, 24),
    voidPurpleMat
  );
  voidMoat.rotation.x = Math.PI / 2;
  voidMoat.position.y = 0.33;
  root.add(voidMoat);

  // 3 Perched Dark Obsidian Wyvern/Gargoyle Statues on the upper corners
  const gargoyleAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  gargoyleAngles.forEach((gAngle) => {
    const gargoyle = createStoneGargoyleStatue(
      obsidianStoneMat,
      darkObsidianMat,
      arcaneCopperGoldMat,
      voidPurpleMat
    );
    const r = 0.74;
    gargoyle.position.set(Math.cos(gAngle) * r, 0.31, Math.sin(gAngle) * r);
    gargoyle.rotation.y = -gAngle + Math.PI / 2;
    root.add(gargoyle);
  });

  // 2 Front-Step Armored Void Gremlin Guardians with glowing cyan eyes & brass-gold armor
  [-0.78, 0.78].forEach((sideAngle) => {
    const gremlin = createStoneGargoyleStatue(
      voidAshGrayMat,
      ancientStoneMat,
      arcaneCopperGoldMat,
      voidCyanCoreMat
    );
    gremlin.scale.setScalar(0.92);
    const r = 0.84;
    gremlin.position.set(Math.sin(sideAngle) * r, 0.16, Math.cos(sideAngle) * r);
    gremlin.rotation.y = sideAngle;
    root.add(gremlin);
  });

  // ==========================================================================
  // 2. FORTIFIED OBSIDIAN BASTION WALL, PURPLE RUNES & JAGGED OBSIDIAN SPIRES
  // ==========================================================================
  const bastionWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.56, 0.42, 8),
    obsidianStoneMat
  );
  bastionWall.position.y = 0.52;
  bastionWall.castShadow = true;
  bastionWall.receiveShadow = true;
  root.add(bastionWall);

  // 6 Vertical Runic Obsidian Pilasters with glowing Void-Purple runes & Arcane-Gold diamond slits
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const pilasterGroup = new THREE.Group();
    pilasterGroup.rotation.y = -a;

    const pilaster = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.5, 0.16),
      darkObsidianMat
    );
    pilaster.position.set(0.51, 0.55, 0);
    pilaster.castShadow = true;
    pilasterGroup.add(pilaster);

    const goldCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.04, 0.17),
      brightGoldTrimMat
    );
    goldCap.position.set(0.51, 0.81, 0);
    pilasterGroup.add(goldCap);

    // 3 Glowing Void-Purple Runes carved vertically into each pilaster
    for (let r = 0; r < 3; r++) {
      const runeGlyph = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.068, 0.055),
        voidPurpleMat
      );
      runeGlyph.position.set(0.572, 0.42 + r * 0.115, (r - 1) * 0.015);
      runeGlyph.rotation.x = (r - 1) * 0.35;
      pilasterGroup.add(runeGlyph);
    }

    // Glowing Void-Purple & Gold diamond sigil between pilasters
    const midAngle = a + Math.PI / 6;
    const archDiamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.06, 0),
      i % 2 === 0 ? voidPurpleMat : brightGoldTrimMat
    );
    archDiamond.scale.set(0.65, 1.45, 0.65);
    archDiamond.position.set(Math.cos(midAngle) * 0.52, 0.5, Math.sin(midAngle) * 0.52);
    root.add(archDiamond);

    root.add(pilasterGroup);
  }

  // Ring of 12 Jagged Dark Obsidian & Void-Crystal Spires erupting around the bastion collar
  for (let c = 0; c < 12; c++) {
    const cAngle = (c / 12) * Math.PI * 2;
    const isLarge = c % 2 === 0;
    const shardH = isLarge ? 0.48 : 0.34;
    const shardR = isLarge ? 0.11 : 0.075;
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(shardR, shardH, 5),
      isLarge ? darkObsidianMat : c % 4 === 1 ? voidPurpleMat : obsidianStoneMat
    );
    const radialDist = isLarge ? 0.48 : 0.42;
    shard.position.set(
      Math.cos(cAngle) * radialDist,
      0.74 + shardH * 0.32,
      Math.sin(cAngle) * radialDist
    );
    const tilt = isLarge ? 0.42 : 0.24;
    shard.rotation.z = -Math.cos(cAngle) * tilt;
    shard.rotation.x = Math.sin(cAngle) * tilt;
    shard.castShadow = true;
    root.add(shard);
  }

  // ==========================================================================
  // 3. CENTRAL SWIRLING VOID SINGULARITY & TWIN RIBBED COPPER-GOLD CONDUITS
  // ==========================================================================
  for (let p = 0; p < 4; p++) {
    const pAngle = (p * Math.PI) / 2 + Math.PI / 4;
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.84, 6),
      darkObsidianMat
    );
    strut.position.set(Math.cos(pAngle) * 0.34, 1.1, Math.sin(pAngle) * 0.34);
    strut.castShadow = true;
    root.add(strut);
  }

  // Swirling Violet-Indigo & White-Lavender Void Singularity Core
  const voidVortexGroup = new THREE.Group();
  voidVortexGroup.position.set(0, 1.1, 0);

  const vortexCoreMat = new THREE.MeshBasicMaterial({
    map: createVoidSpireVortexTexture(),
  });
  const vortexSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 20, 16),
    vortexCoreMat
  );
  vortexSphere.scale.set(0.96, 1.28, 0.96);
  voidVortexGroup.add(vortexSphere);

  // 3 Tilted Concentric Void-Crystal Energy Rings wrapping the singularity
  for (let vr = 0; vr < 3; vr++) {
    const ringMat =
      vr === 0 ? crystalShardLavenderMat : vr === 1 ? voidPurpleMat : brightGoldTrimMat;
    const voidRibbon = new THREE.Mesh(
      new THREE.TorusGeometry(0.33 + vr * 0.04, 0.022, 8, 24),
      ringMat
    );
    voidRibbon.rotation.x = Math.PI / 3 + vr * 0.6;
    voidRibbon.rotation.y = vr * 0.9;
    voidVortexGroup.add(voidRibbon);
  }

  // 6 Orbiting Crystalline Void-Quartz Shards around the singularity core
  for (let vs = 0; vs < 6; vs++) {
    const vsAngle = (vs / 6) * Math.PI * 2;
    const voidShard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055, 0),
      vs % 2 === 0 ? crystalShardLavenderMat : voidPurpleMat
    );
    voidShard.scale.set(0.65, 1.85, 0.65);
    voidShard.position.set(
      Math.cos(vsAngle) * 0.32,
      ((vs % 3) - 1) * 0.14,
      Math.sin(vsAngle) * 0.32
    );
    voidShard.rotation.z = -Math.cos(vsAngle) * 0.65;
    voidVortexGroup.add(voidShard);
  }

  root.add(voidVortexGroup);
  root.userData.heartCrystal = voidVortexGroup;

  // Twin Helical Ribbed Copper-Gold Solenoid Conduits wrapping the void singularity chamber
  [0, Math.PI].forEach((phaseOff) => {
    const helix = new HelixCurve(0.49, 0.42, 0.66, 1.54, 0.95, phaseOff);
    const tubeGeo = new THREE.TubeGeometry(helix, 36, 0.046, 8, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, darkObsidianMat);
    tubeMesh.castShadow = true;
    root.add(tubeMesh);

    const numRibs = 18;
    for (let r = 1; r < numRibs; r++) {
      const t = r / numRibs;
      const pt = helix.getPoint(t);
      const tangent = helix.getTangent(t);
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.056, 0.015, 6, 12),
        r % 5 === 0 ? voidPurpleMat : arcaneCopperGoldMat
      );
      rib.position.copy(pt);
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      root.add(rib);
    }
  });

  // ==========================================================================
  // 4. TOWERING SHARP RUNIC OBSIDIAN OBELISK SPIRE & LATERAL 7-SPEAR VOID FANS
  // ==========================================================================
  // Obelisk Pedestal Collar with Arcane-Gold Chevron Trim
  const obeliskCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.48, 0.16, 4),
    obsidianStoneMat
  );
  obeliskCollar.position.y = 1.5;
  obeliskCollar.rotation.y = Math.PI / 4;
  obeliskCollar.castShadow = true;
  root.add(obeliskCollar);

  // Towering Steeply-Tapered 4-Sided Dark Obsidian Obelisk Pyramid Peak (Defining silhouette of the Runic Void-Spire!)
  const obeliskSpire = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.24, 4),
    darkObsidianMat
  );
  obeliskSpire.position.y = 2.12;
  obeliskSpire.rotation.y = Math.PI / 4;
  obeliskSpire.castShadow = true;
  root.add(obeliskSpire);

  // 4 Arcane-Gold Gable Chevrons + Glowing Void-Purple Runes & Inset Circular Void Lenses on the 4 Obelisk Faces
  for (let face = 0; face < 4; face++) {
    const fAngle = (face * Math.PI) / 2;
    const faceGroup = new THREE.Group();
    faceGroup.rotation.y = fAngle;

    // Golden chevron gable trim at the base of each obelisk face
    [-1, 1].forEach((side) => {
      const chevronBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.032, 0.035),
        brightGoldTrimMat
      );
      chevronBar.position.set(side * 0.07, 1.58, 0.31);
      chevronBar.rotation.z = -side * 0.52;
      faceGroup.add(chevronBar);
    });

    // Glowing Void-Purple Runes carved vertically up the obelisk face
    for (let r = 0; r < 3; r++) {
      const zOffset = 0.28 - r * 0.065;
      const yOffset = 1.66 + r * 0.18;
      const obeliskRune = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.075, 0.02),
        voidPurpleMat
      );
      obeliskRune.position.set((r % 2 === 0 ? 1 : -1) * 0.03, yOffset, zOffset);
      obeliskRune.rotation.x = -0.32;
      obeliskRune.rotation.z = (r - 1) * 0.25;
      faceGroup.add(obeliskRune);
    }

    // Inset Glowing Circular Void-Crystal Lens near the upper obelisk face (matching the concept sheet!)
    const upperBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.016, 8, 16),
      arcaneCopperGoldMat
    );
    upperBezel.position.set(0, 1.96, 0.19);
    upperBezel.rotation.x = -0.32;
    faceGroup.add(upperBezel);

    const upperVoidEye = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 12, 10),
      crystalShardLavenderMat
    );
    upperVoidEye.position.set(0, 1.96, 0.185);
    faceGroup.add(upperVoidEye);

    root.add(faceGroup);
  }

  // Dual Flanking Copper-Wound Void Coils & Sweeping 7-Spear Crystal Shard Fans (Left & Right)
  const voidSmokePuffs: THREE.Mesh[] = [];
  [-1, 1].forEach((side) => {
    const coilGroup = new THREE.Group();
    coilGroup.position.set(side * 0.62, 1.38, 0);

    // Horizontal dark-obsidian & gold strut connecting to the obelisk shaft
    const armStrut = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.07, 0.08),
      darkObsidianMat
    );
    armStrut.position.set(-side * 0.13, 0.02, 0);
    coilGroup.add(armStrut);

    // Cylindrical solenoid core
    const solenoidCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.28, 12),
      darkObsidianMat
    );
    solenoidCore.castShadow = true;
    coilGroup.add(solenoidCore);

    // 5 Stacked Copper-Gold Wire Windings
    for (let w = -2; w <= 2; w++) {
      const winding = new THREE.Mesh(
        new THREE.TorusGeometry(0.112, 0.018, 6, 16),
        arcaneCopperGoldMat
      );
      winding.rotation.x = Math.PI / 2;
      winding.position.y = w * 0.048;
      coilGroup.add(winding);
    }

    // Bottom pointed copper-gold electrode tip
    const bottomElectrode = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.22, 6),
      arcaneCopperGoldMat
    );
    bottomElectrode.rotation.x = Math.PI;
    bottomElectrode.position.y = -0.22;
    coilGroup.add(bottomElectrode);

    // Upper Glowing Void-Crystal Orb Socket (matching the side lens orbs on the concept art)
    const sideOrbBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.018, 8, 16),
      arcaneCopperGoldMat
    );
    sideOrbBezel.position.set(-side * 0.08, 0.22, 0.03);
    coilGroup.add(sideOrbBezel);

    const sideCrystalOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.078, 12, 10),
      crystalShardLavenderMat
    );
    sideCrystalOrb.position.set(-side * 0.08, 0.22, 0.03);
    coilGroup.add(sideCrystalOrb);

    // Sweeping Fan of 7 Crystalline Void-Shard Spear Needles (matching the diamond-tipped spears in the concept sheet!)
    const fanGroup = new THREE.Group();
    fanGroup.position.set(0, 0.18, 0);
    const numSpears = 7;
    for (let n = 0; n < numSpears; n++) {
      const t = n / (numSpears - 1);
      const fanAngle = side * (0.14 + t * 1.05);
      const spearLen = 0.34 + Math.sin(t * Math.PI) * 0.12;

      const spearHolder = new THREE.Group();
      spearHolder.rotation.z = -fanAngle;

      // Copper-gold rod shaft
      const rodShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.018, spearLen * 0.72, 5),
        arcaneCopperGoldMat
      );
      rodShaft.position.y = spearLen * 0.36;
      spearHolder.add(rodShaft);

      // Crystalline Lavender-White Diamond Spearhead Tip
      const diamondSpearTip = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.042, 0),
        n % 2 === 0 ? crystalShardLavenderMat : voidPurpleMat
      );
      diamondSpearTip.scale.set(0.65, 1.95, 0.65);
      diamondSpearTip.position.y = spearLen * 0.85;
      spearHolder.add(diamondSpearTip);

      fanGroup.add(spearHolder);
    }
    coilGroup.add(fanGroup);

    // Rising Dark Void-Shadow & Violet Spark Puffs
    for (let p = 0; p < 3; p++) {
      const smokeOrb = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.055 + p * 0.015, 0),
        p === 0 ? voidPurpleMat : shadowSmokeMat
      );
      smokeOrb.position.set(side * (0.06 + p * 0.05), 0.26 + p * 0.14, 0);
      smokeOrb.userData.ventSide = side;
      smokeOrb.userData.puffIndex = p;
      voidSmokePuffs.push(smokeOrb);
      coilGroup.add(smokeOrb);
    }

    root.add(coilGroup);
  });
  root.userData.steamPuffs = voidSmokePuffs;

  // ==========================================================================
  // 5. ROTATABLE "VOID-SPIRE CORE" FOCUSING LENS & PIERCING SHARD PROJECTOR
  // ==========================================================================
  turret.position.y = 1.96;
  turret.userData.baseY = 1.96;

  // Rotating Dark-Obsidian & Arcane-Gold Void-Spire Core Collar around the upper obelisk
  const coreRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.042, 8, 24),
    darkObsidianMat
  );
  coreRing.rotation.x = Math.PI / 2;
  turret.add(coreRing);

  // Forward Focusing Void-Spire Lens Assembly (+Z direction, projecting piercing crystal shard barrages)
  const forwardLensGroup = new THREE.Group();
  forwardLensGroup.position.set(0, 0, 0.28);

  // Twin Copper-Gold Struts connecting the obelisk eye to the forward focusing ring
  [-1, 1].forEach((side) => {
    const lensStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 0.28, 6),
      arcaneCopperGoldMat
    );
    lensStrut.rotation.x = Math.PI / 2;
    lensStrut.rotation.z = side * 0.22;
    lensStrut.position.set(side * 0.14, 0.02, -0.1);
    forwardLensGroup.add(lensStrut);
  });

  // Outer Dark-Obsidian & X-Clamped "Void-Spire Core" Focusing Ring
  const frontFocusRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.165, 0.032, 8, 20),
    darkObsidianMat
  );
  forwardLensGroup.add(frontFocusRing);

  const frontGoldRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.02, 8, 18),
    brightGoldTrimMat
  );
  forwardLensGroup.add(frontGoldRing);

  // 4 Diagonal X-Brackets clamping the Void-Spire Core (matching the "Void-Spire Core" diagram!)
  for (let b = 0; b < 4; b++) {
    const bAngle = Math.PI / 4 + (b * Math.PI) / 2;
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.11, 0.065),
      darkObsidianMat
    );
    bracket.position.set(Math.cos(bAngle) * 0.145, Math.sin(bAngle) * 0.145, 0);
    bracket.rotation.z = bAngle - Math.PI / 2;
    forwardLensGroup.add(bracket);
  }

  // Luminous Pale-Cyan & Lavender Void-Spire Core Orb inside the lens
  const frontLensOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.088, 12, 10),
    voidCyanCoreMat
  );
  forwardLensGroup.add(frontLensOrb);

  // Cluster of 5 Crystalline Void-Quartz Piercing Shards emerging in a cone from the forward lens (+Z)
  for (let sh = 0; sh < 5; sh++) {
    const shAngle = (sh / 5) * Math.PI * 2;
    const radial = sh === 0 ? 0 : 0.065;
    const shardSpear = new THREE.Mesh(
      new THREE.OctahedronGeometry(sh === 0 ? 0.052 : 0.038, 0),
      sh % 2 === 0 ? crystalShardLavenderMat : voidPurpleMat
    );
    shardSpear.scale.set(0.58, 0.58, 2.35);
    shardSpear.position.set(
      Math.cos(shAngle) * radial,
      Math.sin(shAngle) * radial,
      0.16 + (sh === 0 ? 0.07 : 0)
    );
    forwardLensGroup.add(shardSpear);
  }

  turret.add(forwardLensGroup);

  if (isSuper) {
    const voidHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.54, 0.026, 8, 28),
      voidPurpleMat
    );
    voidHalo.rotation.x = Math.PI / 2;
    voidHalo.position.y = -0.18;
    turret.add(voidHalo);
  }
}

/**
 * Generates a high-contrast procedural armor & rune-vein texture specific to each Mastery Skin
 * so the entire stonework and body of the tower visibly transforms when a skin is equipped.
 */
function createTowerSkinPatternTexture(skinSpec: TowerCosmeticSkinSpec): THREE.CanvasTexture {
  const cacheKey = `tower_skin_tex_v2_${skinSpec.id}`;
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const stoneRgb = hexToRgb(skinSpec.stoneTint);
  const metalRgb = hexToRgb(skinSpec.metalTint);
  const glow1Rgb = hexToRgb(skinSpec.primaryGlow);
  const glow2Rgb = hexToRgb(skinSpec.secondaryGlow);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const [d1, d2, cellId] = voronoi2(u * 6.5, v * 6.5);
      const edgeGap = d2 - d1;
      const noise = fbm2(u * 12 + 3.1, v * 12 + 7.4, 3);

      // Glowing energy veins along Voronoi armor seams & vertical fluted channels
      const seamGlow = Math.max(0, 1 - edgeGap * 9.5);
      const fluteWave = Math.pow(Math.max(0, Math.sin(u * Math.PI * 8)), 6.0) * 0.45;
      const tierBand = Math.exp(-Math.pow(((v * 3) % 1 - 0.5) / 0.08, 2)) * 0.55;

      const plateShade = 0.72 + cellId * 0.35 + (noise - 0.5) * 0.22;
      let r = stoneRgb[0] * plateShade;
      let g = stoneRgb[1] * plateShade;
      let b = stoneRgb[2] * plateShade;

      // Blend metallic trim on horizontal bands
      r = r * (1 - tierBand) + metalRgb[0] * 1.15 * tierBand;
      g = g * (1 - tierBand) + metalRgb[1] * 1.15 * tierBand;
      b = b * (1 - tierBand) + metalRgb[2] * 1.15 * tierBand;

      // Inject vivid primary/secondary skin glow into the carved stone seams
      const veinStrength = Math.min(1, seamGlow * (0.75 + skinSpec.tier * 0.18) + fluteWave * 0.6);
      const veinColor = cellId > 0.5 ? glow2Rgb : glow1Rgb;
      r = r * (1 - veinStrength * 0.55) + veinColor[0] * veinStrength * 1.15;
      g = g * (1 - veinStrength * 0.55) + veinColor[1] * veinStrength * 1.15;
      b = b * (1 - veinStrength * 0.55) + veinColor[2] * veinStrength * 1.15;

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.floor(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  textureCache.set(cacheKey, tex);
  return tex;
}

/**
 * Applies a special unlocked Mastery Cosmetic Skin to any 3D tower model:
 *  - Transforms ALL materials (both MeshStandardMaterial AND MeshBasicMaterial vortexes/runes/domes)
 *  - Applies a high-contrast procedural Skin Armor Texture with glowing Voronoi seams to the tower's stonework
 *  - Attaches unmistakable Tier 1, Tier 2, and Tier 3 3D Architectural Regalia (Corner Obelisk Pylons,
 *    Sweeping Turret Wing-Blades, Counter-Rotating Astrolabe Rings, and Floating Sovereign Astral Crown)
 */
function applyCosmeticMasterySkinToTowerModel(
  root: THREE.Group,
  turret: THREE.Group,
  skinSpec: TowerCosmeticSkinSpec
): void {
  if (skinSpec.isDefault) return;

  const stoneColor = new THREE.Color(skinSpec.stoneTint);
  const metalColor = new THREE.Color(skinSpec.metalTint);
  const primaryGlow = new THREE.Color(skinSpec.primaryGlow);
  const secondaryGlow = new THREE.Color(skinSpec.secondaryGlow);
  const skinArmorTex = createTowerSkinPatternTexture(skinSpec);
  const bumpTex = getMonsterMicroBumpTexture();

  // Brighten stone color slightly so dark tints don't look indistinguishable from default obsidian
  const vibrantStoneColor = stoneColor.clone().lerp(primaryGlow, 0.22).lerp(new THREE.Color(0xffffff), 0.14);

  const clonedMats = new Map<THREE.Material, THREE.Material>();

  const transformMat = (mat: THREE.Material): THREE.Material => {
    if (clonedMats.has(mat)) return clonedMats.get(mat)!;
    const m = mat.clone();

    if (m instanceof THREE.MeshStandardMaterial) {
      if (m.emissiveIntensity >= 0.45) {
        const isBrightCore = m.color.r > 0.82 && m.color.g > 0.82 && m.color.b > 0.82;
        m.color.copy(isBrightCore ? secondaryGlow : primaryGlow);
        m.emissive.copy(isBrightCore ? secondaryGlow : primaryGlow);
        m.emissiveIntensity = Math.min(1.25, Math.max(m.emissiveIntensity, 1.1 + skinSpec.tier * 0.08));
      } else if (m.metalness >= 0.58) {
        m.color.copy(metalColor);
        m.emissive.copy(primaryGlow);
        m.emissiveIntensity = 0.25 + skinSpec.tier * 0.08;
        m.roughness = Math.min(m.roughness, 0.18);
        m.metalness = 0.92;
      } else {
        m.color.copy(stoneColor);
        m.map = skinArmorTex;
        m.bumpMap = bumpTex;
        m.bumpScale = 0.08;
        m.emissive.copy(primaryGlow);
        m.emissiveIntensity = 0.04;
        m.roughness = 0.65;
        m.metalness = 0.25;
        m.needsUpdate = true;
      }
    } else if (m instanceof THREE.MeshBasicMaterial) {
      // Transform glowing vortex discs, rune decals, and translucent shield domes!
      const lum = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11;
      if (lum > 0.15) {
        m.color.copy(lum > 0.72 ? secondaryGlow : primaryGlow);
      }
    }

    clonedMats.set(mat, m);
    return m;
  };

  const xpBarGroup = root.userData.xpBarGroup as THREE.Group | undefined;

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material) {
      // Skip overhead XP bar meshes
      if (xpBarGroup && obj.parent === xpBarGroup) return;
      // Skip ground contact shadow mesh
      if (obj.position.y < 0.025 && obj.geometry instanceof THREE.PlaneGeometry) return;

      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(transformMat);
      } else {
        obj.material = transformMat(obj.material);
      }
    }
  });

  // ============================================================================
  // BESPOKE 3D MASTERY REGALIA BY TIER (Unmistakable Silhouette Changes!)
  // ============================================================================
  const regaliaGlowMat = new THREE.MeshStandardMaterial({
    color: secondaryGlow,
    emissive: primaryGlow,
    emissiveIntensity: 1.95,
    roughness: 0.1,
    metalness: 0.25,
  });

  const regaliaSecondaryGlowMat = new THREE.MeshStandardMaterial({
    color: primaryGlow,
    emissive: secondaryGlow,
    emissiveIntensity: 1.75,
    roughness: 0.12,
    metalness: 0.3,
  });

  const regaliaMetalMat = new THREE.MeshPhysicalMaterial({
    color: metalColor,
    emissive: primaryGlow,
    emissiveIntensity: 0.42,
    roughness: 0.15,
    metalness: 0.94,
    clearcoat: 0.9,
  });

  const regaliaArmorMat = new THREE.MeshStandardMaterial({
    color: vibrantStoneColor,
    map: skinArmorTex,
    emissive: primaryGlow,
    emissiveIntensity: 0.32,
    roughness: 0.38,
    metalness: 0.48,
  });

  // 1. TIER 1+ BASE ARCHITECTURAL PYLONS: 4 Corner Runic Sentinel Obelisks around the base
  const numPylons = skinSpec.tier === 3 ? 6 : 4;
  const pylonRadius = 0.88;
  for (let p = 0; p < numPylons; p++) {
    const pAngle = (p / numPylons) * Math.PI * 2 + Math.PI / 4;
    const px = Math.cos(pAngle) * pylonRadius;
    const pz = Math.sin(pAngle) * pylonRadius;

    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(px, 0, pz);
    pylonGroup.rotation.y = -pAngle;

    const pylonHeight = 0.55 + skinSpec.tier * 0.16;
    const pylonShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.11, pylonHeight, 6),
      regaliaArmorMat
    );
    pylonShaft.position.y = pylonHeight * 0.5;
    pylonShaft.castShadow = true;
    pylonGroup.add(pylonShaft);

    const pylonCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.08, 6),
      regaliaMetalMat
    );
    pylonCollar.position.y = pylonHeight * 0.82;
    pylonGroup.add(pylonCollar);

    const pylonCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09 + skinSpec.tier * 0.015, 0),
      p % 2 === 0 ? regaliaGlowMat : regaliaSecondaryGlowMat
    );
    pylonCrystal.scale.set(0.72, 1.75, 0.72);
    pylonCrystal.position.y = pylonHeight + 0.14;
    pylonGroup.add(pylonCrystal);

    root.add(pylonGroup);
  }

  // 2. ORBITING MASTERY REGALIA RING & LANCES
  const masteryRegalia = new THREE.Group();
  masteryRegalia.position.y = 0.52;

  const baseHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.88, 0.036 + skinSpec.tier * 0.008, 10, 36),
    regaliaGlowMat
  );
  baseHalo.rotation.x = Math.PI / 2;
  masteryRegalia.add(baseHalo);

  const innerMetalHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.024, 8, 32),
    regaliaMetalMat
  );
  innerMetalHalo.rotation.x = Math.PI / 2;
  masteryRegalia.add(innerMetalHalo);

  const numOrbiters = 4 + skinSpec.tier * 2;
  for (let i = 0; i < numOrbiters; i++) {
    const angle = (i / numOrbiters) * Math.PI * 2;
    const lanceGroup = new THREE.Group();
    lanceGroup.position.set(Math.cos(angle) * 0.88, 0.08, Math.sin(angle) * 0.88);
    lanceGroup.rotation.y = -angle;

    const orbiterBlade = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.085 + skinSpec.tier * 0.014, 0),
      i % 2 === 0 ? regaliaGlowMat : regaliaSecondaryGlowMat
    );
    orbiterBlade.scale.set(0.65, 2.1, 0.65);
    lanceGroup.add(orbiterBlade);

    const orbiterRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.018, 6, 12),
      regaliaMetalMat
    );
    lanceGroup.add(orbiterRing);

    masteryRegalia.add(lanceGroup);
  }

  root.add(masteryRegalia);
  root.userData.masteryRegalia = masteryRegalia;

  // 3. TIER 2 & TIER 3: SWEEPING ARCANE WING-BLADES ON TURRET + DIADEM CROWN
  if (skinSpec.tier >= 2) {
    [-1, 1].forEach((side) => {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(side * 0.44, 0.12, -0.06);
      wingGroup.rotation.z = -side * 0.32;
      wingGroup.rotation.y = -side * 0.22;

      // Armored wing mount strut
      const wingStrut = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.48, 0.14),
        regaliaMetalMat
      );
      wingGroup.add(wingStrut);

      // 3 Layered Energy Pinion Feathers fanning outward
      for (let f = 0; f < 3; f++) {
        const feather = new THREE.Mesh(
          new THREE.ConeGeometry(0.065, 0.52 + f * 0.12, 4),
          f === 1 ? regaliaSecondaryGlowMat : regaliaGlowMat
        );
        feather.position.set(side * (0.14 + f * 0.08), 0.12 + f * 0.14, -f * 0.04);
        feather.rotation.z = -side * (0.48 + f * 0.22);
        wingGroup.add(feather);
      }

      turret.add(wingGroup);
    });

    const crownRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.034, 8, 28),
      regaliaMetalMat
    );
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.y = 0.32;
    turret.add(crownRing);

    const numSpikes = skinSpec.tier === 3 ? 8 : 6;
    for (let s = 0; s < numSpikes; s++) {
      const sAngle = (s / numSpikes) * Math.PI * 2;
      const finial = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.28 + (s % 2) * 0.1, 4),
        s % 2 === 0 ? regaliaGlowMat : regaliaSecondaryGlowMat
      );
      finial.position.set(Math.cos(sAngle) * 0.52, 0.44, Math.sin(sAngle) * 0.52);
      finial.rotation.z = -Math.cos(sAngle) * 0.22;
      finial.rotation.x = Math.sin(sAngle) * 0.22;
      turret.add(finial);
    }
  }

  // 4. TIER 3 MYTHIC SOVEREIGN EXCLUSIVE: DUAL COUNTER-ROTATING ASTROLABE RINGS + FLOATING ASTRAL CROWN + AURA PILLAR
  if (skinSpec.tier >= 3) {
    const astrolabeGroup = new THREE.Group();
    astrolabeGroup.position.y = 1.25;

    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.026, 8, 36),
      regaliaGlowMat
    );
    ringA.rotation.x = Math.PI / 3;
    ringA.rotation.y = Math.PI / 6;
    astrolabeGroup.add(ringA);

    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(0.86, 0.024, 8, 36),
      regaliaSecondaryGlowMat
    );
    ringB.rotation.x = -Math.PI / 3;
    ringB.rotation.y = -Math.PI / 6;
    astrolabeGroup.add(ringB);

    root.add(astrolabeGroup);
    root.userData.astrolabeGroup = astrolabeGroup;

    // Translucent Mythic Energy Aura Column enveloping the tower
    const auraMat = new THREE.MeshBasicMaterial({
      color: primaryGlow,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const auraPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.85, 1.85, 16, 1, true),
      auraMat
    );
    auraPillar.position.y = 0.95;
    root.add(auraPillar);
  }
}

/**
 * Animates the Frost Pillar, Magma Volcanic Tower & Quartz Void-Spire Tower's
 * central core, rising vent steam/smoke/spark puffs, gyroscopic focusing lens, and Mastery Regalia each frame.
 */
export function animateTowerSpecialParts(
  root: THREE.Group,
  elapsed: number,
  seedOffset: number
): void {
  const heartCrystal = root.userData.heartCrystal as THREE.Group | undefined;
  if (heartCrystal) {
    const isMagma = Boolean(root.userData.isMagmaDesign);
    const isQuartz = Boolean(root.userData.isQuartzDesign);
    const spinSpeed = isQuartz ? 2.9 : isMagma ? 2.4 : 0.95;
    heartCrystal.rotation.y = elapsed * spinSpeed + seedOffset;
    if (isMagma || isQuartz) {
      heartCrystal.rotation.z =
        Math.sin(elapsed * (isQuartz ? 4.2 : 3.2) + seedOffset) * 0.2;
    }
    const pulse =
      1 +
      Math.sin(elapsed * (isQuartz ? 7.5 : isMagma ? 6.5 : 3.8) + seedOffset) *
        0.08;
    heartCrystal.scale.set(pulse, pulse, pulse);
    heartCrystal.position.y = 1.12 + Math.sin(elapsed * 2.6 + seedOffset) * 0.035;
  }

  const masteryRegalia = root.userData.masteryRegalia as THREE.Group | undefined;
  if (masteryRegalia) {
    masteryRegalia.rotation.y = -elapsed * 1.45 + seedOffset;
    masteryRegalia.position.y = 0.52 + Math.sin(elapsed * 3.2 + seedOffset) * 0.05;
  }

  const astrolabeGroup = root.userData.astrolabeGroup as THREE.Group | undefined;
  if (astrolabeGroup) {
    astrolabeGroup.rotation.y = elapsed * 1.85 + seedOffset;
    astrolabeGroup.rotation.z = Math.sin(elapsed * 2.1 + seedOffset) * 0.35;
  }

  const steamPuffs = root.userData.steamPuffs as THREE.Mesh[] | undefined;
  if (steamPuffs) {
    const isQuartz = Boolean(root.userData.isQuartzDesign);
    steamPuffs.forEach((puff) => {
      const side = (puff.userData.ventSide as number) ?? 1;
      const idx = (puff.userData.puffIndex as number) ?? 0;
      const cycle =
        (elapsed * (isQuartz ? 1.25 : 0.85) + idx * 0.33 + seedOffset * 0.2) % 1;
      puff.position.y = 0.2 + cycle * 0.42;
      puff.position.x =
        side * cycle * 0.16 +
        Math.sin(elapsed * (isQuartz ? 10 : 3) + idx) *
          (isQuartz ? 0.045 : 0.025);
      const s =
        isQuartz ? 0.55 + Math.sin(cycle * Math.PI) * 0.85 : 0.65 + cycle * 1.15;
      puff.scale.setScalar(s);
    });
  }
}

/**
 * Builds a composite 6–11 part procedural 3D Tower or Supertower model with optional Mastery Cosmetic Skin.
 */
export function buildTowerModel(
  kind: TowerKind,
  level: number,
  isSoftwareGl: boolean,
  skinSpec?: TowerCosmeticSkinSpec
): THREE.Group {
  const spec = ALL_TOWERS[kind];
  const root = new THREE.Group();

  const isSuper = spec.isSuper;
  const isQuartzDesign = kind === 'quartz';
  const isFrostDesign = kind === 'frost' || kind === 'prism_glacial';
  const isMagmaDesign = kind === 'magma' || kind === 'plasma_colossus' || kind === 'cryo_volcano';
  const isMonumentalPillar = isQuartzDesign || isFrostDesign || isMagmaDesign;
  const baseScale = isSuper ? 1.24 : 1.0 + (level - 1) * 0.07;

  root.add(createContactShadowMesh(isSuper || isMonumentalPillar ? 1.15 : 0.85));

  const accentColorHex = skinSpec && !skinSpec.isDefault ? skinSpec.primaryGlow : spec.secondaryColor;
  const accentGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentColorHex),
    emissive: new THREE.Color(accentColorHex),
    emissiveIntensity: 0.85,
    roughness: 0.18,
    metalness: 0.3,
  });

  const turret = new THREE.Group();
  turret.position.y = 1.05;
  turret.userData.baseY = 1.05;

  if (isQuartzDesign) {
    buildQuartzVoidSpireModel(root, turret, isSuper);
  } else if (isFrostDesign) {
    buildFrostPillarModel(root, turret, isSuper, isSoftwareGl);
  } else {
    buildMagmaVolcanicTowerModel(root, turret, isSuper);
  }

  for (let l = 1; l < level; l++) {
    const pip = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), accentGlowMat);
    const angle = ((l - 1) * (Math.PI * 2)) / 4;
    pip.position.set(
      Math.cos(angle) * 0.64,
      isMonumentalPillar ? 0.86 : 0.62,
      Math.sin(angle) * 0.64
    );
    root.add(pip);
  }

  // Overhead 3D Experience (XP) Progress Bar above the tower
  const xpBarGroup = new THREE.Group();
  xpBarGroup.position.set(0, isQuartzDesign ? 2.86 : isMonumentalPillar ? 2.52 : isSuper ? 2.28 : 2.02, 0);

  const xpFrameGeo = new THREE.PlaneGeometry(0.96, 0.14);
  const xpFrameMat = new THREE.MeshBasicMaterial({
    color: 0x090d16,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const xpFrame = new THREE.Mesh(xpFrameGeo, xpFrameMat);
  xpBarGroup.add(xpFrame);

  const xpTrackGeo = new THREE.PlaneGeometry(0.88, 0.08);
  const xpTrackMat = new THREE.MeshBasicMaterial({
    color: 0x1e293b,
    side: THREE.DoubleSide,
  });
  const xpTrack = new THREE.Mesh(xpTrackGeo, xpTrackMat);
  xpTrack.position.z = 0.005;
  xpBarGroup.add(xpTrack);

  // Left-anchored fill bar so scale.x in [0.02..1.0] grows cleanly from left to right
  const fillWidth = 0.88;
  const xpFillGeo = new THREE.PlaneGeometry(fillWidth, 0.08);
  xpFillGeo.translate(fillWidth / 2, 0, 0);
  const isMaxLevel = level >= 5;
  const barColor =
    isMaxLevel
      ? '#fbbf24'
      : skinSpec && !skinSpec.isDefault
      ? skinSpec.primaryGlow
      : spec.color;
  const xpFillMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(barColor),
    side: THREE.DoubleSide,
  });
  const xpBarFill = new THREE.Mesh(xpFillGeo, xpFillMat);
  xpBarFill.position.set(-fillWidth / 2, 0, 0.01);
  xpBarFill.scale.set(isMaxLevel ? 1 : 0.03, 1, 1);
  xpBarGroup.add(xpBarFill);

  root.add(xpBarGroup);
  root.add(turret);

  if (skinSpec && !skinSpec.isDefault) {
    applyCosmeticMasterySkinToTowerModel(root, turret, skinSpec);
  }

  root.scale.setScalar(baseScale);
  root.userData.turret = turret;
  root.userData.isSuper = isSuper;
  root.userData.isQuartzDesign = isQuartzDesign;
  root.userData.isFrostDesign = isFrostDesign;
  root.userData.isMagmaDesign = isMagmaDesign;
  root.userData.isMonumentalPillar = isMonumentalPillar;
  root.userData.xpBarGroup = xpBarGroup;
  root.userData.xpBarFill = xpBarFill;
  return root;
}

/**
 * Creates a realistic glossy eyeball with upper and lower fleshy eyelids that can blink.
 */
function createRealisticEye(
  radius: number,
  irisHex: string,
  skinMat: THREE.Material,
  slitPupil = false
): { eyeGroup: THREE.Group; upperLid: THREE.Mesh } {
  const eyeGroup = new THREE.Group();

  const eyeMat = new THREE.MeshPhysicalMaterial({
    map: createEyeballTexture(irisHex, slitPupil),
    roughness: 0.06,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });

  const eyeball = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), eyeMat);
  // Rotate sphere so the UV center (iris/pupil) points directly forward (+Z)
  eyeball.rotation.y = -Math.PI / 2;
  eyeball.castShadow = true;
  eyeGroup.add(eyeball);

  // Upper fleshy eyelid hemisphere
  const upperLidGeo = new THREE.SphereGeometry(
    radius * 1.08,
    16,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.48
  );
  const upperLid = new THREE.Mesh(upperLidGeo, skinMat);
  upperLid.rotation.x = -0.35; // Resting open angle
  upperLid.userData.baseRotX = -0.35;
  eyeGroup.add(upperLid);

  // Lower eyelid rim
  const lowerLidGeo = new THREE.SphereGeometry(
    radius * 1.06,
    16,
    10,
    0,
    Math.PI * 2,
    Math.PI * 0.68,
    Math.PI * 0.32
  );
  const lowerLid = new THREE.Mesh(lowerLidGeo, skinMat);
  lowerLid.rotation.x = 0.22;
  eyeGroup.add(lowerLid);

  return { eyeGroup, upperLid };
}

/**
 * Creates a curved, ridged bull/monster horn (Sulley / Boss style) using a 3D spline.
 */
function createCurvedMonsterHorn(
  baseRadius: number,
  length: number,
  sideSign: number,
  hornMat: THREE.Material
): THREE.Group {
  const hornGroup = new THREE.Group();
  const segments = 6;
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const r0 = baseRadius * (1 - t0 * 0.82);
    const r1 = baseRadius * (1 - t1 * 0.85);
    const segLen = (length / segments) * 1.08;

    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segLen, 10), hornMat);
    const angle = t0 * 1.15;
    seg.position.set(
      sideSign * (t0 * length * 0.55),
      Math.sin(angle) * length * 0.52,
      Math.cos(angle) * 0.04
    );
    seg.rotation.z = -sideSign * (0.65 - t0 * 0.95);
    seg.castShadow = true;
    hornGroup.add(seg);
  }
  return hornGroup;
}

/**
 * Creates an iconic yellow Monsters, Inc. Scream Canister (Tanque de Gritos).
 */
function createScreamCanister(scale = 1.0): THREE.Group {
  const canister = new THREE.Group();

  const yellowPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    roughness: 0.22,
    metalness: 0.35,
    clearcoat: 0.85,
  });

  const darkCapMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.75,
  });

  const screamGaugeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.95,
    roughness: 0.15,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 12), yellowPaintMat);
  body.castShadow = true;
  canister.add(body);

  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.115, 0.08, 12), darkCapMat);
  topCap.position.y = 0.24;
  canister.add(topCap);

  const bottomCap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.11, 0.06, 12), darkCapMat);
  bottomCap.position.y = -0.22;
  canister.add(bottomCap);

  const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 6, 12), darkCapMat);
  valveWheel.rotation.x = Math.PI / 2;
  valveWheel.position.y = 0.3;
  canister.add(valveWheel);

  // Glowing red scream energy level bar on side
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), screamGaugeMat);
  gauge.position.set(0, 0, 0.1);
  canister.add(gauge);

  canister.scale.setScalar(scale);
  return canister;
}

/**
 * Creates an articulated lower jaw with sharp ivory monster teeth and a pink tongue.
 */
function createMonsterJaw(
  width: number,
  depth: number,
  skinMat: THREE.Material,
  toothMat: THREE.Material,
  underbiteFangs = true
): THREE.Group {
  const jawPivot = new THREE.Group();

  // Lower jaw chin/mandible
  const chin = new THREE.Mesh(
    new THREE.SphereGeometry(width * 0.55, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    skinMat
  );
  chin.scale.set(1.05, 0.65, depth / width);
  chin.position.set(0, -0.02, depth * 0.35);
  jawPivot.add(chin);

  // Pink tongue inside mouth
  const tongueMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    roughness: 0.4,
    metalness: 0.05,
  });
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(width * 0.36, 10, 8), tongueMat);
  tongue.scale.set(1.0, 0.35, 1.15);
  tongue.position.set(0, 0.01, depth * 0.38);
  jawPivot.add(tongue);

  // Row of pointed ivory teeth/fangs
  const numTeeth = underbiteFangs ? 5 : 4;
  for (let i = 0; i < numTeeth; i++) {
    const t = i / (numTeeth - 1) - 0.5;
    const isCornerFang = Math.abs(t) > 0.35 && underbiteFangs;
    const toothH = isCornerFang ? width * 0.34 : width * 0.18;
    const toothR = isCornerFang ? width * 0.08 : width * 0.055;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(toothR, toothH, 6), toothMat);
    tooth.position.set(
      t * width * 0.78,
      toothH * 0.45,
      depth * 0.55 - Math.abs(t) * depth * 0.22
    );
    tooth.rotation.x = 0.12;
    jawPivot.add(tooth);
  }

  return jawPivot;
}

/**
 * Helper to build a realistic organic monster leg (hip -> muscular thigh -> knee -> calf -> 3-toed clawed foot).
 */
function createOrganicMonsterLeg(
  hipX: number,
  hipY: number,
  length: number,
  thickness: number,
  skinOrFurMat: THREE.Material,
  clawMat: THREE.Material
): THREE.Group {
  const legPivot = new THREE.Group();
  legPivot.position.set(hipX, hipY, 0);

  // Muscular Thigh
  const thigh = new THREE.Mesh(
    new THREE.CapsuleGeometry(thickness * 0.95, length * 0.35, 6, 12),
    skinOrFurMat
  );
  thigh.position.y = -length * 0.25;
  thigh.castShadow = true;
  legPivot.add(thigh);

  // Calf / Lower Leg
  const calf = new THREE.Mesh(
    new THREE.CapsuleGeometry(thickness * 0.78, length * 0.36, 6, 12),
    skinOrFurMat
  );
  calf.position.set(0, -length * 0.68, -thickness * 0.08);
  calf.castShadow = true;
  legPivot.add(calf);

  // Organic Paw / Foot
  const foot = new THREE.Mesh(new THREE.SphereGeometry(thickness * 1.05, 12, 10), skinOrFurMat);
  foot.scale.set(1.1, 0.55, 1.55);
  foot.position.set(0, -length * 0.94, thickness * 0.42);
  foot.castShadow = true;
  legPivot.add(foot);

  // 3 Curved Ivory Toes + Claws
  [-1, 0, 1].forEach((toeIdx) => {
    const claw = new THREE.Mesh(
      new THREE.ConeGeometry(thickness * 0.24, thickness * 0.75, 6),
      clawMat
    );
    claw.position.set(
      toeIdx * thickness * 0.52,
      -length * 0.96,
      thickness * 1.25 - Math.abs(toeIdx) * thickness * 0.15
    );
    claw.rotation.x = Math.PI / 2.2;
    claw.rotation.z = -toeIdx * 0.18;
    legPivot.add(claw);
  });

  return legPivot;
}

/**
 * Helper to build a realistic organic monster arm (deltoid -> upper arm -> forearm -> clawed hand + optional prop).
 */
function createOrganicMonsterArm(
  shoulderX: number,
  shoulderY: number,
  length: number,
  thickness: number,
  skinOrFurMat: THREE.Material,
  clawMat: THREE.Material,
  propType: 'none' | 'canister' | 'mallet' | 'claw_gauntlet' = 'none',
  accentMat?: THREE.Material
): THREE.Group {
  const armPivot = new THREE.Group();
  armPivot.position.set(shoulderX, shoulderY, 0);
  const sideSign = Math.sign(shoulderX) || 1;

  // Muscular Shoulder Deltoid
  const shoulder = new THREE.Mesh(
    new THREE.SphereGeometry(thickness * 1.22, 12, 10),
    skinOrFurMat
  );
  shoulder.castShadow = true;
  armPivot.add(shoulder);

  // Upper Arm Bicep
  const upperArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(thickness * 0.85, length * 0.36, 6, 12),
    skinOrFurMat
  );
  upperArm.position.set(sideSign * thickness * 0.15, -length * 0.28, 0);
  upperArm.castShadow = true;
  armPivot.add(upperArm);

  // Muscular Forearm
  const forearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(thickness * 0.92, length * 0.38, 6, 12),
    skinOrFurMat
  );
  forearm.position.set(sideSign * thickness * 0.2, -length * 0.66, thickness * 0.32);
  forearm.rotation.x = -0.45;
  forearm.castShadow = true;
  armPivot.add(forearm);

  // Hand & 3 Sharp Claws
  const handPos = new THREE.Vector3(
    sideSign * thickness * 0.2,
    -length * 0.88,
    thickness * 0.56
  );
  const palm = new THREE.Mesh(new THREE.SphereGeometry(thickness * 0.95, 10, 8), skinOrFurMat);
  palm.position.copy(handPos);
  armPivot.add(palm);

  [-1, 0, 1].forEach((fIdx) => {
    const fingerClaw = new THREE.Mesh(
      new THREE.ConeGeometry(thickness * 0.22, thickness * 0.72, 6),
      clawMat
    );
    fingerClaw.position.set(
      handPos.x + fIdx * thickness * 0.36,
      handPos.y - thickness * 0.35,
      handPos.z + thickness * 0.55
    );
    fingerClaw.rotation.x = Math.PI / 2.6;
    armPivot.add(fingerClaw);
  });

  if (propType === 'canister' && sideSign > 0) {
    const canister = createScreamCanister(1.15);
    canister.position.set(handPos.x, handPos.y - 0.05, handPos.z + 0.22);
    canister.rotation.z = Math.PI / 2;
    armPivot.add(canister);
  } else if (propType === 'mallet' && sideSign > 0) {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(thickness * 0.26, thickness * 0.26, length * 1.45, 8),
      clawMat
    );
    handle.position.set(handPos.x, handPos.y, handPos.z + length * 0.45);
    handle.rotation.x = Math.PI / 2;
    armPivot.add(handle);

    const canisterHead = createScreamCanister(1.65);
    canisterHead.position.set(handPos.x, handPos.y, handPos.z + length * 1.15);
    canisterHead.rotation.z = Math.PI / 2;
    armPivot.add(canisterHead);
  } else if (propType === 'claw_gauntlet' && accentMat) {
    const cuff = new THREE.Mesh(
      new THREE.TorusGeometry(thickness * 1.05, thickness * 0.22, 8, 16),
      accentMat
    );
    cuff.position.set(handPos.x, handPos.y + 0.16, handPos.z - 0.08);
    cuff.rotation.x = Math.PI / 2 - 0.45;
    armPivot.add(cuff);
  }

  return armPivot;
}

/**
 * Builds an articulated, realistic Monsters, Inc. ("Monstruos, S.A.") 3D Enemy or Final Boss model.
 */
export function buildEnemyModel(kind: EnemyKind): THREE.Group {
  const spec = ENEMY_SPECS[kind];
  const root = new THREE.Group();

  root.add(createContactShadowMesh(spec.isBoss ? 1.18 : 0.64));

  const hornIvoryMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.32,
    metalness: 0.08,
    clearcoat: 0.4,
  });

  const coreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.accentColor),
    emissive: new THREE.Color(spec.accentColor),
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.3,
  });

  const bodyGroup = new THREE.Group();
  const torso = new THREE.Group();
  bodyGroup.add(torso);

  const eyelids: THREE.Object3D[] = [];
  let rig: CharacterRig;

  if (kind === 'wisp') {
    // =========================================================================
    // 1. MITE, EL CÍCLOPE DEL VACÍO — Fully Articulated 3D Horned Cyclops Stalker
    //    - High-resolution PBR emerald-jade pebbled dermis with micro-bump relief
    //    - Oversized 3D glossy Cyclops Eye with animated blinking eyelid & brow ridge
    //    - Central curved ivory horn + dorsal obsidian osteoderm spikes
    //    - Articulated chomping lower jaw with ivory fangs + 3D arms & legs
    // =========================================================================
    const miteSkinMat = new THREE.MeshPhysicalMaterial({
      map: createMonsterSkinTexture('#15803d', '#84cc16'),
      bumpMap: getMonsterMicroBumpTexture(),
      bumpScale: 0.035,
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
    });
    const obsidianArmorMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b2e,
      roughness: 0.45,
      metalness: 0.65,
    });
    const voidRuneMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    torso.position.y = 0.56;

    // Sculpted spherical-ovoid Cyclops torso/head body
    const bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 22, 18),
      miteSkinMat
    );
    bodyMesh.scale.set(1.06, 1.16, 0.98);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    torso.add(bodyMesh);

    const head = new THREE.Group();
    head.position.set(0, 0.08, 0.04);
    torso.add(head);

    // Heavy furrowed cyclops brow ridge
    const browRidge = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.042, 10, 20, Math.PI * 0.95),
      miteSkinMat
    );
    browRidge.position.set(0, 0.06, 0.25);
    browRidge.rotation.set(0.28, 0, 0.05);
    browRidge.castShadow = true;
    head.add(browRidge);

    // Oversized Central 3D Glossy Cyclops Eye with Animated Blinking Eyelid
    const { eyeGroup, upperLid } = createRealisticEye(
      0.135,
      '#84cc16',
      miteSkinMat,
      false
    );
    eyeGroup.position.set(0, 0.04, 0.26);
    head.add(eyeGroup);
    eyelids.push(upperLid);

    // Central Crown Curved Ivory Horn + Twin Side Osteoderm Spikes
    const centerHorn = createCurvedMonsterHorn(0.062, 0.28, 0, hornIvoryMat);
    centerHorn.position.set(0, 0.28, 0.04);
    centerHorn.rotation.x = 0.25;
    head.add(centerHorn);

    [-1, 1].forEach((side) => {
      const sideSpike = new THREE.Mesh(
        new THREE.ConeGeometry(0.036, 0.11, 8),
        obsidianArmorMat
      );
      sideSpike.position.set(side * 0.17, 0.24, 0.02);
      sideSpike.rotation.z = -side * 0.45;
      sideSpike.castShadow = true;
      head.add(sideSpike);

      // Shoulder obsidian pauldrons with glowing void rune studs
      const pauldron = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.085, 0),
        obsidianArmorMat
      );
      pauldron.position.set(side * 0.31, 0.08, 0.02);
      pauldron.scale.set(1.1, 0.7, 1.1);
      pauldron.castShadow = true;
      torso.add(pauldron);

      const runeStud = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.032, 0),
        voidRuneMat
      );
      runeStud.position.set(side * 0.34, 0.11, 0.04);
      torso.add(runeStud);
    });

    // Articulated chomping lower jaw with sharp ivory fangs
    const jaw = createMonsterJaw(0.28, 0.24, miteSkinMat, hornIvoryMat, true);
    jaw.position.set(0, -0.18, 0.15);
    head.add(jaw);

    // Muscular articulated arms with 3-clawed hands
    const leftArm = createOrganicMonsterArm(
      -0.33,
      0.02,
      0.42,
      0.085,
      miteSkinMat,
      hornIvoryMat
    );
    const rightArm = createOrganicMonsterArm(
      0.33,
      0.02,
      0.42,
      0.085,
      miteSkinMat,
      hornIvoryMat
    );
    torso.add(leftArm);
    torso.add(rightArm);

    // Articulated digitigrade monster legs with 3 ivory talons
    const leftLeg = createOrganicMonsterLeg(
      -0.16,
      0.36,
      0.36,
      0.095,
      miteSkinMat,
      hornIvoryMat
    );
    const rightLeg = createOrganicMonsterLeg(
      0.16,
      0.36,
      0.36,
      0.095,
      miteSkinMat,
      hornIvoryMat
    );
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    rig = {
      bodyGroup,
      torso,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      jaw,
      eyelids,
      isFloating: false,
      baseY: 0.56,
    };
  } else if (kind === 'swarm') {
    // =========================================================================
    // 2. MULTI-EYED LITTLE CRITTER: Fast Magenta Spotted Monster with 3 Eye Stalks
    // =========================================================================
    const critterFurMat = new THREE.MeshPhysicalMaterial({
      map: createSpottedFurTexture('#ec4899', '#fde047'),
      roughness: 0.68,
      sheen: 1.0,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color('#fbcfe8'),
    });

    torso.position.y = 0.56;

    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), critterFurMat);
    bodyMesh.scale.set(1.12, 0.92, 1.05);
    bodyMesh.castShadow = true;
    torso.add(bodyMesh);

    // 3 Expressive Eye Stalks on Top
    const eyeStalks: THREE.Object3D[] = [];
    const headGroup = new THREE.Group();
    [-1, 0, 1].forEach((idx) => {
      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(idx * 0.13, 0.24, 0.08);

      const stalkStem = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.032, 0.14, 4, 8),
        critterFurMat
      );
      stalkStem.position.y = 0.07;
      stalkGroup.add(stalkStem);

      const { eyeGroup, upperLid } = createRealisticEye(0.078, '#eab308', critterFurMat, false);
      eyeGroup.position.set(0, 0.17, 0.02);
      stalkGroup.add(eyeGroup);
      eyelids.push(upperLid);

      stalkGroup.rotation.z = -idx * 0.22;
      headGroup.add(stalkGroup);
      eyeStalks.push(stalkGroup);
    });
    torso.add(headGroup);

    // Big Chomping Jaw with Sharp Fangs
    const jaw = createMonsterJaw(0.38, 0.3, critterFurMat, hornIvoryMat, true);
    jaw.position.set(0, -0.08, 0.14);
    torso.add(jaw);

    // Spiked Tail
    const tail = new THREE.Group();
    tail.position.set(0, -0.06, -0.28);
    const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 8), critterFurMat);
    tailCone.rotation.x = -Math.PI / 2.4;
    tailCone.position.set(0, 0, -0.16);
    tail.add(tailCone);
    torso.add(tail);

    const leftLeg = createOrganicMonsterLeg(-0.15, 0.38, 0.38, 0.075, critterFurMat, hornIvoryMat);
    const rightLeg = createOrganicMonsterLeg(0.15, 0.38, 0.38, 0.075, critterFurMat, hornIvoryMat);
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    rig = {
      bodyGroup,
      torso,
      head: headGroup,
      leftLeg,
      rightLeg,
      jaw,
      tail,
      eyelids,
      eyeStalks,
      isFloating: false,
      baseY: 0.56,
    };
  } else if (kind === 'weaver') {
    // =========================================================================
    // 3. RANDALL BOGGS STYLE: Sleek Purple Iridescent Chameleon Monster
    //    - 4 Articulated Arms, Slit-Pupil Reptilian Eyes, Head Fronds & Coiled Tail
    // =========================================================================
    const scaleMat = new THREE.MeshPhysicalMaterial({
      map: createReptileScalesTexture('#7e22ce', '#ec4899'),
      roughness: 0.28,
      metalness: 0.1,
      clearcoat: 0.65,
      iridescence: 0.85,
      iridescenceIOR: 1.35,
    });

    torso.position.y = 0.72;

    // Sinuous Reptilian Torso
    const upperTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.44, 8, 16), scaleMat);
    upperTorso.castShadow = true;
    torso.add(upperTorso);

    // Chameleon Head with 3 Frond Antennae & 2 Bulging Reptilian Eyes
    const head = new THREE.Group();
    head.position.set(0, 0.42, 0.08);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), scaleMat);
    skull.scale.set(1.05, 0.88, 1.25);
    skull.castShadow = true;
    head.add(skull);

    [-1, 1].forEach((side) => {
      const { eyeGroup, upperLid } = createRealisticEye(0.085, '#facc15', scaleMat, true);
      eyeGroup.position.set(side * 0.12, 0.06, 0.18);
      eyeGroup.rotation.y = side * 0.18;
      head.add(eyeGroup);
      eyelids.push(upperLid);
    });

    // 3 Iconic Head Fronds with Magenta Tips
    [-1, 0, 1].forEach((idx) => {
      const frond = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.22, 4, 8), scaleMat);
      frond.position.set(idx * 0.08, 0.2, -0.05);
      frond.rotation.x = -0.45;
      frond.rotation.z = -idx * 0.32;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), coreMat);
      tip.position.y = 0.13;
      frond.add(tip);
      head.add(frond);
    });

    const jaw = createMonsterJaw(0.26, 0.26, scaleMat, hornIvoryMat, true);
    jaw.position.set(0, -0.09, 0.12);
    head.add(jaw);
    torso.add(head);

    // 4 Articulated Chameleon Arms (Upper Pair + Lower Pair!)
    const leftArm = createOrganicMonsterArm(-0.28, 0.18, 0.46, 0.075, scaleMat, hornIvoryMat);
    const rightArm = createOrganicMonsterArm(0.28, 0.18, 0.46, 0.075, scaleMat, hornIvoryMat);
    const lowerLeftArm = createOrganicMonsterArm(-0.25, -0.06, 0.42, 0.068, scaleMat, hornIvoryMat);
    const lowerRightArm = createOrganicMonsterArm(0.25, -0.06, 0.42, 0.068, scaleMat, hornIvoryMat);
    torso.add(leftArm);
    torso.add(rightArm);
    torso.add(lowerLeftArm);
    torso.add(lowerRightArm);

    // Long Prehensile Chameleon Tail
    const tail = new THREE.Group();
    tail.position.set(0, -0.24, -0.18);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.08, -0.28),
      new THREE.Vector3(0.12, 0.06, -0.52),
      new THREE.Vector3(0, 0.22, -0.64),
    ]);
    const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 16, 0.075, 8, false), scaleMat);
    tailMesh.castShadow = true;
    tail.add(tailMesh);
    torso.add(tail);

    const leftLeg = createOrganicMonsterLeg(-0.15, 0.48, 0.48, 0.085, scaleMat, hornIvoryMat);
    const rightLeg = createOrganicMonsterLeg(0.15, 0.48, 0.48, 0.085, scaleMat, hornIvoryMat);
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    rig = {
      bodyGroup,
      torso,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      extraArms: [lowerLeftArm, lowerRightArm],
      jaw,
      tail,
      eyelids,
      isFloating: false,
      baseY: 0.72,
    };
  } else if (kind === 'construct') {
    // =========================================================================
    // 4. SCARE-FLOOR WORKER / TRICLOPE: Muscular Orange Monster with
    //    Monsters, Inc. Yellow Hardhat, 3 Glossy Eyes & Scream Canister
    // =========================================================================
    const orangeFurMat = new THREE.MeshPhysicalMaterial({
      map: createSpottedFurTexture('#ea580c', '#7c2d12'),
      roughness: 0.65,
      sheen: 0.9,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#fdba74'),
    });

    const yellowHelmetMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      roughness: 0.2,
      metalness: 0.25,
      clearcoat: 0.9,
    });

    torso.position.y = 0.72;

    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.28, 10, 16), orangeFurMat);
    chest.scale.set(1.18, 1.0, 0.95);
    chest.castShadow = true;
    torso.add(chest);

    const head = new THREE.Group();
    head.position.set(0, 0.38, 0.06);
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), orangeFurMat);
    cranium.scale.set(1.15, 0.95, 1.05);
    cranium.castShadow = true;
    head.add(cranium);

    // 3 Glossy Eyes Across the Brow
    [-1, 0, 1].forEach((idx) => {
      const { eyeGroup, upperLid } = createRealisticEye(
        idx === 0 ? 0.078 : 0.064,
        '#38bdf8',
        orangeFurMat,
        false
      );
      eyeGroup.position.set(idx * 0.11, 0.04 + (idx === 0 ? 0.03 : 0), 0.21);
      eyeGroup.rotation.y = idx * 0.18;
      head.add(eyeGroup);
      eyelids.push(upperLid);
    });

    // Monsters, Inc. Yellow Scare-Floor Safety Hardhat + Siren Light
    const hardhat = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      yellowHelmetMat
    );
    hardhat.position.set(0, 0.08, 0);
    hardhat.castShadow = true;
    head.add(hardhat);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.035, 16), yellowHelmetMat);
    brim.position.set(0, 0.08, 0.03);
    head.add(brim);

    const jaw = createMonsterJaw(0.32, 0.26, orangeFurMat, hornIvoryMat, true);
    jaw.position.set(0, -0.1, 0.12);
    head.add(jaw);
    torso.add(head);

    // Carries a Yellow Scream Canister in Right Hand
    const leftArm = createOrganicMonsterArm(-0.38, 0.16, 0.54, 0.1, orangeFurMat, hornIvoryMat);
    const rightArm = createOrganicMonsterArm(
      0.38,
      0.16,
      0.54,
      0.1,
      orangeFurMat,
      hornIvoryMat,
      'canister'
    );
    torso.add(leftArm);
    torso.add(rightArm);

    const leftLeg = createOrganicMonsterLeg(-0.18, 0.5, 0.5, 0.1, orangeFurMat, hornIvoryMat);
    const rightLeg = createOrganicMonsterLeg(0.18, 0.5, 0.5, 0.1, orangeFurMat, hornIvoryMat);
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    rig = {
      bodyGroup,
      torso,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      jaw,
      eyelids,
      isFloating: false,
      baseY: 0.72,
    };
  } else if (kind === 'basalt') {
    // =========================================================================
    // 5. SULLEY (JAMES P. SULLIVAN) STYLE: Hulking Turquoise Monster with
    //    Purple Spots, Curved Ridged Horns, Bushy Eyebrows & Dinosaur Tail
    // =========================================================================
    const sulleyFurMat = new THREE.MeshPhysicalMaterial({
      map: createSpottedFurTexture('#06b6d4', '#a855f7'),
      roughness: 0.68,
      sheen: 1.0,
      sheenRoughness: 0.42,
      sheenColor: new THREE.Color('#67e8f9'),
    });

    const purpleSpotMat = new THREE.MeshStandardMaterial({
      color: 0x9333ea,
      roughness: 0.6,
    });

    torso.position.y = 0.78;

    // Massive Broad-Shouldered Furry Torso + Belly
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.34, 12, 18), sulleyFurMat);
    chest.scale.set(1.26, 1.05, 1.02);
    chest.castShadow = true;
    chest.receiveShadow = true;
    torso.add(chest);

    // Dorsal Spine Plates Down the Back
    for (let s = 0; s < 4; s++) {
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), purpleSpotMat);
      dorsal.position.set(0, 0.22 - s * 0.14, -0.36);
      dorsal.rotation.x = -Math.PI / 2.2;
      torso.add(dorsal);
    }

    // Sulley Head with Curved Bull Horns, Bushy Eyebrows, 2 Glossy Eyes & Roaring Jaw
    const head = new THREE.Group();
    head.position.set(0, 0.48, 0.08);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 16), sulleyFurMat);
    skull.scale.set(1.12, 1.04, 1.08);
    skull.castShadow = true;
    head.add(skull);

    // Two Expressive Eyes + Bushy Turquoise Eyebrows
    [-1, 1].forEach((side) => {
      const { eyeGroup, upperLid } = createRealisticEye(0.075, '#0284c7', sulleyFurMat, false);
      eyeGroup.position.set(side * 0.11, 0.06, 0.24);
      head.add(eyeGroup);
      eyelids.push(upperLid);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.07), purpleSpotMat);
      brow.position.set(side * 0.11, 0.15, 0.26);
      brow.rotation.z = -side * 0.22;
      head.add(brow);

      // Curved Ridged Bull Horn
      const horn = createCurvedMonsterHorn(0.065, 0.36, side, hornIvoryMat);
      horn.position.set(side * 0.22, 0.14, -0.02);
      head.add(horn);
    });

    const jaw = createMonsterJaw(0.38, 0.32, sulleyFurMat, hornIvoryMat, true);
    jaw.position.set(0, -0.14, 0.14);
    head.add(jaw);
    torso.add(head);

    // Thick Furry Tail
    const tail = new THREE.Group();
    tail.position.set(0, -0.26, -0.3);
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.56, 10), sulleyFurMat);
    tailMesh.rotation.x = -Math.PI / 2.5;
    tailMesh.position.set(0, -0.06, -0.24);
    tailMesh.castShadow = true;
    tail.add(tailMesh);
    torso.add(tail);

    const leftArm = createOrganicMonsterArm(-0.48, 0.22, 0.64, 0.14, sulleyFurMat, hornIvoryMat);
    const rightArm = createOrganicMonsterArm(0.48, 0.22, 0.64, 0.14, sulleyFurMat, hornIvoryMat);
    torso.add(leftArm);
    torso.add(rightArm);

    const leftLeg = createOrganicMonsterLeg(-0.22, 0.54, 0.54, 0.14, sulleyFurMat, hornIvoryMat);
    const rightLeg = createOrganicMonsterLeg(0.22, 0.54, 0.54, 0.14, sulleyFurMat, hornIvoryMat);
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    rig = {
      bodyGroup,
      torso,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      jaw,
      tail,
      eyelids,
      isFloating: false,
      baseY: 0.78,
    };
  } else if (kind === 'boss_titan') {
    // =========================================================================
    // 6. FINAL BOSS WAVE 5 — WATERNOOSE, ARACHNID CEO TITAN:
    //    - Heavy Executive Carapace + Formal Collar & Tie, 5 Glossy Eyes in Cluster,
    //      Mandible Jaws, 6 Crab Legs + 2 Colossal Pincer/Mallet Arms!
    // =========================================================================
    const bossSkinMat = new THREE.MeshPhysicalMaterial({
      map: createMonsterSkinTexture('#475569', '#94a3b8'),
      roughness: 0.35,
      metalness: 0.15,
      clearcoat: 0.5,
    });

    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.2,
    });

    const tieCrimsonMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });

    torso.position.y = 0.82;

    // Wide Executive Abdomen/Chest in Suit Jacket
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), suitMat);
    chest.scale.set(1.28, 1.05, 1.12);
    chest.castShadow = true;
    torso.add(chest);

    // Executive Red Tie on Front Chest
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 4), tieCrimsonMat);
    tie.position.set(0, -0.04, 0.5);
    tie.rotation.z = Math.PI;
    torso.add(tie);

    // Head with 5 Clustered Glossy Eyes & Pincer Mandibles
    const head = new THREE.Group();
    head.position.set(0, 0.5, 0.12);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16), bossSkinMat);
    headMesh.scale.set(1.22, 0.96, 1.05);
    headMesh.castShadow = true;
    head.add(headMesh);

    // 5 Eyes in Iconic Waternoose Cluster
    const eyeCoords = [
      [0, 0.12, 0.31, 0.082],
      [-0.14, 0.08, 0.28, 0.068],
      [0.14, 0.08, 0.28, 0.068],
      [-0.24, 0.01, 0.22, 0.055],
      [0.24, 0.01, 0.22, 0.055],
    ];
    eyeCoords.forEach(([ex, ey, ez, er]) => {
      const { eyeGroup, upperLid } = createRealisticEye(er, '#ef4444', bossSkinMat, false);
      eyeGroup.position.set(ex, ey, ez);
      head.add(eyeGroup);
      eyelids.push(upperLid);
    });

    const jaw = createMonsterJaw(0.46, 0.36, bossSkinMat, hornIvoryMat, true);
    jaw.position.set(0, -0.15, 0.14);
    head.add(jaw);
    torso.add(head);

    // Massive Arms with Scream-Mallet Smasher
    const leftArm = createOrganicMonsterArm(
      -0.6,
      0.22,
      0.72,
      0.16,
      suitMat,
      hornIvoryMat,
      'claw_gauntlet',
      tieCrimsonMat
    );
    const rightArm = createOrganicMonsterArm(
      0.6,
      0.22,
      0.72,
      0.16,
      suitMat,
      hornIvoryMat,
      'mallet'
    );
    torso.add(leftArm);
    torso.add(rightArm);

    // Multi-Legged Arachnid Base (Front Pair, Mid Pair, Rear Pair)
    const leftLeg = createOrganicMonsterLeg(-0.28, 0.56, 0.56, 0.13, bossSkinMat, hornIvoryMat);
    const rightLeg = createOrganicMonsterLeg(0.28, 0.56, 0.56, 0.13, bossSkinMat, hornIvoryMat);
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    const extraLegs: THREE.Group[] = [];
    [-0.26, 0.26].forEach((zOff) => {
      [-1, 1].forEach((side) => {
        const crabLeg = createOrganicMonsterLeg(
          side * 0.36,
          0.52,
          0.52,
          0.1,
          bossSkinMat,
          hornIvoryMat
        );
        crabLeg.position.z = zOff;
        crabLeg.rotation.z = -side * 0.28;
        bodyGroup.add(crabLeg);
        extraLegs.push(crabLeg);
      });
    });

    rig = {
      bodyGroup,
      torso,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      extraLegs,
      jaw,
      eyelids,
      isFloating: false,
      baseY: 0.82,
    };
  } else {
    // =========================================================================
    // 7. FINAL BOSS WAVE 10 — EMPEROR OF THE NIGHT SCREAM:
    //    - Colossal Bioluminescent Void-Purple Spotted Fur Monster,
    //      4 Sweeping Ram Horns, Orbiting Yellow Scream Canisters,
    //      Multi-Eye Crown & Dual Scream-Extractor Smashers!
    // =========================================================================
    const emperorFurMat = new THREE.MeshPhysicalMaterial({
      map: createSpottedFurTexture('#581c87', '#06b6d4'),
      roughness: 0.58,
      sheen: 1.0,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color('#22d3ee'),
    });

    torso.position.y = 0.88;

    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.38, 12, 18), emperorFurMat);
    chest.scale.set(1.32, 1.08, 1.05);
    chest.castShadow = true;
    torso.add(chest);

    //Glowing Scream Core Embedded in Chest
    const coreMesh = createScreamCanister(1.1);
    coreMesh.position.set(0, 0.05, 0.42);
    torso.add(coreMesh);

    const head = new THREE.Group();
    head.position.set(0, 0.56, 0.1);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 16), emperorFurMat);
    skull.scale.set(1.18, 1.05, 1.12);
    skull.castShadow = true;
    head.add(skull);

    // 1 Giant Central Eye + 2 Flanking Slit Eyes + 4 Sweeping Horns
    const centerEye = createRealisticEye(0.11, '#22d3ee', emperorFurMat, true);
    centerEye.eyeGroup.position.set(0, 0.12, 0.29);
    head.add(centerEye.eyeGroup);
    eyelids.push(centerEye.upperLid);

    [-1, 1].forEach((side) => {
      const sideEye = createRealisticEye(0.072, '#f43f5e', emperorFurMat, true);
      sideEye.eyeGroup.position.set(side * 0.18, 0.04, 0.24);
      sideEye.eyeGroup.rotation.y = side * 0.25;
      head.add(sideEye.eyeGroup);
      eyelids.push(sideEye.upperLid);

      const upperHorn = createCurvedMonsterHorn(0.078, 0.46, side, hornIvoryMat);
      upperHorn.position.set(side * 0.25, 0.18, -0.02);
      head.add(upperHorn);

      const lowerHorn = createCurvedMonsterHorn(0.058, 0.34, side, hornIvoryMat);
      lowerHorn.position.set(side * 0.26, 0.02, 0.04);
      lowerHorn.rotation.x = 0.45;
      head.add(lowerHorn);
    });

    const jaw = createMonsterJaw(0.44, 0.36, emperorFurMat, hornIvoryMat, true);
    jaw.position.set(0, -0.16, 0.14);
    head.add(jaw);
    torso.add(head);

    // Orbiting Ring of Floating Yellow Scream Canisters Behind Back
    const wingsOrHalo = new THREE.Group();
    wingsOrHalo.position.set(0, 0.24, -0.35);
    for (let c = 0; c < 4; c++) {
      const angle = (c * Math.PI) / 2 + Math.PI / 4;
      const orbCanister = createScreamCanister(0.85);
      orbCanister.position.set(Math.cos(angle) * 0.68, Math.sin(angle) * 0.68, 0);
      orbCanister.rotation.z = angle;
      wingsOrHalo.add(orbCanister);
    }
    torso.add(wingsOrHalo);

    const tail = new THREE.Group();
    tail.position.set(0, -0.3, -0.36);
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.68, 10), emperorFurMat);
    tailMesh.rotation.x = -Math.PI / 2.4;
    tailMesh.position.set(0, -0.08, -0.28);
    tail.add(tailMesh);
    torso.add(tail);

    const leftArm = createOrganicMonsterArm(
      -0.62,
      0.24,
      0.76,
      0.17,
      emperorFurMat,
      hornIvoryMat,
      'canister'
    );
    const rightArm = createOrganicMonsterArm(
      0.62,
      0.24,
      0.76,
      0.17,
      emperorFurMat,
      hornIvoryMat,
      'mallet'
    );
    torso.add(leftArm);
    torso.add(rightArm);

    const leftLeg = createOrganicMonsterLeg(-0.28, 0.64, 0.64, 0.16, emperorFurMat, hornIvoryMat);
    const rightLeg = createOrganicMonsterLeg(0.28, 0.64, 0.64, 0.16, emperorFurMat, hornIvoryMat);
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    rig = {
      bodyGroup,
      torso,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      jaw,
      tail,
      eyelids,
      wingsOrHalo,
      coreMesh,
      isFloating: false,
      baseY: 0.88,
    };
  }

  const statusRig = buildEnemyStatusIndicatorsRig(spec.isBoss);
  root.add(statusRig.container);

  root.add(bodyGroup);
  root.scale.setScalar(spec.scale);
  root.userData.bodyGroup = bodyGroup;
  root.userData.rig = rig;
  root.userData.coreMat = coreMat;
  root.userData.statusRig = statusRig;
  return root;
}

export interface EnemyStatusIndicatorsRig {
  container: THREE.Group;
  isBoss: boolean;
  frozenBodyGroup: THREE.Group;
  frozenOverheadIcon: THREE.Group;
  frozenShell: THREE.Mesh;
  burnedBodyGroup: THREE.Group;
  burnedOverheadIcon: THREE.Group;
  burnedFlames: THREE.Object3D[];
  burnedVortexRing: THREE.Mesh;
  slowedBodyGroup: THREE.Group;
  slowedOverheadIcon: THREE.Group;
  slowedRingA: THREE.Mesh;
  slowedRingB: THREE.Mesh;
  slowedWeightsGroup: THREE.Group;
}

/**
 * Builds the 3 unique composite 3D Status Effect visual rigs attached to each enemy model:
 * 1. CONGELADO (Frozen): Translucent 3D Glacial Ice Crystal Cage & Spikes on body + 3D 6-Pointed Snowflake Star overhead.
 * 2. QUEMADO (Burned): Orbiting 3D Flame Tongues & Solar Magma Ring on body + 3D Triple-Flame Crown overhead.
 * 3. RALENTIZADO (Slowed): Counter-Rotating Arcane Gravity Rings & Downward Chevrons on body + 3D Chrono-Hourglass overhead.
 */
export function buildEnemyStatusIndicatorsRig(isBoss: boolean): EnemyStatusIndicatorsRig {
  const container = new THREE.Group();
  const overheadY = isBoss ? 2.76 : 1.98;

  // ============================================================================
  // 1. CONGELADO (FROZEN) — 3D Glacial Ice Prison + Overhead 3D Snowflake Star
  // ============================================================================
  const frozenBodyGroup = new THREE.Group();
  frozenBodyGroup.visible = false;

  const iceCrystalMat = new THREE.MeshPhysicalMaterial({
    color: 0x67e8f9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.68,
    clearcoat: 1.0,
  });
  const iceCoreSolidMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.95,
    roughness: 0.15,
  });

  // Hexagonal frozen ice plinth at feet
  const iceBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.72, 0.16, 6),
    iceCrystalMat
  );
  iceBase.position.y = 0.08;
  frozenBodyGroup.add(iceBase);

  // Translucent faceted glacial crystal shell encasing torso
  const frozenShell = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    iceCrystalMat
  );
  frozenShell.scale.set(0.95, 1.35, 0.95);
  frozenShell.position.y = 0.78;
  frozenBodyGroup.add(frozenShell);

  // 5 Jagged 3D Ice Spikes jutting outward around the frozen monster
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spikeH = 0.78 + (i % 2) * 0.24;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, spikeH, 5), iceCrystalMat);
    spike.position.set(Math.cos(angle) * 0.42, spikeH * 0.48, Math.sin(angle) * 0.42);
    spike.rotation.z = -Math.cos(angle) * 0.36;
    spike.rotation.x = Math.sin(angle) * 0.36;
    frozenBodyGroup.add(spike);
  }
  container.add(frozenBodyGroup);

  // Overhead 3D 6-Pointed Crystalline Snowflake Star
  const frozenOverheadIcon = new THREE.Group();
  frozenOverheadIcon.position.set(0, overheadY, 0);
  frozenOverheadIcon.visible = false;

  for (let b = 0; b < 3; b++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.065, 0.065), iceCoreSolidMat);
    bar.rotation.z = (b * Math.PI) / 3;
    frozenOverheadIcon.add(bar);
  }
  for (let p = 0; p < 6; p++) {
    const a = (p * Math.PI) / 3;
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), iceCrystalMat);
    tip.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0);
    frozenOverheadIcon.add(tip);
  }
  const snowCenter = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), iceCoreSolidMat);
  frozenOverheadIcon.add(snowCenter);
  container.add(frozenOverheadIcon);

  // ============================================================================
  // 2. QUEMADO (BURNED) — 3D Orbiting Flame Tongues + Overhead 3D Flame Crown
  // ============================================================================
  const burnedBodyGroup = new THREE.Group();
  burnedBodyGroup.visible = false;

  const flameOuterMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.15,
    roughness: 0.2,
  });
  const flameInnerMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xfacc15,
    emissiveIntensity: 1.35,
    roughness: 0.15,
  });
  const flameCrimsonMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });

  // Incandescent magma vortex ring around waist
  const burnedVortexRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.038, 8, 24),
    flameOuterMat
  );
  burnedVortexRing.rotation.x = Math.PI / 2;
  burnedVortexRing.position.y = 0.52;
  burnedBodyGroup.add(burnedVortexRing);

  // 6 Sculpted 3D Flame Tongues spiraling around the monster
  const burnedFlames: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const flameCluster = new THREE.Group();
    const angle = (i / 6) * Math.PI * 2;
    const radius = 0.48 + (i % 2) * 0.08;

    const outerTongue = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.46, 5),
      i % 2 === 0 ? flameOuterMat : flameCrimsonMat
    );
    outerTongue.position.y = 0.23;
    flameCluster.add(outerTongue);

    const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), flameInnerMat);
    innerCore.scale.set(1, 1.6, 1);
    innerCore.position.y = 0.16;
    flameCluster.add(innerCore);

    flameCluster.position.set(
      Math.cos(angle) * radius,
      0.28 + (i % 3) * 0.22,
      Math.sin(angle) * radius
    );
    flameCluster.userData.baseAngle = angle;
    flameCluster.userData.baseRadius = radius;
    flameCluster.userData.baseY = 0.28 + (i % 3) * 0.22;
    burnedFlames.push(flameCluster);
    burnedBodyGroup.add(flameCluster);
  }
  container.add(burnedBodyGroup);

  // Overhead 3D Blazing Triple-Tongue Fire Crest
  const burnedOverheadIcon = new THREE.Group();
  burnedOverheadIcon.position.set(0, overheadY, 0);
  burnedOverheadIcon.visible = false;

  const centerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.38, 6), flameOuterMat);
  centerFlame.position.y = 0.06;
  burnedOverheadIcon.add(centerFlame);

  const leftFlame = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.28, 5), flameCrimsonMat);
  leftFlame.position.set(-0.12, 0.0, 0);
  leftFlame.rotation.z = 0.38;
  burnedOverheadIcon.add(leftFlame);

  const rightFlame = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.28, 5), flameCrimsonMat);
  rightFlame.position.set(0.12, 0.0, 0);
  rightFlame.rotation.z = -0.38;
  burnedOverheadIcon.add(rightFlame);

  const emberHeart = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), flameInnerMat);
  emberHeart.position.set(0, -0.04, 0.05);
  burnedOverheadIcon.add(emberHeart);
  container.add(burnedOverheadIcon);

  // ============================================================================
  // 3. RALENTIZADO (SLOWED) — 3D Gravity Shackles + Overhead 3D Chrono-Hourglass
  // ============================================================================
  const slowedBodyGroup = new THREE.Group();
  slowedBodyGroup.visible = false;

  const slowCyanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const slowIndigoMat = new THREE.MeshStandardMaterial({
    color: 0x818cf8,
    emissive: 0x4f46e5,
    emissiveIntensity: 0.85,
    roughness: 0.25,
  });

  // Ground hexagram deceleration ring
  const slowGroundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.62, 6),
    slowCyanMat
  );
  slowGroundRing.material.side = THREE.DoubleSide;
  slowGroundRing.rotation.x = -Math.PI / 2;
  slowGroundRing.position.y = 0.04;
  slowedBodyGroup.add(slowGroundRing);

  // Counter-rotating arcane deceleration rings
  const slowedRingA = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.028, 8, 24),
    slowCyanMat
  );
  slowedRingA.rotation.x = Math.PI / 2.3;
  slowedRingA.position.y = 0.45;
  slowedBodyGroup.add(slowedRingA);

  const slowedRingB = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.026, 8, 24),
    slowIndigoMat
  );
  slowedRingB.rotation.x = -Math.PI / 2.3;
  slowedRingB.position.y = 0.45;
  slowedBodyGroup.add(slowedRingB);

  // 4 Orbiting downward-pointing gravity weight chevrons around legs
  const slowedWeightsGroup = new THREE.Group();
  slowedWeightsGroup.position.y = 0.42;
  for (let w = 0; w < 4; w++) {
    const a = (w * Math.PI) / 2;
    const weightCone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 4), slowCyanMat);
    weightCone.rotation.x = Math.PI; // Pointing straight down to indicate heavy slow
    weightCone.position.set(Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56);
    slowedWeightsGroup.add(weightCone);
  }
  slowedBodyGroup.add(slowedWeightsGroup);
  container.add(slowedBodyGroup);

  // Overhead 3D Chrono-Hourglass Icon (twin apex-to-apex pyramids + orbiting ring)
  const slowedOverheadIcon = new THREE.Group();
  slowedOverheadIcon.position.set(0, overheadY, 0);
  slowedOverheadIcon.visible = false;

  const topBulb = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.2, 4), slowCyanMat);
  topBulb.rotation.x = Math.PI;
  topBulb.position.y = 0.1;
  slowedOverheadIcon.add(topBulb);

  const bottomBulb = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.2, 4), slowIndigoMat);
  bottomBulb.position.y = -0.1;
  slowedOverheadIcon.add(bottomBulb);

  const chronoRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.024, 6, 18), slowCyanMat);
  slowedOverheadIcon.add(chronoRing);
  container.add(slowedOverheadIcon);

  return {
    container,
    isBoss,
    frozenBodyGroup,
    frozenOverheadIcon,
    frozenShell,
    burnedBodyGroup,
    burnedOverheadIcon,
    burnedFlames,
    burnedVortexRing,
    slowedBodyGroup,
    slowedOverheadIcon,
    slowedRingA,
    slowedRingB,
    slowedWeightsGroup,
  };
}

/**
 * Updates and animates the 3D Status Effect visual indicators (Congelado, Quemado, Ralentizado)
 * on an enemy model each frame, arranging active 3D overhead icons side-by-side above the health bar.
 */
export function animateEnemyStatusEffects(
  root: THREE.Group,
  phase: number,
  isFrozen: boolean,
  isBurned: boolean,
  isSlowed: boolean
) {
  const statusRig = root.userData.statusRig as EnemyStatusIndicatorsRig | undefined;
  if (!statusRig) return;

  statusRig.frozenBodyGroup.visible = isFrozen;
  statusRig.frozenOverheadIcon.visible = isFrozen;

  statusRig.burnedBodyGroup.visible = isBurned;
  statusRig.burnedOverheadIcon.visible = isBurned;

  // Show slowed body shackles when slowed (even if not frozen, or alongside burn)
  statusRig.slowedBodyGroup.visible = isSlowed && !isFrozen;
  statusRig.slowedOverheadIcon.visible = isSlowed;

  // Arrange active overhead 3D status icons evenly side-by-side above the health bar
  const activeOverheadIcons: THREE.Group[] = [];
  if (isFrozen) activeOverheadIcons.push(statusRig.frozenOverheadIcon);
  if (isBurned) activeOverheadIcons.push(statusRig.burnedOverheadIcon);
  if (isSlowed) activeOverheadIcons.push(statusRig.slowedOverheadIcon);

  const baseOverheadY = statusRig.isBoss ? 2.78 : 1.98;
  const spacing = 0.46;
  activeOverheadIcons.forEach((icon, idx) => {
    const offsetX = (idx - (activeOverheadIcons.length - 1) / 2) * spacing;
    icon.position.x = offsetX;
    icon.position.y = baseOverheadY + Math.sin(phase * 4.2 + idx * 1.3) * 0.05;
  });

  // 1. Animate CONGELADO (Frozen) 3D Crystals & Overhead Snowflake
  if (isFrozen) {
    statusRig.frozenOverheadIcon.rotation.y = phase * 2.4;
    statusRig.frozenOverheadIcon.rotation.z = Math.sin(phase * 3.0) * 0.18;
    const pulse = 1 + Math.sin(phase * 6.0) * 0.04;
    statusRig.frozenShell.scale.set(0.95 * pulse, 1.35 * pulse, 0.95 * pulse);
  }

  // 2. Animate QUEMADO (Burned) 3D Orbiting Flame Tongues & Overhead Fire Crown
  if (isBurned) {
    statusRig.burnedOverheadIcon.rotation.y = phase * 3.2;
    const crownFlicker = 1 + Math.sin(phase * 18.0) * 0.12;
    statusRig.burnedOverheadIcon.scale.set(1, crownFlicker, 1);

    statusRig.burnedVortexRing.rotation.z = -phase * 4.5;
    const vortexScale = 1 + Math.sin(phase * 10.0) * 0.08;
    statusRig.burnedVortexRing.scale.set(vortexScale, vortexScale, 1);

    statusRig.burnedFlames.forEach((flame, idx) => {
      const baseAngle = (flame.userData.baseAngle as number) ?? 0;
      const baseRadius = (flame.userData.baseRadius as number) ?? 0.5;
      const baseY = (flame.userData.baseY as number) ?? 0.35;
      const orbitAngle = baseAngle + phase * 3.8;
      flame.position.x = Math.cos(orbitAngle) * baseRadius;
      flame.position.z = Math.sin(orbitAngle) * baseRadius;
      flame.position.y = baseY + Math.sin(phase * 9.0 + idx * 1.7) * 0.12;
      const flickerY = 0.85 + Math.abs(Math.sin(phase * 16.0 + idx * 2.1)) * 0.45;
      flame.scale.set(1, flickerY, 1);
      flame.rotation.y = -orbitAngle;
    });
  }

  // 3. Animate RALENTIZADO (Slowed) 3D Gravity Rings & Overhead Chrono-Hourglass
  if (isSlowed) {
    statusRig.slowedOverheadIcon.rotation.y = phase * 2.2;
    statusRig.slowedOverheadIcon.rotation.z = Math.sin(phase * 2.5) * 0.25;

    statusRig.slowedRingA.rotation.z = phase * 2.6;
    statusRig.slowedRingB.rotation.z = -phase * 2.6;
    statusRig.slowedWeightsGroup.rotation.y = -phase * 1.8;
    statusRig.slowedWeightsGroup.position.y = 0.38 + Math.sin(phase * 5.5) * 0.06;
  }
}

/**
 * Builds the player-summoned Allied Monster Guardian (Heroic Emerald-Turquoise Sulley Champion).
 */
export function buildAlliedGolemModel(): THREE.Group {
  const root = new THREE.Group();
  root.add(createContactShadowMesh(0.9));

  const guardianFurMat = new THREE.MeshPhysicalMaterial({
    map: createSpottedFurTexture('#10b981', '#0284c7'),
    roughness: 0.62,
    sheen: 1.0,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color('#6ee7b7'),
  });

  const goldArmorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.8,
  });

  const hornIvoryMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.08,
    clearcoat: 0.5,
  });

  const bodyGroup = new THREE.Group();
  const torso = new THREE.Group();
  torso.position.y = 0.82;
  bodyGroup.add(torso);

  // Muscular Emerald-Spotted Furry Chest
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.36, 12, 18), guardianFurMat);
  chest.scale.set(1.28, 1.06, 1.02);
  chest.castShadow = true;
  chest.receiveShadow = true;
  torso.add(chest);

  // Golden Monsters Inc. "M" Crest Badge on Chest
  const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), goldArmorMat);
  coreMesh.position.set(0, 0.08, 0.38);
  torso.add(coreMesh);

  // Friendly yet Fierce Guardian Monster Head
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.08);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 16), guardianFurMat);
  skull.scale.set(1.14, 1.04, 1.08);
  skull.castShadow = true;
  head.add(skull);

  const eyelids: THREE.Object3D[] = [];
  [-1, 1].forEach((side) => {
    const { eyeGroup, upperLid } = createRealisticEye(0.08, '#10b981', guardianFurMat, false);
    eyeGroup.position.set(side * 0.12, 0.06, 0.25);
    head.add(eyeGroup);
    eyelids.push(upperLid);

    const horn = createCurvedMonsterHorn(0.07, 0.38, side, hornIvoryMat);
    horn.position.set(side * 0.22, 0.15, -0.02);
    head.add(horn);
  });

  const jaw = createMonsterJaw(0.38, 0.32, guardianFurMat, hornIvoryMat, true);
  jaw.position.set(0, -0.14, 0.14);
  head.add(jaw);
  torso.add(head);

  // Thick Furry Tail
  const tail = new THREE.Group();
  tail.position.set(0, -0.28, -0.32);
  const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.58, 10), guardianFurMat);
  tailMesh.rotation.x = -Math.PI / 2.4;
  tailMesh.position.set(0, -0.06, -0.24);
  tail.add(tailMesh);
  torso.add(tail);

  const leftArm = createOrganicMonsterArm(
    -0.52,
    0.22,
    0.68,
    0.15,
    guardianFurMat,
    hornIvoryMat,
    'claw_gauntlet',
    goldArmorMat
  );
  const rightArm = createOrganicMonsterArm(
    0.52,
    0.22,
    0.68,
    0.15,
    guardianFurMat,
    hornIvoryMat,
    'claw_gauntlet',
    goldArmorMat
  );
  torso.add(leftArm);
  torso.add(rightArm);

  const leftLeg = createOrganicMonsterLeg(-0.24, 0.56, 0.56, 0.15, guardianFurMat, hornIvoryMat);
  const rightLeg = createOrganicMonsterLeg(0.24, 0.56, 0.56, 0.15, guardianFurMat, hornIvoryMat);
  bodyGroup.add(leftLeg);
  bodyGroup.add(rightLeg);

  const rig: CharacterRig = {
    bodyGroup,
    torso,
    head,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    jaw,
    tail,
    eyelids,
    coreMesh,
    isFloating: false,
    baseY: 0.82,
  };

  root.add(bodyGroup);
  root.scale.setScalar(1.25);
  root.userData.bodyGroup = bodyGroup;
  root.userData.rig = rig;
  return root;
}

/**
 * Animates a realistic Monster CharacterRig procedurally each frame:
 * - Organic walk stride + secondary crab legs
 * - Primary & secondary 4-arm swing + overhead roar/smash attack
 * - Articulated lower jaw chomping & roaring
 * - Periodic realistic eyelid blinking
 * - Independent eye-stalk bobbing & prehensile tail sway
 */
export function animateCharacterModel(
  root: THREE.Group,
  phase: number,
  isMoving: boolean,
  attackBounce: number,
  isStunned: boolean
) {
  const rig = root.userData.rig as CharacterRig | undefined;
  if (!rig) return;

  if (isStunned) {
    rig.head.rotation.z = Math.sin(phase * 22) * 0.05;
    if (rig.jaw) rig.jaw.rotation.x = 0.25;
    return;
  }

  const walkCycle = phase * 8.5;
  const strideAmp = isMoving ? 0.62 : 0.08;

  // 1. Primary Leg Stride Cycle
  if (rig.leftLeg && rig.rightLeg) {
    rig.leftLeg.rotation.x = Math.sin(walkCycle) * strideAmp;
    rig.rightLeg.rotation.x = -Math.sin(walkCycle) * strideAmp;
  }

  // 1b. Extra Arachnid Crab Legs (Waternoose Boss)
  if (rig.extraLegs) {
    rig.extraLegs.forEach((leg, idx) => {
      const offset = idx * 1.4;
      leg.rotation.x = Math.sin(walkCycle + offset) * strideAmp * 0.75;
    });
  }

  // 2. Arm Swing & Roaring Smash Animation
  if (rig.leftArm && rig.rightArm) {
    if (attackBounce > 0) {
      const slamAngle = -Math.sin(attackBounce * Math.PI) * 1.5;
      rig.leftArm.rotation.x = slamAngle;
      rig.rightArm.rotation.x = slamAngle;
      rig.torso.rotation.x = Math.sin(attackBounce * Math.PI) * 0.28;
    } else {
      rig.leftArm.rotation.x = -Math.sin(walkCycle) * strideAmp * 0.85;
      rig.rightArm.rotation.x = Math.sin(walkCycle) * strideAmp * 0.85;
      rig.leftArm.rotation.z = -0.08 - Math.cos(walkCycle * 0.5) * 0.06;
      rig.rightArm.rotation.z = 0.08 + Math.cos(walkCycle * 0.5) * 0.06;
      rig.torso.rotation.x = isMoving ? 0.08 : 0;
    }
  }

  // 2b. Secondary Chameleon Arms (Randall 4-arm gait)
  if (rig.extraArms) {
    rig.extraArms.forEach((arm, idx) => {
      const dir = idx === 0 ? 1 : -1;
      arm.rotation.x = dir * Math.cos(walkCycle) * strideAmp * 0.7;
    });
  }

  // 3. Heavy Organic Torso Bounce, Breathing & Hip Sway
  const breathScale = 1 + Math.sin(phase * 3.5) * 0.025;
  rig.torso.scale.set(breathScale, 1 / breathScale, breathScale);
  rig.torso.position.y =
    rig.baseY + Math.abs(Math.cos(walkCycle)) * (isMoving ? 0.095 : 0.02);
  rig.torso.rotation.y = Math.sin(walkCycle) * (isMoving ? 0.14 : 0.03);
  rig.torso.rotation.z = Math.cos(walkCycle) * (isMoving ? 0.05 : 0.01);

  // 4. Head Look & Expressive Tilt
  rig.head.rotation.y = -rig.torso.rotation.y * 0.55 + Math.sin(walkCycle * 0.5) * 0.12;
  rig.head.rotation.x = Math.sin(walkCycle * 2) * 0.05;

  // 5. Articulated Jaw Chomping & Roaring
  if (rig.jaw) {
    if (attackBounce > 0) {
      // Wide monster roar during attack
      rig.jaw.rotation.x = 0.55 * Math.sin(attackBounce * Math.PI);
    } else {
      // Natural breathing / chomping while marching
      rig.jaw.rotation.x = 0.08 + Math.max(0, Math.sin(phase * 5.2)) * 0.22;
    }
  }

  // 6. Realistic Periodic Eyelid Blinking
  if (rig.eyelids && rig.eyelids.length > 0) {
    // Blink pulse every ~3.4 seconds
    const blinkWave = Math.sin(phase * 1.85);
    const blinkAmount = blinkWave > 0.94 ? (blinkWave - 0.94) / 0.06 : 0;
    rig.eyelids.forEach((lid) => {
      const baseRot = (lid.userData.baseRotX as number) ?? -0.35;
      lid.rotation.x = baseRot + blinkAmount * 1.15;
    });
  }

  // 7. Independent Eye Stalks Wobble
  if (rig.eyeStalks) {
    rig.eyeStalks.forEach((stalk, idx) => {
      stalk.rotation.x = Math.sin(walkCycle * 1.3 + idx) * 0.22;
    });
  }

  // 8. Prehensile / Dinosaur Tail Wag
  if (rig.tail) {
    rig.tail.rotation.y = Math.sin(walkCycle * 0.9) * 0.36;
    rig.tail.rotation.x = Math.cos(walkCycle * 1.8) * 0.08;
  }

  // 9. Orbiting Scream Canisters / Halo Spin
  if (rig.wingsOrHalo) {
    rig.wingsOrHalo.rotation.z = phase * 1.6;
  }

  if (rig.coreMesh) {
    rig.coreMesh.rotation.y = phase * 2.2;
  }

  // 10. 2.5D Character Sprite Billboard Walk Waddle & Squash-Stretch
  if (rig.spriteBillboard) {
    const tilt = Math.sin(walkCycle) * (isMoving ? 0.09 : 0.015);
    rig.spriteBillboard.material.rotation = tilt;
    const squash = 1 + Math.sin(walkCycle * 2) * (isMoving ? 0.045 : 0.015);
    rig.spriteBillboard.scale.set(1.42 / squash, 1.42 * squash, 1);
  }
}

/**
 * Builds the Void Spawn Portal (`Portal de Aparición del Vacío` — `VOID SPAWN PORTAL`)
 * modeled directly after the user's reference concept sheet:
 * - Cracked Dark-Obsidian & Ancient-Stone stepped foundation with glowing Arcane-Gold ember fissures & a Magenta-Violet Runic Summoning Circle at the threshold
 * - Monumental upright Circular Segmented Runic Stone Archway Ring (18 chiseled Ancient-Stone & Obsidian-Stone voussoirs with glowing Violet-Magenta runes)
 * - Heavy stepped side buttress pedestals & ribbed Arcane-Gold / Copper solenoid conduits wrapping the upper crown and lower flanks
 * - Grand Top Crown Keystone housing a large multifaceted glowing Void-Purple Diamond Crystal + lower threshold diamond crystal
 * - Colossal Swirling Black-Hole & Purple-White Void Vortex spinning inside the ring with 8 crackling 3D Violet-White Lightning Tendrils
 * - Twin Flanking Jagged Dark-Obsidian & Void-Crystal Obelisk Monoliths + floating Dark-Obsidian Shadow Wisp Orbs with glowing eyes
 */
export function buildVoidSpawnPortalModel(): THREE.Group {
  const root = new THREE.Group();
  root.add(createContactShadowMesh(2.35));

  // Orient the portal slightly behind the tile center (-X) and angled toward (+X, +Z) so mobs emerge cleanly onto the road and the isometric camera sees the full 3/4 face
  const portalGroup = new THREE.Group();
  portalGroup.position.set(-0.28, 0, -0.06);
  portalGroup.rotation.y = -0.34;
  root.add(portalGroup);

  // ============================================================================
  // 1. MATERIAL PALETTE (Dark Obsidian, Obsidian Stone, Ancient Stone, Void Purple, Arcane Gold, Void-Ash Gray)
  // ============================================================================
  const darkObsidianMat = new THREE.MeshPhysicalMaterial({
    color: 0x161224,
    roughness: 0.26,
    metalness: 0.48,
    clearcoat: 0.68,
  });
  const obsidianStoneMat = new THREE.MeshStandardMaterial({
    color: 0x2c253b,
    roughness: 0.72,
    metalness: 0.22,
  });
  const ancientStoneMat = new THREE.MeshStandardMaterial({
    color: 0x4f445d,
    roughness: 0.78,
    metalness: 0.16,
  });
  const voidAshGrayMat = new THREE.MeshStandardMaterial({
    color: 0x575366,
    roughness: 0.75,
    metalness: 0.18,
  });
  const warmBronzeStoneMat = new THREE.MeshStandardMaterial({
    color: 0x6b482e,
    roughness: 0.68,
    metalness: 0.32,
  });
  const arcaneGoldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd99b26,
    emissive: 0x92400e,
    emissiveIntensity: 0.3,
    roughness: 0.24,
    metalness: 0.9,
  });
  const copperConduitMat = new THREE.MeshPhysicalMaterial({
    color: 0xc26a27,
    emissive: 0x78350f,
    emissiveIntensity: 0.22,
    roughness: 0.28,
    metalness: 0.86,
    clearcoat: 0.55,
  });
  const voidPurpleCrystalMat = new THREE.MeshStandardMaterial({
    color: 0xd8b4fe,
    emissive: 0x9333ea,
    emissiveIntensity: 1.65,
    roughness: 0.12,
    metalness: 0.2,
  });
  const magentaRuneMat = new THREE.MeshStandardMaterial({
    color: 0xf0abfc,
    emissive: 0xc026d3,
    emissiveIntensity: 1.55,
    roughness: 0.14,
  });
  const lightningArcMat = new THREE.MeshBasicMaterial({
    color: 0xf5d0fe,
  });
  const emberFissureMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
  });

  // ============================================================================
  // 2. STEPPED OBSIDIAN DAIS, GOLDEN EMBER FISSURES & RUNIC SUMMONING CIRCLE
  // ============================================================================
  const lowerRockPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.62, 1.82, 0.2, 8),
    darkObsidianMat
  );
  lowerRockPlinth.rotation.y = Math.PI / 8;
  lowerRockPlinth.position.y = 0.1;
  lowerRockPlinth.receiveShadow = true;
  lowerRockPlinth.castShadow = true;
  portalGroup.add(lowerRockPlinth);

  const upperStonePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.36, 1.52, 0.16, 8),
    obsidianStoneMat
  );
  upperStonePlinth.rotation.y = Math.PI / 8;
  upperStonePlinth.position.y = 0.24;
  upperStonePlinth.receiveShadow = true;
  upperStonePlinth.castShadow = true;
  portalGroup.add(upperStonePlinth);

  // Glowing Magenta-Purple Runic Summoning Circle on the stone threshold (+X side in front of the portal)
  const summonDiscGeo = new THREE.PlaneGeometry(1.65, 1.65);
  summonDiscGeo.rotateX(-Math.PI / 2);
  const summonDiscMat = new THREE.MeshBasicMaterial({
    map: createVoidSpireRuneRingTexture(),
    transparent: true,
    depthWrite: false,
  });
  const summonDisc = new THREE.Mesh(summonDiscGeo, summonDiscMat);
  summonDisc.position.set(0.38, 0.326, 0);
  portalGroup.add(summonDisc);

  // Glowing Arcane-Gold / Amber Fissure Cracks at the front threshold (matching the concept sheet!)
  for (let f = 0; f < 5; f++) {
    const fAngle = (f - 2) * 0.38;
    const fissure = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.018, 0.032),
      emberFissureMat
    );
    fissure.position.set(
      0.88 + Math.cos(fAngle) * 0.22,
      0.325,
      Math.sin(fAngle) * 0.58
    );
    fissure.rotation.y = -fAngle + 0.25;
    portalGroup.add(fissure);
  }

  // ============================================================================
  // 3. MONUMENTAL CIRCULAR SEGMENTED RUNIC STONE ARCHWAY RING (STARGATE)
  // ============================================================================
  const ringCenterY = 1.42;
  const ringRadius = 1.12;

  // Inner metallic dark-obsidian structural core ring
  const coreTorus = new THREE.Mesh(
    new THREE.TorusGeometry(ringRadius, 0.16, 12, 36),
    obsidianStoneMat
  );
  coreTorus.rotation.y = Math.PI / 2;
  coreTorus.position.set(0, ringCenterY, 0);
  coreTorus.castShadow = true;
  coreTorus.receiveShadow = true;
  portalGroup.add(coreTorus);

  // Glowing inner violet plasma rim ring
  const innerRimTorus = new THREE.Mesh(
    new THREE.TorusGeometry(ringRadius - 0.13, 0.042, 10, 36),
    voidPurpleCrystalMat
  );
  innerRimTorus.rotation.y = Math.PI / 2;
  innerRimTorus.position.set(0.02, ringCenterY, 0);
  portalGroup.add(innerRimTorus);

  // 18 Segmented Chiseled Stone Voussoir Arch Blocks + Glowing Carved Violet-Magenta Runes around the circle
  const numVoussoirs = 18;
  for (let v = 0; v < numVoussoirs; v++) {
    const theta = (v / numVoussoirs) * Math.PI * 2;
    // Skip bottom-most block buried in the dais
    if (Math.sin(theta) < -0.88) continue;

    const voussoirGroup = new THREE.Group();
    const vy = ringCenterY + Math.sin(theta) * ringRadius;
    const vz = Math.cos(theta) * ringRadius;
    voussoirGroup.position.set(0, vy, vz);
    voussoirGroup.rotation.x = -theta;

    const stoneBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.28, 0.34),
      v % 2 === 0 ? ancientStoneMat : voidAshGrayMat
    );
    stoneBlock.castShadow = true;
    stoneBlock.receiveShadow = true;
    voussoirGroup.add(stoneBlock);

    // Chiseled outer stone bevel cap
    const outerBevel = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.08),
      darkObsidianMat
    );
    outerBevel.position.set(0, 0, 0.18);
    voussoirGroup.add(outerBevel);

    // Glowing Violet-Magenta Runes carved onto the front (+X) and back (-X) faces of each stone block
    [-0.185, 0.185].forEach((xFace) => {
      const runeMain = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.13, 0.042),
        v % 3 === 0 ? voidPurpleCrystalMat : magentaRuneMat
      );
      runeMain.position.set(xFace, 0, 0);
      runeMain.rotation.x = ((v % 3) - 1) * 0.28;
      voussoirGroup.add(runeMain);

      const runeCross = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.032, 0.11),
        magentaRuneMat
      );
      runeCross.position.set(xFace, (v % 2 === 0 ? 1 : -1) * 0.025, 0);
      runeCross.rotation.x = 0.45;
      voussoirGroup.add(runeCross);
    });

    portalGroup.add(voussoirGroup);
  }

  // Heavy Stepped Side Buttresses & Warm Bronze-Gold Anchor Feet (Left & Right Lower Flanks)
  [-1, 1].forEach((zSide) => {
    const buttressGroup = new THREE.Group();
    buttressGroup.position.set(0, 0.32, zSide * 1.06);

    const lowerFoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.34, 0.56),
      warmBronzeStoneMat
    );
    lowerFoot.position.set(0.06, 0.15, zSide * 0.12);
    lowerFoot.castShadow = true;
    lowerFoot.receiveShadow = true;
    buttressGroup.add(lowerFoot);

    const upperButtress = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.62, 0.42),
      ancientStoneMat
    );
    upperButtress.position.set(0, 0.52, 0);
    upperButtress.rotation.x = -zSide * 0.22;
    upperButtress.castShadow = true;
    buttressGroup.add(upperButtress);

    const goldClamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.1, 0.46),
      arcaneGoldMat
    );
    goldClamp.position.set(0, 0.82, -zSide * 0.06);
    buttressGroup.add(goldClamp);

    portalGroup.add(buttressGroup);
  });

  // ============================================================================
  // 4. TOP CROWN DIAMOND KEYSTONE, LOWER THRESHOLD CRYSTAL & RIBBED COPPER CONDUITS
  // ============================================================================
  // Grand Top Crown Keystone at 12 o'clock apex
  const topKeystoneGroup = new THREE.Group();
  topKeystoneGroup.position.set(0, ringCenterY + ringRadius + 0.08, 0);

  const keystoneBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.46, 0.52),
    ancientStoneMat
  );
  keystoneBlock.castShadow = true;
  topKeystoneGroup.add(keystoneBlock);

  const goldDiamondFrame = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    arcaneGoldMat
  );
  goldDiamondFrame.scale.set(0.65, 1.35, 0.95);
  goldDiamondFrame.position.set(0.14, -0.02, 0);
  topKeystoneGroup.add(goldDiamondFrame);

  const topDiamondCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.23, 0),
    voidPurpleCrystalMat
  );
  topDiamondCrystal.scale.set(0.72, 1.38, 0.88);
  topDiamondCrystal.position.set(0.2, -0.02, 0);
  topDiamondCrystal.userData.baseY = -0.02;
  topKeystoneGroup.add(topDiamondCrystal);
  portalGroup.add(topKeystoneGroup);

  // Lower Threshold Keystone Crystal at 6 o'clock base
  const bottomBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.28, 0.44),
    darkObsidianMat
  );
  bottomBracket.position.set(0.12, 0.42, 0);
  portalGroup.add(bottomBracket);

  const bottomDiamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    voidPurpleCrystalMat
  );
  bottomDiamond.scale.set(0.65, 1.35, 0.85);
  bottomDiamond.position.set(0.3, 0.46, 0);
  portalGroup.add(bottomDiamond);

  // Curved Ribbed Copper-Gold Solenoid Conduits wrapping the outer rim of the Stone Portal Ring
  [-1, 1].forEach((zSide) => {
    const conduitPoints: THREE.Vector3[] = [];
    const numPts = 14;
    for (let i = 0; i <= numPts; i++) {
      const t = i / numPts;
      // Arc from lower buttress (theta ~ 0.15) up to the top keystone (theta ~ 1.38)
      const angle = 0.12 + t * 1.26;
      const r = ringRadius + 0.22;
      conduitPoints.push(
        new THREE.Vector3(
          -0.04,
          ringCenterY + Math.sin(angle) * r,
          zSide * Math.cos(angle) * r
        )
      );
    }
    const conduitCurve = new THREE.CatmullRomCurve3(conduitPoints);
    const conduitTube = new THREE.Mesh(
      new THREE.TubeGeometry(conduitCurve, 20, 0.052, 8, false),
      warmBronzeStoneMat
    );
    conduitTube.castShadow = true;
    portalGroup.add(conduitTube);

    for (let r = 1; r < 12; r++) {
      const t = r / 12;
      const pt = conduitCurve.getPoint(t);
      const tangent = conduitCurve.getTangent(t);
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.064, 0.016, 6, 12),
        r % 4 === 0 ? voidPurpleCrystalMat : copperConduitMat
      );
      rib.position.copy(pt);
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      portalGroup.add(rib);
    }
  });

  // ============================================================================
  // 5. SWIRLING BLACK-HOLE PURPLE VORTEX, CRACKLING LIGHTNING & SHADOW WISPS
  // ============================================================================
  // Plane group oriented facing +X (normal along +X) so child .rotation.z spins in-plane inside the circular ring
  const vortexPlaneGroup = new THREE.Group();
  vortexPlaneGroup.position.set(0, ringCenterY, 0);
  vortexPlaneGroup.rotation.y = Math.PI / 2;
  portalGroup.add(vortexPlaneGroup);

  // Primary Swirling Black-Hole & Violet Singularity Disc inside the circular ring
  const vortexMat = new THREE.MeshBasicMaterial({
    map: createCastleBlackHoleVortexTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const voidSingularity = new THREE.Mesh(
    new THREE.CircleGeometry(ringRadius - 0.12, 36),
    vortexMat
  );
  vortexPlaneGroup.add(voidSingularity);
  root.userData.voidSingularity = voidSingularity;

  // Counter-rotating inner lavender-purple spiral overlay disc + pitch-black 3D event horizon core
  const innerSwirlMat = new THREE.MeshBasicMaterial({
    map: createVoidSpireVortexTexture(),
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerSwirlDisc = new THREE.Mesh(
    new THREE.CircleGeometry((ringRadius - 0.18) * 0.82, 32),
    innerSwirlMat
  );
  innerSwirlDisc.position.z = 0.03;
  vortexPlaneGroup.add(innerSwirlDisc);
  root.userData.innerSwirlDisc = innerSwirlDisc;

  const blackHoleCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 14),
    new THREE.MeshBasicMaterial({ color: 0x020005 })
  );
  blackHoleCore.scale.set(1.0, 1.0, 0.32);
  blackHoleCore.position.z = 0.04;
  vortexPlaneGroup.add(blackHoleCore);

  // 8 Crackling 3D Violet-White Lightning Tendrils arcing inward from the stone ring rim
  const lightningGroup = new THREE.Group();
  lightningGroup.position.z = 0.06;
  for (let l = 0; l < 8; l++) {
    const lAngle = (l / 8) * Math.PI * 2 + 0.2;
    const outerR = ringRadius - 0.14;
    const midR = outerR * 0.66;
    const innerR = outerR * 0.36;
    const p0 = new THREE.Vector3(Math.cos(lAngle) * outerR, Math.sin(lAngle) * outerR, 0);
    const p1 = new THREE.Vector3(
      Math.cos(lAngle + 0.22) * midR,
      Math.sin(lAngle + 0.22) * midR,
      0.06
    );
    const p2 = new THREE.Vector3(
      Math.cos(lAngle - 0.15) * innerR,
      Math.sin(lAngle - 0.15) * innerR,
      0.03
    );
    const boltCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
    const boltMesh = new THREE.Mesh(
      new THREE.TubeGeometry(boltCurve, 6, 0.016, 5, false),
      l % 2 === 0 ? lightningArcMat : magentaRuneMat
    );
    lightningGroup.add(boltMesh);
  }
  vortexPlaneGroup.add(lightningGroup);
  root.userData.ring = lightningGroup as unknown as THREE.Mesh;

  // 3 Floating Shadowy Void Wisp Orbs with Glowing Eyes emerging from the portal (matching concept art!)
  const wispOffsets: Array<[number, number, number, number]> = [
    [0.32, 1.18, 0.86, 0.14],
    [0.44, 0.86, 1.12, 0.12],
    [0.24, 1.76, -0.42, 0.11],
  ];
  wispOffsets.forEach(([wx, wy, wz, wr]) => {
    const wispGroup = new THREE.Group();
    wispGroup.position.set(wx, wy, wz);

    const wispBody = new THREE.Mesh(
      new THREE.SphereGeometry(wr, 12, 10),
      darkObsidianMat
    );
    wispGroup.add(wispBody);

    const wispAura = new THREE.Mesh(
      new THREE.SphereGeometry(wr * 1.32, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      })
    );
    wispGroup.add(wispAura);

    // Glowing menacing white-violet eyes
    [-0.042, 0.042].forEach((ez) => {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.028, 0.036),
        lightningArcMat
      );
      eye.position.set(wr * 0.88, 0.02, ez);
      eye.rotation.x = ez > 0 ? -0.25 : 0.25;
      wispGroup.add(eye);
    });

    portalGroup.add(wispGroup);
  });

  // ============================================================================
  // 6. TWIN FLANKING JAGGED DARK-OBSIDIAN & VOID-CRYSTAL OBELISK MONOLITHS
  // ============================================================================
  [-1, 1].forEach((zSide) => {
    const monolithGroup = new THREE.Group();
    monolithGroup.position.set(-0.18, 0.2, zSide * 1.54);
    monolithGroup.rotation.x = zSide * 0.16;
    monolithGroup.rotation.z = 0.08;

    const spireHeight = zSide < 0 ? 1.72 : 1.56;
    const mainMonolith = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, spireHeight, 5),
      darkObsidianMat
    );
    mainMonolith.position.y = spireHeight * 0.48;
    mainMonolith.castShadow = true;
    mainMonolith.receiveShadow = true;
    monolithGroup.add(mainMonolith);

    // Embedded Glowing Void-Purple Crystal Shards & Veins erupting from the Obsidian Monolith
    for (let c = 0; c < 4; c++) {
      const cAngle = (c / 4) * Math.PI * 2 + 0.4;
      const shardH = 0.48 + (c % 2) * 0.24;
      const crystalShard = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, shardH, 4),
        c % 2 === 0 ? voidPurpleCrystalMat : magentaRuneMat
      );
      crystalShard.position.set(
        Math.cos(cAngle) * 0.18,
        0.28 + c * 0.22,
        Math.sin(cAngle) * 0.18
      );
      crystalShard.rotation.z = -Math.cos(cAngle) * 0.42;
      crystalShard.rotation.x = Math.sin(cAngle) * 0.42;
      monolithGroup.add(crystalShard);
    }

    portalGroup.add(monolithGroup);
  });

  return root;
}

/**
 * Builds the Astral Sanctuary Core (Goal structure) or Void Spawn Portal (Spawn structure).
 */
export function buildPortalOrCoreModel(isGoal: boolean, colorHex: string): THREE.Group {
  if (!isGoal) {
    return buildVoidSpawnPortalModel();
  }

  const root = new THREE.Group();
  root.add(createContactShadowMesh(1.2));

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.2,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.75,
  });

  const energyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.2,
  });

  const dais = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.88, 0.24, 8), stoneMat);
  dais.position.y = 0.12;
  dais.receiveShadow = true;
  root.add(dais);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.08, 10, 28), frameMat);
  ring.position.y = 1.02;
  ring.castShadow = true;
  root.add(ring);

  const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), energyMat);
  coreCrystal.position.y = 1.02;
  root.add(coreCrystal);

  root.userData.coreCrystal = coreCrystal;
  root.userData.ring = ring;

  return root;
}

/**
 * Builds a natural crystal cluster obstacle for map tiles.
 */
export function buildCrystalObstacleModel(stoneHex: string, crystalHex: string): THREE.Group {
  const root = new THREE.Group();
  root.add(createContactShadowMesh(0.85));

  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(stoneHex),
    roughness: 0.88,
    metalness: 0.12,
  });

  const crystalMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(crystalHex),
    emissive: new THREE.Color(crystalHex),
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.35,
  });

  const baseRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), rockMat);
  baseRock.scale.set(1.2, 0.65, 1.1);
  baseRock.position.y = 0.28;
  baseRock.castShadow = true;
  baseRock.receiveShadow = true;
  root.add(baseRock);

  const angles = [0, 2.1, 4.2];
  angles.forEach((a, idx) => {
    const h = 0.85 + (idx % 2) * 0.35;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.18, h, 5), crystalMat);
    shard.position.set(Math.cos(a) * 0.22, h * 0.48, Math.sin(a) * 0.22);
    shard.rotation.z = (idx - 1) * 0.24;
    shard.rotation.x = (idx % 2 === 0 ? 1 : -1) * 0.18;
    shard.castShadow = true;
    root.add(shard);
  });

  return root;
}

/**
 * Builds an Octagonal Stone Tower Pedestal matching the carved stone pads in the reference valley map.
 */
export function buildOctagonalTowerPedestalModel(isSubtleTerrace = false): THREE.Group {
  const root = new THREE.Group();
  const bumpTex = getMonsterMicroBumpTexture();

  if (isSubtleTerrace) {
    // Subtle mossy stone ring on secondary buildable grass cells so the valley stays natural
    const subtleMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      bumpMap: bumpTex,
      bumpScale: 0.06,
      roughness: 0.9,
      metalness: 0.08,
      transparent: true,
      opacity: 0.55,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.58, 8), subtleMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.018;
    ring.receiveShadow = true;
    root.add(ring);
    return root;
  }

  root.add(createContactShadowMesh(0.98));

  const outerStoneMat = new THREE.MeshStandardMaterial({
    color: 0x4b4659,
    bumpMap: bumpTex,
    bumpScale: 0.09,
    roughness: 0.82,
    metalness: 0.18,
  });
  const midTrimMat = new THREE.MeshStandardMaterial({
    color: 0x2e2a3b,
    bumpMap: bumpTex,
    bumpScale: 0.07,
    roughness: 0.72,
    metalness: 0.28,
  });
  const topSlabMat = new THREE.MeshStandardMaterial({
    color: 0x8b8499,
    bumpMap: bumpTex,
    bumpScale: 0.06,
    roughness: 0.68,
    metalness: 0.2,
  });
  const runeGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    roughness: 0.25,
  });
  const cyanFloraMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.95,
  });

  // 1. Stepped outer octagonal stone foundation sunk slightly into the terrain
  const baseFoundation = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.96, 0.2, 8),
    outerStoneMat
  );
  baseFoundation.rotation.y = Math.PI / 8;
  baseFoundation.position.y = 0.03;
  baseFoundation.castShadow = true;
  baseFoundation.receiveShadow = true;
  root.add(baseFoundation);

  // 2. Dark slate recessed bevel ring
  const midRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.81, 0.09, 8),
    midTrimMat
  );
  midRing.rotation.y = Math.PI / 8;
  midRing.position.y = 0.14;
  midRing.castShadow = true;
  midRing.receiveShadow = true;
  root.add(midRing);

  // 3. Flat warm-stone octagonal top platform slab
  const topSlab = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.72, 0.08, 8),
    topSlabMat
  );
  topSlab.rotation.y = Math.PI / 8;
  topSlab.position.y = 0.2;
  topSlab.receiveShadow = true;
  root.add(topSlab);

  // 4. 8 Chiseled corner curb blocks around the octagon perimeter
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.12), outerStoneMat);
    block.position.set(Math.cos(angle) * 0.72, 0.21, Math.sin(angle) * 0.72);
    block.rotation.y = -angle + Math.PI / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    root.add(block);
  }

  // 5. Subtle engraved rune border on top slab
  const runeRing = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.51, 8), runeGlowMat);
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.rotation.z = Math.PI / 8;
  runeRing.position.y = 0.244;
  root.add(runeRing);

  // Small mossy stones & glowing cyan flower at pedestal base
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), outerStoneMat);
  rock.scale.set(1.2, 0.7, 1.0);
  rock.position.set(0.78, 0.04, 0.42);
  root.add(rock);

  const flower = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), cyanFloraMat);
  flower.position.set(-0.76, 0.08, 0.44);
  root.add(flower);

  return root;
}

// Shared materials cache for Runic Void Tree Groves to maximize WebGL performance across map obstacles & perimeter forests
let _runicTreeMaterials: {
  darkObsidianBark: THREE.MeshPhysicalMaterial;
  obsidianStone: THREE.MeshStandardMaterial;
  organicMossSoil: THREE.MeshStandardMaterial;
  ancientBronzeBark: THREE.MeshStandardMaterial;
  crimsonBark: THREE.MeshStandardMaterial;
  ashGrayFoliage: THREE.MeshStandardMaterial;
  voidPurpleDeepFoliage: THREE.MeshStandardMaterial;
  voidPurpleMidFoliage: THREE.MeshStandardMaterial;
  crimsonDeepFoliage: THREE.MeshStandardMaterial;
  crimsonBrightFoliage: THREE.MeshStandardMaterial;
  arcaneGoldFoliage: THREE.MeshStandardMaterial;
  goldenHeartGlow: THREE.MeshStandardMaterial;
  magentaRuneGlow: THREE.MeshStandardMaterial;
  voidPurpleCrystal: THREE.MeshStandardMaterial;
  frostCyanGlow: THREE.MeshStandardMaterial;
  frostIceTip: THREE.MeshStandardMaterial;
  wispAuraMat: THREE.MeshBasicMaterial;
  wispEyeMat: THREE.MeshBasicMaterial;
} | null = null;

function getRunicTreeMaterials() {
  if (_runicTreeMaterials) return _runicTreeMaterials;
  const bumpTex = getMonsterMicroBumpTexture();
  _runicTreeMaterials = {
    darkObsidianBark: new THREE.MeshPhysicalMaterial({
      color: 0x1a1528,
      bumpMap: bumpTex,
      bumpScale: 0.09,
      roughness: 0.56,
      metalness: 0.24,
      clearcoat: 0.3,
    }),
    obsidianStone: new THREE.MeshStandardMaterial({
      color: 0x2c253b,
      bumpMap: bumpTex,
      bumpScale: 0.1,
      roughness: 0.84,
      metalness: 0.16,
    }),
    organicMossSoil: new THREE.MeshStandardMaterial({
      color: 0x233824,
      bumpMap: bumpTex,
      bumpScale: 0.14,
      roughness: 0.94,
      metalness: 0.06,
    }),
    ancientBronzeBark: new THREE.MeshStandardMaterial({
      color: 0x5c4328,
      bumpMap: bumpTex,
      bumpScale: 0.08,
      emissive: 0x451a03,
      emissiveIntensity: 0.22,
      roughness: 0.68,
      metalness: 0.24,
    }),
    crimsonBark: new THREE.MeshStandardMaterial({
      color: 0x2b1620,
      bumpMap: bumpTex,
      bumpScale: 0.08,
      roughness: 0.76,
      metalness: 0.15,
    }),
    ashGrayFoliage: new THREE.MeshStandardMaterial({
      color: 0x576366,
      bumpMap: bumpTex,
      bumpScale: 0.06,
      roughness: 0.78,
      metalness: 0.08,
    }),
    voidPurpleDeepFoliage: new THREE.MeshStandardMaterial({
      color: 0x3b175e,
      bumpMap: bumpTex,
      bumpScale: 0.06,
      emissive: 0x1e0936,
      emissiveIntensity: 0.25,
      roughness: 0.72,
      metalness: 0.1,
    }),
    voidPurpleMidFoliage: new THREE.MeshStandardMaterial({
      color: 0x5b2187,
      bumpMap: bumpTex,
      bumpScale: 0.06,
      emissive: 0x3b0764,
      emissiveIntensity: 0.3,
      roughness: 0.68,
      metalness: 0.12,
    }),
    crimsonDeepFoliage: new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      bumpMap: bumpTex,
      bumpScale: 0.06,
      emissive: 0x450a0a,
      emissiveIntensity: 0.22,
      roughness: 0.74,
      metalness: 0.08,
    }),
    crimsonBrightFoliage: new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      bumpMap: bumpTex,
      bumpScale: 0.06,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.28,
      roughness: 0.68,
      metalness: 0.1,
    }),
    arcaneGoldFoliage: new THREE.MeshStandardMaterial({
      color: 0xd99b26,
      bumpMap: bumpTex,
      bumpScale: 0.06,
      emissive: 0xb45309,
      emissiveIntensity: 0.55,
      roughness: 0.52,
      metalness: 0.22,
    }),
    goldenHeartGlow: new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.55,
      roughness: 0.2,
    }),
    magentaRuneGlow: new THREE.MeshStandardMaterial({
      color: 0xf0abfc,
      emissive: 0xc026d3,
      emissiveIntensity: 1.65,
      roughness: 0.15,
    }),
    voidPurpleCrystal: new THREE.MeshStandardMaterial({
      color: 0xd8b4fe,
      emissive: 0x9333ea,
      emissiveIntensity: 1.45,
      roughness: 0.15,
    }),
    frostCyanGlow: new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x0284c7,
      emissiveIntensity: 1.35,
      roughness: 0.22,
      metalness: 0.25,
    }),
    frostIceTip: new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.7,
      roughness: 0.12,
    }),
    wispAuraMat: new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
    wispEyeMat: new THREE.MeshBasicMaterial({
      color: 0xf5d0fe,
    }),
  };
  return _runicTreeMaterials;
}

/**
 * Builds the Ancient Runic Void Tree Grove (`Bosque Rúnico del Vacío`)
 * modeled directly after the user's reference concept image (`image_127ef4ff.png`) and
 * organically rooted into the valley earth (no artificial grey octagonal stone coin slab!):
 * - Sunken mossy soil & cracked obsidian root-bed with 12 gnarled root tendrils plunging deep into the terrain (`y = -0.22`)
 * - Center Hero Tree: Gnarled, twisted Dark-Obsidian & Ancient-Gold trunk with spreading organic roots,
 *   two spiral bands of glowing Violet-Magenta runes carved into the bark, a glowing Golden-Amber hollow
 *   with bioluminescent golden mushroom clusters at the base, and a lush multi-layered canopy of Void-Purple,
 *   Crimson-Burgundy, and sunlit Arcane-Gold foliage.
 * - Left Companion Tree: Twisted Crimson Bloodleaf Tree (`Árbol Carmesí`) rooted directly into the soil.
 * - Right-Front Companion Tree: Spectral Frost-Root Deadwood (`Árbol Espectral de Escarcha`) with glowing ice-cyan
 *   roots plunging into the soil, bare jagged frost branches & hanging icicles.
 */
export function buildPineForestObstacleModel(variantSeed = 0): THREE.Group {
  const root = new THREE.Group();
  root.add(createContactShadowMesh(1.65));

  const mats = getRunicTreeMaterials();

  // ============================================================================
  // 1. ORGANIC SUNKEN MOSSY EARTH & BOULDER ROOT-BED (Seamless Ground Integration)
  // ============================================================================
  // Low, natural mossy soil mound that sinks into the terrain (y = -0.06 to +0.08)
  const mossyRootBed = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.76, 1),
    mats.organicMossSoil
  );
  mossyRootBed.scale.set(1.38, 0.22, 1.32);
  mossyRootBed.position.set(0.0, -0.02, 0.0);
  mossyRootBed.receiveShadow = true;
  root.add(mossyRootBed);

  // Irregular mossy earth & half-buried obsidian boulders around the trunk base so it blends naturally with the terrain
  const soilClumps: Array<[number, number, number, number, number, boolean]> = [
    [-0.58, -0.04, -0.18, 0.36, 0.28, true],
    [0.54, -0.04, 0.26, 0.34, 0.26, true],
    [0.18, -0.03, -0.52, 0.38, 0.24, false],
    [-0.38, -0.03, 0.44, 0.32, 0.25, true],
    [0.48, -0.04, -0.34, 0.29, 0.32, false],
    [-0.64, -0.05, 0.16, 0.28, 0.3, false],
  ];
  soilClumps.forEach(([cx, cy, cz, r, sy, isMoss], idx) => {
    const clump = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 1),
      isMoss ? mats.organicMossSoil : mats.obsidianStone
    );
    clump.scale.set(1.25, sy, 1.15);
    clump.position.set(cx, cy, cz);
    clump.rotation.set(idx * 0.3, idx * 0.9, idx * 0.2);
    clump.receiveShadow = true;
    clump.castShadow = true;
    root.add(clump);
  });

  // ============================================================================
  // 2. CENTER HERO TREE: ANCIENT RUNIC VOID-GOLD TREE (GRAN ÁRBOL RÚNICO)
  // ============================================================================
  const heroTree = new THREE.Group();
  // Seated directly into the ground (y = -0.04) so the trunk & roots emerge organically from the earth
  heroTree.position.set(0.02, -0.04, -0.04);
  root.add(heroTree);

  // Core twisted trunk column extending down into the soil (-0.15)
  const coreTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 1.32, 8),
    mats.darkObsidianBark
  );
  coreTrunk.position.y = 0.54;
  coreTrunk.castShadow = true;
  coreTrunk.receiveShadow = true;
  heroTree.add(coreTrunk);

  // 8 Intertwined Gnarled Root-to-Bough Strands plunging deep into the earth (y = -0.22) and rising to the canopy
  for (let s = 0; s < 8; s++) {
    const baseAngle = (s / 8) * Math.PI * 2 + 0.2;
    const midAngle = baseAngle + 0.52;
    const topAngle = midAngle + 0.35;
    const rootSpread = 0.84 + (s % 2) * 0.16;

    // pSub plunges deep underground so even on sloped terrain the roots are anchored in the earth
    const pSub = new THREE.Vector3(Math.cos(baseAngle) * (rootSpread + 0.12), -0.22, Math.sin(baseAngle) * (rootSpread + 0.12));
    const p0 = new THREE.Vector3(Math.cos(baseAngle) * rootSpread, -0.02, Math.sin(baseAngle) * rootSpread);
    const p1 = new THREE.Vector3(Math.cos(baseAngle + 0.18) * 0.38, 0.26, Math.sin(baseAngle + 0.18) * 0.38);
    const p2 = new THREE.Vector3(Math.cos(midAngle) * 0.24, 0.68, Math.sin(midAngle) * 0.24);
    const p3 = new THREE.Vector3(Math.cos(midAngle + 0.15) * 0.25, 1.08, Math.sin(midAngle + 0.15) * 0.25);
    const p4 = new THREE.Vector3(Math.cos(topAngle) * 0.66, 1.48 + (s % 2) * 0.14, Math.sin(topAngle) * 0.64);

    const strandCurve = new THREE.CatmullRomCurve3([pSub, p0, p1, p2, p3, p4]);
    const strandMat = s % 2 === 0 ? mats.darkObsidianBark : mats.ancientBronzeBark;
    const strandMesh = new THREE.Mesh(
      new THREE.TubeGeometry(strandCurve, 14, 0.074, 6, false),
      strandMat
    );
    strandMesh.castShadow = true;
    strandMesh.receiveShadow = true;
    heroTree.add(strandMesh);
  }

  // Two Diagonal Spiral Tracks of Glowing Violet-Magenta Runes carved into the twisted front trunk
  for (let track = 0; track < 2; track++) {
    const numRunes = 5;
    for (let r = 0; r < numRunes; r++) {
      const t = r / (numRunes - 1);
      const rAngle = -0.35 + t * 0.85 + track * 0.38;
      const ry = 0.32 + t * 0.68 + track * 0.08;
      const rad = 0.275;

      const runeGroup = new THREE.Group();
      runeGroup.position.set(Math.sin(rAngle) * rad, ry, Math.cos(rAngle) * rad);
      runeGroup.rotation.y = rAngle;

      // Vertical rune stave + diagonal rune branch
      const stave = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.078, 0.018),
        r % 2 === 0 ? mats.magentaRuneGlow : mats.voidPurpleCrystal
      );
      stave.rotation.z = -0.28;
      runeGroup.add(stave);

      const twig = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.018, 0.02),
        mats.magentaRuneGlow
      );
      twig.position.set(0.01, 0.012, 0.002);
      twig.rotation.z = 0.45;
      runeGroup.add(twig);

      heroTree.add(runeGroup);
    }
  }

  // Warm Golden-Amber Bioluminescent Hollow at the Root Base & Upper Branch Fork
  const rootHollowGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    mats.goldenHeartGlow
  );
  rootHollowGlow.scale.set(1.2, 0.85, 0.9);
  rootHollowGlow.position.set(0.12, 0.16, 0.22);
  heroTree.add(rootHollowGlow);

  const upperForkHeartGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    mats.goldenHeartGlow
  );
  upperForkHeartGlow.position.set(0, 1.26, 0.06);
  heroTree.add(upperForkHeartGlow);

  // 7 Glowing Golden-Amber Bioluminescent Mushrooms nestled in the gnarled root hollows
  const mushroomCoords: Array<[number, number, number, number]> = [
    [0.18, 0.06, 0.36, 1.0],
    [0.08, 0.04, 0.42, 0.78],
    [0.26, 0.04, 0.32, 0.65],
    [-0.28, 0.05, 0.28, 0.92],
    [-0.36, 0.03, 0.34, 0.68],
    [0.34, 0.04, -0.18, 0.82],
    [-0.14, 0.08, 0.32, 0.72],
  ];
  mushroomCoords.forEach(([mx, my, mz, mScale]) => {
    const mush = new THREE.Group();
    mush.position.set(mx, my, mz);
    mush.scale.setScalar(mScale);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.026, 0.09, 6),
      mats.ancientBronzeBark
    );
    stem.position.y = 0.045;
    mush.add(stem);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62),
      mats.goldenHeartGlow
    );
    cap.position.y = 0.08;
    mush.add(cap);

    heroTree.add(mush);
  });

  // Lush Multi-Layered Twilight Canopy (Void-Purple outer clouds, Crimson-Burgundy top crown, Golden-Amber sunlit inner foliage)
  const canopyPuffs: Array<{
    x: number;
    y: number;
    z: number;
    r: number;
    sx: number;
    sy: number;
    sz: number;
    mat: THREE.Material;
  }> = [
    // Inner sunlit Arcane-Gold foliage clusters glowing above the branch forks
    { x: 0.0, y: 1.44, z: 0.24, r: 0.36, sx: 1.25, sy: 0.78, sz: 1.1, mat: mats.arcaneGoldFoliage },
    { x: -0.28, y: 1.48, z: 0.16, r: 0.32, sx: 1.2, sy: 0.75, sz: 1.05, mat: mats.arcaneGoldFoliage },
    { x: 0.3, y: 1.46, z: 0.14, r: 0.32, sx: 1.2, sy: 0.75, sz: 1.05, mat: mats.arcaneGoldFoliage },
    // Mid-tier Royal Void-Purple billowy canopy clouds
    { x: -0.54, y: 1.56, z: 0.08, r: 0.42, sx: 1.28, sy: 0.82, sz: 1.15, mat: mats.voidPurpleMidFoliage },
    { x: 0.54, y: 1.58, z: 0.06, r: 0.42, sx: 1.28, sy: 0.82, sz: 1.15, mat: mats.voidPurpleMidFoliage },
    { x: -0.34, y: 1.68, z: -0.24, r: 0.44, sx: 1.3, sy: 0.85, sz: 1.2, mat: mats.voidPurpleDeepFoliage },
    { x: 0.34, y: 1.66, z: -0.22, r: 0.44, sx: 1.3, sy: 0.85, sz: 1.2, mat: mats.voidPurpleDeepFoliage },
    { x: 0.0, y: 1.72, z: 0.22, r: 0.44, sx: 1.32, sy: 0.84, sz: 1.18, mat: mats.voidPurpleMidFoliage },
    { x: -0.22, y: 1.82, z: 0.04, r: 0.42, sx: 1.25, sy: 0.85, sz: 1.18, mat: mats.voidPurpleMidFoliage },
    { x: 0.24, y: 1.8, z: 0.06, r: 0.42, sx: 1.25, sy: 0.85, sz: 1.18, mat: mats.voidPurpleDeepFoliage },
    // Upper Crown Crimson-Burgundy & Twilight Plum crest foliage (matching the top of the centerpiece tree!)
    { x: 0.0, y: 1.98, z: -0.02, r: 0.44, sx: 1.32, sy: 0.84, sz: 1.22, mat: mats.crimsonDeepFoliage },
    { x: -0.18, y: 1.92, z: 0.14, r: 0.34, sx: 1.2, sy: 0.78, sz: 1.1, mat: mats.crimsonBrightFoliage },
    { x: 0.2, y: 1.9, z: -0.12, r: 0.35, sx: 1.2, sy: 0.78, sz: 1.1, mat: mats.voidPurpleMidFoliage },
  ];

  canopyPuffs.forEach((p, idx) => {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(p.r, 1), p.mat);
    puff.position.set(p.x, p.y, p.z);
    puff.scale.set(p.sx, p.sy, p.sz);
    puff.rotation.set(idx * 0.4, idx * 0.7, idx * 0.25);
    puff.castShadow = true;
    puff.receiveShadow = true;
    heroTree.add(puff);
  });

  // ============================================================================
  // 3. LEFT COMPANION TREE: CRIMSON BLOODLEAF TREE & ASH-BARK BOUGH
  // ============================================================================
  const crimsonTree = new THREE.Group();
  crimsonTree.position.set(-0.56, -0.04, -0.18);
  crimsonTree.scale.setScalar(0.76);
  root.add(crimsonTree);

  const crimsonTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.28, 1.12, 7),
    mats.crimsonBark
  );
  crimsonTrunk.position.y = 0.42;
  crimsonTrunk.rotation.z = 0.18;
  crimsonTrunk.castShadow = true;
  crimsonTree.add(crimsonTrunk);

  // 4 Spreading Crimson Roots plunging into the ground
  for (let cr = 0; cr < 4; cr++) {
    const cAngle = (cr / 4) * Math.PI * 2 + 0.4;
    const cRootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.22, 0),
      new THREE.Vector3(Math.cos(cAngle) * 0.26, 0.04, Math.sin(cAngle) * 0.26),
      new THREE.Vector3(Math.cos(cAngle + 0.15) * 0.46, -0.18, Math.sin(cAngle + 0.15) * 0.46),
    ]);
    const cRootMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cRootCurve, 6, 0.042, 5, false),
      mats.crimsonBark
    );
    crimsonTree.add(cRootMesh);
  }

  const crimsonFoliageMat =
    variantSeed % 3 === 1 ? mats.ashGrayFoliage : mats.crimsonDeepFoliage;
  const crimsonHighlightMat =
    variantSeed % 3 === 1 ? mats.voidPurpleMidFoliage : mats.crimsonBrightFoliage;

  const sideCanopyOffsets: Array<[number, number, number, number, boolean]> = [
    [-0.18, 1.02, 0.08, 0.38, true],
    [0.14, 1.08, -0.08, 0.36, false],
    [-0.04, 1.22, 0.0, 0.4, true],
    [-0.28, 0.88, -0.06, 0.3, false],
  ];
  sideCanopyOffsets.forEach(([cx, cy, cz, cr, isBright]) => {
    const cloud = new THREE.Mesh(
      new THREE.DodecahedronGeometry(cr, 1),
      isBright ? crimsonHighlightMat : crimsonFoliageMat
    );
    cloud.position.set(cx, cy, cz);
    cloud.scale.set(1.25, 0.82, 1.15);
    cloud.castShadow = true;
    cloud.receiveShadow = true;
    crimsonTree.add(cloud);
  });

  // ============================================================================
  // 4. RIGHT-FRONT COMPANION: SPECTRAL FROST-ROOT DEADWOOD (ÁRBOL DE ESCARCHA)
  // ============================================================================
  const frostTree = new THREE.Group();
  frostTree.position.set(0.56, -0.04, 0.28);
  frostTree.scale.setScalar(0.74);
  root.add(frostTree);

  // Lower dark bark transitioning into glowing ice-cyan trunk
  const frostTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.19, 0.82, 6),
    mats.ancientBronzeBark
  );
  frostTrunk.position.y = 0.28;
  frostTrunk.rotation.z = -0.14;
  frostTrunk.castShadow = true;
  frostTree.add(frostTrunk);

  // 5 Spreading Bioluminescent Ice-Cyan Tendril Roots plunging deep into the earth
  for (let r = 0; r < 5; r++) {
    const rAngle = (r / 5) * Math.PI * 2 + 0.3;
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.24, 0),
      new THREE.Vector3(Math.cos(rAngle) * 0.26, 0.06, Math.sin(rAngle) * 0.26),
      new THREE.Vector3(Math.cos(rAngle + 0.2) * 0.52, -0.18, Math.sin(rAngle + 0.2) * 0.52),
    ]);
    const cyanRoot = new THREE.Mesh(
      new THREE.TubeGeometry(rootCurve, 7, 0.035, 5, false),
      mats.frostCyanGlow
    );
    frostTree.add(cyanRoot);
  }

  // 5 Bare Jagged Ice-Cyan Spectral Branches + Hanging Frost Icicles
  for (let b = 0; b < 5; b++) {
    const bAngle = (b / 5) * Math.PI * 2 + 0.4;
    const branchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.04, 0.58, 0),
      new THREE.Vector3(Math.cos(bAngle) * 0.24, 0.88, Math.sin(bAngle) * 0.24),
      new THREE.Vector3(Math.cos(bAngle - 0.18) * 0.44, 1.22 + (b % 2) * 0.12, Math.sin(bAngle - 0.18) * 0.44),
    ]);
    const cyanBranch = new THREE.Mesh(
      new THREE.TubeGeometry(branchCurve, 7, 0.028, 5, false),
      b % 2 === 0 ? mats.frostCyanGlow : mats.frostIceTip
    );
    frostTree.add(cyanBranch);

    // Hanging crystalline icicle from the spectral branch
    if (b % 2 === 0) {
      const icicle = new THREE.Mesh(
        new THREE.ConeGeometry(0.026, 0.18, 4),
        mats.frostIceTip
      );
      icicle.rotation.x = Math.PI;
      icicle.position.set(
        Math.cos(bAngle) * 0.32,
        0.86,
        Math.sin(bAngle) * 0.32
      );
      frostTree.add(icicle);
    }
  }

  // ============================================================================
  // 5. FOREGROUND DEADWOOD SAPLING, VOID CRYSTALS & FLOATING VOID WISPS
  // ============================================================================
  // Foreground gnarled dark-obsidian sapling with purple crystal shards emerging from the soil
  [-0.36, 0.38].forEach((xPos, idx) => {
    const crystal = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.34 + idx * 0.08, 5),
      idx === 0 ? mats.voidPurpleCrystal : mats.magentaRuneGlow
    );
    crystal.position.set(xPos, 0.08, 0.54 - idx * 0.12);
    crystal.rotation.z = idx === 0 ? 0.24 : -0.28;
    root.add(crystal);
  });

  // 3 Floating Dark-Obsidian Void Wisp Orbs with Purple Flame Auras & Glowing Eyes hovering in the branches
  const wispCoords: Array<[number, number, number, number]> = [
    [-0.58, 1.54, 0.24, 0.095],
    [0.54, 1.62, -0.14, 0.09],
    [0.42, 0.96, 0.32, 0.078],
  ];
  wispCoords.forEach(([wx, wy, wz, wr]) => {
    const wisp = new THREE.Group();
    wisp.position.set(wx, wy, wz);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(wr, 10, 8),
      mats.darkObsidianBark
    );
    wisp.add(core);

    const aura = new THREE.Mesh(
      new THREE.ConeGeometry(wr * 1.38, wr * 2.8, 8),
      mats.wispAuraMat
    );
    aura.position.y = wr * 0.28;
    wisp.add(aura);

    // Pair of glowing violet-white eyes facing outward/camera
    [-0.028, 0.028].forEach((ex) => {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.02, 0.022),
        mats.wispEyeMat
      );
      eye.position.set(ex, 0.01, wr * 0.88);
      wisp.add(eye);
    });

    root.add(wisp);
  });

  return root;
}

/**
 * Builds the Northern Spawn Portal using the Void Spawn Portal design.
 */
export function buildForestPassSpawnModel(): THREE.Group {
  return buildVoidSpawnPortalModel();
}

/**
 * Builds the Southern/Cliff Spawn Portal using the Void Spawn Portal design.
 */
export function buildAncientTempleSpawnModel(): THREE.Group {
  return buildVoidSpawnPortalModel();
}

/**
 * Generates a pixel-shader-grade swirling Black-Hole & Violet Singularity accretion disk texture
 * for the Castle's central abyssal vortex and the Void Spawn Portals (matching `image_4f1b52b4.png`).
 */
function createCastleBlackHoleVortexTexture(): THREE.CanvasTexture {
  const key = 'castle_black_hole_vortex_tex';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const r = Math.hypot(dx, dy);
      if (r >= 1.0) continue;

      const theta = Math.atan2(dy, dx);
      // Domain-warped FBM for turbulent void nebula filaments
      const n1 = fbm2(dx * 3.5 + 1.7, dy * 3.5 + 4.3, 4);
      const n2 = fbm2(dx * 7.2 - n1 * 1.8, dy * 7.2 + n1 * 1.8, 3);

      // Logarithmic spiral arms winding into the pitch-black event horizon
      const logR = Math.log(Math.max(0.08, r));
      const phase1 = theta * 3.0 - logR * 7.8 + n1 * 3.8;
      const phase2 = theta * 6.0 - logR * 12.5 + n2 * 4.5;

      const spiralArmMajor = Math.pow(0.5 + 0.5 * Math.sin(phase1), 2.2);
      const spiralArmMinor = Math.pow(0.5 + 0.5 * Math.cos(phase2), 3.2);

      // Pitch-black event horizon inside r < 0.17 with razor-sharp relativistic photon ring at r ~ 0.21
      const eventHorizonMask = Math.min(1, Math.max(0, (r - 0.145) / 0.065));
      const photonRing = Math.exp(-Math.pow((r - 0.205) / 0.042, 2)) * 1.15;
      const outerEnvelope = Math.pow(Math.max(0, 1 - r), 0.78);

      const rawLum =
        (spiralArmMajor * 0.68 + spiralArmMinor * 0.36 + n2 * 0.28) *
          outerEnvelope *
          eventHorizonMask +
        photonRing * (0.75 + 0.25 * spiralArmMajor);

      const lum = Math.min(1, Math.max(0, rawLum));
      // Deep void-purple to magenta-lavender to white-violet core palette
      const red = Math.min(255, Math.floor((18 + Math.pow(lum, 1.15) * 232) * eventHorizonMask));
      const green = Math.min(255, Math.floor((6 + Math.pow(lum, 1.85) * 214) * eventHorizonMask));
      const blue = Math.min(255, Math.floor((36 + Math.pow(lum, 0.82) * 219) * eventHorizonMask));

      const alpha = Math.min(1, (1 - Math.pow(r, 3.2)) * 1.08);
      const idx = (y * size + x) * 4;
      data[idx] = red;
      data[idx + 1] = green;
      data[idx + 2] = blue;
      data[idx + 3] = Math.floor(alpha * 255);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates the translucent glowing violet energy shield dome texture with cellular arcane lattice and plasma filaments.
 */
function createCastleShieldDomeTexture(): THREE.CanvasTexture {
  const key = 'castle_shield_dome_tex';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    // Crown & basal rim Fresnel amplification while keeping mid-latitudes crystal-clear
    const crownGlow = Math.exp(-Math.pow(v / 0.22, 2)) * 0.68;
    const baseRimGlow = Math.exp(-Math.pow((1 - v) / 0.18, 2)) * 0.82;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Tileable horizontal coordinate u: sin/cos wrap
      const nx = Math.cos(u * Math.PI * 2) * 2.2;
      const ny = Math.sin(u * Math.PI * 2) * 2.2;
      const n = fbm2(nx + 3.1, v * 6.5 + ny + 1.4, 4);
      const [d1, d2] = voronoi2(u * 16, v * 10);
      const hexEdge = Math.exp(-Math.pow((d2 - d1) / 0.045, 2));
      const plasmaVein = Math.pow(Math.max(0, 1 - Math.abs(n - 0.52) * 8.5), 2.5);

      const intensity = Math.min(
        1,
        0.18 + crownGlow + baseRimGlow + hexEdge * 0.28 + plasmaVein * 0.45 * (crownGlow + baseRimGlow + 0.3)
      );
      const alpha = Math.min(
        0.88,
        0.16 + crownGlow * 0.55 + baseRimGlow * 0.65 + hexEdge * 0.22 + plasmaVein * 0.35
      );

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.floor(155 + intensity * 98));
      data[idx + 1] = Math.min(255, Math.floor(85 + Math.pow(intensity, 1.4) * 155));
      data[idx + 2] = Math.min(255, Math.floor(225 + intensity * 30));
      data[idx + 3] = Math.floor(alpha * 255);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Builds the Grand Runic Void-Bastion Castle Citadel (`Castillo del Vacío Rúnico`)
 * modeled directly after the user's reference concept image (`image_4f1b52b4.png`):
 * - Stepped dark-obsidian & bronze-stone octagonal citadel foundation surrounded by 10 perimeter Gargoyle & Brass-Gremlin Guardian statues
 * - Polygonal crenellated ash-stone & dark-obsidian outer fortress wall with inset Arcane-Gold Diamond frames housing glowing Void-Purple crystals & magenta runic pilasters
 * - Grand Front Archway Gatehouse with 3 carved stone steps, Swirling Purple-White Void Gate Portal, golden chevron crest & oversized diamond void crystal
 * - 6 Crenellated corner watchtowers & 4 tall jagged runic obelisk spires wrapped in helical ribbed copper-bronze induction conduits
 * - Towering central Runic Void-Spire Keep with 3 glowing circular void lenses, lateral copper solenoid coils & sweeping fans of floating crystal needles
 * - Colossal Swirling Black-Hole & Purple Void Singularity spinning at the heart of the courtyard
 * - Giant Translucent Glowing Violet-Magenta Energy Shield Dome (`Cúpula de Contención Arcana`) enclosing the upper citadel
 */
export function buildCastleKeepGoalModel(): THREE.Group {
  const root = new THREE.Group();
  root.add(createContactShadowMesh(3.2));

  // Center the citadel slightly offset toward +X on the goal plateau so its front gate at -X meets the road seamlessly
  const citadel = new THREE.Group();
  citadel.position.set(0.62, 0, 0);
  // Slight rotation toward the camera (+Z / -X) so both the front portal gate and central black-hole vortex are showcased
  citadel.rotation.y = -0.18;
  root.add(citadel);

  // ============================================================================
  // 1. MATERIAL PALETTE (Dark Obsidian, Ancient Stone, Copper-Bronze, Void Purple)
  // ============================================================================
  const darkObsidianMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1625,
    roughness: 0.28,
    metalness: 0.48,
    clearcoat: 0.65,
  });
  const ancientStoneMat = new THREE.MeshStandardMaterial({
    color: 0x3b354a,
    roughness: 0.82,
    metalness: 0.18,
  });
  const ashStoneMat = new THREE.MeshStandardMaterial({
    color: 0x524b63,
    roughness: 0.76,
    metalness: 0.15,
  });
  const warmFoundationStoneMat = new THREE.MeshStandardMaterial({
    color: 0x5c4433,
    roughness: 0.78,
    metalness: 0.22,
  });
  const copperConduitMat = new THREE.MeshPhysicalMaterial({
    color: 0xc26a27,
    emissive: 0x78350f,
    emissiveIntensity: 0.2,
    roughness: 0.26,
    metalness: 0.88,
    clearcoat: 0.55,
  });
  const darkBronzeMat = new THREE.MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.38,
    metalness: 0.82,
  });
  const arcaneGoldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd99b26,
    emissive: 0x92400e,
    emissiveIntensity: 0.28,
    roughness: 0.24,
    metalness: 0.9,
  });
  const voidPurpleCrystalMat = new THREE.MeshStandardMaterial({
    color: 0xd8b4fe,
    emissive: 0x9333ea,
    emissiveIntensity: 1.55,
    roughness: 0.12,
    metalness: 0.2,
  });
  const magentaRuneMat = new THREE.MeshStandardMaterial({
    color: 0xf0abfc,
    emissive: 0xc026d3,
    emissiveIntensity: 1.45,
    roughness: 0.15,
  });
  const whiteVoidLensMat = new THREE.MeshStandardMaterial({
    color: 0xf5f3ff,
    emissive: 0xc084fc,
    emissiveIntensity: 1.9,
    roughness: 0.08,
  });
  const gremlinCyanEyeMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.6,
  });

  // ============================================================================
  // 2. STEPPED OCTAGONAL CITADEL FOUNDATION & 10 PERIMETER GUARDIAN STATUES
  // ============================================================================
  const lowerRockPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(2.18, 2.38, 0.26, 8),
    darkObsidianMat
  );
  lowerRockPlinth.rotation.y = Math.PI / 8;
  lowerRockPlinth.position.y = 0.13;
  lowerRockPlinth.receiveShadow = true;
  lowerRockPlinth.castShadow = true;
  citadel.add(lowerRockPlinth);

  const midBronzePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.96, 2.12, 0.22, 8),
    warmFoundationStoneMat
  );
  midBronzePlinth.rotation.y = Math.PI / 8;
  midBronzePlinth.position.y = 0.34;
  midBronzePlinth.receiveShadow = true;
  midBronzePlinth.castShadow = true;
  citadel.add(midBronzePlinth);

  // 10 Perimeter Guardian Statues (Alternating Brass Gremlins with Cyan Eyes & Horned Obsidian Void-Gargoyles)
  const guardianAngles = [
    -2.65, -2.18, -1.72, -1.28, -0.82,
    0.82, 1.28, 1.72, 2.18, 2.65,
  ];
  guardianAngles.forEach((ang, idx) => {
    // Point angle relative to -X (angle = Math.PI is directly in front of the gatehouse at -X)
    const worldAngle = Math.PI + ang * 0.62;
    const isBrassGremlin = idx % 2 === 0;
    const statue = createStoneGargoyleStatue(
      isBrassGremlin ? ashStoneMat : darkObsidianMat,
      isBrassGremlin ? arcaneGoldMat : ancientStoneMat,
      copperConduitMat,
      isBrassGremlin ? gremlinCyanEyeMat : voidPurpleCrystalMat
    );
    statue.scale.setScalar(1.08);
    const radial = 2.08;
    statue.position.set(
      Math.cos(worldAngle) * radial,
      0.24,
      Math.sin(worldAngle) * radial
    );
    statue.rotation.y = -worldAngle + Math.PI / 2;
    citadel.add(statue);
  });

  // ============================================================================
  // 3. POLYGONAL CRENELLATED FORTRESS WALL, DIAMOND CRYSTALS & RUNIC PILASTERS
  // ============================================================================
  const wallRadius = 1.68;
  const wallHeight = 1.18;

  const mainBastionCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(wallRadius, wallRadius + 0.12, wallHeight, 8),
    ancientStoneMat
  );
  mainBastionCylinder.rotation.y = Math.PI / 8;
  mainBastionCylinder.position.y = 0.42 + wallHeight * 0.5;
  mainBastionCylinder.castShadow = true;
  mainBastionCylinder.receiveShadow = true;
  citadel.add(mainBastionCylinder);

  // Upper ash-stone parapet rim & crenellated battlement merlons
  const parapetRim = new THREE.Mesh(
    new THREE.CylinderGeometry(wallRadius + 0.06, wallRadius + 0.04, 0.16, 8),
    ashStoneMat
  );
  parapetRim.rotation.y = Math.PI / 8;
  parapetRim.position.y = 0.42 + wallHeight + 0.06;
  parapetRim.castShadow = true;
  citadel.add(parapetRim);

  const numMerlons = 24;
  for (let m = 0; m < numMerlons; m++) {
    const mAngle = (m / numMerlons) * Math.PI * 2;
    // Skip merlons directly over the front portal archway (-X direction, angle ~ Math.PI)
    if (Math.abs(Math.atan2(Math.sin(mAngle - Math.PI), Math.cos(mAngle - Math.PI))) < 0.34) {
      continue;
    }
    const merlon = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.26),
      m % 2 === 0 ? ashStoneMat : darkObsidianMat
    );
    merlon.position.set(
      Math.cos(mAngle) * (wallRadius - 0.02),
      0.42 + wallHeight + 0.22,
      Math.sin(mAngle) * (wallRadius - 0.02)
    );
    merlon.rotation.y = -mAngle;
    merlon.castShadow = true;
    citadel.add(merlon);
  }

  // 7 Wall Faces (all except the front -X portal face): Inset Arcane-Gold Diamond Frames + Glowing Void-Purple Gems + Runic Pilasters
  for (let face = 0; face < 8; face++) {
    const faceAngle = Math.PI + (face * Math.PI) / 4;
    if (face === 0) continue; // Face 0 (Math.PI, -X) is the Grand Portal Gatehouse

    const wallFaceGroup = new THREE.Group();
    wallFaceGroup.rotation.y = -faceAngle;

    // Warm bronze lower buttress block
    const buttress = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.42, 0.72),
      warmFoundationStoneMat
    );
    buttress.position.set(wallRadius + 0.02, 0.56, 0);
    buttress.castShadow = true;
    wallFaceGroup.add(buttress);

    // Inset Arcane-Gold Diamond Frame on the wall panel
    const diamondFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.36, 0.36),
      arcaneGoldMat
    );
    diamondFrame.rotation.x = Math.PI / 4;
    diamondFrame.position.set(wallRadius + 0.01, 0.98, 0);
    wallFaceGroup.add(diamondFrame);

    // Glowing Faceted Void-Purple Diamond Crystal inside the gold frame
    const diamondGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.17, 0),
      voidPurpleCrystalMat
    );
    diamondGem.scale.set(0.55, 1.15, 0.85);
    diamondGem.position.set(wallRadius + 0.06, 0.98, 0);
    wallFaceGroup.add(diamondGem);

    // Flanking Vertical Dark-Obsidian Pilasters with 3 Glowing Magenta Runes
    [-0.44, 0.44].forEach((zOff) => {
      const pilaster = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 1.18, 0.18),
        darkObsidianMat
      );
      pilaster.position.set(wallRadius + 0.02, 0.98, zOff);
      pilaster.castShadow = true;
      wallFaceGroup.add(pilaster);

      for (let r = 0; r < 3; r++) {
        const rune = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.09, 0.07),
          r % 2 === 0 ? magentaRuneMat : voidPurpleCrystalMat
        );
        rune.position.set(wallRadius + 0.11, 0.68 + r * 0.28, zOff);
        rune.rotation.x = (r - 1) * 0.28;
        wallFaceGroup.add(rune);
      }
    });

    citadel.add(wallFaceGroup);
  }

  // ============================================================================
  // 4. GRAND FRONT ARCHWAY & SWIRLING PURPLE VOID GATE PORTAL (-X ENTRANCE)
  // ============================================================================
  const gateGroup = new THREE.Group();
  // Positioned on the -X face facing the approaching road
  gateGroup.position.set(-wallRadius - 0.04, 0.38, 0);
  citadel.add(gateGroup);

  // 3 Carved Stone Steps ascending into the Void Portal
  for (let st = 0; st < 3; st++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(0.42 - st * 0.08, 0.09, 0.96 - st * 0.1),
      st % 2 === 0 ? ashStoneMat : darkObsidianMat
    );
    step.position.set(-0.28 + st * 0.1, 0.04 + st * 0.08, 0);
    step.receiveShadow = true;
    step.castShadow = true;
    gateGroup.add(step);
  }

  // Left & Right Heavy Runic Gate Pillars with Glowing Magenta-Violet Runes
  [-0.58, 0.58].forEach((zSide) => {
    const gatePillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 1.38, 0.28),
      darkObsidianMat
    );
    gatePillar.position.set(0.02, 0.68, zSide);
    gatePillar.castShadow = true;
    gateGroup.add(gatePillar);

    const goldPillarCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.1, 0.32),
      arcaneGoldMat
    );
    goldPillarCap.position.set(0.02, 1.38, zSide);
    gateGroup.add(goldPillarCap);

    // 3 Glowing Magenta Runes carved down each gate pillar
    for (let r = 0; r < 3; r++) {
      const glyph = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.12, 0.09),
        magentaRuneMat
      );
      glyph.position.set(-0.17, 0.35 + r * 0.34, zSide);
      glyph.rotation.x = (r - 1) * 0.3;
      gateGroup.add(glyph);
    }

    // Twin Horned Obsidian Spikes flanking the upper gate arch
    const hornSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.52, 5),
      darkObsidianMat
    );
    hornSpike.position.set(-0.02, 1.66, zSide * 0.85);
    hornSpike.rotation.x = zSide * 0.18;
    hornSpike.castShadow = true;
    gateGroup.add(hornSpike);
  });

  // Arcane-Gold Rounded Archway Frame surrounding the portal
  const archRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.095, 10, 24, Math.PI),
    arcaneGoldMat
  );
  archRing.rotation.y = -Math.PI / 2;
  archRing.position.set(-0.04, 0.72, 0);
  gateGroup.add(archRing);

  // Swirling Purple-White Void Portal Disc inside the Gatehouse Arch
  const gatePortalMat = new THREE.MeshBasicMaterial({
    map: createVoidSpireVortexTexture(),
    side: THREE.DoubleSide,
  });
  const gatePortalDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 28),
    gatePortalMat
  );
  gatePortalDisc.rotation.y = -Math.PI / 2;
  gatePortalDisc.position.set(-0.05, 0.68, 0);
  gateGroup.add(gatePortalDisc);
  root.userData.gatePortalDisc = gatePortalDisc;

  // Grand Golden Chevron Crest & Oversized Faceted Diamond Void-Crystal crowning the Gate Archway
  const crestFrame = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    arcaneGoldMat
  );
  crestFrame.scale.set(0.45, 1.38, 0.92);
  crestFrame.position.set(-0.1, 1.38, 0);
  gateGroup.add(crestFrame);

  const crestDiamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.21, 0),
    voidPurpleCrystalMat
  );
  crestDiamond.scale.set(0.55, 1.35, 0.85);
  crestDiamond.position.set(-0.14, 1.38, 0);
  gateGroup.add(crestDiamond);

  // ============================================================================
  // 5. 6 CRENELLATED CORNER WATCHTOWERS & 4 COILED RUNIC OBELISK SPIRES
  // ============================================================================
  // 6 Outer Corner Crenellated Watchtowers with Pyramidal Obsidian Spires & Coiled Copper Conduits
  const watchtowerAngles = [
    Math.PI - 0.72,
    Math.PI + 0.72,
    Math.PI - 1.55,
    Math.PI + 1.55,
    Math.PI - 2.45,
    Math.PI + 2.45,
  ];
  watchtowerAngles.forEach((tAngle, idx) => {
    const isRearTall = idx >= 4;
    const towerH = isRearTall ? 1.95 : 1.58;
    const tRadius = 1.66;
    const tx = Math.cos(tAngle) * tRadius;
    const tz = Math.sin(tAngle) * tRadius;

    const towerGroup = new THREE.Group();
    towerGroup.position.set(tx, 0.42, tz);
    citadel.add(towerGroup);

    // Cylindrical stone tower shaft
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.33, towerH, 8),
      ancientStoneMat
    );
    shaft.position.y = towerH * 0.5;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    towerGroup.add(shaft);

    // Helical Ribbed Copper-Bronze Conduit wrapping the watchtower shaft
    const coilCurve = new HelixCurve(0.32, 0.29, 0.18, towerH - 0.15, 1.15, idx * 1.1);
    const coilTube = new THREE.Mesh(
      new THREE.TubeGeometry(coilCurve, 24, 0.036, 7, false),
      darkBronzeMat
    );
    towerGroup.add(coilTube);

    for (let r = 1; r <= 10; r++) {
      const t = r / 11;
      const pt = coilCurve.getPoint(t);
      const tangent = coilCurve.getTangent(t);
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.044, 0.012, 5, 10),
        copperConduitMat
      );
      rib.position.copy(pt);
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      towerGroup.add(rib);
    }

    // Crenellated Battlement Crown on top of the watchtower
    const crownHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.3, 0.22, 8),
      ashStoneMat
    );
    crownHead.position.y = towerH + 0.08;
    crownHead.castShadow = true;
    towerGroup.add(crownHead);

    for (let cm = 0; cm < 6; cm++) {
      const cmA = (cm / 6) * Math.PI * 2;
      const cMerlon = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.16, 0.11),
        darkObsidianMat
      );
      cMerlon.position.set(Math.cos(cmA) * 0.31, towerH + 0.22, Math.sin(cmA) * 0.31);
      cMerlon.rotation.y = -cmA;
      towerGroup.add(cMerlon);
    }

    // Sharp Pyramidal Dark-Obsidian Spire Roof
    const spireRoof = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.68, 4),
      darkObsidianMat
    );
    spireRoof.rotation.y = Math.PI / 4;
    spireRoof.position.y = towerH + 0.52;
    spireRoof.castShadow = true;
    towerGroup.add(spireRoof);

    // Glowing Violet Rune etched onto the watchtower face
    const towerRune = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.085, 0),
      magentaRuneMat
    );
    towerRune.scale.set(0.5, 1.4, 0.5);
    towerRune.position.set(Math.cos(tAngle) * 0.31, towerH * 0.52, Math.sin(tAngle) * 0.31);
    towerGroup.add(towerRune);
  });

  // 4 Tall Jagged Runic Obelisk Spires around the inner sanctuary collar (wrapped in Copper Coils & Runes)
  const obeliskCoords: Array<[number, number, number]> = [
    [-1.08, -0.78, 2.55],
    [-1.08, 0.78, 2.55],
    [0.45, -1.12, 2.95],
    [0.45, 1.12, 2.95],
  ];
  obeliskCoords.forEach(([ox, oz, obeliskH], idx) => {
    const obGroup = new THREE.Group();
    obGroup.position.set(ox, 0.45, oz);
    citadel.add(obGroup);

    // Tapered 4-sided Dark Obsidian Obelisk Needle
    const obeliskShaft = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, obeliskH, 4),
      darkObsidianMat
    );
    obeliskShaft.rotation.y = Math.PI / 4;
    obeliskShaft.position.y = obeliskH * 0.5;
    obeliskShaft.castShadow = true;
    obGroup.add(obeliskShaft);

    // Coiled Copper-Bronze Solenoid Bands wrapping the base of the obelisk
    for (let b = 0; b < 5; b++) {
      const bandR = 0.23 - b * 0.022;
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(bandR, 0.026, 6, 14),
        b % 2 === 0 ? copperConduitMat : arcaneGoldMat
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.38 + b * 0.14;
      obGroup.add(band);
    }

    // Glowing Magenta-Violet Runes up the obelisk face
    for (let r = 0; r < 3; r++) {
      const rune = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.14, 0.06),
        r % 2 === 0 ? magentaRuneMat : voidPurpleCrystalMat
      );
      rune.position.set(-0.14 + r * 0.02, 1.05 + r * 0.32, (idx % 2 === 0 ? -1 : 1) * 0.08);
      obGroup.add(rune);
    }
  });

  // ============================================================================
  // 6. CENTRAL RUNIC VOID-SPIRE KEEP & COLOSSAL BLACK-HOLE VOID SINGULARITY
  // ============================================================================
  const centralKeep = new THREE.Group();
  centralKeep.position.set(0.18, 0.85, 0);
  citadel.add(centralKeep);

  // Inner Stepped Bastion Pedestal supporting the Keep
  const keepPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.96, 1.15, 8),
    ancientStoneMat
  );
  keepPedestal.position.y = 0.55;
  keepPedestal.castShadow = true;
  centralKeep.add(keepPedestal);

  // Towering Pyramidal Obsidian Void-Spire Apex rising above the singularity
  const centralSpireApex = new THREE.Mesh(
    new THREE.ConeGeometry(0.56, 1.85, 4),
    darkObsidianMat
  );
  centralSpireApex.rotation.y = Math.PI / 4;
  centralSpireApex.position.set(0.12, 2.25, 0);
  centralSpireApex.castShadow = true;
  centralKeep.add(centralSpireApex);

  // Golden Chevron Trim & Central Diamond Rune on the Keep Apex
  const apexGoldChevron = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.032, 6, 4),
    arcaneGoldMat
  );
  apexGoldChevron.rotation.y = Math.PI / 4;
  apexGoldChevron.rotation.x = Math.PI / 3;
  apexGoldChevron.position.set(0.02, 1.82, 0);
  centralKeep.add(apexGoldChevron);

  const apexDiamondGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    voidPurpleCrystalMat
  );
  apexDiamondGem.scale.set(0.55, 1.35, 0.75);
  apexDiamondGem.position.set(-0.22, 2.22, 0);
  centralKeep.add(apexDiamondGem);
  apexDiamondGem.userData.baseY = 2.22;
  root.userData.coreCrystal = apexDiamondGem;

  // 3 Glowing Circular Void-Projector Lenses on the Central Spire Keep
  const lensOffsets: Array<[number, number, number, number]> = [
    [-0.26, 1.92, 0, 0.14],
    [-0.18, 2.02, -0.32, 0.11],
    [-0.18, 2.02, 0.32, 0.11],
  ];
  lensOffsets.forEach(([lx, ly, lz, lr]) => {
    const lensRing = new THREE.Mesh(
      new THREE.TorusGeometry(lr, 0.025, 8, 18),
      arcaneGoldMat
    );
    lensRing.rotation.y = Math.PI / 2;
    lensRing.position.set(lx, ly, lz);
    centralKeep.add(lensRing);

    const lensCore = new THREE.Mesh(
      new THREE.SphereGeometry(lr * 0.72, 12, 10),
      whiteVoidLensMat
    );
    lensCore.position.set(lx - 0.02, ly, lz);
    centralKeep.add(lensCore);
  });

  // Lateral Copper-Wound Solenoid Towers & Sweeping Fans of 7 Floating Void-Crystal Shards
  const floatingShards: THREE.Object3D[] = [];
  [-1, 1].forEach((side) => {
    const sideCoilGroup = new THREE.Group();
    sideCoilGroup.position.set(0.05, 1.55, side * 0.78);
    centralKeep.add(sideCoilGroup);

    const coilCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.42, 12),
      darkObsidianMat
    );
    sideCoilGroup.add(coilCore);

    for (let w = -2; w <= 2; w++) {
      const winding = new THREE.Mesh(
        new THREE.TorusGeometry(0.155, 0.024, 6, 16),
        copperConduitMat
      );
      winding.rotation.x = Math.PI / 2;
      winding.position.y = w * 0.068;
      sideCoilGroup.add(winding);
    }

    // Sweeping Fan of 7 Pointed Void-Crystal Needles
    for (let n = 0; n < 7; n++) {
      const t = n / 6;
      const fanAngle = side * (0.18 + t * 0.95);
      const needleLen = 0.44 + Math.sin(t * Math.PI) * 0.16;

      const needlePivot = new THREE.Group();
      needlePivot.position.set(0, 0.24, 0);
      needlePivot.rotation.x = fanAngle;

      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.018, needleLen * 0.65, 5),
        copperConduitMat
      );
      rod.position.y = needleLen * 0.32;
      needlePivot.add(rod);

      const crystalHead = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.065, 0),
        n % 2 === 0 ? whiteVoidLensMat : voidPurpleCrystalMat
      );
      crystalHead.scale.set(0.55, 1.85, 0.55);
      crystalHead.position.y = needleLen * 0.86;
      needlePivot.add(crystalHead);
      floatingShards.push(crystalHead);

      sideCoilGroup.add(needlePivot);
    }
  });
  root.userData.floatingShards = floatingShards;

  // ============================================================================
  // 7. COLOSSAL SWIRLING BLACK-HOLE & PURPLE VOID SINGULARITY (COURTYARD HEART)
  // ============================================================================
  const singularityGroup = new THREE.Group();
  singularityGroup.position.set(-0.48, 1.98, 0);
  // Tilted slightly toward the isometric camera and incoming road so the spiral black hole is front-and-center
  singularityGroup.rotation.y = -Math.PI / 2 + 0.28;
  citadel.add(singularityGroup);

  const blackHoleDiscMat = new THREE.MeshBasicMaterial({
    map: createCastleBlackHoleVortexTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const blackHoleDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(1.78, 1.78),
    blackHoleDiscMat
  );
  singularityGroup.add(blackHoleDisc);

  // Secondary counter-rotating inner spiral layer for deep 3D parallax
  const innerSwirlDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(1.28, 1.28),
    blackHoleDiscMat
  );
  innerSwirlDisc.position.z = 0.04;
  singularityGroup.add(innerSwirlDisc);

  // 3D Pitch-Black Event Horizon Sphere at the exact center of the vortex
  const eventHorizonSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0x020005 })
  );
  singularityGroup.add(eventHorizonSphere);

  // 2 Tilted Glowing Violet Accretion Torus Rings orbiting the Black Hole
  const accretionRingA = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.028, 8, 32),
    voidPurpleCrystalMat
  );
  accretionRingA.rotation.x = 0.42;
  accretionRingA.rotation.y = 0.35;
  singularityGroup.add(accretionRingA);

  const accretionRingB = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.02, 8, 32),
    magentaRuneMat
  );
  accretionRingB.rotation.x = -0.48;
  accretionRingB.rotation.y = -0.25;
  singularityGroup.add(accretionRingB);

  root.userData.voidSingularity = blackHoleDisc;
  root.userData.innerSwirlDisc = innerSwirlDisc;
  root.userData.ring = accretionRingA;

  // ============================================================================
  // 8. GIANT TRANSLUCENT GLOWING VIOLET ENERGY SHIELD DOME (CÚPULA ARCANA)
  // ============================================================================
  const shieldDomeGroup = new THREE.Group();
  shieldDomeGroup.position.set(-0.04, 1.92, 0);
  citadel.add(shieldDomeGroup);

  const domeTex = createCastleShieldDomeTexture();
  const shieldDomeMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8b4fe,
    emissive: 0x9333ea,
    emissiveIntensity: 0.65,
    map: domeTex,
    transparent: true,
    opacity: 0.34,
    roughness: 0.08,
    metalness: 0.05,
    transmission: 0.45,
    clearcoat: 1.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Upper Translucent Energy Dome Sphere enclosing the central spire & black hole vortex
  const shieldDomeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.52, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.72),
    shieldDomeMat
  );
  shieldDomeGroup.add(shieldDomeMesh);

  // Bright Glowing Violet-White Rim Ring at the base of the energy dome
  const domeBaseHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.032, 8, 40),
    whiteVoidLensMat
  );
  domeBaseHalo.rotation.x = Math.PI / 2;
  domeBaseHalo.position.y = -0.48;
  shieldDomeGroup.add(domeBaseHalo);

  root.userData.shieldDome = shieldDomeMesh;

  return root;
}

/**
 * Builds an Arched Stone Bridge with cobbled deck, stone archivolts, and crenellated parapets spanning over the valley river.
 */
export function buildStoneBridgeModel(): THREE.Group {
  const root = new THREE.Group();

  const bridgeStoneMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.78,
    metalness: 0.14,
  });
  const archDarkMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.88,
  });
  const cobbleDeckMat = new THREE.MeshStandardMaterial({
    color: 0x78716c,
    roughness: 0.84,
  });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.1,
  });

  // Gently arched bridge roadway deck
  const deckCenter = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.18, 1.92), cobbleDeckMat);
  deckCenter.position.y = 0.02;
  deckCenter.receiveShadow = true;
  deckCenter.castShadow = true;
  root.add(deckCenter);

  // Stone arch piers descending into the river water below
  [-0.95, 0.95].forEach((xPier) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.75, 2.05), archDarkMat);
    pier.position.set(xPier, -0.32, 0);
    pier.castShadow = true;
    pier.receiveShadow = true;
    root.add(pier);
  });

  // North & South stone parapets with crenellated posts and warm bridge lanterns
  [-0.88, 0.88].forEach((zSide) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.38, 0.18), bridgeStoneMat);
    wall.position.set(0, 0.24, zSide);
    wall.castShadow = true;
    wall.receiveShadow = true;
    root.add(wall);

    [-1.05, -0.35, 0.35, 1.05].forEach((xPos, idx) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.52, 0.24), archDarkMat);
      post.position.set(xPos, 0.3, zSide);
      post.castShadow = true;
      root.add(post);

      if (idx === 0 || idx === 3) {
        const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), lanternGlowMat);
        lantern.position.set(xPos, 0.64, zSide);
        root.add(lantern);
      }
    });
  });

  return root;
}

/**
 * Computes the exact sculpted 3D valley terrain height Y at any world (vx, vz) coordinate
 * so obstacles, perimeter trees, and pedestals are seated directly into the ground without floating.
 */
export function getValleyTerrainHeightAt(
  mapConfig: MapConfig,
  vx: number,
  vz: number,
  worldDepth = 32
): number {
  const offsetX = -((mapConfig.cols - 1) * TILE_SIZE) / 2;
  const offsetZ = -((mapConfig.rows - 1) * TILE_SIZE) / 2;
  const gridToWorldXZ = (col: number, row: number): [number, number] => [
    offsetX + col * TILE_SIZE,
    offsetZ + row * TILE_SIZE,
  ];

  const riverWorldX =
    mapConfig.riverCol !== undefined ? gridToWorldXZ(mapConfig.riverCol, 5)[0] : null;
  const bridgeWorldZ =
    mapConfig.bridgeRow !== undefined ? gridToWorldXZ(0, mapConfig.bridgeRow)[1] : 0;

  const playHalfW = (mapConfig.cols * TILE_SIZE) / 2;
  const playHalfD = (mapConfig.rows * TILE_SIZE) / 2;
  const dxOut = Math.max(0, Math.abs(vx) - playHalfW + 0.6);
  const dzOut = Math.max(0, Math.abs(vz) - playHalfD + 0.6);
  const edgeDist = Math.hypot(dxOut, dzOut);

  let y = -0.02;
  if (edgeDist > 0) {
    const hillNoise =
      Math.sin(vx * 0.35) * Math.cos(vz * 0.35) * 0.45 +
      Math.sin(vx * 0.8 + vz * 0.6) * 0.2;
    const isRiverCanyonGap = riverWorldX !== null && Math.abs(vx - riverWorldX) < 3.2;
    if (!isRiverCanyonGap) {
      y += Math.min(3.8, Math.pow(edgeDist * 0.28, 1.45) + Math.max(0, hillNoise));
    }
  } else {
    let minRoadDist = 999;
    for (const path of mapConfig.staticPaths) {
      for (const c of path) {
        const [rx, rz] = gridToWorldXZ(c.col, c.row);
        const d = Math.hypot(vx - rx, vz - rz);
        if (d < minRoadDist) minRoadDist = d;
      }
    }
    if (minRoadDist < 1.05) {
      y = -0.035;
    } else {
      y = -0.01 + Math.sin(vx * 0.9) * Math.cos(vz * 0.9) * 0.025;
    }
  }

  if (riverWorldX !== null) {
    const meanderX = riverWorldX + Math.sin((vz / worldDepth) * Math.PI * 2.5 - 0.6) * 0.45;
    const distToRiver = Math.abs(vx - meanderX);
    const distToBridge = Math.abs(vz - bridgeWorldZ);
    if (distToRiver < 1.45 && distToBridge > 0.85) {
      const depthFactor = Math.cos((distToRiver / 1.45) * (Math.PI / 2));
      y = -0.52 * depthFactor;
    }
  }

  return y;
}

/**
 * Synthesizes BOTH a high-definition pixel-level PBR Albedo Texture AND a matching Height/Bump Map
 * for the 3D Valley Diorama Terrain using multi-octave FBM noise, chiseled cellular Voronoi stone masonry,
 * directional bevel highlights, deep ambient-occlusion mortar crevices, and organic root-bed soil halos under trees.
 */
function createValleyTerrainTexturesPair(
  mapConfig: MapConfig,
  worldWidth: number,
  worldDepth: number,
  maxAnisotropy: number
): { albedoTex: THREE.CanvasTexture; bumpTex: THREE.CanvasTexture } {
  const cacheKeyAlbedo = `terrain_albedo_v5_${mapConfig.id}_${maxAnisotropy}`;
  const cacheKeyBump = `terrain_bump_v5_${mapConfig.id}_${maxAnisotropy}`;
  if (textureCache.has(cacheKeyAlbedo) && textureCache.has(cacheKeyBump)) {
    return {
      albedoTex: textureCache.get(cacheKeyAlbedo)!,
      bumpTex: textureCache.get(cacheKeyBump)!,
    };
  }

  const size = 1024;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const albedoCtx = albedoCanvas.getContext('2d')!;
  const albedoImg = albedoCtx.createImageData(size, size);
  const aData = albedoImg.data;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(size, size);
  const bData = bumpImg.data;

  const isDefaultCastleValley = mapConfig.id === 'bastion_del_alba';

  const offsetX = -((mapConfig.cols - 1) * TILE_SIZE) / 2;
  const offsetZ = -((mapConfig.rows - 1) * TILE_SIZE) / 2;
  const gridToWorldXZ = (col: number, row: number): [number, number] => [
    offsetX + col * TILE_SIZE,
    offsetZ + row * TILE_SIZE,
  ];

  // Dense Catmull-Rom road samples for fast distance lookup
  const roadSamples: Array<[number, number]> = [];
  for (const path of mapConfig.staticPaths) {
    if (path.length < 2) continue;
    const pts = path.map((c) => {
      const [wx, wz] = gridToWorldXZ(c.col, c.row);
      return new THREE.Vector3(wx, 0, wz);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.38);
    const spaced = curve.getSpacedPoints(180);
    for (const p of spaced) {
      roadSamples.push([p.x, p.z]);
    }
  }

  const spawnPoints = mapConfig.spawns.map((s) => gridToWorldXZ(s.col, s.row));
  const goalPoint = gridToWorldXZ(mapConfig.goal.col, mapConfig.goal.row);
  const obstaclePoints = mapConfig.obstacles.map((o) => gridToWorldXZ(o.col, o.row));
  const pedestalPoints = (mapConfig.pedestals || []).map((p) => gridToWorldXZ(p.col, p.row));
  const riverWorldX =
    mapConfig.riverCol !== undefined ? gridToWorldXZ(mapConfig.riverCol, 5)[0] : null;

  // Lush stylized fantasy meadow palette
  const meadowA = isDefaultCastleValley ? [62, 126, 68] : hexToRgb(mapConfig.theme.tileColorA);
  const meadowB = isDefaultCastleValley ? [34, 76, 42] : hexToRgb(mapConfig.theme.tileColorB);
  const forestHumus = [38, 28, 24];
  const cliffRock = isDefaultCastleValley ? [88, 84, 104] : hexToRgb(mapConfig.theme.obstacleColor);
  const roadStoneA = isDefaultCastleValley ? [124, 118, 142] : hexToRgb(mapConfig.theme.pathColor);
  const roadStoneB = [56, 50, 68];
  const leyGold = [250, 204, 21];
  const voidViolet = [192, 132, 252];

  const playHalfW = (mapConfig.cols * TILE_SIZE) / 2;
  const playHalfD = (mapConfig.rows * TILE_SIZE) / 2;

  for (let py = 0; py < size; py++) {
    const wz = (py / size - 0.5) * worldDepth;
    for (let px = 0; px < size; px++) {
      const wx = (px / size - 0.5) * worldWidth;

      // 1. Multi-octave FBM terrain noise & cellular Voronoi flagstone tessellation
      const fbmMacro = fbm2(wx * 0.22 + 5.2, wz * 0.22 + 8.7, 4);
      const fbmMicro = fbm2(wx * 1.65 + 11.4, wz * 1.65 + 3.9, 3);
      const fbmFine = fbm2(wx * 4.8 + 2.1, wz * 4.8 + 6.3, 2);

      const [vD1, vD2, vCell] = voronoi2(
        wx * 1.95 + fbmMicro * 0.26,
        wz * 1.95 + fbmMacro * 0.26
      );
      const rawGap = vD2 - vD1;
      // Sharp chiseled mortar groove (0 in seam, 1 on stone face)
      const stoneMortarGap = Math.min(1, Math.max(0, (rawGap - 0.035) * 7.5));
      const bevelRim = Math.exp(-Math.pow((rawGap - 0.085) / 0.045, 2));
      const stoneBlockBevel = Math.min(
        1,
        stoneMortarGap * (0.68 + fbmMicro * 0.28 + (fFineOrZero(fbmFine) - 0.5) * 0.16) +
          bevelRim * 0.24
      );

      // 2. Distance to nearest road sample
      let minRoadDistSq = 9999;
      for (let i = 0; i < roadSamples.length; i++) {
        const dx = wx - roadSamples[i][0];
        const dz = wz - roadSamples[i][1];
        const dSq = dx * dx + dz * dz;
        if (dSq < minRoadDistSq) minRoadDistSq = dSq;
      }
      const roadDist = Math.sqrt(minRoadDistSq);

      // Distance to nearest pedestal
      let minPedDistSq = 9999;
      for (let p = 0; p < pedestalPoints.length; p++) {
        const dx = wx - pedestalPoints[p][0];
        const dz = wz - pedestalPoints[p][1];
        const dSq = dx * dx + dz * dz;
        if (dSq < minPedDistSq) minPedDistSq = dSq;
      }
      const pedDist = Math.sqrt(minPedDistSq);

      // 3. Distance to Void Portals & Castle Citadel for glowing ley-line fractures
      let minPortalDist = Math.hypot(wx - goalPoint[0], wz - goalPoint[1]);
      for (let s = 0; s < spawnPoints.length; s++) {
        const pd = Math.hypot(wx - spawnPoints[s][0], wz - spawnPoints[s][1]);
        if (pd < minPortalDist) minPortalDist = pd;
      }

      // 4. Distance to Tree Obstacles for organic root-bed soil & golden spore integration
      let minTreeDist = 999;
      for (let o = 0; o < obstaclePoints.length; o++) {
        const td = Math.hypot(wx - obstaclePoints[o][0], wz - obstaclePoints[o][1]);
        if (td < minTreeDist) minTreeDist = td;
      }

      // 5. Base biome shading: Soft, lush stylized dark-fantasy meadow (no cobblestone grid on grass!)
      const dxOut = Math.max(0, Math.abs(wx) - playHalfW + 0.6);
      const dzOut = Math.max(0, Math.abs(wz) - playHalfD + 0.6);
      const cliffFactor = Math.min(1, Math.hypot(dxOut, dzOut) * 0.35);

      const mossMix = Math.min(1, Math.max(0, fbmMacro * 0.6 + fbmMicro * 0.4));
      const grassBlade = (fbmFine - 0.5) * 20;
      const sunKiss = Math.max(0, Math.sin(wx * 0.28 + wz * 0.24) * 0.5 + 0.5);

      let r = meadowB[0] * (1 - mossMix) + meadowA[0] * mossMix + grassBlade * 0.6 + sunKiss * 14;
      let g = meadowB[1] * (1 - mossMix) + meadowA[1] * mossMix + grassBlade + sunKiss * 20;
      let b = meadowB[2] * (1 - mossMix) + meadowA[2] * mossMix + grassBlade * 0.4 + sunKiss * 10;
      let bumpHeight = 0.42 + fbmMicro * 0.32 + fbmFine * 0.18;

      // Subtle mystical wildflower and clover florets in open grass areas
      if (fbmFine > 0.66 && vCell > 0.80 && minTreeDist > 1.3 && roadDist > 1.4 && cliffFactor < 0.05) {
        const isGoldenFloret = vCell > 0.90;
        const floretR = isGoldenFloret ? 245 : 130;
        const floretG = isGoldenFloret ? 210 : 215;
        const floretB = isGoldenFloret ? 70 : 255;
        r = r * 0.25 + floretR * 0.75;
        g = g * 0.25 + floretG * 0.75;
        b = b * 0.25 + floretB * 0.75;
        bumpHeight += 0.12;
      }

      const mortarAO = 0.22 + 0.78 * stoneMortarGap;

      // Carved stone foundations under tower pedestals
      if (pedDist < 1.05) {
        const pedT = Math.min(1, Math.max(0, (1.05 - pedDist) / 0.28));
        const pedSlab = mortarAO * (0.65 + stoneBlockBevel * 0.45) * (0.88 + (vCell - 0.5) * 0.24);
        r = r * (1 - pedT) + cliffRock[0] * pedSlab * pedT;
        g = g * (1 - pedT) + cliffRock[1] * pedSlab * pedT;
        b = b * (1 - pedT) + cliffRock[2] * pedSlab * pedT;
        bumpHeight = bumpHeight * (1 - pedT) + (0.35 + stoneBlockBevel * 0.55) * pedT;
      }

      // Organic root-bed soil & dark humus underneath tree groves
      if (minTreeDist < 1.6) {
        const treeBedMask = Math.pow(Math.max(0, 1 - minTreeDist / 1.6), 1.35);
        const rootRadial = Math.pow(
          Math.max(0, Math.cos(Math.atan2(wz, wx) * 7 + fbmMicro * 4.5)),
          4.0
        );
        const soilR = forestHumus[0] + rootRadial * 32;
        const soilG = forestHumus[1] + rootRadial * 24 + (1 - treeBedMask) * 14;
        const soilB = forestHumus[2] + rootRadial * 36;
        r = r * (1 - treeBedMask * 0.88) + soilR * (treeBedMask * 0.88);
        g = g * (1 - treeBedMask * 0.88) + soilG * (treeBedMask * 0.88);
        b = b * (1 - treeBedMask * 0.88) + soilB * (treeBedMask * 0.88);
        bumpHeight =
          bumpHeight * (1 - treeBedMask * 0.6) +
          (0.24 + rootRadial * 0.4 + fbmFine * 0.2) * (treeBedMask * 0.6);
      }

      // Stratified cliff rock on outer valley slopes
      if (cliffFactor > 0.01) {
        const strata = 0.5 + 0.5 * Math.sin(wx * 1.5 + wz * 1.3 + fbmMacro * 6.5);
        const rockVal = mortarAO * (0.46 + stoneBlockBevel * 0.5 + strata * 0.28);
        r = r * (1 - cliffFactor) + cliffRock[0] * rockVal * cliffFactor;
        g = g * (1 - cliffFactor) + cliffRock[1] * rockVal * cliffFactor;
        b = b * (1 - cliffFactor) + cliffRock[2] * rockVal * cliffFactor;
        bumpHeight =
          bumpHeight * (1 - cliffFactor) + (0.2 + stoneBlockBevel * 0.72) * cliffFactor;
      }

      // 6. River canyon gorge banks & wet cobblestone riverbed
      if (riverWorldX !== null) {
        const meanderX = riverWorldX + Math.sin((wz / worldDepth) * Math.PI * 2.5 - 0.6) * 0.45;
        const rDist = Math.abs(wx - meanderX);
        if (rDist < 1.9) {
          const bankT = Math.max(0, 1 - rDist / 1.9);
          const wetRock = mortarAO * (0.38 + stoneBlockBevel * 0.52);
          const wetR = 30 * wetRock;
          const wetG = 65 * wetRock;
          const wetB = 90 * wetRock;
          r = r * (1 - bankT) + wetR * bankT;
          g = g * (1 - bankT) + wetG * bankT;
          b = b * (1 - bankT) + wetB * bankT;
          bumpHeight = bumpHeight * (1 - bankT) + stoneBlockBevel * 0.5 * bankT;
        }
      }

      // Road dirt shoulder transition (between roadDist 0.82 and 1.35)
      if (roadDist < 1.35 && roadDist >= 0.82) {
        const shoulderT = Math.sin(((roadDist - 0.82) / 0.53) * Math.PI);
        const dirtR = 48 + fbmMicro * 14;
        const dirtG = 44 + fbmMicro * 10;
        const dirtB = 34 + fbmMicro * 8;
        r = r * (1 - shoulderT * 0.48) + dirtR * (shoulderT * 0.48);
        g = g * (1 - shoulderT * 0.48) + dirtG * (shoulderT * 0.48);
        b = b * (1 - shoulderT * 0.48) + dirtB * (shoulderT * 0.48);
      }

      // 7. Carved Voronoi Obsidian & Ancient-Stone Flagstone Roadway along staticPaths
      if (roadDist < 1.24) {
        const roadCoreT = Math.min(1, Math.max(0, (1.18 - roadDist) / 0.32));
        const curbRimMask = Math.exp(-Math.pow((roadDist - 0.84) / 0.13, 2));

        // High-definition chiseled Voronoi pavers on the roadbed
        const [rD1, rD2, rCell] = voronoi2(
          wx * 2.85 + fbmMicro * 0.22,
          wz * 2.85 + fbmMacro * 0.22
        );
        const rGap = rD2 - rD1;
        const paverMortar = Math.min(1, Math.max(0, (rGap - 0.032) * 8.2));
        const paverBevelHighlight = Math.exp(-Math.pow((rGap - 0.08) / 0.04, 2));
        const paverCrown = Math.max(0, 1 - rD1 * 0.78);
        const paverRelief = Math.min(
          1,
          paverMortar * (0.62 + paverCrown * 0.38) + paverBevelHighlight * 0.25
        );

        const blockTint = rCell;
        const microGrain = (fbmFine - 0.5) * 22;
        let pr =
          (roadStoneB[0] * (1 - blockTint) + roadStoneA[0] * blockTint) *
            (0.28 + paverRelief * 0.88) +
          microGrain * paverMortar;
        let pg =
          (roadStoneB[1] * (1 - blockTint) + roadStoneA[1] * blockTint) *
            (0.28 + paverRelief * 0.88) +
          microGrain * paverMortar;
        let pb =
          (roadStoneB[2] * (1 - blockTint) + roadStoneA[2] * blockTint) *
            (0.28 + paverRelief * 0.88) +
          microGrain * paverMortar;

        // Glowing Arcane-Gold & Void-Purple mortar veins in the stone crevices
        const mortarCrackMask = Math.max(0, 1 - paverMortar * 2.4);
        const portalProximity = Math.max(0.35, Math.exp(-minPortalDist / 8.5));
        const veinGlow = mortarCrackMask * portalProximity * (0.75 + 0.45 * fbmMacro);
        const isVioletVein = rCell > 0.5;
        pr += (isVioletVein ? voidViolet[0] : leyGold[0]) * veinGlow * 1.15;
        pg += (isVioletVein ? voidViolet[1] : leyGold[1]) * veinGlow * 1.15;
        pb += (isVioletVein ? voidViolet[2] : leyGold[2]) * veinGlow * 1.15;

        // Chiseled stone curb border highlight
        pr += curbRimMask * 38 * paverMortar;
        pg += curbRimMask * 34 * paverMortar;
        pb += curbRimMask * 44 * paverMortar;

        r = r * (1 - roadCoreT) + pr * roadCoreT;
        g = g * (1 - roadCoreT) + pg * roadCoreT;
        b = b * (1 - roadCoreT) + pb * roadCoreT;
        bumpHeight =
          bumpHeight * (1 - roadCoreT) +
          (0.12 + paverRelief * 0.82 + curbRimMask * 0.18) * roadCoreT;
      }

      const idx = (py * size + px) * 4;
      aData[idx] = Math.min(255, Math.max(0, Math.floor(r)));
      aData[idx + 1] = Math.min(255, Math.max(0, Math.floor(g)));
      aData[idx + 2] = Math.min(255, Math.max(0, Math.floor(b)));
      aData[idx + 3] = 255;

      const bh = Math.min(255, Math.max(0, Math.floor(bumpHeight * 255)));
      bData[idx] = bh;
      bData[idx + 1] = bh;
      bData[idx + 2] = bh;
      bData[idx + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  albedoTex.colorSpace = THREE.SRGBColorSpace;
  albedoTex.anisotropy = maxAnisotropy;
  albedoTex.needsUpdate = true;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.anisotropy = maxAnisotropy;
  bumpTex.needsUpdate = true;

  textureCache.set(cacheKeyAlbedo, albedoTex);
  textureCache.set(cacheKeyBump, bumpTex);

  return { albedoTex, bumpTex };
}

function fFineOrZero(val: number): number {
  return Number.isFinite(val) ? val : 0.5;
}

export function createPaintedValleyTerrainTexture(
  mapConfig: MapConfig,
  worldWidth: number,
  worldDepth: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  return createValleyTerrainTexturesPair(mapConfig, worldWidth, worldDepth, maxAnisotropy)
    .albedoTex;
}

/**
 * Builds the seamless, sculpted 3D Valley Diorama Terrain Mesh + PBR Voronoi Bump Map + River Water surface.
 */
export function buildSculptedValleyTerrainMesh(
  mapConfig: MapConfig,
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();

  const worldWidth = 44;
  const worldDepth = 32;
  const segX = 128;
  const segZ = 96;

  const terrainGeo = new THREE.PlaneGeometry(worldWidth, worldDepth, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);

  const offsetX = -((mapConfig.cols - 1) * TILE_SIZE) / 2;
  const riverWorldX =
    mapConfig.riverCol !== undefined ? offsetX + mapConfig.riverCol * TILE_SIZE : null;

  const posAttr = terrainGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const y = getValleyTerrainHeightAt(mapConfig, vx, vz, worldDepth);
    posAttr.setY(i, y);
  }
  terrainGeo.computeVertexNormals();

  const { albedoTex, bumpTex } = createValleyTerrainTexturesPair(
    mapConfig,
    worldWidth,
    worldDepth,
    maxAnisotropy
  );
  const terrainMat = new THREE.MeshStandardMaterial({
    map: albedoTex,
    bumpMap: bumpTex,
    bumpScale: 0.3,
    roughness: 0.78,
    metalness: 0.14,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

/**
 * Procedural animated water texture pair for the valley river:
 * flowing wave crests, crystalline caustics, and foamy banks.
 */
function createRiverWaterTexturesPair(
  maxAnisotropy: number
): { waterMap: THREE.CanvasTexture; waterBump: THREE.CanvasTexture } {
  const cacheKeyMap = `river_water_map_v2_${maxAnisotropy}`;
  const cacheKeyBump = `river_water_bump_v2_${maxAnisotropy}`;
  if (textureCache.has(cacheKeyMap) && textureCache.has(cacheKeyBump)) {
    return {
      waterMap: textureCache.get(cacheKeyMap)!,
      waterBump: textureCache.get(cacheKeyBump)!,
    };
  }

  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(w, h);
  const bData = bumpImg.data;

  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const distFromCenter = Math.abs(u - 0.5) * 2; // 0 in center, 1 at banks

      // Layered waves and flowing caustics
      const n1 = fbm2(u * 10.0 + 1.2, v * 16.0 + 3.4, 3);
      const n2 = fbm2(u * 22.0 + 5.1, v * 30.0 + 7.2, 2);
      const wave = Math.sin(v * 32.0 + n1 * 4.5 + Math.sin(u * 12.0) * 1.5) * 0.5 + 0.5;
      const caustic = Math.pow(Math.sin((u + v * 0.6) * 24.0 + n2 * 3.2) * 0.5 + 0.5, 3.2);

      // Bank foam: soft white froth along river banks
      const foamEdge = Math.max(0, (distFromCenter - 0.68) / 0.32);
      const foamNoise = fbm2(u * 28.0, v * 24.0, 3);
      const foam = Math.min(1, Math.pow(foamEdge, 1.3) * (0.55 + foamNoise * 0.75) + (wave > 0.85 ? 0.3 : 0));

      // Color gradient: deep sapphire in center, turquoise near edges, white on foam
      const deepR = 8, deepG = 84, deepB = 152;
      const shallowR = 14, shallowG = 175, shallowB = 240;
      const foamR = 230, foamG = 248, foamB = 255;

      let r = deepR * (1 - distFromCenter * 0.55) + shallowR * (distFromCenter * 0.55);
      let g = deepG * (1 - distFromCenter * 0.55) + shallowG * (distFromCenter * 0.55);
      let b = deepB * (1 - distFromCenter * 0.55) + shallowB * (distFromCenter * 0.55);

      // Add caustics highlight
      r += caustic * 40;
      g += caustic * 65;
      b += caustic * 80;

      // Add foam
      r = r * (1 - foam) + foamR * foam;
      g = g * (1 - foam) + foamG * foam;
      b = b * (1 - foam) + foamB * foam;

      const idx = (py * w + px) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.floor(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b)));
      data[idx + 3] = 255;

      const bumpVal = Math.min(
        255,
        Math.max(0, Math.floor((wave * 0.52 + caustic * 0.28 + foam * 0.48) * 255))
      );
      bData[idx] = bumpVal;
      bData[idx + 1] = bumpVal;
      bData[idx + 2] = bumpVal;
      bData[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const waterMap = new THREE.CanvasTexture(canvas);
  waterMap.colorSpace = THREE.SRGBColorSpace;
  waterMap.wrapS = THREE.RepeatWrapping;
  waterMap.wrapT = THREE.RepeatWrapping;
  waterMap.repeat.set(1, 4);
  waterMap.anisotropy = maxAnisotropy;
  waterMap.needsUpdate = true;

  const waterBump = new THREE.CanvasTexture(bumpCanvas);
  waterBump.wrapS = THREE.RepeatWrapping;
  waterBump.wrapT = THREE.RepeatWrapping;
  waterBump.repeat.set(1, 4);
  waterBump.anisotropy = maxAnisotropy;
  waterBump.needsUpdate = true;

  textureCache.set(cacheKeyMap, waterMap);
  textureCache.set(cacheKeyBump, waterBump);

  return { waterMap, waterBump };
}

  // Shimmering 3D river water plane with normal/bump ripple micro-relief
  if (riverWorldX !== null) {
    const waterGeo = new THREE.PlaneGeometry(3.3, worldDepth * 1.45, 24, 64);
    waterGeo.rotateX(-Math.PI / 2);
    const wPos = waterGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < wPos.count; i++) {
      const wz = wPos.getZ(i);
      const wx = wPos.getX(i);
      const meander = Math.sin((wz / worldDepth) * Math.PI * 2.5 - 0.6) * 0.45;
      wPos.setX(i, wx + meander);
    }
    waterGeo.computeVertexNormals();

    const { waterMap, waterBump } = createRiverWaterTexturesPair(maxAnisotropy);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x012a4a,
      emissiveIntensity: 0.06,
      map: waterMap,
      bumpMap: waterBump,
      bumpScale: 0.06,
      roughness: 0.25,
      metalness: 0.1,
      clearcoat: 0.35,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.88,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.name = 'riverWaterMesh';
    waterMesh.position.set(riverWorldX, -0.16, -3.5);
    waterMesh.receiveShadow = true;
    group.add(waterMesh);
  }

  return group;
}

/**
 * Builds the 3D Dark-Fantasy Horizon Panorama, FBM Nebula Sky Dome, Faceted Obsidian Peaks, and Perimeter Runic Forests.
 */
export function buildValleyEnvironmentBackdrop(mapConfig: MapConfig): THREE.Group {
  const group = new THREE.Group();
  const isDefaultCastleValley = mapConfig.id === 'bastion_del_alba';

  // 1. Pixel-level FBM Volumetric Twilight Nebula & Starfield Sky Dome
  const skyKey = `sky_dome_v3_${mapConfig.id}`;
  let skyTex = textureCache.get(skyKey);
  if (!skyTex) {
    const skyW = 512;
    const skyH = 256;
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = skyW;
    skyCanvas.height = skyH;
    const ctx = skyCanvas.getContext('2d')!;
    const imgData = ctx.createImageData(skyW, skyH);
    const data = imgData.data;

    const topRgb = [8, 10, 22];
    const midRgb = isDefaultCastleValley ? [59, 7, 100] : hexToRgb(mapConfig.theme.skyColor);
    const horizonRgb = isDefaultCastleValley ? [168, 85, 247] : hexToRgb(mapConfig.theme.crystalColor);

    for (let y = 0; y < skyH; y++) {
      const v = y / skyH;
      for (let x = 0; x < skyW; x++) {
        const u = x / skyW;
        const nx = Math.cos(u * Math.PI * 2) * 2.5;
        const ny = Math.sin(u * Math.PI * 2) * 2.5;
        const nebula = fbm2(nx + 4.2, v * 5.0 + ny + 1.8, 4);
        const auroraVeil = Math.pow(Math.max(0, Math.sin(u * Math.PI * 4 + nebula * 4.5)), 3.0) * Math.exp(-Math.pow((v - 0.48) / 0.18, 2));

        const tMid = Math.min(1, v / 0.58);
        const tHor = Math.max(0, Math.min(1, (v - 0.38) / 0.35)) * Math.max(0, 1 - Math.max(0, v - 0.72) / 0.28);

        let r = topRgb[0] * (1 - tMid) + midRgb[0] * tMid + horizonRgb[0] * tHor * (0.45 + nebula * 0.65) + auroraVeil * 145;
        let g = topRgb[1] * (1 - tMid) + midRgb[1] * tMid + horizonRgb[1] * tHor * (0.35 + nebula * 0.55) + auroraVeil * 75;
        let b = topRgb[2] * (1 - tMid) + midRgb[2] * tMid + horizonRgb[2] * tHor * (0.55 + nebula * 0.65) + auroraVeil * 195;

        // Crisp starfield in upper hemisphere
        if (v < 0.52) {
          const starHash = hash2(x * 1.3, y * 1.7);
          if (starHash > 0.9965) {
            const starBright = (1 - v / 0.52) * 220;
            r += starBright;
            g += starBright;
            b += starBright;
          }
        }

        const idx = (y * skyW + x) * 4;
        data[idx] = Math.min(255, Math.max(0, Math.floor(r)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b)));
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(skyKey, skyTex);
  }

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(92, 36, 24),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  group.add(skyDome);

  // 2. Sculpted Multi-Faceted Obsidian & Ancient Stone Mountain Ranges with Bump Relief
  const bumpMap = getMonsterMicroBumpTexture();
  const mountainRockMat = new THREE.MeshStandardMaterial({
    color: isDefaultCastleValley ? 0x262338 : new THREE.Color(mapConfig.theme.obstacleColor),
    bumpMap,
    bumpScale: 0.18,
    roughness: 0.78,
    metalness: 0.25,
  });
  const sunlitPeakMat = new THREE.MeshStandardMaterial({
    color: isDefaultCastleValley ? 0x464259 : 0x64748b,
    emissive: isDefaultCastleValley ? 0x3b0764 : 0x0f172a,
    emissiveIntensity: 0.25,
    bumpMap,
    bumpScale: 0.14,
    roughness: 0.65,
    metalness: 0.32,
  });
  const peakCrystalMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0x9333ea,
    emissiveIntensity: 1.35,
    roughness: 0.2,
  });

  const mountainSpecs: Array<{ x: number; z: number; r: number; h: number }> = [
    { x: 18, z: -22, r: 9.5, h: 21 },
    { x: 25, z: -15, r: 10.5, h: 24 },
    { x: 11, z: -26, r: 8.0, h: 16.5 },
    { x: 26, z: -4, r: 8.5, h: 15 },
    { x: -22, z: -20, r: 9.5, h: 19.5 },
    { x: -13, z: -25, r: 8.2, h: 16 },
    { x: -25, z: -10, r: 8.5, h: 15.5 },
    { x: -5.5, z: -32, r: 7.5, h: 13.5 },
    { x: 5.5, z: -32, r: 7.5, h: 14.0 },
    { x: -21, z: 14, r: 6.5, h: 9.5 },
    { x: 22, z: 13, r: 6.8, h: 10.5 },
  ];

  mountainSpecs.forEach((m, idx) => {
    const peakGroup = new THREE.Group();
    const baseCone = new THREE.Mesh(
      new THREE.ConeGeometry(m.r, m.h, 7),
      mountainRockMat
    );
    baseCone.position.y = m.h * 0.42;
    baseCone.rotation.y = idx * 0.9;
    baseCone.castShadow = true;
    baseCone.receiveShadow = true;
    peakGroup.add(baseCone);

    const upperCap = new THREE.Mesh(
      new THREE.ConeGeometry(m.r * 0.56, m.h * 0.48, 7),
      sunlitPeakMat
    );
    upperCap.position.y = m.h * 0.68;
    upperCap.rotation.y = idx * 0.9 + 0.15;
    peakGroup.add(upperCap);

    // Flanking secondary crag spire + glowing void crystal vein
    const flankSpire = new THREE.Mesh(
      new THREE.ConeGeometry(m.r * 0.42, m.h * 0.62, 6),
      mountainRockMat
    );
    flankSpire.position.set(m.r * 0.38, m.h * 0.28, m.r * 0.22);
    flankSpire.rotation.set(0.08, idx * 1.3, -0.14);
    peakGroup.add(flankSpire);

    if (idx % 2 === 0) {
      const crystalShard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65, 0),
        peakCrystalMat
      );
      crystalShard.scale.set(0.6, 2.4, 0.6);
      crystalShard.position.set(-m.r * 0.25, m.h * 0.45, m.r * 0.35);
      crystalShard.rotation.z = 0.28;
      peakGroup.add(crystalShard);
    }

    peakGroup.position.set(m.x, -1.2, m.z);
    group.add(peakGroup);
  });

  // 3. Dense Perimeter Ancient Runic Void Forests seated directly into the sculpted valley slopes
  const perimeterTreeCoords: Array<[number, number, number]> = [
    [-16.5, -10.5, 1.35],
    [-14.0, -11.5, 1.25],
    [-11.0, -11.8, 1.4],
    [-8.0, -11.5, 1.15],
    [-4.5, -11.8, 1.3],
    [2.5, -11.5, 1.2],
    [8.5, -11.5, 1.35],
    [13.5, -11.2, 1.45],
    [-17.2, -5.5, 1.3],
    [-17.5, 0.5, 1.4],
    [-17.0, 5.5, 1.25],
    [-16.5, 10.2, 1.45],
    [-12.5, 11.5, 1.35],
    [-7.5, 11.8, 1.25],
    [-2.5, 11.6, 1.4],
    [3.5, 11.8, 1.35],
    [9.5, 11.5, 1.3],
    [15.5, 11.2, 1.45],
  ];

  perimeterTreeCoords.forEach(([tx, tz, sc], idx) => {
    const cluster = buildPineForestObstacleModel(idx);
    const groundY = getValleyTerrainHeightAt(mapConfig, tx, tz);
    cluster.position.set(tx, groundY - 0.04, tz);
    cluster.scale.setScalar(sc);
    cluster.rotation.y = ((idx % 3) - 1) * 0.32;
    group.add(cluster);
  });

  return group;
}

/**
 * Builds 3D Sculpted Obsidian & Bronze-Stone Road Curbs, Bevelled Flagstones, and Recessed Arcane Runic Chevrons (>>).
 */
export function buildOrganicRoadRibbonAndChevrons(mapConfig: MapConfig): THREE.Group {
  const group = new THREE.Group();

  const offsetX = -((mapConfig.cols - 1) * TILE_SIZE) / 2;
  const offsetZ = -((mapConfig.rows - 1) * TILE_SIZE) / 2;
  const gridToWorldXZ = (col: number, row: number): THREE.Vector3 =>
    new THREE.Vector3(offsetX + col * TILE_SIZE, 0, offsetZ + row * TILE_SIZE);

  // 3D Extruded / Bevelled Arcane Chevron Rune Geometry
  const chevronShape = new THREE.Shape();
  chevronShape.moveTo(-0.18, -0.22);
  chevronShape.lineTo(0.12, 0);
  chevronShape.lineTo(-0.18, 0.22);
  chevronShape.lineTo(-0.06, 0.22);
  chevronShape.lineTo(0.24, 0);
  chevronShape.lineTo(-0.06, -0.22);
  chevronShape.closePath();

  const chevronGeo = new THREE.ShapeGeometry(chevronShape);
  chevronGeo.rotateX(-Math.PI / 2);

  const chevronRuneMat = new THREE.MeshStandardMaterial({
    color: 0xd8b4fe,
    emissive: 0xa855f7,
    emissiveIntensity: 1.45,
    roughness: 0.25,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const chevronGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xd97706,
    emissiveIntensity: 1.25,
    roughness: 0.3,
    metalness: 0.65,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const bumpTex = getMonsterMicroBumpTexture();
  const curbObsidianMat = new THREE.MeshStandardMaterial({
    color: 0x262338,
    bumpMap: bumpTex,
    bumpScale: 0.06,
    roughness: 0.68,
    metalness: 0.35,
  });
  const flagstoneMat = new THREE.MeshStandardMaterial({
    color: 0x3b354d,
    bumpMap: bumpTex,
    bumpScale: 0.05,
    roughness: 0.74,
    metalness: 0.25,
  });
  const bronzeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    emissive: 0x451a03,
    emissiveIntensity: 0.22,
    roughness: 0.38,
    metalness: 0.78,
  });

  const curbGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.09, 6);
  const flagstoneGeo = new THREE.CylinderGeometry(0.26, 0.29, 0.032, 6);
  const bronzeCapGeo = new THREE.OctahedronGeometry(0.055, 0);

  mapConfig.staticPaths.forEach((path) => {
    if (path.length < 2) return;
    const pts = path.map((c) => gridToWorldXZ(c.col, c.row));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.38);

    // 1. Place 3D hexagonal/polygonal carved obsidian curbstones & road flagstones along the winding road
    const curbCount = path.length * 3;
    for (let i = 1; i < curbCount - 1; i++) {
      const u = i / curbCount;
      const pt = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);

      if (
        mapConfig.riverCol !== undefined &&
        Math.abs(pt.x - (offsetX + mapConfig.riverCol * TILE_SIZE)) < 1.3
      ) {
        continue;
      }

      const normalX = -tan.z;
      const normalZ = tan.x;
      const heading = Math.atan2(tan.x, tan.z);

      [-0.82, 0.82].forEach((sideOffset, sIdx) => {
        const curb = new THREE.Mesh(curbGeo, curbObsidianMat);
        curb.position.set(
          pt.x + normalX * sideOffset,
          0.01,
          pt.z + normalZ * sideOffset
        );
        curb.scale.set(1.25, 1.0, 0.85);
        curb.rotation.y = heading + ((i + sIdx) % 3) * 0.4;
        curb.castShadow = true;
        curb.receiveShadow = true;
        group.add(curb);

        // Every 4th curbstone features an Arcane-Gold/Bronze stud cap
        if (i % 4 === 0) {
          const cap = new THREE.Mesh(bronzeCapGeo, bronzeTrimMat);
          cap.position.set(
            pt.x + normalX * sideOffset,
            0.06,
            pt.z + normalZ * sideOffset
          );
          cap.scale.set(1.0, 0.55, 1.0);
          group.add(cap);
        }
      });

      // Staggered 3D bevelled obsidian flagstones inlaid along the road surface
      const sideJitter = ((i % 3) - 1) * 0.36;
      const paver = new THREE.Mesh(flagstoneGeo, flagstoneMat);
      paver.position.set(
        pt.x + normalX * sideJitter,
        -0.028,
        pt.z + normalZ * sideJitter
      );
      paver.scale.set(1.15 + (i % 2) * 0.25, 1.0, 0.9 + ((i + 1) % 2) * 0.25);
      paver.rotation.y = heading + i * 0.52;
      paver.receiveShadow = true;
      group.add(paver);
    }

    // 2. Place recessed Arcane-Gold & Void-Purple directional double-chevron (>>) runes along the road center
    const chevronCount = Math.max(8, Math.floor(path.length * 0.65));
    for (let i = 1; i < chevronCount; i++) {
      const u = i / chevronCount;
      const pt = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const heading = Math.atan2(tan.z, tan.x);

      const pairGroup = new THREE.Group();
      [-0.16, 0.16].forEach((offsetAlong, cIdx) => {
        const ch = new THREE.Mesh(
          chevronGeo,
          cIdx === 0 ? chevronRuneMat : chevronGoldMat
        );
        ch.position.x = offsetAlong;
        pairGroup.add(ch);
      });

      pairGroup.position.set(pt.x, 0.008, pt.z);
      pairGroup.rotation.y = -heading;
      group.add(pairGroup);
    }
  });

  return group;
}


