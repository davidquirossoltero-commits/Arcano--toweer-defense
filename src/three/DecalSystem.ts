import * as THREE from 'three';

export type DecalPreset =
  | 'meteor_scorch'
  | 'stasis_glyph'
  | 'golem_spawn_footprint'
  | 'monster_spawn_footprint'
  | 'monster_paw_track'
  | 'boss_crater'
  | 'tower_fusion_sigil';

interface ActiveDecalInstance {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  age: number;
  lifetime: number;
  initialScale: number;
  targetScale: number;
  spinSpeed: number;
  fadeStartRatio: number;
}

const decalTextureCache = new Map<string, THREE.CanvasTexture>();

function hash2D(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmDecal(x: number, y: number): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    v += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return v;
}

/**
 * Draws an intricate Elder-Arcane runic ring on a 2D canvas context.
 */
function drawArcaneRuneRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  strokePrimary: string,
  strokeSecondary: string,
  glyphSize = 10
) {
  ctx.save();
  ctx.strokeStyle = strokePrimary;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + glyphSize * 1.15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = strokeSecondary;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - glyphSize * 1.15, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const gx = cx + Math.cos(angle) * radius;
    const gy = cy + Math.sin(angle) * radius;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(angle + Math.PI / 2);
    ctx.strokeStyle = i % 2 === 0 ? strokePrimary : strokeSecondary;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const g = i % 4;
    if (g === 0) {
      ctx.moveTo(0, -glyphSize);
      ctx.lineTo(-glyphSize * 0.55, 0);
      ctx.lineTo(0, glyphSize);
      ctx.lineTo(glyphSize * 0.55, 0);
      ctx.closePath();
      ctx.moveTo(0, -glyphSize);
      ctx.lineTo(0, glyphSize);
    } else if (g === 1) {
      ctx.moveTo(-glyphSize * 0.5, -glyphSize * 0.8);
      ctx.lineTo(glyphSize * 0.5, -glyphSize * 0.8);
      ctx.lineTo(-glyphSize * 0.5, glyphSize * 0.8);
      ctx.lineTo(glyphSize * 0.5, glyphSize * 0.8);
      ctx.closePath();
    } else if (g === 2) {
      ctx.moveTo(0, glyphSize);
      ctx.lineTo(0, -glyphSize);
      ctx.moveTo(-glyphSize * 0.6, -glyphSize * 0.25);
      ctx.lineTo(0, -glyphSize);
      ctx.lineTo(glyphSize * 0.6, -glyphSize * 0.25);
    } else {
      ctx.moveTo(-glyphSize * 0.6, glyphSize * 0.6);
      ctx.lineTo(0, -glyphSize * 0.85);
      ctx.lineTo(glyphSize * 0.6, glyphSize * 0.6);
      ctx.moveTo(-glyphSize * 0.35, glyphSize * 0.15);
      ctx.lineTo(glyphSize * 0.35, glyphSize * 0.15);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Generates high-resolution, shader-grade procedural textures for terrain surface & screen-space decals.
 * Replaces simplistic cartoon shapes with FBM-shaded volcanic craters, cryo-astrolabes, and runic seals.
 */
function getDecalTexture(preset: DecalPreset, maxAnisotropy: number): THREE.CanvasTexture {
  const key = `${preset}_${maxAnisotropy}`;
  if (decalTextureCache.has(key)) return decalTextureCache.get(key)!;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  if (preset === 'meteor_scorch' || preset === 'boss_crater') {
    const isBoss = preset === 'boss_crater';
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    // Pixel-level FBM volcanic impact crater & radial tectonic fissures
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - cx) / (size * 0.5);
        const dy = (y - cy) / (size * 0.5);
        const r = Math.hypot(dx, dy);
        if (r > 0.98) continue;

        const angle = Math.atan2(dy, dx);
        const n = fbmDecal(dx * 5.5 + 3.1, dy * 5.5 + 7.4);
        const angularCrack = Math.pow(
          Math.abs(Math.sin(angle * 7 + n * 4.2)),
          14
        );
        const secondaryCrack = Math.pow(
          Math.abs(Math.cos(angle * 13 - n * 5.0)),
          18
        );

        const rimGlow = Math.exp(-Math.pow((r - 0.52 + (n - 0.5) * 0.14) / 0.11, 2));
        const coreGlow = Math.max(0, 1 - r / 0.36) * (0.7 + 0.3 * n);
        const fissureIntensity =
          (angularCrack + secondaryCrack * 0.65) * Math.max(0, 1 - r / 0.92);

        const charMask = Math.max(0, 1 - Math.pow(r / 0.92, 2.2)) * (0.65 + 0.35 * n);
        const heat = Math.min(1, coreGlow * 1.25 + rimGlow * 0.65 + fissureIntensity * 0.95);

        const idx = (y * size + x) * 4;
        if (isBoss) {
          data[idx] = Math.min(255, Math.floor(18 + heat * 237));
          data[idx + 1] = Math.min(255, Math.floor(10 + Math.pow(heat, 1.6) * 185));
          data[idx + 2] = Math.min(255, Math.floor(24 + Math.pow(heat, 1.2) * 245));
        } else {
          data[idx] = Math.min(255, Math.floor(22 + heat * 233));
          data[idx + 1] = Math.min(255, Math.floor(14 + Math.pow(heat, 1.55) * 210));
          data[idx + 2] = Math.min(255, Math.floor(12 + Math.pow(heat, 2.8) * 140));
        }
        const alpha = Math.min(1, Math.max(charMask * 0.85, heat * 0.95)) * (1 - Math.pow(r, 4));
        data[idx + 3] = Math.floor(alpha * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Subtle engraved obsidian shockwave ring
    drawArcaneRuneRing(
      ctx,
      cx,
      cy,
      152,
      16,
      isBoss ? 'rgba(216, 180, 254, 0.78)' : 'rgba(253, 186, 116, 0.72)',
      isBoss ? 'rgba(244, 63, 94, 0.65)' : 'rgba(239, 68, 68, 0.58)',
      8
    );
  } else if (preset === 'stasis_glyph') {
    // High-precision Crystalline Cryo-Astrolabe & Sacred Geometry Containment Seal
    const bgGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 236);
    bgGrad.addColorStop(0, 'rgba(224, 242, 254, 0.55)');
    bgGrad.addColorStop(0.38, 'rgba(56, 189, 248, 0.32)');
    bgGrad.addColorStop(0.75, 'rgba(14, 116, 144, 0.18)');
    bgGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 236, 0, Math.PI * 2);
    ctx.fill();

    drawArcaneRuneRing(
      ctx,
      cx,
      cy,
      196,
      24,
      'rgba(186, 230, 253, 0.92)',
      'rgba(56, 189, 248, 0.78)',
      9
    );

    // Dual interlocking hexagrams (12-pointed crystalline star)
    ctx.save();
    ctx.translate(cx, cy);
    for (let s = 0; s < 4; s++) {
      ctx.save();
      ctx.rotate((s * Math.PI) / 6);
      ctx.strokeStyle = s % 2 === 0 ? 'rgba(224, 242, 254, 0.88)' : 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = s % 2 === 0 ? 3.2 : 2.2;
      ctx.beginPath();
      for (let v = 0; v < 3; v++) {
        const a = (v * Math.PI * 2) / 3 - Math.PI / 2;
        const px = Math.cos(a) * 158;
        const py = Math.sin(a) * 158;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Intricate 6-pointed dendritic snowflake core
    ctx.strokeStyle = '#f0f9ff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3.5;
    for (let arm = 0; arm < 6; arm++) {
      const a = (arm * Math.PI) / 3;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -112);
      // Dendritic crystal branches
      [-42, -74, -96].forEach((by, bIdx) => {
        const span = 24 - bIdx * 5;
        ctx.moveTo(0, by);
        ctx.lineTo(-span, by - span * 0.7);
        ctx.moveTo(0, by);
        ctx.lineTo(span, by - span * 0.7);
      });
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } else if (preset === 'golem_spawn_footprint' || preset === 'monster_spawn_footprint') {
    // Arcane Dimensional Rift Seal / Sentinel Summoning Sigil (replaces cartoon paw prints)
    const isAlly = preset === 'golem_spawn_footprint';
    const primaryHex = isAlly ? '#6ee7b7' : '#d8b4fe';
    const secondaryHex = isAlly ? '#38bdf8' : '#f43f5e';
    const coreGlowRgba = isAlly ? 'rgba(16, 185, 129, 0.48)' : 'rgba(168, 85, 247, 0.48)';
    const midGlowRgba = isAlly ? 'rgba(14, 165, 233, 0.24)' : 'rgba(225, 29, 72, 0.24)';

    const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, 228);
    grad.addColorStop(0, coreGlowRgba);
    grad.addColorStop(0.52, midGlowRgba);
    grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 228, 0, Math.PI * 2);
    ctx.fill();

    drawArcaneRuneRing(ctx, cx, cy, 184, 20, primaryHex, secondaryHex, 10);

    // Inscribed octagonal & diamond arcane matrix
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = primaryHex;
    ctx.shadowBlur = 10;
    for (let k = 0; k < 2; k++) {
      ctx.save();
      ctx.rotate((k * Math.PI) / 4);
      ctx.strokeStyle = k === 0 ? primaryHex : secondaryHex;
      ctx.lineWidth = 3;
      ctx.strokeRect(-108, -108, 216, 216);
      ctx.restore();
    }

    // 8 Radial ley-line spears converging on central diamond
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 38, Math.sin(a) * 38);
      ctx.lineTo(Math.cos(a) * 145, Math.sin(a) * 145);
      ctx.stroke();
    }

    // Central faceted diamond core
    ctx.fillStyle = primaryHex;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(24, 0);
    ctx.lineTo(0, 34);
    ctx.lineTo(-24, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (preset === 'monster_paw_track') {
    // Subtle fractured obsidian & arcane dust step-imprint (replaces cartoon oval+triangle paw)
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - cx) / (size * 0.5);
        const dy = (y - cy) / (size * 0.5);
        const r = Math.hypot(dx * 1.15, dy * 0.95);
        if (r > 0.72) continue;

        const n = fbmDecal(dx * 7.5 + 1.9, dy * 7.5 + 4.3);
        const angle = Math.atan2(dy, dx);
        const fracture = Math.pow(Math.abs(Math.sin(angle * 5 + n * 3.5)), 12);

        const depression = Math.max(0, 1 - Math.pow(r / 0.62, 2)) * (0.55 + 0.45 * n);
        const rimRune = Math.exp(-Math.pow((r - 0.42) / 0.06, 2)) * (0.5 + 0.5 * fracture);
        const glow = Math.min(1, fracture * (1 - r / 0.68) * 0.85 + rimRune * 0.9);

        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, Math.floor(24 + glow * 190));
        data[idx + 1] = Math.min(255, Math.floor(20 + glow * 165));
        data[idx + 2] = Math.min(255, Math.floor(38 + glow * 225));
        const alpha = Math.min(0.68, (depression * 0.42 + glow * 0.55) * (1 - r / 0.72));
        data[idx + 3] = Math.floor(Math.max(0, alpha) * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } else {
    // 'tower_fusion_sigil' — Grand Golden-Violet Alchemical Transmutation Circle
    const halo = ctx.createRadialGradient(cx, cy, 12, cx, cy, 240);
    halo.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
    halo.addColorStop(0.45, 'rgba(245, 158, 11, 0.38)');
    halo.addColorStop(0.78, 'rgba(168, 85, 247, 0.22)');
    halo.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 240, 0, Math.PI * 2);
    ctx.fill();

    drawArcaneRuneRing(
      ctx,
      cx,
      cy,
      198,
      24,
      'rgba(253, 224, 71, 0.95)',
      'rgba(192, 132, 252, 0.88)',
      10
    );

    drawArcaneRuneRing(
      ctx,
      cx,
      cy,
      128,
      16,
      'rgba(186, 230, 253, 0.9)',
      'rgba(251, 191, 36, 0.85)',
      7
    );

    // Inscribed Octagram
    for (let sq = 0; sq < 2; sq++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((sq * Math.PI) / 4);
      ctx.strokeStyle = sq === 0 ? '#fde047' : '#d8b4fe';
      ctx.shadowColor = sq === 0 ? '#f59e0b' : '#a855f7';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(-132, -132, 264, 264);
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  decalTextureCache.set(key, tex);
  return tex;
}

/**
 * Custom Screen-Space & Terrain Surface Projected Decal Shader:
 * Computes screen-space UV coordinates (`gl_FragCoord.xy / uResolution`) for a subtle
 * screen-space scanline/refraction shimmer while projecting the decal texture onto the terrain.
 */
function createScreenSpaceDecalMaterial(
  texture: THREE.Texture,
  tintHex: string,
  resolution: THREE.Vector2
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    uniforms: {
      uMap: { value: texture },
      uTint: { value: new THREE.Color(tintHex) },
      uOpacity: { value: 1.0 },
      uTime: { value: 0.0 },
      uResolution: { value: resolution },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec4 vScreenPos;
      void main() {
        vUv = uv;
        vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vScreenPos = clipPos;
        gl_Position = clipPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uTint;
      uniform float uOpacity;
      uniform float uTime;
      uniform vec2 uResolution;
      varying vec2 vUv;
      varying vec4 vScreenPos;

      void main() {
        vec4 texColor = texture2D(uMap, vUv);
        if (texColor.a < 0.01) discard;

        // Screen-space normalized coordinate for subtle arcane interference shimmer
        vec2 screenUv = (vScreenPos.xy / max(vScreenPos.w, 0.0001)) * 0.5 + 0.5;
        float screenPulse = 0.94 + 0.06 * sin(screenUv.y * 72.0 - uTime * 4.5);

        vec3 finalRgb = mix(texColor.rgb, texColor.rgb * uTint * 1.32, 0.62) * screenPulse;
        gl_FragColor = vec4(finalRgb, texColor.a * uOpacity);
      }
    `,
  });
}

export class DecalSystem {
  private parentGroup: THREE.Group;
  private decals: ActiveDecalInstance[] = [];
  private sharedPlaneGeo: THREE.PlaneGeometry;
  private maxAnisotropy: number;
  private resolution: THREE.Vector2 = new THREE.Vector2(window.innerWidth, window.innerHeight);

  // Interactive Live Spell Targeting Screen-Space Decal Reticle
  private targetingReticleMesh: THREE.Mesh;
  private targetingReticleMat: THREE.ShaderMaterial;

  constructor(parentGroup: THREE.Group, maxAnisotropy = 4) {
    this.parentGroup = parentGroup;
    this.maxAnisotropy = maxAnisotropy;

    this.sharedPlaneGeo = new THREE.PlaneGeometry(1, 1);
    this.sharedPlaneGeo.rotateX(-Math.PI / 2);

    const reticleTex = getDecalTexture('stasis_glyph', this.maxAnisotropy);
    this.targetingReticleMat = createScreenSpaceDecalMaterial(
      reticleTex,
      '#10b981',
      this.resolution
    );
    this.targetingReticleMesh = new THREE.Mesh(this.sharedPlaneGeo, this.targetingReticleMat);
    this.targetingReticleMesh.position.y = 0.045;
    this.targetingReticleMesh.visible = false;
    this.targetingReticleMesh.renderOrder = 2;
    this.parentGroup.add(this.targetingReticleMesh);
  }

  public setResolution(width: number, height: number) {
    this.resolution.set(width, height);
  }

  /**
   * Updates the live interactive spell-targeting decal projected on the terrain surface under the cursor.
   */
  public updateTargetingDecal(
    visible: boolean,
    worldPos?: THREE.Vector3,
    radius = 2.5,
    colorHex = '#10b981',
    preset: DecalPreset = 'golem_spawn_footprint',
    surfaceY = 0.045
  ) {
    this.targetingReticleMesh.visible = visible;
    if (!visible || !worldPos) return;

    this.targetingReticleMat.uniforms.uMap.value = getDecalTexture(preset, this.maxAnisotropy);
    this.targetingReticleMat.uniforms.uTint.value.set(colorHex);
    this.targetingReticleMat.uniforms.uOpacity.value = 0.88;
    this.targetingReticleMesh.position.set(worldPos.x, surfaceY, worldPos.z);
    this.targetingReticleMesh.scale.setScalar(radius * 2);
  }

  /**
   * Spawns a screen-space / terrain surface decal at the specified world coordinates.
   */
  public spawnDecal(options: {
    preset: DecalPreset;
    position: THREE.Vector3;
    radius: number;
    colorHex?: string;
    lifetime?: number;
    rotationY?: number;
    spinSpeed?: number;
    surfaceY?: number;
  }) {
    // Cap active decals to 75 to keep frame rate silky-smooth
    if (this.decals.length >= 75) {
      const oldest = this.decals.shift()!;
      this.parentGroup.remove(oldest.mesh);
      oldest.material.dispose();
    }

    const tex = getDecalTexture(options.preset, this.maxAnisotropy);
    const defaultTint =
      options.preset === 'meteor_scorch'
        ? '#f97316'
        : options.preset === 'stasis_glyph'
        ? '#38bdf8'
        : options.preset === 'golem_spawn_footprint'
        ? '#10b981'
        : options.preset === 'monster_spawn_footprint'
        ? '#a855f7'
        : options.preset === 'boss_crater'
        ? '#ef4444'
        : options.preset === 'tower_fusion_sigil'
        ? '#f59e0b'
        : '#a855f7';

    const mat = createScreenSpaceDecalMaterial(
      tex,
      options.colorHex || defaultTint,
      this.resolution
    );

    const mesh = new THREE.Mesh(this.sharedPlaneGeo, mat);
    const yLevel = options.surfaceY ?? -0.025;
    mesh.position.set(options.position.x, yLevel, options.position.z);
    mesh.rotation.y = options.rotationY ?? Math.random() * Math.PI * 2;
    mesh.renderOrder = 1;

    const targetScale = options.radius * 2;
    const initialScale =
      options.preset === 'monster_paw_track' ? targetScale * 0.85 : targetScale * 0.25;
    mesh.scale.setScalar(initialScale);

    this.parentGroup.add(mesh);

    this.decals.push({
      mesh,
      material: mat,
      age: 0,
      lifetime: options.lifetime ?? 9.0,
      initialScale,
      targetScale,
      spinSpeed: options.spinSpeed ?? 0,
      fadeStartRatio: 0.65,
    });
  }

  public update(dt: number, elapsedTime: number) {
    if (this.targetingReticleMesh.visible) {
      this.targetingReticleMesh.rotation.y = elapsedTime * 0.9;
      this.targetingReticleMat.uniforms.uTime.value = elapsedTime;
      const pulse = 1 + Math.sin(elapsedTime * 5.0) * 0.05;
      this.targetingReticleMesh.scale.multiplyScalar(
        pulse / (this.targetingReticleMesh.userData.lastPulse || 1)
      );
      this.targetingReticleMesh.userData.lastPulse = pulse;
    }

    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.age += dt;
      if (d.age >= d.lifetime) {
        this.parentGroup.remove(d.mesh);
        d.material.dispose();
        this.decals.splice(i, 1);
        continue;
      }

      const progress = d.age / d.lifetime;
      // Fast pop-in expansion during first 12% of lifetime
      const expandT = Math.min(1, d.age / 0.18);
      const easeOut = 1 - Math.pow(1 - expandT, 3);
      const currentScale = THREE.MathUtils.lerp(d.initialScale, d.targetScale, easeOut);
      d.mesh.scale.setScalar(currentScale);

      if (d.spinSpeed !== 0) {
        d.mesh.rotation.y += d.spinSpeed * dt;
      }

      // Smooth fade out after fadeStartRatio
      let opacity = 0.92;
      if (progress > d.fadeStartRatio) {
        const fadeT = (progress - d.fadeStartRatio) / (1 - d.fadeStartRatio);
        opacity = 0.92 * (1 - fadeT);
      }
      d.material.uniforms.uOpacity.value = opacity;
      d.material.uniforms.uTime.value = elapsedTime;
    }
  }

  public clearAll() {
    for (const d of this.decals) {
      this.parentGroup.remove(d.mesh);
      d.material.dispose();
    }
    this.decals = [];
    this.targetingReticleMesh.visible = false;
  }

  public dispose() {
    this.clearAll();
    this.parentGroup.remove(this.targetingReticleMesh);
    this.targetingReticleMat.dispose();
    this.sharedPlaneGeo.dispose();
  }
}
