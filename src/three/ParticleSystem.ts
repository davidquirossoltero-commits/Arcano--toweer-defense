import * as THREE from 'three';

export type ParticlePreset =
  | 'fusion_sparks'
  | 'boss_explosion'
  | 'boss_shockwave'
  | 'golem_summon'
  | 'meteor_cataclysm'
  | 'frost_nova'
  | 'crystal_shatter';

export type ParticleShape = 'spark' | 'orb';

export interface ParticleEmitterConfig {
  shape: ParticleShape;
  count: number;
  startColor: string;
  endColor?: string;
  minSpeed: number;
  maxSpeed: number;
  minLife: number;
  maxLife: number;
  minSize: number;
  maxSize: number;
  gravity: number;
  drag: number;
  spreadAngle?: number; // radians from vertical (Math.PI = full sphere)
  swirlSpeed?: number;  // tangential vortex speed for magic fusion sparks
  upwardBias?: number;
  shockwaveRing?: {
    color: string;
    maxRadius: number;
    duration: number;
    yOffset?: number;
  };
}

interface PooledParticleInstance {
  active: boolean;
  shape: ParticleShape;
  origin: THREE.Vector3;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  startColor: THREE.Color;
  endColor: THREE.Color;
  currentColor: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  swirlSpeed: number;
  spinSpeed: THREE.Vector3;
}

interface ActiveShockwaveRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxRadius: number;
}

// Pre-allocated module-scope math objects for zero-GC updates
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _radial = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export const PARTICLE_PRESETS: Record<ParticlePreset, ParticleEmitterConfig[]> = {
  fusion_sparks: [
    {
      shape: 'spark',
      count: 48,
      startColor: '#fde047',
      endColor: '#38bdf8',
      minSpeed: 2.2,
      maxSpeed: 5.8,
      minLife: 0.65,
      maxLife: 1.25,
      minSize: 0.9,
      maxSize: 1.65,
      gravity: -2.4, // Levitates upward in an arcane vortex
      drag: 0.96,
      spreadAngle: Math.PI * 0.65,
      swirlSpeed: 6.5,
      upwardBias: 2.2,
      shockwaveRing: {
        color: '#f59e0b',
        maxRadius: 3.8,
        duration: 0.65,
        yOffset: 0.12,
      },
    },
    {
      shape: 'orb',
      count: 24,
      startColor: '#a855f7',
      endColor: '#38bdf8',
      minSpeed: 1.5,
      maxSpeed: 4.0,
      minLife: 0.5,
      maxLife: 0.95,
      minSize: 0.8,
      maxSize: 1.3,
      gravity: -1.2,
      drag: 0.95,
      swirlSpeed: -4.5,
      upwardBias: 1.6,
    },
  ],
  boss_explosion: [
    {
      shape: 'orb',
      count: 60,
      startColor: '#fef08a',
      endColor: '#dc2626',
      minSpeed: 4.5,
      maxSpeed: 10.5,
      minLife: 0.55,
      maxLife: 1.2,
      minSize: 1.2,
      maxSize: 2.2,
      gravity: 9.5,
      drag: 0.94,
      spreadAngle: Math.PI * 0.85,
      upwardBias: 3.4,
      shockwaveRing: {
        color: '#ef4444',
        maxRadius: 6.2,
        duration: 0.75,
        yOffset: 0.15,
      },
    },
    {
      shape: 'spark',
      count: 45,
      startColor: '#f97316',
      endColor: '#7c2d12',
      minSpeed: 5.5,
      maxSpeed: 12.0,
      minLife: 0.45,
      maxLife: 0.95,
      minSize: 0.9,
      maxSize: 1.7,
      gravity: 12.0,
      drag: 0.96,
      upwardBias: 2.8,
    },
  ],
  boss_shockwave: [
    {
      shape: 'spark',
      count: 34,
      startColor: '#f59e0b',
      endColor: '#dc2626',
      minSpeed: 3.5,
      maxSpeed: 7.5,
      minLife: 0.35,
      maxLife: 0.75,
      minSize: 0.85,
      maxSize: 1.45,
      gravity: 8.5,
      drag: 0.94,
      upwardBias: 1.5,
      shockwaveRing: {
        color: '#f97316',
        maxRadius: 4.6,
        duration: 0.55,
        yOffset: 0.1,
      },
    },
  ],
  golem_summon: [
    {
      shape: 'spark',
      count: 40,
      startColor: '#6ee7b7',
      endColor: '#059669',
      minSpeed: 2.5,
      maxSpeed: 6.2,
      minLife: 0.5,
      maxLife: 1.0,
      minSize: 0.95,
      maxSize: 1.5,
      gravity: -1.5,
      drag: 0.95,
      swirlSpeed: 4.2,
      upwardBias: 2.0,
      shockwaveRing: {
        color: '#10b981',
        maxRadius: 3.5,
        duration: 0.55,
        yOffset: 0.1,
      },
    },
  ],
  meteor_cataclysm: [
    {
      shape: 'orb',
      count: 55,
      startColor: '#fef08a',
      endColor: '#ea580c',
      minSpeed: 5.0,
      maxSpeed: 11.0,
      minLife: 0.5,
      maxLife: 1.1,
      minSize: 1.1,
      maxSize: 2.0,
      gravity: 11.0,
      drag: 0.95,
      upwardBias: 3.5,
      shockwaveRing: {
        color: '#f59e0b',
        maxRadius: 5.4,
        duration: 0.65,
        yOffset: 0.12,
      },
    },
  ],
  frost_nova: [
    {
      shape: 'spark',
      count: 28,
      startColor: '#e0f2fe',
      endColor: '#06b6d4',
      minSpeed: 2.8,
      maxSpeed: 6.0,
      minLife: 0.35,
      maxLife: 0.7,
      minSize: 0.75,
      maxSize: 1.25,
      gravity: 3.5,
      drag: 0.93,
      upwardBias: 1.0,
      shockwaveRing: {
        color: '#22d3ee',
        maxRadius: 3.2,
        duration: 0.45,
        yOffset: 0.1,
      },
    },
  ],
  crystal_shatter: [
    {
      shape: 'spark',
      count: 20,
      startColor: '#38bdf8',
      endColor: '#1d4ed8',
      minSpeed: 2.5,
      maxSpeed: 6.0,
      minLife: 0.3,
      maxLife: 0.65,
      minSize: 0.7,
      maxSize: 1.2,
      gravity: 9.8,
      drag: 0.96,
      upwardBias: 1.8,
    },
  ],
};

/**
 * Generic, high-performance 3D Particle System using InstancedMesh pools and expanding shockwaves.
 */
export class ParticleSystem {
  private parentGroup: THREE.Group;
  private maxSparks = 360;
  private maxOrbs = 240;

  private sparkMesh: THREE.InstancedMesh;
  private orbMesh: THREE.InstancedMesh;

  private sparks: PooledParticleInstance[] = [];
  private orbs: PooledParticleInstance[] = [];
  private shockwaves: ActiveShockwaveRing[] = [];
  private sharedRingGeo: THREE.RingGeometry;

  constructor(parentGroup: THREE.Group) {
    this.parentGroup = parentGroup;

    // 1. Crystalline Sparks Instanced Pool
    const sparkGeo = new THREE.OctahedronGeometry(0.14, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, this.maxSparks);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparks.push(this.createBlankParticle('spark'));
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    this.parentGroup.add(this.sparkMesh);

    // 2. Glowing Plasma/Explosion Orbs Instanced Pool
    const orbGeo = new THREE.IcosahedronGeometry(0.16, 1);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.orbMesh = new THREE.InstancedMesh(orbGeo, orbMat, this.maxOrbs);
    this.orbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.orbMesh.frustumCulled = false;

    for (let i = 0; i < this.maxOrbs; i++) {
      this.orbs.push(this.createBlankParticle('orb'));
      _mat4.makeScale(0, 0, 0);
      this.orbMesh.setMatrixAt(i, _mat4);
      this.orbMesh.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.orbMesh.instanceMatrix.needsUpdate = true;
    if (this.orbMesh.instanceColor) this.orbMesh.instanceColor.needsUpdate = true;
    this.parentGroup.add(this.orbMesh);

    // 3. Shared Shockwave Ring Geometry
    this.sharedRingGeo = new THREE.RingGeometry(0.78, 1.0, 40);
    this.sharedRingGeo.rotateX(-Math.PI / 2);
  }

  private createBlankParticle(shape: ParticleShape): PooledParticleInstance {
    return {
      active: false,
      shape,
      origin: new THREE.Vector3(),
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      startColor: new THREE.Color(0xffffff),
      endColor: new THREE.Color(0xffffff),
      currentColor: new THREE.Color(0xffffff),
      size: 1,
      life: 0,
      maxLife: 1,
      gravity: 9.8,
      drag: 0.96,
      swirlSpeed: 0,
      spinSpeed: new THREE.Vector3(6, 4, 2),
    };
  }

  /**
   * Triggers a named multi-emitter particle preset (e.g. 'fusion_sparks', 'boss_explosion') at a world position.
   */
  public emitPreset(
    preset: ParticlePreset,
    position: THREE.Vector3,
    overrideColor?: string,
    scaleMultiplier = 1.0
  ) {
    const configs = PARTICLE_PRESETS[preset];
    if (!configs) return;

    for (const cfg of configs) {
      this.emitCustom(
        {
          ...cfg,
          startColor: overrideColor || cfg.startColor,
          minSize: cfg.minSize * scaleMultiplier,
          maxSize: cfg.maxSize * scaleMultiplier,
        },
        position
      );
    }
  }

  /**
   * Triggers a custom particle burst with full control over physics, colors, vortex swirl, and shockwaves.
   */
  public emitCustom(config: ParticleEmitterConfig, position: THREE.Vector3) {
    const pool = config.shape === 'orb' ? this.orbs : this.sparks;
    const limit = pool.length;
    const spread = config.spreadAngle ?? Math.PI * 0.7;
    const upward = config.upwardBias ?? 1.5;

    let spawned = 0;
    for (let i = 0; i < limit && spawned < config.count; i++) {
      const p = pool[i];
      if (!p.active) {
        p.active = true;
        p.origin.copy(position);
        p.position.copy(position);
        // Slight initial radial offset so swirl has immediate leverage
        const initRadius = config.swirlSpeed ? 0.25 + Math.random() * 0.45 : 0.05;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * spread;
        const speed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);

        p.position.x += Math.cos(theta) * initRadius;
        p.position.z += Math.sin(theta) * initRadius;

        p.velocity.set(
          Math.cos(theta) * Math.sin(phi) * speed,
          Math.cos(phi) * speed + upward,
          Math.sin(theta) * Math.sin(phi) * speed
        );

        p.startColor.set(config.startColor);
        p.endColor.set(config.endColor || config.startColor);
        p.currentColor.copy(p.startColor);

        p.size = config.minSize + Math.random() * (config.maxSize - config.minSize);
        p.life = 0;
        p.maxLife = config.minLife + Math.random() * (config.maxLife - config.minLife);
        p.gravity = config.gravity;
        p.drag = config.drag;
        p.swirlSpeed = config.swirlSpeed ?? 0;
        p.spinSpeed.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        );

        spawned++;
      }
    }

    if (config.shockwaveRing) {
      this.spawnShockwaveRing(
        position,
        config.shockwaveRing.color,
        config.shockwaveRing.maxRadius,
        config.shockwaveRing.duration,
        config.shockwaveRing.yOffset ?? 0.1
      );
    }
  }

  private spawnShockwaveRing(
    position: THREE.Vector3,
    colorHex: string,
    maxRadius: number,
    duration: number,
    yOffset: number
  ) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const mesh = new THREE.Mesh(this.sharedRingGeo, mat);
    mesh.position.set(position.x, yOffset, position.z);
    mesh.scale.setScalar(0.2);
    this.parentGroup.add(mesh);

    this.shockwaves.push({
      mesh,
      life: 0,
      maxLife: duration,
      maxRadius,
    });
  }

  public update(dt: number) {
    this.updatePool(this.sparks, this.sparkMesh, dt);
    this.updatePool(this.orbs, this.orbMesh, dt);

    // Update shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        this.parentGroup.remove(sw.mesh);
        (sw.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
      } else {
        const t = sw.life / sw.maxLife;
        const easeOut = 1 - Math.pow(1 - t, 3);
        const radius = 0.25 + easeOut * sw.maxRadius;
        sw.mesh.scale.setScalar(radius);
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      }
    }
  }

  private updatePool(
    pool: PooledParticleInstance[],
    mesh: THREE.InstancedMesh,
    dt: number
  ) {
    let anyActive = false;

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;
      anyActive = true;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, _mat4);
        continue;
      }

      const t = p.life / p.maxLife;

      // Apply gravity and air drag
      p.velocity.y -= p.gravity * dt;
      const dragFactor = Math.pow(p.drag, dt * 60);
      p.velocity.multiplyScalar(dragFactor);

      // Apply tangential vortex swirl (for magic tower fusion sparks & golem summons)
      if (p.swirlSpeed !== 0) {
        _radial.subVectors(p.position, p.origin);
        _radial.y = 0;
        if (_radial.lengthSq() > 0.0001) {
          _radial.normalize();
          _tangent.crossVectors(_up, _radial).normalize();
          p.position.addScaledVector(_tangent, p.swirlSpeed * dt);
        }
      }

      p.position.addScaledVector(p.velocity, dt);

      // Smooth color gradient from startColor to endColor
      p.currentColor.copy(p.startColor).lerp(p.endColor, t);

      // Scale envelope: quick pop-in then smooth fade-out
      const scaleCurve = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      const s = Math.max(0.001, p.size * scaleCurve);

      _euler.set(
        p.spinSpeed.x * p.life,
        p.spinSpeed.y * p.life,
        p.spinSpeed.z * p.life
      );
      _quat.setFromEuler(_euler);
      _scale.setScalar(s);
      _mat4.compose(p.position, _quat, _scale);

      mesh.setMatrixAt(i, _mat4);
      mesh.setColorAt(i, p.currentColor);
    }

    if (anyActive) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  public clearAll() {
    for (let i = 0; i < this.sparks.length; i++) {
      this.sparks[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.orbs.length; i++) {
      this.orbs[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.orbMesh.setMatrixAt(i, _mat4);
    }
    this.orbMesh.instanceMatrix.needsUpdate = true;

    for (const sw of this.shockwaves) {
      this.parentGroup.remove(sw.mesh);
      (sw.mesh.material as THREE.Material).dispose();
    }
    this.shockwaves = [];
  }

  public getActiveCount(): number {
    let count = this.shockwaves.length;
    for (let i = 0; i < this.sparks.length; i++) {
      if (this.sparks[i].active) count++;
    }
    for (let i = 0; i < this.orbs.length; i++) {
      if (this.orbs[i].active) count++;
    }
    return count;
  }

  public dispose() {
    this.clearAll();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.orbMesh.geometry.dispose();
    (this.orbMesh.material as THREE.Material).dispose();
    this.sharedRingGeo.dispose();
  }
}
