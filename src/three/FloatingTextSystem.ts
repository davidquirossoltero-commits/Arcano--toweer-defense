import * as THREE from 'three';

export interface FloatingDamageOptions {
  position: THREE.Vector3;
  amount: number;
  isCritical: boolean;
  isBoss?: boolean;
  accentColor?: string;
}

interface ActiveFloatingText {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  baseWidth: number;
  baseHeight: number;
  isCritical: boolean;
}

const MAX_CACHED_TEXTURES = 140;

/**
 * 3D World-Space Floating Combat Text (Damage Numbers) System.
 * Renders camera-facing billboard sprites over hit enemies, differentiating
 * critical strikes with a metallic golden gradient, "¡CRÍTICO!" badge, and larger scale.
 */
export class FloatingTextSystem {
  private parentGroup: THREE.Group;
  private activeTexts: ActiveFloatingText[] = [];
  private spritePool: { sprite: THREE.Sprite; material: THREE.SpriteMaterial }[] = [];
  private textureCache: Map<string, THREE.CanvasTexture> = new Map();

  constructor(parentGroup: THREE.Group) {
    this.parentGroup = parentGroup;
  }

  public spawnDamageNumber(options: FloatingDamageOptions) {
    const roundedAmount = Math.max(1, Math.round(options.amount));
    const isCritical = options.isCritical;
    const isBoss = Boolean(options.isBoss);

    const texture = this.getOrCreateDamageTexture(
      roundedAmount,
      isCritical,
      options.accentColor
    );

    const pooled = this.acquireSprite();
    pooled.material.map = texture;
    pooled.material.opacity = 1;
    pooled.material.needsUpdate = true;

    // Critical hits are rendered significantly larger and with higher priority
    const bossScale = isBoss ? 1.15 : 1.0;
    const baseWidth = (isCritical ? 1.95 : 1.12) * bossScale;
    const baseHeight = (isCritical ? 0.98 : 0.56) * bossScale;

    const jitterX = (Math.random() - 0.5) * (isCritical ? 0.45 : 0.55);
    const jitterZ = (Math.random() - 0.5) * (isCritical ? 0.45 : 0.55);
    const startYOffset = (isBoss ? 2.55 : 1.75) + (isCritical ? 0.22 : 0);

    pooled.sprite.position.set(
      options.position.x + jitterX,
      options.position.y + startYOffset,
      options.position.z + jitterZ
    );

    const initialScaleFactor = isCritical ? 0.45 : 0.65;
    pooled.sprite.scale.set(
      baseWidth * initialScaleFactor,
      baseHeight * initialScaleFactor,
      1
    );
    pooled.sprite.renderOrder = isCritical ? 1005 : 995;
    pooled.sprite.visible = true;

    const lateralVx = jitterX * 0.85;
    const lateralVz = jitterZ * 0.85;
    const upwardVy = isCritical ? 2.35 : 1.65;

    this.activeTexts.push({
      sprite: pooled.sprite,
      material: pooled.material,
      velocity: new THREE.Vector3(lateralVx, upwardVy, lateralVz),
      age: 0,
      maxLife: isCritical ? 1.15 : 0.82,
      baseWidth,
      baseHeight,
      isCritical,
    });
  }

  public spawnLevelUpBanner(position: THREE.Vector3, newLevel: number, accentColor: string) {
    const key = `lvlup_${newLevel}_${accentColor}`;
    let texture = this.textureCache.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(14, 14, 292, 100, 20);
      ctx.fillStyle = 'rgba(11, 15, 25, 0.92)';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();
      ctx.restore();

      const cx = canvas.width / 2;
      ctx.save();
      ctx.font = '900 28px "Cinzel", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`✦ ¡NIVEL ${newLevel}! ✦`, cx, 46);

      ctx.font = '800 20px "JetBrains Mono", "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = accentColor || '#38bdf8';
      ctx.fillText('+Alcance  +Cadencia', cx, 84);
      ctx.restore();

      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      this.textureCache.set(key, texture);
    }

    const pooled = this.acquireSprite();
    pooled.material.map = texture;
    pooled.material.opacity = 1;
    pooled.material.needsUpdate = true;

    const baseWidth = 2.35;
    const baseHeight = 0.94;
    pooled.sprite.position.set(position.x, position.y + 2.45, position.z);
    pooled.sprite.scale.set(baseWidth * 0.5, baseHeight * 0.5, 1);
    pooled.sprite.renderOrder = 1010;
    pooled.sprite.visible = true;

    this.activeTexts.push({
      sprite: pooled.sprite,
      material: pooled.material,
      velocity: new THREE.Vector3(0, 1.85, 0),
      age: 0,
      maxLife: 1.45,
      baseWidth,
      baseHeight,
      isCritical: true,
    });
  }

  public spawnStatusCallout(
    position: THREE.Vector3,
    status: 'frozen' | 'burned' | 'slowed',
    isBoss = false
  ) {
    const key = `status_callout_${status}`;
    let texture = this.textureCache.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = 288;
      canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const config =
        status === 'frozen'
          ? {
              label: '❄ ¡CONGELADO!',
              border: '#67e8f9',
              text: '#e0f2fe',
              bg: 'rgba(8, 51, 68, 0.9)',
            }
          : status === 'burned'
          ? {
              label: '🔥 ¡QUEMADO!',
              border: '#fb923c',
              text: '#fef08a',
              bg: 'rgba(67, 20, 7, 0.9)',
            }
          : {
              label: '⏳ RALENTIZADO',
              border: '#38bdf8',
              text: '#bae6fd',
              bg: 'rgba(15, 23, 42, 0.88)',
            };

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(14, 16, 260, 64, 14);
      ctx.fillStyle = config.bg;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = config.border;
      ctx.stroke();

      ctx.font = '900 22px "Cinzel", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = config.text;
      ctx.fillText(config.label, canvas.width / 2, canvas.height / 2 + 1);
      ctx.restore();

      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      this.textureCache.set(key, texture);
    }

    const pooled = this.acquireSprite();
    pooled.material.map = texture;
    pooled.material.opacity = 1;
    pooled.material.needsUpdate = true;

    const scaleMult = isBoss ? 1.18 : 1.0;
    const baseWidth = 1.62 * scaleMult;
    const baseHeight = 0.54 * scaleMult;
    const jitterX = (Math.random() - 0.5) * 0.36;
    const jitterZ = (Math.random() - 0.5) * 0.36;

    pooled.sprite.position.set(
      position.x + jitterX,
      position.y + (isBoss ? 2.85 : 2.1),
      position.z + jitterZ
    );
    pooled.sprite.scale.set(baseWidth * 0.5, baseHeight * 0.5, 1);
    pooled.sprite.renderOrder = 1008;
    pooled.sprite.visible = true;

    this.activeTexts.push({
      sprite: pooled.sprite,
      material: pooled.material,
      velocity: new THREE.Vector3(jitterX * 0.5, 1.55, jitterZ * 0.5),
      age: 0,
      maxLife: 0.92,
      baseWidth,
      baseHeight,
      isCritical: status === 'frozen',
    });
  }

  public update(dt: number) {
    for (let i = this.activeTexts.length - 1; i >= 0; i--) {
      const item = this.activeTexts[i];
      item.age += dt;

      if (item.age >= item.maxLife) {
        item.sprite.visible = false;
        this.parentGroup.remove(item.sprite);
        this.spritePool.push({ sprite: item.sprite, material: item.material });
        this.activeTexts.splice(i, 1);
        continue;
      }

      const t = item.age / item.maxLife;

      // Smooth upward float with gentle damping
      item.sprite.position.x += item.velocity.x * dt;
      item.sprite.position.y += item.velocity.y * dt;
      item.sprite.position.z += item.velocity.z * dt;
      item.velocity.y = Math.max(0.35, item.velocity.y - (item.isCritical ? 2.1 : 1.7) * dt);
      item.velocity.x *= Math.exp(-3.5 * dt);
      item.velocity.z *= Math.exp(-3.5 * dt);

      // Elastic pop-in scale curve, stronger on critical hits
      let scaleAnim = 1.0;
      if (item.isCritical) {
        if (t < 0.14) {
          const p = t / 0.14;
          scaleAnim = 0.45 + p * 0.95; // Pops up to 1.40x
        } else if (t < 0.32) {
          const p = (t - 0.14) / 0.18;
          scaleAnim = 1.4 - p * 0.28; // Settles to 1.12x
        } else {
          scaleAnim = 1.12;
        }
      } else {
        if (t < 0.12) {
          const p = t / 0.12;
          scaleAnim = 0.65 + p * 0.45; // Pops to 1.10x
        } else if (t < 0.26) {
          const p = (t - 0.12) / 0.14;
          scaleAnim = 1.1 - p * 0.1; // Settles to 1.0x
        } else {
          scaleAnim = 1.0;
        }
      }

      item.sprite.scale.set(
        item.baseWidth * scaleAnim,
        item.baseHeight * scaleAnim,
        1
      );

      // Fade out cleanly in the final 32% of lifetime
      if (t > 0.68) {
        const fade = 1 - (t - 0.68) / 0.32;
        item.material.opacity = Math.max(0, fade * fade);
      } else {
        item.material.opacity = 1;
      }
    }
  }

  public clearAll() {
    for (const item of this.activeTexts) {
      item.sprite.visible = false;
      this.parentGroup.remove(item.sprite);
      this.spritePool.push({ sprite: item.sprite, material: item.material });
    }
    this.activeTexts = [];
  }

  public dispose() {
    this.clearAll();
    this.textureCache.forEach((tex) => tex.dispose());
    this.textureCache.clear();
    this.spritePool.forEach((p) => p.material.dispose());
    this.spritePool = [];
  }

  private acquireSprite(): { sprite: THREE.Sprite; material: THREE.SpriteMaterial } {
    const existing = this.spritePool.pop();
    if (existing) {
      this.parentGroup.add(existing.sprite);
      return existing;
    }

    const material = new THREE.SpriteMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    this.parentGroup.add(sprite);
    return { sprite, material };
  }

  private getOrCreateDamageTexture(
    amount: number,
    isCritical: boolean,
    accentColor?: string
  ): THREE.CanvasTexture {
    const key = `${isCritical ? 'crit' : 'norm'}_${amount}_${accentColor || 'default'}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    if (this.textureCache.size >= MAX_CACHED_TEXTURES) {
      const oldestKey = this.textureCache.keys().next().value;
      if (oldestKey) {
        this.textureCache.get(oldestKey)?.dispose();
        this.textureCache.delete(oldestKey);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;

    if (isCritical) {
      // Golden radiant backplate pill for critical hits
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(22, 14, 212, 98, 22);
      const bgGrad = ctx.createLinearGradient(0, 14, 0, 112);
      bgGrad.addColorStop(0, 'rgba(69, 26, 3, 0.82)');
      bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.88)');
      ctx.fillStyle = bgGrad;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();
      ctx.restore();

      // Top "¡CRÍTICO!" header in bright gold
      ctx.save();
      ctx.font = '900 20px "Cinzel", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#090d16';
      ctx.strokeText('✦ ¡CRÍTICO! ✦', cx, 36);
      ctx.fillStyle = '#fef08a';
      ctx.fillText('✦ ¡CRÍTICO! ✦', cx, 36);
      ctx.restore();

      // Main large golden damage number
      const text = `-${amount}!`;
      ctx.save();
      ctx.font = '900 54px "JetBrains Mono", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 10;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#090d16';
      ctx.strokeText(text, cx, 78);

      const goldGrad = ctx.createLinearGradient(0, 48, 0, 106);
      goldGrad.addColorStop(0, '#fef9c3');
      goldGrad.addColorStop(0.45, '#fde047');
      goldGrad.addColorStop(0.8, '#fbbf24');
      goldGrad.addColorStop(1, '#d97706');
      ctx.fillStyle = goldGrad;
      ctx.fillText(text, cx, 78);
      ctx.restore();
    } else {
      // Standard hit floating number
      const text = `-${amount}`;
      ctx.save();
      ctx.font = '800 46px "JetBrains Mono", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#090d16';
      ctx.strokeText(text, cx, 66);

      const fillGrad = ctx.createLinearGradient(0, 42, 0, 90);
      fillGrad.addColorStop(0, '#ffffff');
      fillGrad.addColorStop(1, accentColor || '#e2e8f0');
      ctx.fillStyle = fillGrad;
      ctx.fillText(text, cx, 66);
      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.textureCache.set(key, texture);
    return texture;
  }
}
