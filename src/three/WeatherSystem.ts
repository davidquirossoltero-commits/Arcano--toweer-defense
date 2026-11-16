import * as THREE from 'three';
import { MapConfig, WEATHER_SPECS, WeatherType } from '../types/game';

const MAX_WEATHER_PARTICLES = 650;
const BOUNDS_XZ = 27;
const MIN_Y = -0.5;
const MAX_Y = 23.0;

/**
 * Global 3D Dynamic Weather System managed by GameEngine.
 * Controls:
 * 1. Continuous global atmospheric particles (Arcane Snowflakes, Abyssal Fog Wisps, Volcanic Embers, Aether Storm Rain, Astral Motes).
 * 2. Smooth interpolation of scene sky color, exponential fog color & density, and directional/hemisphere lighting mood.
 * 3. Ground frost / mist shimmer planes and periodic lightning flashes during Aether Storms.
 */
export class WeatherSystem {
  private parentGroup: THREE.Group;
  private isSoftwareGl: boolean;
  private currentWeather: WeatherType = 'clear';

  // Global Particle Buffer (THREE.Points)
  private pointsMesh: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private phases: Float32Array;
  private pointsMaterial: THREE.PointsMaterial;

  // Low-lying volumetric ground mist rings (visible during dense_fog & arcane_snow)
  private mistGroup: THREE.Group = new THREE.Group();
  private mistPlanes: THREE.Mesh[] = [];

  // Cached Procedural Particle Sprite Textures per WeatherType
  private textures: Record<WeatherType, THREE.CanvasTexture>;

  // Smoothly interpolated atmosphere state
  private targetSkyColor = new THREE.Color('#090d16');
  private targetFogColor = new THREE.Color('#0f172a');
  private targetLightColor = new THREE.Color('#fffbeb');
  private currentSkyColor = new THREE.Color('#090d16');
  private currentFogColor = new THREE.Color('#0f172a');
  private currentLightColor = new THREE.Color('#fffbeb');
  private currentFogDensity = 0.016;
  private targetFogDensity = 0.016;
  private currentLightIntensityMult = 1.0;
  private targetLightIntensityMult = 1.0;

  // Storm lightning flash timer
  private lightningFlashIntensity = 0;
  private nextLightningTimer = 4.5;

  constructor(parentGroup: THREE.Group, isSoftwareGl: boolean) {
    this.parentGroup = parentGroup;
    this.isSoftwareGl = isSoftwareGl;

    this.textures = {
      clear: this.createWeatherSpriteTexture('clear'),
      arcane_snow: this.createWeatherSpriteTexture('arcane_snow'),
      dense_fog: this.createWeatherSpriteTexture('dense_fog'),
      ember_ash: this.createWeatherSpriteTexture('ember_ash'),
      aether_storm: this.createWeatherSpriteTexture('aether_storm'),
    };

    const count = isSoftwareGl ? 220 : MAX_WEATHER_PARTICLES;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * BOUNDS_XZ * 2;
      this.positions[i * 3 + 1] = MIN_Y + Math.random() * (MAX_Y - MIN_Y);
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS_XZ * 2;

      this.velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      this.velocities[i * 3 + 1] = 0.8 + Math.random() * 0.4;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      this.phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.pointsMaterial = new THREE.PointsMaterial({
      size: 0.55,
      map: this.textures.clear,
      color: new THREE.Color('#38bdf8'),
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.pointsMesh = new THREE.Points(geometry, this.pointsMaterial);
    this.pointsMesh.frustumCulled = false;
    this.parentGroup.add(this.pointsMesh);

    this.initGroundMistLayers();
    this.parentGroup.add(this.mistGroup);
  }

  private initGroundMistLayers() {
    const mistTex = this.textures.dense_fog;
    const planeGeo = new THREE.PlaneGeometry(16, 16);
    planeGeo.rotateX(-Math.PI / 2);

    const layerCount = this.isSoftwareGl ? 4 : 9;
    for (let i = 0; i < layerCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: mistTex,
        color: new THREE.Color('#a855f7'),
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      const angle = (i / layerCount) * Math.PI * 2;
      const radius = 5 + (i % 3) * 5.5;
      mesh.position.set(
        Math.cos(angle) * radius,
        0.18 + (i % 3) * 0.22,
        Math.sin(angle) * radius
      );
      mesh.rotation.y = angle;
      this.mistGroup.add(mesh);
      this.mistPlanes.push(mesh);
    }
  }

  private createWeatherSpriteTexture(type: WeatherType): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const cx = 32;
    const cy = 32;

    ctx.clearRect(0, 0, 64, 64);

    if (type === 'arcane_snow') {
      // Crystalline 6-pointed arcane snowflake with soft halo
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.45, 'rgba(103, 232, 249, 0.75)');
      grad.addColorStop(1, 'rgba(103, 232, 249, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
        ctx.stroke();
      }
    } else if (type === 'dense_fog') {
      // Soft volumetric mist puff
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 30);
      grad.addColorStop(0, 'rgba(216, 180, 254, 0.55)');
      grad.addColorStop(0.55, 'rgba(147, 51, 234, 0.25)');
      grad.addColorStop(1, 'rgba(88, 28, 135, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'ember_ash') {
      // Incandescent diamond ember spark
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24);
      grad.addColorStop(0, 'rgba(254, 240, 138, 1)');
      grad.addColorStop(0.45, 'rgba(249, 115, 22, 0.85)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, 6);
      ctx.lineTo(54, cy);
      ctx.lineTo(cx, 58);
      ctx.lineTo(10, cy);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'aether_storm') {
      // Diagonal electric rain streak
      const grad = ctx.createLinearGradient(cx, 4, cx, 60);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.95)');
      grad.addColorStop(1, 'rgba(250, 204, 21, 0.9)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 4, 6);
      ctx.lineTo(cx + 4, 58);
      ctx.stroke();
    } else {
      // Clear astral glowing mote
      const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 22);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.4, 'rgba(56, 189, 248, 0.6)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  public setWeather(weather: WeatherType, mapConfig: MapConfig, immediate = false) {
    this.currentWeather = weather;
    const spec = WEATHER_SPECS[weather];

    // Blend map's base theme with weather's atmospheric tint
    const baseSky = new THREE.Color(mapConfig.theme.skyColor);
    const baseFog = new THREE.Color(mapConfig.theme.fogColor);
    const weatherSky = new THREE.Color(spec.skyColorTint);
    const weatherFog = new THREE.Color(spec.fogColorTint);

    const blendFactor = weather === 'clear' ? 0.15 : 0.68;
    this.targetSkyColor.copy(baseSky).lerp(weatherSky, blendFactor);
    this.targetFogColor.copy(baseFog).lerp(weatherFog, blendFactor);
    this.targetLightColor.set(spec.lightColorTint);
    this.targetFogDensity = spec.fogDensity;
    this.targetLightIntensityMult = spec.lightIntensityMult;

    if (immediate) {
      this.currentSkyColor.copy(this.targetSkyColor);
      this.currentFogColor.copy(this.targetFogColor);
      this.currentLightColor.copy(this.targetLightColor);
      this.currentFogDensity = this.targetFogDensity;
      this.currentLightIntensityMult = this.targetLightIntensityMult;
    }

    // Update global particle appearance
    this.pointsMaterial.map = this.textures[weather];
    this.pointsMaterial.color.set(spec.accentColor);
    if (weather === 'dense_fog') {
      this.pointsMaterial.size = 2.6;
      this.pointsMaterial.opacity = 0.36;
    } else if (weather === 'arcane_snow') {
      this.pointsMaterial.size = 0.72;
      this.pointsMaterial.opacity = 0.9;
    } else if (weather === 'ember_ash') {
      this.pointsMaterial.size = 0.65;
      this.pointsMaterial.opacity = 0.92;
    } else if (weather === 'aether_storm') {
      this.pointsMaterial.size = 0.85;
      this.pointsMaterial.opacity = 0.85;
    } else {
      this.pointsMaterial.size = 0.48;
      this.pointsMaterial.opacity = 0.65;
    }
    this.pointsMaterial.needsUpdate = true;

    const maxDraw = this.isSoftwareGl
      ? Math.min(220, Math.round(spec.particleCount * 0.45))
      : Math.min(MAX_WEATHER_PARTICLES, spec.particleCount);
    this.pointsMesh.geometry.setDrawRange(0, maxDraw);
  }

  public update(
    dt: number,
    elapsed: number,
    scene: THREE.Scene,
    keyLight: THREE.DirectionalLight | null,
    hemiLight: THREE.HemisphereLight | null
  ) {
    const spec = WEATHER_SPECS[this.currentWeather];
    const lerpRate = 1 - Math.exp(-2.2 * dt);

    // 1. Smoothly transition Sky, Fog, and Lighting
    this.currentSkyColor.lerp(this.targetSkyColor, lerpRate);
    this.currentFogColor.lerp(this.targetFogColor, lerpRate);
    this.currentLightColor.lerp(this.targetLightColor, lerpRate);
    this.currentFogDensity += (this.targetFogDensity - this.currentFogDensity) * lerpRate;
    this.currentLightIntensityMult +=
      (this.targetLightIntensityMult - this.currentLightIntensityMult) * lerpRate;

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(this.currentSkyColor);
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(this.currentFogColor);
      scene.fog.density = this.currentFogDensity;
    }

    // Periodic lightning flash in Aether Storm
    if (this.currentWeather === 'aether_storm') {
      this.nextLightningTimer -= dt;
      if (this.nextLightningTimer <= 0) {
        this.nextLightningTimer = 3.5 + Math.random() * 5.0;
        this.lightningFlashIntensity = 1.35;
      }
    }
    if (this.lightningFlashIntensity > 0.01) {
      this.lightningFlashIntensity *= Math.exp(-10 * dt);
    } else {
      this.lightningFlashIntensity = 0;
    }

    if (keyLight) {
      keyLight.color.copy(this.currentLightColor);
      keyLight.intensity = 1.15 * this.currentLightIntensityMult + this.lightningFlashIntensity;
    }
    if (hemiLight) {
      hemiLight.intensity = 0.55 * this.currentLightIntensityMult + this.lightningFlashIntensity * 0.4;
    }

    // 2. Animate Ground Volumetric Mist Planes (active during dense_fog & arcane_snow)
    const targetMistOpacity =
      this.currentWeather === 'dense_fog'
        ? 0.28
        : this.currentWeather === 'arcane_snow'
        ? 0.14
        : 0.0;

    for (let i = 0; i < this.mistPlanes.length; i++) {
      const plane = this.mistPlanes[i];
      const mat = plane.material as THREE.MeshBasicMaterial;
      mat.opacity += (targetMistOpacity - mat.opacity) * lerpRate;
      mat.color.set(spec.accentColor);
      plane.visible = mat.opacity > 0.01;
      if (plane.visible) {
        plane.rotation.z = elapsed * (i % 2 === 0 ? 0.12 : -0.1) + i;
        plane.position.x += Math.sin(elapsed * 0.3 + i) * dt * 0.4;
      }
    }

    // 3. Update Global 3D Weather Particles
    const posAttr = this.pointsMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const drawCount = this.pointsMesh.geometry.drawRange.count;

    for (let i = 0; i < drawCount; i++) {
      const idx = i * 3;
      const phase = this.phases[i];
      const velScale = this.velocities[idx + 1];

      // Horizontal wind + sinusoidal turbulence swirl
      const swayX = Math.sin(elapsed * 1.6 + phase) * 0.85;
      const swayZ = Math.cos(elapsed * 1.4 + phase) * 0.85;

      this.positions[idx] += (spec.windX + swayX) * dt;
      this.positions[idx + 1] -= spec.fallSpeed * velScale * dt;
      this.positions[idx + 2] += (spec.windZ + swayZ) * dt;

      // Seamless toroidal wrap around the sanctuary bounds
      if (this.positions[idx] > BOUNDS_XZ) this.positions[idx] = -BOUNDS_XZ;
      if (this.positions[idx] < -BOUNDS_XZ) this.positions[idx] = BOUNDS_XZ;

      if (this.positions[idx + 2] > BOUNDS_XZ) this.positions[idx + 2] = -BOUNDS_XZ;
      if (this.positions[idx + 2] < -BOUNDS_XZ) this.positions[idx + 2] = BOUNDS_XZ;

      if (this.positions[idx + 1] < MIN_Y) {
        this.positions[idx + 1] = MAX_Y;
      } else if (this.positions[idx + 1] > MAX_Y) {
        this.positions[idx + 1] = MIN_Y;
      }
    }

    posAttr.needsUpdate = true;
  }

  public dispose() {
    this.pointsMesh.geometry.dispose();
    this.pointsMaterial.dispose();
    Object.values(this.textures).forEach((t) => t.dispose());
    this.mistPlanes.forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
  }
}
