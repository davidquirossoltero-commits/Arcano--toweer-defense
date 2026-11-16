import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ACHIEVEMENTS,
  ALL_TOWERS,
  AchievementId,
  AchievementMetricKey,
  AchievementMetrics,
  AudioTrackState,
  BASE_TOWERS,
  BaseTowerType,
  DAILY_VOID_EVENTS,
  DIFFICULTY_SPECS,
  DailyVoidEventId,
  DailyVoidEventSpec,
  DifficultyLevel,
  ENEMY_SPECS,
  EnemyKind,
  FusionCandidate,
  GameHudState,
  GridCoord,
  MAPS,
  MAX_TOWER_LEVEL,
  MapConfig,
  PLAYER_ABILITIES,
  PlacedTowerData,
  PlayerAbilityId,
  TOWER_MASTERY_SKINS,
  TowerCosmeticSkinSpec,
  TowerKind,
  TowerMasteryState,
  TowerSkinId,
  UnlockedAchievementNotification,
  WAVE_DEFINITIONS,
  WEATHER_ORDER,
  WEATHER_SPECS,
  WeatherType,
  findSuperTowerRecipe,
  getAdjustedTowerCost,
  getBaseTowerForKind,
  getFeaturedDailyEventIdForToday,
  getSkinSpecById,
  getTowerEffectiveDamage,
  getTowerEffectiveFireRate,
  getTowerEffectiveRange,
  getTowerMaxXpForLevel,
} from '../types/game';
import { coordKey } from '../utils/pathfinding';
import { soundEngine } from '../utils/sound';
import {
  animateCharacterModel,
  animateEnemyStatusEffects,
  animateTowerSpecialParts,
  buildAlliedGolemModel,
  buildCastleKeepGoalModel,
  buildEnemyModel,
  buildOctagonalTowerPedestalModel,
  buildOrganicRoadRibbonAndChevrons,
  buildPineForestObstacleModel,
  buildSculptedValleyTerrainMesh,
  buildStoneBridgeModel,
  buildTowerModel,
  buildValleyEnvironmentBackdrop,
  buildVoidSpawnPortalModel,
  getValleyTerrainHeightAt,
} from './proceduralModels';
import { ParticleEmitterConfig, ParticlePreset, ParticleSystem } from './ParticleSystem';
import { DecalPreset, DecalSystem } from './DecalSystem';
import { WeatherSystem } from './WeatherSystem';
import { FloatingTextSystem } from './FloatingTextSystem';

const TILE_SIZE = 2.0;
const AUTO_WAVE_DELAY_SECONDS = 7.0;

// Pre-allocated scratch math helpers to avoid GC in animation loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();

interface ActiveTowerEntity extends PlacedTowerData {
  mesh: THREE.Group;
  cooldown: number;
}

interface ActiveEnemyEntity {
  id: string;
  kind: EnemyKind;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  path: GridCoord[];
  pathIndex: number;
  position: THREE.Vector3;
  slowTimer: number;
  slowFactor: number;
  frozenTimer: number;
  freezeImmunityTimer: number;
  burnTimer: number;
  burnDps: number;
  burnTickTimer: number;
  burnSourceTowerKey?: string;
  stunTimer: number;
  bossSlamTimer: number;
  attackAnimTimer: number;
  stepTrackTimer: number;
  stepFootSide: number;
  animOffset: number;
  hpBarGroup: THREE.Group;
  hpBarFill: THREE.Group;
  hpBarMaterial: THREE.MeshBasicMaterial;
}

interface ActiveGolemEntity {
  id: string;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  damage: number;
  path: GridCoord[]; // Marches from goal toward spawn along static path
  pathIndex: number;
  position: THREE.Vector3;
  attackCooldown: number;
  attackAnimTimer: number;
  stepTrackTimer: number;
  stepFootSide: number;
  animOffset: number;
  hpBarGroup: THREE.Group;
  hpBarFill: THREE.Group;
  hpBarMaterial: THREE.MeshBasicMaterial;
}

interface ActiveProjectile {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetEnemyId?: string;
  sourceTowerKey?: string;
  progress: number;
  speed: number;
  arcHeight: number;
  damage: number;
  splashRadius: number;
  slowFactor: number;
  slowDuration: number;
  freezeChance: number;
  freezeDuration: number;
  burnDps: number;
  burnDuration: number;
  chainCount: number;
  color: string;
  isSuper: boolean;
}

interface ActiveLaserBeam {
  line: THREE.Line;
  ttl: number;
  maxTtl: number;
}

export class GameEngine {
  private container: HTMLElement;
  private onStateChange: (state: GameHudState) => void;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock: THREE.Clock;
  private frameId: number = 0;
  private disposed: boolean = false;

  // Map & Static Path Grid
  private currentMap: MapConfig = MAPS[0];
  private gridGroup: THREE.Group = new THREE.Group();
  private entitiesGroup: THREE.Group = new THREE.Group();
  private effectsGroup: THREE.Group = new THREE.Group();
  private tileMeshes: Map<string, THREE.Mesh> = new Map();
  private staticPathTilesSet: Set<string> = new Set();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private pointerNdc: THREE.Vector2 = new THREE.Vector2(-99, -99);

  // Path & Hover Visuals
  private activeSpawnPaths: GridCoord[][] = [];
  private pathLinesGroup: THREE.Group = new THREE.Group();
  private previewGroup: THREE.Group = new THREE.Group();
  private hoverHighlightMesh!: THREE.Mesh;
  private rangeCircleMesh!: THREE.Mesh;
  private fusionLinkLine: THREE.Line | null = null;
  private hoveredCell: GridCoord | null = null;
  private lastHoverRaycastTime: number = 0;

  // Game Entities & Dedicated Generic Particle System
  private towers: Map<string, ActiveTowerEntity> = new Map();
  private enemies: ActiveEnemyEntity[] = [];
  private golems: ActiveGolemEntity[] = [];
  private projectiles: ActiveProjectile[] = [];
  private beams: ActiveLaserBeam[] = [];
  private portalsAndCore: THREE.Group[] = [];
  private particleSystem: ParticleSystem;
  private decalSystem: DecalSystem;
  private weatherSystem: WeatherSystem;
  private floatingTextSystem: FloatingTextSystem;
  private hemiLight: THREE.HemisphereLight | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private riverWaterMesh: THREE.Mesh | null = null;
  private autoWeatherTimer: number = 26.0;

  // Wave Spawning Queue
  private spawnQueue: { kind: EnemyKind; spawnTime: number; spawnIndex: number }[] = [];
  private waveElapsed: number = 0;

  // Feel, Camera Shake & Cinematic Boss Camera
  private hitstopTimer: number = 0;
  private shakeIntensity: number = 0;
  private cinematicAngle: number = 0;
  private cinematicWasAutoActivated: boolean = false;
  private isPointerDownOnCanvas: boolean = false;
  private cinematicFocusPos = new THREE.Vector3(0, 0, 0);
  private bannerTimeout: number = 0;
  private achievementToastTimeout: number = 0;
  private achievementToastQueue: UnlockedAchievementNotification[] = [];
  private menuOverlayOpen: boolean = false;

  // Synchronized HUD State
  private state: GameHudState;

  constructor(container: HTMLElement, onStateChange: (state: GameHudState) => void) {
    this.container = container;
    this.onStateChange = onStateChange;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.5,
      160
    );
    this.camera.position.set(0, 22, 21);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2.25;
    this.controls.minPolarAngle = Math.PI / 7;
    this.controls.minDistance = 11;
    this.controls.maxDistance = 42;
    this.controls.target.set(0, 0, 0);

    this.clock = new THREE.Clock();

    const savedAchievements = this.loadPersistedAchievements();
    const savedMastery = this.loadPersistedTowerMastery();
    const savedAudio = soundEngine.getAudioSettings();

    this.state = {
      phase: 'title',
      mapId: MAPS[0].id,
      difficulty: 'normal',
      weather: 'arcane_snow',
      autoWeather: true,
      gold: MAPS[0].startingGold,
      mana: MAPS[0].startingMana,
      maxMana: 150,
      lives: MAPS[0].startingLives,
      maxLives: MAPS[0].startingLives,
      wave: 0,
      totalWaves: MAPS[0].totalWaves,
      waveInProgress: false,
      nextWaveCountdown: null,
      enemiesRemaining: 0,
      gameSpeed: 1,
      selectedBuildTower: 'quartz',
      selectedPlacedTower: null,
      fusionCandidates: [],
      activeAbilityTargeting: null,
      abilityCooldowns: {
        summon_golem: 0,
        astral_meteor: 0,
        stasis_pulse: 0,
      },
      stasisTimer: 0,
      activeBoss: null,
      activeGolemsCount: 0,
      superTowersBuilt: 0,
      totalKills: 0,
      statusBanner: null,
      isMuted: savedAudio.muted,
      masterVolume: savedAudio.masterVolume,
      musicVolume: savedAudio.musicVolume,
      sfxVolume: savedAudio.sfxVolume,
      musicState: 'exploration',
      cinematicCamera: false,
      autoCinematicCamera: true,
      dockCollapsed: false,
      achievementMetrics: savedAchievements.metrics,
      unlockedAchievements: savedAchievements.unlocked,
      activeAchievementToast: null,
      towerMastery: savedMastery,
      activeDailyEventId: getFeaturedDailyEventIdForToday(),
    };

    this.setupLighting();
    this.scene.add(this.gridGroup);
    this.scene.add(this.pathLinesGroup);
    this.scene.add(this.previewGroup);
    this.scene.add(this.entitiesGroup);
    this.scene.add(this.effectsGroup);

    this.initHoverAndRangeIndicators();
    this.particleSystem = new ParticleSystem(this.effectsGroup);
    this.decalSystem = new DecalSystem(
      this.effectsGroup,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    this.decalSystem.setResolution(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    this.weatherSystem = new WeatherSystem(this.effectsGroup, this.isSoftwareGl);
    this.floatingTextSystem = new FloatingTextSystem(this.effectsGroup);
    this.loadMap(MAPS[0].id, true);
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.emitState();
    this.startLoop();
  }

  private setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xfde68a, 0x1e293b, 0.88);
    hemiLight.position.set(0, 42, 0);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.35);
    keyLight.position.set(-14, 26, -18);
    keyLight.castShadow = !this.isSoftwareGl;
    const d = 24;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 70;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);
    this.keyLight = keyLight;

    const sunsetRimLight = new THREE.DirectionalLight(0xf97316, 1.05);
    sunsetRimLight.position.set(0, 14, -28);
    this.scene.add(sunsetRimLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    fillLight.position.set(18, 16, 16);
    this.scene.add(fillLight);
  }

  private initHoverAndRangeIndicators() {
    const hoverGeo = new THREE.RingGeometry(0.52, 0.86, 8);
    hoverGeo.rotateX(-Math.PI / 2);
    hoverGeo.rotateZ(Math.PI / 8);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.hoverHighlightMesh = new THREE.Mesh(hoverGeo, hoverMat);
    this.hoverHighlightMesh.position.y = 0.05;
    this.hoverHighlightMesh.visible = false;
    this.previewGroup.add(this.hoverHighlightMesh);

    const rangeGeo = new THREE.RingGeometry(0.96, 1.0, 48);
    rangeGeo.rotateX(-Math.PI / 2);
    const rangeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.rangeCircleMesh = new THREE.Mesh(rangeGeo, rangeMat);
    this.rangeCircleMesh.position.y = 0.06;
    this.rangeCircleMesh.visible = false;
    this.previewGroup.add(this.rangeCircleMesh);
  }

  public triggerParticlePreset(
    preset: ParticlePreset,
    worldPosition?: THREE.Vector3,
    overrideColor?: string,
    scaleMultiplier = 1.0
  ) {
    let targetPos = worldPosition;
    if (!targetPos) {
      if (this.state.selectedPlacedTower) {
        targetPos = this.gridToWorld(
          this.state.selectedPlacedTower.col,
          this.state.selectedPlacedTower.row
        ).add(new THREE.Vector3(0, 1.2, 0));
      } else if (this.enemies.length > 0) {
        const bossOrFirst = this.enemies.find((e) => ENEMY_SPECS[e.kind].isBoss) || this.enemies[0];
        targetPos = bossOrFirst.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      } else {
        targetPos = new THREE.Vector3(0, 1.2, 0);
      }
    }

    this.particleSystem.emitPreset(preset, targetPos, overrideColor, scaleMultiplier);

    const groundPos = targetPos.clone();
    const cell = this.worldToGrid(groundPos.x, groundPos.z);
    const surfY = cell ? this.getSurfaceDecalY(cell.col, cell.row) : 0.015;

    if (preset === 'boss_explosion' || preset === 'meteor_cataclysm') {
      this.decalSystem.spawnDecal({
        preset: preset === 'meteor_cataclysm' ? 'meteor_scorch' : 'boss_crater',
        position: groundPos,
        radius: 2.6 * scaleMultiplier,
        colorHex: overrideColor,
        lifetime: 11.0,
        surfaceY: surfY,
      });
      soundEngine.playMeteorImpact();
      this.triggerCameraShake(0.42);
    } else if (preset === 'fusion_sparks') {
      this.decalSystem.spawnDecal({
        preset: 'tower_fusion_sigil',
        position: groundPos,
        radius: 1.45 * scaleMultiplier,
        colorHex: overrideColor,
        lifetime: 12.0,
        spinSpeed: 0.25,
        surfaceY: surfY,
      });
      soundEngine.playSuperFusion();
      this.triggerCameraShake(0.24);
    } else if (preset === 'golem_summon') {
      this.decalSystem.spawnDecal({
        preset: 'golem_spawn_footprint',
        position: groundPos,
        radius: 1.65 * scaleMultiplier,
        colorHex: overrideColor || '#10b981',
        lifetime: 11.0,
        surfaceY: surfY,
      });
      soundEngine.playGolemSummon();
    } else {
      this.decalSystem.spawnDecal({
        preset: preset === 'frost_nova' ? 'stasis_glyph' : 'boss_crater',
        position: groundPos,
        radius: 1.85 * scaleMultiplier,
        colorHex: overrideColor,
        lifetime: 8.5,
        spinSpeed: preset === 'frost_nova' ? 0.35 : 0,
        surfaceY: surfY,
      });
      soundEngine.playShoot('nova');
    }
  }

  public triggerCustomParticleEffect(config: ParticleEmitterConfig, worldPosition?: THREE.Vector3) {
    const pos = worldPosition || new THREE.Vector3(0, 1.2, 0);
    this.particleSystem.emitCustom(config, pos);
  }

  public gridToWorld(col: number, row: number, target = new THREE.Vector3()): THREE.Vector3 {
    const offsetX = -((this.currentMap.cols - 1) * TILE_SIZE) / 2;
    const offsetZ = -((this.currentMap.rows - 1) * TILE_SIZE) / 2;
    target.set(offsetX + col * TILE_SIZE, 0, offsetZ + row * TILE_SIZE);
    return target;
  }

  public worldToGrid(worldX: number, worldZ: number): GridCoord | null {
    const offsetX = -((this.currentMap.cols - 1) * TILE_SIZE) / 2;
    const offsetZ = -((this.currentMap.rows - 1) * TILE_SIZE) / 2;
    const col = Math.round((worldX - offsetX) / TILE_SIZE);
    const row = Math.round((worldZ - offsetZ) / TILE_SIZE);
    if (col < 0 || col >= this.currentMap.cols || row < 0 || row >= this.currentMap.rows) {
      return null;
    }
    return { col, row };
  }

  public loadMap(mapId: string, stayInTitle = false) {
    const found = MAPS.find((m) => m.id === mapId) || MAPS[0];
    this.currentMap = found;

    this.gridGroup.clear();
    this.entitiesGroup.clear();
    this.pathLinesGroup.clear();
    this.tileMeshes.clear();
    this.staticPathTilesSet.clear();
    this.towers.clear();
    this.enemies = [];
    this.golems = [];
    this.projectiles.forEach((p) => {
      this.effectsGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
    });
    this.projectiles = [];
    this.beams.forEach((b) => this.effectsGroup.remove(b.line));
    this.beams = [];
    this.portalsAndCore = [];
    this.spawnQueue = [];
    this.clearFusionLink();
    this.particleSystem.clearAll();
    this.decalSystem.clearAll();
    this.floatingTextSystem.clearAll();

    // Populate static path set from MapConfig.staticPaths
    this.activeSpawnPaths = found.staticPaths.map((p) => [...p]);
    for (const path of found.staticPaths) {
      for (const c of path) {
        this.staticPathTilesSet.add(coordKey(c.col, c.row));
      }
    }

    this.scene.background = new THREE.Color(found.theme.skyColor);
    this.scene.fog = new THREE.FogExp2(found.theme.fogColor, 0.0055);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    // 1. Build 360° Sunset Mountain Horizon Sky Dome, 3D Alpine Peaks & Perimeter Pine Forests
    const backdropGroup = buildValleyEnvironmentBackdrop(found);
    this.gridGroup.add(backdropGroup);

    // 2. Build Seamless Sculpted 3D Valley Terrain & Painted 2048x2048 Diorama Map (No square grid!)
    this.riverWaterMesh = null;
    const terrainGroup = buildSculptedValleyTerrainMesh(found, maxAniso);
    this.gridGroup.add(terrainGroup);
    const rMesh = terrainGroup.getObjectByName('riverWaterMesh');
    if (rMesh instanceof THREE.Mesh) {
      this.riverWaterMesh = rMesh;
    }

    // 3. Render Arched Stone Bridge over the Winding Valley River
    if (found.riverCol !== undefined && found.bridgeRow !== undefined) {
      const bridgeModel = buildStoneBridgeModel();
      bridgeModel.position.copy(this.gridToWorld(found.riverCol, found.bridgeRow));
      this.gridGroup.add(bridgeModel);
    }

    // 4. Render Carved Octagonal Stone Tower Pedestals on strategic roadside terraces
    const primaryPedestalSet = new Set<string>();
    if (found.pedestals) {
      for (const ped of found.pedestals) {
        const pedKey = coordKey(ped.col, ped.row);
        if (this.staticPathTilesSet.has(pedKey)) continue;
        primaryPedestalSet.add(pedKey);
        const pedModel = buildOctagonalTowerPedestalModel(false);
        pedModel.position.copy(this.gridToWorld(ped.col, ped.row));
        this.gridGroup.add(pedModel);
      }
    }

    // 5. Render Ancient Runic Void Tree Groves (Bosque Rúnico del Vacío) seated organically into the sculpted terrain
    for (let i = 0; i < found.obstacles.length; i++) {
      const obs = found.obstacles[i];
      const obsKey = coordKey(obs.col, obs.row);
      if (this.staticPathTilesSet.has(obsKey)) continue;
      const model = buildPineForestObstacleModel(i);
      const pos = this.gridToWorld(obs.col, obs.row);
      pos.y = getValleyTerrainHeightAt(found, pos.x, pos.z) - 0.03;
      model.position.copy(pos);
      model.rotation.y = ((i % 3) - 1) * 0.28;
      this.gridGroup.add(model);
    }

    // 6. Render Void Spawn Portals (Portal de Aparición del Vacío) at all enemy spawn points
    for (let sIdx = 0; sIdx < found.spawns.length; sIdx++) {
      const sp = found.spawns[sIdx];
      const portal = buildVoidSpawnPortalModel();
      portal.position.copy(this.gridToWorld(sp.col, sp.row));
      this.gridGroup.add(portal);
      this.portalsAndCore.push(portal);
    }

    // 7. Render the Monumental Multi-Turret Royal Castle Citadel on the Right Goal Plateau
    const coreModel = buildCastleKeepGoalModel();
    coreModel.position.copy(this.gridToWorld(found.goal.col, found.goal.row));
    this.gridGroup.add(coreModel);
    this.portalsAndCore.push(coreModel);

    // 8. Render 3D Stone Curbs & Glowing Red Double-Chevron (>>) Road Markers
    this.renderStaticPathConduits();

    const activeEvent = this.getActiveDailyEvent();
    const defaultMapWeather: WeatherType = activeEvent
      ? activeEvent.weather
      : found.defaultWeather || 'clear';

    const activeWeather = this.state.autoWeather ? defaultMapWeather : this.state.weather;
    this.weatherSystem.setWeather(activeWeather, found, true);
    this.autoWeatherTimer = 26.0;

    const diffSpec = DIFFICULTY_SPECS[this.state.difficulty];
    const adjustedStartingGold = Math.max(
      60,
      found.startingGold +
        diffSpec.startingGoldOffset +
        (activeEvent ? activeEvent.bonusStartingGold : 0)
    );
    const adjustedStartingMana = Math.min(
      150,
      found.startingMana + (activeEvent ? activeEvent.bonusStartingMana : 0)
    );

    this.state = {
      ...this.state,
      phase: stayInTitle ? 'title' : 'playing',
      mapId: found.id,
      weather: activeWeather,
      gold: adjustedStartingGold,
      mana: adjustedStartingMana,
      lives: found.startingLives,
      maxLives: found.startingLives,
      wave: 0,
      totalWaves: found.totalWaves,
      waveInProgress: false,
      nextWaveCountdown: stayInTitle ? null : AUTO_WAVE_DELAY_SECONDS,
      enemiesRemaining: 0,
      selectedPlacedTower: null,
      fusionCandidates: [],
      activeAbilityTargeting: null,
      abilityCooldowns: {
        summon_golem: 0,
        astral_meteor: 0,
        stasis_pulse: 0,
      },
      stasisTimer: 0,
      activeBoss: null,
      activeGolemsCount: 0,
      superTowersBuilt: 0,
      totalKills: 0,
      musicState: 'exploration',
      cinematicCamera: false,
      statusBanner: stayInTitle
        ? null
        : activeEvent
        ? `Evento Diario «${activeEvent.title}» Activo · ${found.chapterTitle}: ${found.name} — Oleada 1 en 7s`
        : `${found.chapterTitle} — ${found.name} (${diffSpec.label} · Clima: ${WEATHER_SPECS[activeWeather].label}) — Oleada 1 en 7s`,
    };
    this.cinematicWasAutoActivated = false;

    soundEngine.setMusicState('exploration');
    this.emitState();
  }

  /**
   * Returns the exact terrain surface Y height for projecting non-Z-fighting decals on roads vs terraces.
   */
  private getSurfaceDecalY(col: number, row: number): number {
    return this.staticPathTilesSet.has(coordKey(col, row)) ? 0.015 : 0.035;
  }

  /**
   * Checks if a tile is a valid buildable terrace (outside static road, obstacles, portals, and existing towers).
   */
  private isTileBuildable(col: number, row: number): boolean {
    const key = coordKey(col, row);
    if (this.staticPathTilesSet.has(key)) return false;
    if (this.towers.has(key)) return false;
    if (
      this.currentMap.riverCol !== undefined &&
      col === this.currentMap.riverCol &&
      row !== this.currentMap.bridgeRow
    ) {
      return false;
    }
    for (const obs of this.currentMap.obstacles) {
      if (obs.col === col && obs.row === row) return false;
    }
    return true;
  }

  private renderStaticPathConduits() {
    this.pathLinesGroup.clear();
    const roadRibbonGroup = buildOrganicRoadRibbonAndChevrons(this.currentMap);
    this.pathLinesGroup.add(roadRibbonGroup);
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const now = performance.now();
      if (now - this.lastHoverRaycastTime < 35) return;
      this.lastHoverRaycastTime = now;
      this.updateHoverCell();
    };

    const onPointerDown = (e: PointerEvent) => {
      this.isPointerDownOnCanvas = true;
      if (e.button !== 0 || this.state.phase !== 'playing') return;
      const rect = canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.updateHoverCell();
      if (this.hoveredCell) {
        this.handleCellClick(this.hoveredCell.col, this.hoveredCell.row);
      }
    };

    const onPointerUp = () => {
      this.isPointerDownOnCanvas = false;
    };

    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.decalSystem.setResolution(w, h);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.state.phase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.startGame(this.state.mapId);
        }
        return;
      }

      if (e.code === 'Escape') {
        if (this.state.activeAbilityTargeting) {
          this.setAbilityTargeting(null);
        } else {
          this.togglePause();
        }
      } else if (e.code === 'Digit1') {
        this.selectBuildTower('quartz');
      } else if (e.code === 'Digit2') {
        this.selectBuildTower('frost');
      } else if (e.code === 'Digit3') {
        this.selectBuildTower('magma');
      } else if (e.code === 'KeyQ') {
        this.triggerAbility('summon_golem');
      } else if (e.code === 'KeyW') {
        this.triggerAbility('astral_meteor');
      } else if (e.code === 'KeyE') {
        this.triggerAbility('stasis_pulse');
      } else if (e.code === 'KeyC') {
        this.toggleCinematicCamera();
      } else if (e.code === 'KeyH') {
        this.toggleDockCollapsed();
      } else if (e.code === 'Space' && !this.state.waveInProgress && this.state.phase === 'playing') {
        e.preventDefault();
        this.startNextWave();
      }
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
  }

  private updateHoverCell() {
    if (this.state.phase !== 'playing') {
      this.hoverHighlightMesh.visible = false;
      this.rangeCircleMesh.visible = false;
      this.decalSystem.updateTargetingDecal(false);
      return;
    }

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hitPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint);
    if (!hit) {
      this.hoveredCell = null;
      this.hoverHighlightMesh.visible = false;
      this.decalSystem.updateTargetingDecal(false);
      return;
    }

    const cell = this.worldToGrid(hitPoint.x, hitPoint.z);
    if (!cell) {
      this.hoveredCell = null;
      this.hoverHighlightMesh.visible = false;
      this.decalSystem.updateTargetingDecal(false);
      return;
    }

    this.hoveredCell = cell;

    const worldPos = this.gridToWorld(cell.col, cell.row);
    const surfY = this.getSurfaceDecalY(cell.col, cell.row);
    this.hoverHighlightMesh.position.set(worldPos.x, surfY + 0.015, worldPos.z);
    this.hoverHighlightMesh.visible = true;

    const hoverMat = this.hoverHighlightMesh.material as THREE.MeshBasicMaterial;
    const existingTower = this.towers.get(coordKey(cell.col, cell.row));

    if (this.state.activeAbilityTargeting) {
      const isMeteor = this.state.activeAbilityTargeting === 'astral_meteor';
      hoverMat.color.setHex(isMeteor ? 0xf59e0b : 0x10b981);
      this.rangeCircleMesh.visible = true;
      this.rangeCircleMesh.position.set(worldPos.x, surfY + 0.025, worldPos.z);
      const r = isMeteor ? 3.4 : 2.2;
      this.rangeCircleMesh.scale.setScalar(r);

      const decalPreset: DecalPreset = isMeteor ? 'meteor_scorch' : 'golem_spawn_footprint';
      this.decalSystem.updateTargetingDecal(
        true,
        worldPos,
        r,
        isMeteor ? '#f59e0b' : '#10b981',
        decalPreset,
        surfY + 0.008
      );
      return;
    }

    this.decalSystem.updateTargetingDecal(false);

    if (existingTower) {
      hoverMat.color.setHex(0xf59e0b);
      return;
    }

    if (this.state.selectedBuildTower) {
      const buildable = this.isTileBuildable(cell.col, cell.row);
      hoverMat.color.setHex(buildable ? 0x38bdf8 : 0xef4444);
      this.rangeCircleMesh.visible = buildable;
      this.rangeCircleMesh.position.set(worldPos.x, surfY + 0.02, worldPos.z);
      const spec = BASE_TOWERS[this.state.selectedBuildTower];
      this.rangeCircleMesh.scale.setScalar(spec.range);
    }
  }

  private handleCellClick(col: number, row: number) {
    const key = coordKey(col, row);

    if (this.state.activeAbilityTargeting) {
      this.executeTargetedAbility(this.state.activeAbilityTargeting, col, row);
      return;
    }

    const existing = this.towers.get(key);
    if (existing) {
      soundEngine.playClick();
      this.selectPlacedTower(existing);
      return;
    }

    if (this.state.selectedBuildTower) {
      if (!this.isTileBuildable(col, row)) {
        this.showBanner('Construye tus torres en las terrazas libres fuera del camino estático');
        return;
      }

      const spec = BASE_TOWERS[this.state.selectedBuildTower];
      const buildCost = getAdjustedTowerCost(spec.cost, this.state.difficulty);
      if (this.state.gold < buildCost) {
        this.showBanner(`Oro insuficiente para construir ${spec.name} (${buildCost} Oro)`);
        return;
      }

      this.state.gold -= buildCost;
      const skinSpec = this.getTowerEquippedSkinSpec(spec.id);
      const model = buildTowerModel(spec.id, 1, this.isSoftwareGl, skinSpec);
      const worldPos = this.gridToWorld(col, row);
      model.position.copy(worldPos);
      this.entitiesGroup.add(model);

      const newTower: ActiveTowerEntity = {
        id: `tower_${col}_${row}_${Date.now()}`,
        col,
        row,
        kind: spec.id,
        level: 1,
        xp: 0,
        maxXp: getTowerMaxXpForLevel(1),
        totalInvested: buildCost,
        kills: 0,
        totalDamage: 0,
        stunTimer: 0,
        mesh: model,
        cooldown: 0,
      };
      this.syncTowerXpBarVisual(newTower);

      this.towers.set(key, newTower);
      soundEngine.playBuild();
      this.particleSystem.emitPreset(
        'crystal_shatter',
        worldPos.clone().add(new THREE.Vector3(0, 0.8, 0)),
        spec.color
      );
      this.selectPlacedTower(newTower);
    }
  }

  private selectPlacedTower(tower: ActiveTowerEntity | null) {
    this.clearFusionLink();
    if (!tower) {
      this.state.selectedPlacedTower = null;
      this.state.fusionCandidates = [];
      this.rangeCircleMesh.visible = false;
      this.emitState();
      return;
    }

    const spec = ALL_TOWERS[tower.kind];
    const worldPos = this.gridToWorld(tower.col, tower.row);
    this.rangeCircleMesh.visible = true;
    this.rangeCircleMesh.position.set(worldPos.x, 0.06, worldPos.z);
    const effectiveRange = getTowerEffectiveRange(spec, tower.level);
    this.rangeCircleMesh.scale.setScalar(effectiveRange);

    const candidates = this.computeFusionCandidates(tower);
    this.state.selectedPlacedTower = {
      id: tower.id,
      col: tower.col,
      row: tower.row,
      kind: tower.kind,
      level: tower.level,
      xp: tower.xp,
      maxXp: tower.maxXp,
      totalInvested: tower.totalInvested,
      kills: tower.kills,
      totalDamage: Math.round(tower.totalDamage),
      stunTimer: tower.stunTimer,
    };
    this.state.fusionCandidates = candidates;

    if (candidates.length > 0) {
      this.drawFusionLink(tower, candidates[0].neighborTower, candidates[0].resultSpec.color);
    }

    this.emitState();
  }

  private computeFusionCandidates(tower: ActiveTowerEntity): FusionCandidate[] {
    if (ALL_TOWERS[tower.kind].isSuper) return [];
    const results: FusionCandidate[] = [];
    const seenIds = new Set<string>([tower.id]);

    // 1. Check all 8 surrounding tiles (orthogonal + diagonal)
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const neighborTower = this.towers.get(coordKey(tower.col + dc, tower.row + dr));
        if (!neighborTower || seenIds.has(neighborTower.id)) continue;
        const match = findSuperTowerRecipe(tower.kind, neighborTower.kind);
        if (match) {
          seenIds.add(neighborTower.id);
          results.push({
            neighborTower: {
              id: neighborTower.id,
              col: neighborTower.col,
              row: neighborTower.row,
              kind: neighborTower.kind,
              level: neighborTower.level,
              xp: neighborTower.xp,
              maxXp: neighborTower.maxXp,
              totalInvested: neighborTower.totalInvested,
              kills: neighborTower.kills,
              totalDamage: Math.round(neighborTower.totalDamage),
              stunTimer: neighborTower.stunTimer,
            },
            resultSpec: match.spec,
            fusionCost: getAdjustedTowerCost(match.spec.cost, this.state.difficulty),
          });
        }
      }
    }

    // 2. Fallback: if no immediate neighbor was found, allow fusing with any other base tower on the map sorted by proximity
    if (results.length === 0) {
      const otherTowers = Array.from(this.towers.values())
        .filter((t) => t.id !== tower.id && !ALL_TOWERS[t.kind].isSuper)
        .sort((a, b) => {
          const da = Math.hypot(a.col - tower.col, a.row - tower.row);
          const db = Math.hypot(b.col - tower.col, b.row - tower.row);
          return da - db;
        });

      for (const other of otherTowers.slice(0, 3)) {
        const match = findSuperTowerRecipe(tower.kind, other.kind);
        if (match) {
          results.push({
            neighborTower: {
              id: other.id,
              col: other.col,
              row: other.row,
              kind: other.kind,
              level: other.level,
              xp: other.xp,
              maxXp: other.maxXp,
              totalInvested: other.totalInvested,
              kills: other.kills,
              totalDamage: Math.round(other.totalDamage),
              stunTimer: other.stunTimer,
            },
            resultSpec: match.spec,
            fusionCost: getAdjustedTowerCost(match.spec.cost, this.state.difficulty),
          });
        }
      }
    }

    return results;
  }

  private drawFusionLink(a: GridCoord, b: GridCoord, colorHex: string) {
    this.clearFusionLink();
    const posA = this.gridToWorld(a.col, a.row).add(new THREE.Vector3(0, 1.3, 0));
    const posB = this.gridToWorld(b.col, b.row).add(new THREE.Vector3(0, 1.3, 0));
    const mid = posA.clone().lerp(posB, 0.5).add(new THREE.Vector3(0, 0.65, 0));
    const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);
    const pts = curve.getPoints(16);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(colorHex), linewidth: 2 });
    this.fusionLinkLine = new THREE.Line(geo, mat);
    this.effectsGroup.add(this.fusionLinkLine);
  }

  private clearFusionLink() {
    if (this.fusionLinkLine) {
      this.effectsGroup.remove(this.fusionLinkLine);
      this.fusionLinkLine.geometry.dispose();
      this.fusionLinkLine = null;
    }
  }

  public fuseSelectedTowerWith(neighborId: string) {
    if (!this.state.selectedPlacedTower) return;
    const primaryKey = coordKey(this.state.selectedPlacedTower.col, this.state.selectedPlacedTower.row);
    const primaryTower = this.towers.get(primaryKey);
    if (!primaryTower) return;

    // Refresh candidates to ensure up-to-date state
    const currentCandidates = this.computeFusionCandidates(primaryTower);
    const candidate = currentCandidates.find((c) => c.neighborTower.id === neighborId) || currentCandidates[0];
    if (!candidate) {
      this.showBanner('Selecciona o construye otra torre para fusionarlas en una Supertorre');
      return;
    }

    if (this.state.gold < candidate.fusionCost) {
      this.showBanner(`Necesitas ${candidate.fusionCost} de Oro para fusionar en ${candidate.resultSpec.name} (Tienes ${this.state.gold})`);
      return;
    }

    const neighborKey = coordKey(candidate.neighborTower.col, candidate.neighborTower.row);
    const neighborEntity = this.towers.get(neighborKey);
    if (!neighborEntity) return;

    this.state.gold -= candidate.fusionCost;

    const neighborWorldPos = this.gridToWorld(neighborEntity.col, neighborEntity.row);
    const worldPos = this.gridToWorld(primaryTower.col, primaryTower.row);

    this.entitiesGroup.remove(primaryTower.mesh);
    this.entitiesGroup.remove(neighborEntity.mesh);
    this.towers.delete(neighborKey);

    const superSpec = candidate.resultSpec;
    const inheritedLevel = Math.max(primaryTower.level, neighborEntity.level);
    const superMesh = buildTowerModel(
      superSpec.id,
      inheritedLevel,
      this.isSoftwareGl,
      this.getTowerEquippedSkinSpec(superSpec.id)
    );
    superMesh.position.copy(worldPos);
    this.entitiesGroup.add(superMesh);

    const fusedTower: ActiveTowerEntity = {
      id: `supertower_${primaryTower.col}_${primaryTower.row}_${Date.now()}`,
      col: primaryTower.col,
      row: primaryTower.row,
      kind: superSpec.id,
      level: inheritedLevel,
      xp: primaryTower.xp,
      maxXp: getTowerMaxXpForLevel(inheritedLevel),
      totalInvested: primaryTower.totalInvested + neighborEntity.totalInvested + candidate.fusionCost,
      kills: primaryTower.kills + neighborEntity.kills,
      totalDamage: primaryTower.totalDamage + neighborEntity.totalDamage,
      stunTimer: 0,
      mesh: superMesh,
      cooldown: 0,
    };
    this.syncTowerXpBarVisual(fusedTower);

    this.towers.set(primaryKey, fusedTower);
    this.state.superTowersBuilt += 1;

    soundEngine.playSuperFusion();
    this.triggerCameraShake(0.35);

    this.particleSystem.emitPreset(
      'fusion_sparks',
      neighborWorldPos.clone().add(new THREE.Vector3(0, 0.8, 0)),
      superSpec.secondaryColor,
      0.85
    );
    this.particleSystem.emitPreset(
      'fusion_sparks',
      worldPos.clone().add(new THREE.Vector3(0, 1.3, 0)),
      superSpec.color,
      1.35
    );

    // Stamp arcane transmutation decals onto both fused terrace tiles
    this.decalSystem.spawnDecal({
      preset: 'tower_fusion_sigil',
      position: neighborWorldPos,
      radius: 1.05,
      colorHex: superSpec.secondaryColor,
      lifetime: 10.0,
      spinSpeed: -0.2,
      surfaceY: this.getSurfaceDecalY(neighborEntity.col, neighborEntity.row),
    });
    this.decalSystem.spawnDecal({
      preset: 'tower_fusion_sigil',
      position: worldPos,
      radius: 1.45,
      colorHex: superSpec.color,
      lifetime: 22.0,
      spinSpeed: 0.28,
      surfaceY: this.getSurfaceDecalY(primaryTower.col, primaryTower.row),
    });

    this.showBanner(`¡Fusión completada: ${superSpec.name}!`);
    this.incrementAchievementMetric('superTowersCreated', 1, worldPos);
    this.selectPlacedTower(fusedTower);
  }

  /**
   * Allows 1-click direct fusion/ascension of a single selected base tower into a Supertower
   * even if the player has not placed a second tower on the map yet.
   */
  public directAscendSelectedTower(partnerType: BaseTowerType) {
    if (!this.state.selectedPlacedTower) return;
    const primaryKey = coordKey(this.state.selectedPlacedTower.col, this.state.selectedPlacedTower.row);
    const primaryTower = this.towers.get(primaryKey);
    if (!primaryTower || ALL_TOWERS[primaryTower.kind].isSuper) return;

    const match = findSuperTowerRecipe(primaryTower.kind, partnerType);
    if (!match) return;

    const totalCost = getAdjustedTowerCost(match.spec.cost, this.state.difficulty);
    if (this.state.gold < totalCost) {
      this.showBanner(`Necesitas ${totalCost} de Oro para fusionar en ${match.spec.name} (Tienes ${this.state.gold})`);
      return;
    }

    this.state.gold -= totalCost;
    const worldPos = this.gridToWorld(primaryTower.col, primaryTower.row);
    this.entitiesGroup.remove(primaryTower.mesh);

    const superSpec = match.spec;
    const superMesh = buildTowerModel(
      superSpec.id,
      primaryTower.level,
      this.isSoftwareGl,
      this.getTowerEquippedSkinSpec(superSpec.id)
    );
    superMesh.position.copy(worldPos);
    this.entitiesGroup.add(superMesh);

    const fusedTower: ActiveTowerEntity = {
      id: `supertower_${primaryTower.col}_${primaryTower.row}_${Date.now()}`,
      col: primaryTower.col,
      row: primaryTower.row,
      kind: superSpec.id,
      level: primaryTower.level,
      xp: primaryTower.xp,
      maxXp: getTowerMaxXpForLevel(primaryTower.level),
      totalInvested: primaryTower.totalInvested + totalCost,
      kills: primaryTower.kills,
      totalDamage: primaryTower.totalDamage,
      stunTimer: 0,
      mesh: superMesh,
      cooldown: 0,
    };
    this.syncTowerXpBarVisual(fusedTower);

    this.towers.set(primaryKey, fusedTower);
    this.state.superTowersBuilt += 1;

    soundEngine.playSuperFusion();
    this.triggerCameraShake(0.35);

    this.particleSystem.emitPreset(
      'fusion_sparks',
      worldPos.clone().add(new THREE.Vector3(0, 1.3, 0)),
      superSpec.color,
      1.35
    );

    this.decalSystem.spawnDecal({
      preset: 'tower_fusion_sigil',
      position: worldPos,
      radius: 1.45,
      colorHex: superSpec.color,
      lifetime: 22.0,
      spinSpeed: 0.28,
      surfaceY: this.getSurfaceDecalY(primaryTower.col, primaryTower.row),
    });

    this.showBanner(`¡Fusión Arcana completada: ${superSpec.name}!`);
    this.incrementAchievementMetric('superTowersCreated', 1, worldPos);
    this.selectPlacedTower(fusedTower);
  }

  public upgradeSelectedTower() {
    if (!this.state.selectedPlacedTower) return;
    const key = coordKey(this.state.selectedPlacedTower.col, this.state.selectedPlacedTower.row);
    const tower = this.towers.get(key);
    if (!tower || tower.level >= MAX_TOWER_LEVEL) return;

    const spec = ALL_TOWERS[tower.kind];
    const upgradeCost = getAdjustedTowerCost(
      Math.round(spec.cost * 0.75 * tower.level),
      this.state.difficulty
    );
    if (this.state.gold < upgradeCost) {
      this.showBanner(`Oro insuficiente para mejorar esta torre (${upgradeCost} Oro)`);
      return;
    }

    this.state.gold -= upgradeCost;
    tower.level += 1;
    tower.xp = 0;
    tower.maxXp = getTowerMaxXpForLevel(tower.level);
    tower.totalInvested += upgradeCost;

    this.entitiesGroup.remove(tower.mesh);
    const newMesh = buildTowerModel(
      tower.kind,
      tower.level,
      this.isSoftwareGl,
      this.getTowerEquippedSkinSpec(tower.kind)
    );
    const worldPos = this.gridToWorld(tower.col, tower.row);
    newMesh.position.copy(worldPos);
    this.entitiesGroup.add(newMesh);
    tower.mesh = newMesh;
    this.syncTowerXpBarVisual(tower);

    soundEngine.playBuild();
    this.particleSystem.emitPreset(
      'fusion_sparks',
      worldPos.clone().add(new THREE.Vector3(0, 1.0, 0)),
      spec.color,
      0.85
    );
    this.floatingTextSystem.spawnLevelUpBanner(worldPos, tower.level, spec.color);
    this.selectPlacedTower(tower);
  }

  private syncTowerXpBarVisual(tower: ActiveTowerEntity) {
    const xpBarFill = tower.mesh.userData.xpBarFill as THREE.Mesh | undefined;
    if (!xpBarFill) return;
    const mat = xpBarFill.material as THREE.MeshBasicMaterial;
    if (tower.level >= MAX_TOWER_LEVEL) {
      xpBarFill.scale.x = 1.0;
      mat.color.setHex(0xfbbf24);
    } else {
      const ratio = Math.max(0.04, Math.min(1.0, tower.xp / Math.max(1, tower.maxXp)));
      xpBarFill.scale.x = ratio;
      const skin = this.getTowerEquippedSkinSpec(tower.kind);
      mat.color.set(!skin.isDefault ? skin.primaryGlow : ALL_TOWERS[tower.kind].color);
    }
  }

  private awardTowerControlXp(tower: ActiveTowerEntity, affectedCount: number) {
    if (affectedCount <= 0) return;
    tower.kills += affectedCount;
    if (tower.level >= MAX_TOWER_LEVEL) {
      this.syncTowerXpBarVisual(tower);
      if (this.state.selectedPlacedTower?.id === tower.id) {
        this.selectPlacedTower(tower);
      }
      return;
    }

    tower.xp += affectedCount * 16;
    this.checkAndApplyTowerLevelUp(tower);
  }

  private awardTowerKillXp(tower: ActiveTowerEntity, killedEnemy: ActiveEnemyEntity) {
    tower.kills += 1;
    if (tower.level >= MAX_TOWER_LEVEL) {
      this.syncTowerXpBarVisual(tower);
      if (this.state.selectedPlacedTower?.id === tower.id) {
        this.selectPlacedTower(tower);
      }
      return;
    }

    const enemySpec = ENEMY_SPECS[killedEnemy.kind];
    const xpGain = enemySpec.isBoss
      ? 160
      : killedEnemy.kind === 'basalt'
      ? 55
      : killedEnemy.kind === 'construct' || killedEnemy.kind === 'weaver'
      ? 35
      : 28;

    tower.xp += xpGain;
    this.checkAndApplyTowerLevelUp(tower);
  }

  private checkAndApplyTowerLevelUp(tower: ActiveTowerEntity) {
    let leveledUp = false;

    while (tower.level < MAX_TOWER_LEVEL && tower.xp >= tower.maxXp) {
      tower.xp -= tower.maxXp;
      tower.level += 1;
      tower.maxXp = getTowerMaxXpForLevel(tower.level);
      leveledUp = true;
    }

    if (tower.level >= MAX_TOWER_LEVEL) {
      tower.xp = tower.maxXp;
    }

    if (leveledUp) {
      const spec = ALL_TOWERS[tower.kind];
      const worldPos = this.gridToWorld(tower.col, tower.row);
      this.entitiesGroup.remove(tower.mesh);
      const newMesh = buildTowerModel(
        tower.kind,
        tower.level,
        this.isSoftwareGl,
        this.getTowerEquippedSkinSpec(tower.kind)
      );
      newMesh.position.copy(worldPos);
      this.entitiesGroup.add(newMesh);
      tower.mesh = newMesh;
      this.syncTowerXpBarVisual(tower);

      soundEngine.playBuild();
      this.particleSystem.emitPreset(
        'fusion_sparks',
        worldPos.clone().add(new THREE.Vector3(0, 1.15, 0)),
        '#fbbf24',
        1.1
      );
      this.floatingTextSystem.spawnLevelUpBanner(worldPos, tower.level, spec.color);
      this.showBanner(
        `¡${spec.name} subió a Nivel ${tower.level} por experiencia! (+Alcance y +Cadencia)`
      );
    } else {
      this.syncTowerXpBarVisual(tower);
    }

    if (this.state.selectedPlacedTower?.id === tower.id) {
      this.selectPlacedTower(tower);
    }
  }

  public sellSelectedTower() {
    if (!this.state.selectedPlacedTower) return;
    const key = coordKey(this.state.selectedPlacedTower.col, this.state.selectedPlacedTower.row);
    const tower = this.towers.get(key);
    if (!tower) return;

    const refund = Math.round(tower.totalInvested * 0.75);
    this.state.gold += refund;
    this.entitiesGroup.remove(tower.mesh);
    this.towers.delete(key);

    soundEngine.playClick();
    this.selectPlacedTower(null);
  }

  public triggerAbility(abilityId: PlayerAbilityId) {
    if (this.state.phase !== 'playing') return;
    const spec = PLAYER_ABILITIES[abilityId];
    if (this.state.abilityCooldowns[abilityId] > 0) {
      this.showBanner(`${spec.name} aún está en enfriamiento`);
      return;
    }
    if (this.state.mana < spec.manaCost) {
      this.showBanner('Esencia Arcana (Maná) insuficiente');
      return;
    }

    if (!spec.requiresTarget) {
      this.state.mana -= spec.manaCost;
      this.state.abilityCooldowns[abilityId] = spec.cooldown;
      this.state.stasisTimer = 4.5;
      for (const enemy of this.enemies) {
        enemy.stunTimer = Math.max(enemy.stunTimer, 4.0);
        enemy.frozenTimer = Math.max(enemy.frozenTimer, 4.0);
        this.floatingTextSystem.spawnStatusCallout(
          enemy.position,
          'frozen',
          ENEMY_SPECS[enemy.kind].isBoss
        );
        this.particleSystem.emitPreset(
          'frost_nova',
          enemy.position.clone().add(new THREE.Vector3(0, 0.8, 0))
        );
        this.decalSystem.spawnDecal({
          preset: 'stasis_glyph',
          position: enemy.position,
          radius: 1.35,
          colorHex: '#38bdf8',
          lifetime: 5.2,
          spinSpeed: 0.45,
          surfaceY: -0.03,
        });
      }
      soundEngine.playSuperFusion();
      this.showBanner('¡Protocolo 23-19 activado! Monstruos congelados y torres sobrecargadas');
      this.incrementAchievementMetric('abilitiesCast', 1);
      this.emitState();
      return;
    }

    if (this.state.activeAbilityTargeting === abilityId && abilityId === 'summon_golem') {
      this.executeTargetedAbility('summon_golem', this.currentMap.goal.col, this.currentMap.goal.row);
      return;
    }

    this.setAbilityTargeting(abilityId);
  }

  public setAbilityTargeting(abilityId: PlayerAbilityId | null) {
    this.state.activeAbilityTargeting = abilityId;
    if (!abilityId) {
      this.decalSystem.updateTargetingDecal(false);
    } else {
      const spec = PLAYER_ABILITIES[abilityId];
      this.showBanner(`Selecciona un punto en el mapa para lanzar: ${spec.name}`);
    }
    this.emitState();
  }

  private executeTargetedAbility(abilityId: PlayerAbilityId, col: number, row: number) {
    const spec = PLAYER_ABILITIES[abilityId];
    if (this.state.mana < spec.manaCost || this.state.abilityCooldowns[abilityId] > 0) {
      this.state.activeAbilityTargeting = null;
      this.decalSystem.updateTargetingDecal(false);
      this.emitState();
      return;
    }

    this.state.mana -= spec.manaCost;
    this.state.abilityCooldowns[abilityId] = spec.cooldown;
    this.state.activeAbilityTargeting = null;
    this.decalSystem.updateTargetingDecal(false);

    if (abilityId === 'summon_golem') {
      this.spawnAlliedGolemAt(col, row);
    } else if (abilityId === 'astral_meteor') {
      const targetWorld = this.gridToWorld(col, row);
      const surfY = this.getSurfaceDecalY(col, row);
      soundEngine.playMeteorImpact();
      this.triggerCameraShake(0.55);
      this.hitstopTimer = 0.05;
      this.particleSystem.emitPreset(
        'meteor_cataclysm',
        targetWorld.clone().add(new THREE.Vector3(0, 0.5, 0)),
        '#f59e0b',
        1.35
      );

      // Stamp screen-space molten scorch crater decal at spell impact zone
      this.decalSystem.spawnDecal({
        preset: 'meteor_scorch',
        position: targetWorld,
        radius: 3.4,
        colorHex: '#f97316',
        lifetime: 14.0,
        surfaceY: surfY,
      });

      for (const enemy of this.enemies) {
        const dist = enemy.position.distanceTo(targetWorld);
        if (dist <= 3.8 * TILE_SIZE * 0.6) {
          this.applyStatusEffectsToEnemy(enemy, {
            burnDps: 65,
            burnDuration: 5.0,
          });
          this.applyDamageToEnemy(enemy, 520, true, 0, 1.0, '#f59e0b');
          enemy.stunTimer = Math.max(enemy.stunTimer, 3.0);
        }
      }
      this.showBanner('¡Impacto de Sobrecarga de Gritos!');
      this.incrementAchievementMetric('abilitiesCast', 1, targetWorld);
    }

    this.emitState();
  }

  public spawnAlliedGolemAt(col: number, row: number) {
    const primaryPath = this.activeSpawnPaths[0];
    if (!primaryPath || primaryPath.length < 2) return;

    let bestPath = primaryPath;
    let bestNodeIdx = primaryPath.length - 1;
    let bestDist = Infinity;

    for (const path of this.activeSpawnPaths) {
      for (let i = 0; i < path.length; i++) {
        const d = Math.abs(path[i].col - col) + Math.abs(path[i].row - row);
        if (d < bestDist) {
          bestDist = d;
          bestPath = path;
          bestNodeIdx = i;
        }
      }
    }

    const reversePath = bestPath.slice(0, bestNodeIdx + 1).reverse();
    if (reversePath.length < 2) {
      reversePath.push(bestPath[0]);
    }

    const startCoord = reversePath[0];
    const startWorld = this.gridToWorld(startCoord.col, startCoord.row);
    const mesh = buildAlliedGolemModel();
    mesh.position.copy(startWorld);

    const { hpBarGroup, hpBarFill, hpBarMaterial } = this.createEntityHealthBar(
      1.1,
      2.15,
      0x10b981
    );
    mesh.add(hpBarGroup);

    this.entitiesGroup.add(mesh);

    const golemMult = this.getActiveDailyEvent()?.golemStatMult ?? 1;
    const scaledGolemHp = Math.round(1150 * golemMult);
    const scaledGolemDmg = Math.round(105 * golemMult);

    const golem: ActiveGolemEntity = {
      id: `golem_${Date.now()}`,
      mesh,
      hp: scaledGolemHp,
      maxHp: scaledGolemHp,
      damage: scaledGolemDmg,
      path: reversePath,
      pathIndex: 1,
      position: startWorld.clone(),
      attackCooldown: 0,
      attackAnimTimer: 0,
      stepTrackTimer: 0.25,
      stepFootSide: 1,
      animOffset: Math.random() * 10,
      hpBarGroup,
      hpBarFill,
      hpBarMaterial,
    };

    this.golems.push(golem);
    this.state.activeGolemsCount = this.golems.length;
    soundEngine.playGolemSummon();
    this.triggerCameraShake(0.28);
    this.particleSystem.emitPreset(
      'golem_summon',
      startWorld.clone().add(new THREE.Vector3(0, 1.0, 0))
    );

    // Stamp Allied Guardian spawn footprint decal onto the static road surface
    const nextCoord = reversePath[1] || reversePath[0];
    const nextWorld = this.gridToWorld(nextCoord.col, nextCoord.row);
    const spawnHeading = Math.atan2(nextWorld.x - startWorld.x, nextWorld.z - startWorld.z);
    this.decalSystem.spawnDecal({
      preset: 'golem_spawn_footprint',
      position: startWorld,
      radius: 1.65,
      colorHex: '#10b981',
      lifetime: 13.0,
      rotationY: spawnHeading,
      surfaceY: -0.03,
    });

    this.showBanner('¡Guardián Peludo desplegado sobre la calzada estática!');
    this.incrementAchievementMetric('golemsSummonAndAbility' as unknown as AchievementMetricKey, 0);
    this.incrementAchievementMetric('golemsSummoned', 1, startWorld);
    this.incrementAchievementMetric('abilitiesCast', 1, startWorld);
    this.emitState();
  }

  public startNextWave() {
    if (this.state.waveInProgress || this.state.phase !== 'playing') return;
    if (this.state.wave >= this.currentMap.totalWaves) return;

    this.state.wave += 1;
    this.state.waveInProgress = true;
    this.state.nextWaveCountdown = null;
    const waveDef = WAVE_DEFINITIONS[this.state.wave - 1] || WAVE_DEFINITIONS[WAVE_DEFINITIONS.length - 1];
    const diffSpec = DIFFICULTY_SPECS[this.state.difficulty];

    this.spawnQueue = [];
    this.waveElapsed = 0;
    let cursorTime = 0.5;
    let spawnCounter = 0;

    for (const group of waveDef.groups) {
      cursorTime += group.delayBefore;
      const isBoss = ENEMY_SPECS[group.kind].isBoss;
      const effectiveCount = Math.max(1, group.count + (isBoss ? 0 : diffSpec.extraGroupEnemies));
      const effectiveInterval = Math.max(0.25, group.interval * diffSpec.spawnIntervalMultiplier);

      for (let i = 0; i < effectiveCount; i++) {
        this.spawnQueue.push({
          kind: group.kind,
          spawnTime: cursorTime + i * effectiveInterval,
          spawnIndex: spawnCounter % this.currentMap.spawns.length,
        });
        spawnCounter++;
      }
      cursorTime += effectiveCount * effectiveInterval;
    }

    this.state.enemiesRemaining = this.spawnQueue.length + this.enemies.length;

    // Dynamic weather shift on wave start when autoWeather is active
    if (this.state.autoWeather) {
      const waveWeatherCycle: WeatherType[] = [
        'arcane_snow',
        'dense_fog',
        'ember_ash',
        'clear',
        'aether_storm',
      ];
      const nextWeather: WeatherType = waveDef.isBossWave
        ? 'aether_storm'
        : waveWeatherCycle[(this.state.wave - 1) % waveWeatherCycle.length];
      if (nextWeather !== this.state.weather) {
        this.state.weather = nextWeather;
        this.weatherSystem.setWeather(nextWeather, this.currentMap, false);
        this.autoWeatherTimer = 26.0;
      }
    }

    const nextMusicState: AudioTrackState = waveDef.isBossWave ? 'boss_combat' : 'combat';
    this.state.musicState = nextMusicState;
    soundEngine.startBackgroundMusic();
    soundEngine.setMusicState(nextMusicState);

    const weatherLabel = WEATHER_SPECS[this.state.weather].label;
    if (waveDef.isBossWave) {
      soundEngine.playBossAlert();
      if (this.state.autoCinematicCamera && !this.state.cinematicCamera) {
        this.syncCinematicAngleFromCamera();
        this.state.cinematicCamera = true;
        this.cinematicWasAutoActivated = true;
      }
      this.showBanner(
        `¡OLEADA DE JEFE ${this.state.wave}: ${waveDef.bossName} [${diffSpec.label} · Cámara Cinemática Activa]!`
      );
    } else {
      soundEngine.playWaveStart();
      this.showBanner(`Oleada ${this.state.wave}: ${waveDef.title} (${diffSpec.label} · Clima: ${weatherLabel})`);
    }

    this.emitState();
  }

  private spawnEnemy(kind: EnemyKind, spawnIndex: number) {
    const spec = ENEMY_SPECS[kind];
    const diffSpec = DIFFICULTY_SPECS[this.state.difficulty];
    const waveScale = 1 + (this.state.wave - 1) * 0.12;
    const scaledHp = Math.max(10, Math.round(spec.hp * waveScale * diffSpec.enemyHpMultiplier));

    const path = this.activeSpawnPaths[spawnIndex] || this.activeSpawnPaths[0];
    if (!path || path.length === 0) return;

    const startWorld = this.gridToWorld(path[0].col, path[0].row);
    const mesh = buildEnemyModel(kind);
    mesh.position.copy(startWorld);

    const barWidth = spec.isBoss ? 1.5 : 0.85;
    const barY = spec.isBoss ? 2.35 : 1.6;
    const { hpBarGroup, hpBarFill, hpBarMaterial } = this.createEntityHealthBar(
      barWidth,
      barY,
      spec.isBoss ? 0xf59e0b : 0xef4444
    );
    mesh.add(hpBarGroup);

    this.entitiesGroup.add(mesh);

    const nextNode = path[1] || path[0];
    const nextWorld = this.gridToWorld(nextNode.col, nextNode.row);
    const spawnHeading = Math.atan2(nextWorld.x - startWorld.x, nextWorld.z - startWorld.z);

    // Stamp unit spawn footprint decal at the Scare-Floor Door Portal threshold
    this.decalSystem.spawnDecal({
      preset: 'monster_spawn_footprint',
      position: startWorld,
      radius: spec.isBoss ? 1.85 : 1.05,
      colorHex: spec.color,
      lifetime: spec.isBoss ? 11.0 : 5.5,
      rotationY: spawnHeading,
      surfaceY: -0.03,
    });

    if (spec.isBoss) {
      this.particleSystem.emitPreset(
        'boss_shockwave',
        startWorld.clone().add(new THREE.Vector3(0, 0.8, 0)),
        spec.accentColor,
        1.25
      );
      this.triggerCameraShake(0.35);
      if (this.state.autoCinematicCamera && !this.state.cinematicCamera) {
        this.syncCinematicAngleFromCamera();
        this.state.cinematicCamera = true;
        this.cinematicWasAutoActivated = true;
        this.emitState();
      }
    }

    const dailySpeedMult = this.getActiveDailyEvent()?.enemySpeedMult ?? 1;

    const enemy: ActiveEnemyEntity = {
      id: `enemy_${Date.now()}_${Math.random()}`,
      kind,
      mesh,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: spec.speed * dailySpeedMult,
      armor: spec.armor,
      path: [...path],
      pathIndex: 1,
      position: startWorld.clone(),
      slowTimer: 0,
      slowFactor: 0,
      frozenTimer: 0,
      freezeImmunityTimer: 0,
      burnTimer: 0,
      burnDps: 0,
      burnTickTimer: 0,
      stunTimer: 0,
      bossSlamTimer: spec.isBoss ? 5.5 : 999,
      attackAnimTimer: 0,
      stepTrackTimer: 0.35,
      stepFootSide: 1,
      animOffset: Math.random() * 12,
      hpBarGroup,
      hpBarFill,
      hpBarMaterial,
    };

    this.enemies.push(enemy);
  }

  private applyStatusEffectsToEnemy(
    enemy: ActiveEnemyEntity,
    effects: {
      slowFactor?: number;
      slowDuration?: number;
      freezeChance?: number;
      freezeDuration?: number;
      burnDps?: number;
      burnDuration?: number;
    },
    sourceTowerKey?: string
  ) {
    if (enemy.hp <= 0) return;
    const spec = ENEMY_SPECS[enemy.kind];
    let triggeredFrozen = false;

    // 1. CONGELADO (Frozen): Encases enemy in a 3D glacial ice crystal cage + overhead 3D snowflake
    if (
      effects.freezeChance &&
      effects.freezeChance > 0 &&
      effects.freezeDuration &&
      effects.freezeDuration > 0 &&
      enemy.freezeImmunityTimer <= 0
    ) {
      const effectiveChance = spec.isBoss ? effects.freezeChance * 0.65 : effects.freezeChance;
      if (Math.random() < effectiveChance) {
        const wasFrozen = enemy.frozenTimer > 0.1;
        const effectiveDuration = spec.isBoss
          ? effects.freezeDuration * 0.65
          : effects.freezeDuration;
        enemy.frozenTimer = Math.max(enemy.frozenTimer, effectiveDuration);
        enemy.freezeImmunityTimer = effectiveDuration + 1.4;
        triggeredFrozen = true;
        if (!wasFrozen) {
          soundEngine.playFreezePulse();
          this.floatingTextSystem.spawnStatusCallout(enemy.position, 'frozen', spec.isBoss);
          this.particleSystem.emitPreset(
            'frost_nova',
            enemy.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
            '#22d3ee',
            0.55
          );
        }
      }
    }

    // 2. QUEMADO (Burned): Orbiting 3D flame tongues + fire DoT ticks + overhead 3D flame crown
    if (effects.burnDps && effects.burnDps > 0 && effects.burnDuration && effects.burnDuration > 0) {
      const wasBurning = enemy.burnTimer > 0.15;
      enemy.burnDps = Math.max(enemy.burnDps, effects.burnDps);
      enemy.burnTimer = Math.max(enemy.burnTimer, effects.burnDuration);
      if (sourceTowerKey) {
        enemy.burnSourceTowerKey = sourceTowerKey;
      }
      if (!wasBurning) {
        enemy.burnTickTimer = 0.45;
        this.floatingTextSystem.spawnStatusCallout(enemy.position, 'burned', spec.isBoss);
      }
    }

    // 3. RALENTIZADO (Slowed): Counter-rotating arcane rings + gravity anchors + overhead 3D hourglass
    if (
      effects.slowFactor &&
      effects.slowFactor > 0 &&
      effects.slowDuration &&
      effects.slowDuration > 0
    ) {
      const wasSlowed = enemy.slowTimer > 0.2;
      enemy.slowFactor = Math.max(enemy.slowFactor, effects.slowFactor);
      enemy.slowTimer = Math.max(enemy.slowTimer, effects.slowDuration);
      if (!wasSlowed && !triggeredFrozen && enemy.frozenTimer <= 0) {
        this.floatingTextSystem.spawnStatusCallout(enemy.position, 'slowed', spec.isBoss);
      }
    }
  }

  private applyDamageToEnemy(
    enemy: ActiveEnemyEntity,
    rawDamage: number,
    ignoreArmor = false,
    armorShred = 0,
    baseCritChance = 0.22,
    accentColor?: string
  ): boolean {
    if (armorShred > 0) {
      enemy.armor = Math.max(0, enemy.armor - armorShred);
    }

    // Bonus crit probability against slowed, frozen, burned, stunned, or Protocol 23-19 stasis targets
    const statusCritBonus =
      (enemy.slowTimer > 0 ? 0.12 : 0) +
      (enemy.frozenTimer > 0 ? 0.22 : 0) +
      (enemy.burnTimer > 0 ? 0.08 : 0) +
      (enemy.stunTimer > 0 ? 0.12 : 0) +
      (this.state.stasisTimer > 0 ? 0.18 : 0);
    const effectiveCritChance = Math.min(1.0, baseCritChance + statusCritBonus);
    const isCritical = Math.random() < effectiveCritChance;
    const critMultiplier = isCritical ? 1.75 : 1.0;

    // Fragilidad Criogénica: enemies slowed (+25%) or frozen (+45%) by Pilar de Escarcha take amplified damage from other towers
    const dailyCryoBonus = this.getActiveDailyEvent()?.cryoFragilityBonus ?? 0;
    const cryoVulnerabilityMult =
      enemy.frozenTimer > 0 || this.state.stasisTimer > 0
        ? 1.45 + dailyCryoBonus
        : enemy.slowTimer > 0
        ? 1.25 + dailyCryoBonus * 0.65
        : 1.0;

    const effectiveArmor = ignoreArmor ? 0 : enemy.armor;
    const dmg = Math.max(
      4,
      Math.round(rawDamage * cryoVulnerabilityMult * critMultiplier - effectiveArmor)
    );
    enemy.hp -= dmg;

    const spec = ENEMY_SPECS[enemy.kind];

    // Spawn 3D floating damage text above the enemy
    this.floatingTextSystem.spawnDamageNumber({
      position: enemy.position,
      amount: dmg,
      isCritical,
      isBoss: spec.isBoss,
      accentColor: accentColor || spec.accentColor,
    });

    if (isCritical) {
      this.particleSystem.emitPreset(
        'fusion_sparks',
        enemy.position.clone().add(new THREE.Vector3(0, 0.95, 0)),
        '#fbbf24',
        0.48
      );
    }

    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.hpBarFill.scale.x = Math.max(0.001, ratio);

    if (enemy.hp <= 0) {
      this.state.gold += spec.rewardGold;
      this.state.mana = Math.min(this.state.maxMana, this.state.mana + spec.rewardMana);
      this.state.totalKills += 1;

      if (spec.isBoss) {
        this.particleSystem.emitPreset(
          'boss_explosion',
          enemy.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
          spec.accentColor,
          1.45
        );
        this.decalSystem.spawnDecal({
          preset: 'boss_crater',
          position: enemy.position,
          radius: 2.9,
          colorHex: spec.accentColor,
          lifetime: 15.0,
          surfaceY: -0.028,
        });
        soundEngine.playMeteorImpact();
        soundEngine.playEnemyDefeat(true);
        this.triggerCameraShake(0.65);
        this.hitstopTimer = 0.065;
        this.showBanner(`¡${spec.name} ha sido derrotado en una explosión arcana!`);
        this.incrementAchievementMetric('bossesDefeated', 1, enemy.position);
      } else {
        soundEngine.playEnemyDefeat(false);
        this.particleSystem.emitPreset(
          'crystal_shatter',
          enemy.position.clone().add(new THREE.Vector3(0, 0.7, 0)),
          spec.accentColor,
          1.0
        );
      }

      this.incrementAchievementMetric('monstersEliminated', 1);
      this.entitiesGroup.remove(enemy.mesh);
      return true;
    }
    soundEngine.playEnemyHit(isCritical);
    return false;
  }

  private updateSimulation(dt: number) {
    if (this.state.phase !== 'playing' || this.menuOverlayOpen) return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    const simDt = dt * this.state.gameSpeed;
    const elapsed = this.clock.elapsedTime;

    let cooldownChanged = false;
    (Object.keys(this.state.abilityCooldowns) as PlayerAbilityId[]).forEach((id) => {
      if (this.state.abilityCooldowns[id] > 0) {
        this.state.abilityCooldowns[id] = Math.max(0, this.state.abilityCooldowns[id] - simDt);
        cooldownChanged = true;
      }
    });
    if (this.state.stasisTimer > 0) {
      this.state.stasisTimer = Math.max(0, this.state.stasisTimer - simDt);
      cooldownChanged = true;
    }

    // Automatic 3-second countdown between waves
    if (
      !this.state.waveInProgress &&
      this.state.wave < this.currentMap.totalWaves &&
      this.state.nextWaveCountdown !== null
    ) {
      this.state.nextWaveCountdown = Math.max(0, this.state.nextWaveCountdown - dt);
      cooldownChanged = true;
      if (this.state.nextWaveCountdown <= 0) {
        this.startNextWave();
      }
    }

    if (this.state.waveInProgress) {
      this.waveElapsed += simDt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].spawnTime <= this.waveElapsed) {
        const next = this.spawnQueue.shift()!;
        this.spawnEnemy(next.kind, next.spawnIndex);
      }
    }

    // Update Allied Crystal Golems with Articulated Animation
    for (let i = this.golems.length - 1; i >= 0; i--) {
      const golem = this.golems[i];
      golem.attackCooldown = Math.max(0, golem.attackCooldown - simDt);
      golem.attackAnimTimer = Math.max(0, golem.attackAnimTimer - simDt * 2.5);

      let engagedEnemy: ActiveEnemyEntity | null = null;
      let minDist = 1.9;
      for (const e of this.enemies) {
        const d = e.position.distanceTo(golem.position);
        if (d < minDist) {
          minDist = d;
          engagedEnemy = e;
        }
      }

      if (engagedEnemy) {
        _vec3A.subVectors(engagedEnemy.position, golem.position);
        const bodyGroup = golem.mesh.userData.bodyGroup as THREE.Group | undefined;
        if (bodyGroup) {
          bodyGroup.rotation.y = Math.atan2(_vec3A.x, _vec3A.z);
        }
        engagedEnemy.stunTimer = Math.max(engagedEnemy.stunTimer, 0.25);

        if (golem.attackCooldown <= 0) {
          golem.attackCooldown = 1.05;
          golem.attackAnimTimer = 1.0;
          this.particleSystem.emitPreset(
            'golem_summon',
            golem.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
            '#10b981',
            0.75
          );
          for (const e of this.enemies) {
            if (e.position.distanceTo(golem.position) <= 2.4) {
              this.applyDamageToEnemy(e, golem.damage, false, 2, 0.26, '#10b981');
            }
          }
          const isBoss = ENEMY_SPECS[engagedEnemy.kind].isBoss;
          golem.hp -= isBoss ? 110 : 32;
          golem.hpBarFill.scale.x = Math.max(0.001, golem.hp / golem.maxHp);
        }
        animateCharacterModel(golem.mesh, elapsed + golem.animOffset, false, golem.attackAnimTimer, false);
      } else if (golem.pathIndex < golem.path.length) {
        const targetCoord = golem.path[golem.pathIndex];
        const targetPos = this.gridToWorld(targetCoord.col, targetCoord.row, _vec3A);
        const dir = _vec3B.subVectors(targetPos, golem.position);
        const dist = dir.length();
        const step = 1.85 * TILE_SIZE * simDt;

        if (dist <= step) {
          golem.position.copy(targetPos);
          golem.pathIndex++;
        } else {
          dir.normalize();
          golem.position.addScaledVector(dir, step);
          const heading = Math.atan2(dir.x, dir.z);
          const bodyGroup = golem.mesh.userData.bodyGroup as THREE.Group | undefined;
          if (bodyGroup) {
            bodyGroup.rotation.y = heading;
          }

          // Stamp alternating left/right 3-toed monster paw footprints as Guardian marches
          golem.stepTrackTimer -= simDt;
          if (golem.stepTrackTimer <= 0) {
            golem.stepTrackTimer = 0.42;
            golem.stepFootSide *= -1;
            const perpX = Math.cos(heading) * 0.28 * golem.stepFootSide;
            const perpZ = -Math.sin(heading) * 0.28 * golem.stepFootSide;
            this.decalSystem.spawnDecal({
              preset: 'monster_paw_track',
              position: new THREE.Vector3(golem.position.x + perpX, 0, golem.position.z + perpZ),
              radius: 0.44,
              colorHex: '#10b981',
              lifetime: 5.5,
              rotationY: heading + Math.PI,
              surfaceY: -0.03,
            });
          }
        }
        golem.mesh.position.copy(golem.position);
        animateCharacterModel(golem.mesh, elapsed + golem.animOffset, true, golem.attackAnimTimer, false);
      } else {
        this.particleSystem.emitPreset(
          'golem_summon',
          golem.position.clone().add(new THREE.Vector3(0, 0.8, 0))
        );
        golem.hp = 0;
      }

      if (golem.hp <= 0) {
        this.entitiesGroup.remove(golem.mesh);
        this.golems.splice(i, 1);
        this.state.activeGolemsCount = this.golems.length;
      }
    }

    // Update Enemies & Bosses with Articulated Skeletal Animation & 3D Status Effects
    let activeBossInfo: GameHudState['activeBoss'] = null;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.hp <= 0) {
        this.enemies.splice(i, 1);
        continue;
      }

      const spec = ENEMY_SPECS[enemy.kind];
      enemy.attackAnimTimer = Math.max(0, enemy.attackAnimTimer - simDt * 2.2);

      if (enemy.freezeImmunityTimer > 0) {
        enemy.freezeImmunityTimer = Math.max(0, enemy.freezeImmunityTimer - simDt);
      }

      if (enemy.slowTimer > 0) {
        enemy.slowTimer = Math.max(0, enemy.slowTimer - simDt);
        if (enemy.slowTimer <= 0) enemy.slowFactor = 0;
      }

      if (enemy.frozenTimer > 0) {
        enemy.frozenTimer = Math.max(0, enemy.frozenTimer - simDt);
      }

      // QUEMADO (Burned) Damage-over-Time periodic tick
      if (enemy.burnTimer > 0) {
        enemy.burnTimer = Math.max(0, enemy.burnTimer - simDt);
        enemy.burnTickTimer -= simDt;
        if (enemy.burnTickTimer <= 0) {
          enemy.burnTickTimer = 0.5;
          const burnTickDmg = Math.max(4, Math.round(enemy.burnDps * 0.5));
          const burnTower = enemy.burnSourceTowerKey
            ? this.towers.get(enemy.burnSourceTowerKey)
            : undefined;
          if (burnTower) {
            burnTower.totalDamage += burnTickDmg;
            this.recordTowerMasteryDamage(burnTower.kind, burnTickDmg, enemy.position);
          }
          this.particleSystem.emitPreset(
            'fusion_sparks',
            enemy.position.clone().add(new THREE.Vector3(0, 0.85, 0)),
            '#f97316',
            0.38
          );
          const killedByBurn = this.applyDamageToEnemy(
            enemy,
            burnTickDmg,
            true,
            0,
            0.08,
            '#f97316'
          );
          if (killedByBurn) {
            if (burnTower) {
              this.awardTowerKillXp(burnTower, enemy);
            }
            this.enemies.splice(i, 1);
            continue;
          }
        }
        if (enemy.burnTimer <= 0) {
          enemy.burnDps = 0;
        }
      }

      const isFrozen = enemy.frozenTimer > 0 || this.state.stasisTimer > 0;
      const isBurned = enemy.burnTimer > 0;
      const isSlowed = enemy.slowTimer > 0 && enemy.slowFactor > 0;

      // Update 3D Status Indicator Rig on Enemy Model (Ice Cage, Orbiting Flames, Deceleration Rings & Overhead 3D Icons)
      animateEnemyStatusEffects(
        enemy.mesh,
        elapsed + enemy.animOffset,
        isFrozen,
        isBurned,
        isSlowed
      );

      // Tint health bar fill to reflect priority status state (updates both front and back faces simultaneously)
      const hpMat = enemy.hpBarMaterial;
      if (isFrozen) {
        hpMat.color.setHex(0x22d3ee);
      } else if (isBurned) {
        hpMat.color.setHex(0xf97316);
      } else if (isSlowed) {
        hpMat.color.setHex(0x60a5fa);
      } else {
        hpMat.color.setHex(spec.isBoss ? 0xf59e0b : 0xef4444);
      }

      if (spec.isBoss && !activeBossInfo) {
        activeBossInfo = {
          name: spec.name,
          subtitle: enemy.kind === 'boss_archon' ? 'Señor Supremo del Vacío' : 'Coloso Acorazado de Obsidiana',
          hp: Math.max(0, Math.round(enemy.hp)),
          maxHp: enemy.maxHp,
          armor: enemy.armor,
        };
      }

      if (isFrozen || enemy.stunTimer > 0) {
        if (enemy.stunTimer > 0) {
          enemy.stunTimer = Math.max(0, enemy.stunTimer - simDt);
        }
        animateCharacterModel(
          enemy.mesh,
          elapsed + enemy.animOffset,
          false,
          enemy.attackAnimTimer,
          isFrozen
        );
        continue;
      }

      // Boss periodic seismic shockwave & overhead weapon slam
      if (spec.isBoss) {
        enemy.bossSlamTimer -= simDt;
        if (enemy.bossSlamTimer <= 0) {
          enemy.bossSlamTimer = 8.0;
          enemy.attackAnimTimer = 1.0;
          this.triggerCameraShake(0.38);
          this.particleSystem.emitPreset(
            'boss_shockwave',
            enemy.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
            spec.accentColor,
            1.2
          );
          this.decalSystem.spawnDecal({
            preset: 'boss_crater',
            position: enemy.position,
            radius: 2.5,
            colorHex: spec.accentColor,
            lifetime: 10.0,
            surfaceY: -0.028,
          });
          this.towers.forEach((t) => {
            const tPos = this.gridToWorld(t.col, t.row);
            if (tPos.distanceTo(enemy.position) <= 3.4) {
              t.stunTimer = Math.max(t.stunTimer, 1.0);
            }
          });
        }
      }

      if (enemy.kind === 'weaver' && Math.random() < simDt * 0.5) {
        enemy.attackAnimTimer = 0.8;
        for (const ally of this.enemies) {
          if (ally.position.distanceTo(enemy.position) <= 2.8) {
            ally.hp = Math.min(ally.maxHp, ally.hp + 10);
            ally.hpBarFill.scale.x = Math.max(0.001, ally.hp / ally.maxHp);
          }
        }
      }

      const speedMult = Math.max(0.2, 1 - enemy.slowFactor);
      const moveSpeed = enemy.speed * speedMult * TILE_SIZE * 0.65 * simDt;

      if (enemy.pathIndex < enemy.path.length) {
        const targetCoord = enemy.path[enemy.pathIndex];
        const targetPos = this.gridToWorld(targetCoord.col, targetCoord.row, _vec3A);
        const dir = _vec3B.subVectors(targetPos, enemy.position);
        const dist = dir.length();

        if (dist <= moveSpeed) {
          enemy.position.copy(targetPos);
          enemy.pathIndex++;
        } else {
          dir.normalize();
          enemy.position.addScaledVector(dir, moveSpeed);
          const heading = Math.atan2(dir.x, dir.z);
          const bodyGroup = enemy.mesh.userData.bodyGroup as THREE.Group | undefined;
          if (bodyGroup) {
            bodyGroup.rotation.y = heading;
          }

          // Heavy Monsters (Sulley basalt, Scare-Floor construct, & Bosses) leave dynamic paw tracks
          if (enemy.kind === 'basalt' || enemy.kind === 'construct' || spec.isBoss) {
            enemy.stepTrackTimer -= simDt;
            if (enemy.stepTrackTimer <= 0) {
              enemy.stepTrackTimer = spec.isBoss ? 0.48 : 0.55;
              enemy.stepFootSide *= -1;
              const hipSpread = spec.isBoss ? 0.38 : 0.24;
              const perpX = Math.cos(heading) * hipSpread * enemy.stepFootSide;
              const perpZ = -Math.sin(heading) * hipSpread * enemy.stepFootSide;
              this.decalSystem.spawnDecal({
                preset: 'monster_paw_track',
                position: new THREE.Vector3(enemy.position.x + perpX, 0, enemy.position.z + perpZ),
                radius: spec.isBoss ? 0.54 : 0.36,
                colorHex: spec.color,
                lifetime: 5.0,
                rotationY: heading + Math.PI,
                surfaceY: -0.03,
              });
            }
          }
        }
        enemy.mesh.position.copy(enemy.position);
        animateCharacterModel(
          enemy.mesh,
          elapsed * enemy.speed * speedMult + enemy.animOffset,
          true,
          enemy.attackAnimTimer,
          false
        );
      } else {
        // SUDDEN-DEATH CASTLE RULE: Any single mob reaching the Castle immediately ends the match!
        this.state.lives = 0;
        this.triggerCameraShake(0.75);
        soundEngine.playMeteorImpact();
        this.particleSystem.emitPreset(
          'boss_explosion',
          enemy.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
          '#ef4444',
          1.35
        );
        this.entitiesGroup.remove(enemy.mesh);
        this.enemies.splice(i, 1);

        this.state.phase = 'gameover';
        this.state.waveInProgress = false;
        this.state.musicState = 'exploration';
        soundEngine.setMusicState('exploration');
        this.showBanner(`¡${spec.name} ha penetrado en el Castillo! ¡La partida ha terminado!`);
        this.emitState();
        return;
      }
    }

    const hadBossBefore = this.state.activeBoss !== null;
    this.state.activeBoss = activeBossInfo;
    if (hadBossBefore && !activeBossInfo && this.cinematicWasAutoActivated) {
      const anyBossStillQueued = this.spawnQueue.some((q) => ENEMY_SPECS[q.kind].isBoss);
      if (!anyBossStillQueued) {
        this.state.cinematicCamera = false;
        this.cinematicWasAutoActivated = false;
        cooldownChanged = true;
      }
    }
    if (this.state.waveInProgress) {
      const targetCombatTrack: AudioTrackState = activeBossInfo ? 'boss_combat' : 'combat';
      if (this.state.musicState !== targetCombatTrack) {
        this.state.musicState = targetCombatTrack;
        soundEngine.setMusicState(targetCombatTrack);
        cooldownChanged = true;
      }
    }

    // Update Towers Combat
    const hasteMult = this.state.stasisTimer > 0 ? 1.45 : 1.0;

    this.towers.forEach((tower, towerKey) => {
      animateTowerSpecialParts(tower.mesh, elapsed, tower.col * 1.7 + tower.row * 2.3);

      const turret = tower.mesh.userData.turret as THREE.Group | undefined;
      const isMonumentalPillar = Boolean(tower.mesh.userData.isMonumentalPillar);
      const isQuartzDesign = Boolean(tower.mesh.userData.isQuartzDesign);
      if (turret) {
        const turretBaseY = (turret.userData.baseY as number) ?? 1.05;
        turret.position.y = turretBaseY + Math.sin(elapsed * 3 + tower.col) * 0.045;
        if (tower.mesh.userData.isSuper && !isMonumentalPillar) {
          turret.rotation.y += simDt * 0.8;
        }
      }

      if (tower.stunTimer > 0) {
        tower.stunTimer -= simDt;
        return;
      }

      tower.cooldown -= simDt * hasteMult;
      if (tower.cooldown > 0) return;

      const spec = ALL_TOWERS[tower.kind];
      const towerPos = this.gridToWorld(tower.col, tower.row);
      const effectiveRange = getTowerEffectiveRange(spec, tower.level) * (TILE_SIZE * 0.55);
      const activeEvent = this.getActiveDailyEvent();
      const eventDmgMult =
        activeEvent && getBaseTowerForKind(tower.kind) === 'quartz'
          ? activeEvent.quartzDamageMult
          : 1.0;
      const effectiveDamage = Math.round(getTowerEffectiveDamage(spec, tower.level) * eventDmgMult);
      const effectiveFireRate = getTowerEffectiveFireRate(spec, tower.level);
      const levelScale = 1 + (tower.level - 1) * 0.15;

      let bestTarget: ActiveEnemyEntity | null = null;
      let bestProgress = -1;

      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        const d = enemy.position.distanceTo(towerPos);
        if (d <= effectiveRange) {
          if (enemy.pathIndex > bestProgress) {
            bestProgress = enemy.pathIndex;
            bestTarget = enemy;
          }
        }
      }

      if (!bestTarget) return;

      tower.cooldown = 1 / effectiveFireRate;

      let aimYaw = 0;
      if (turret && (!tower.mesh.userData.isSuper || isMonumentalPillar)) {
        _vec3A.subVectors(bestTarget.position, towerPos);
        aimYaw = Math.atan2(_vec3A.x, _vec3A.z);
        turret.rotation.y = aimYaw;
      }

      const muzzlePos = isMonumentalPillar
        ? towerPos
            .clone()
            .add(
              new THREE.Vector3(
                Math.sin(aimYaw) * 0.52,
                1.96 * tower.mesh.scale.y,
                Math.cos(aimYaw) * 0.52
              )
            )
        : towerPos.clone().add(new THREE.Vector3(0, 1.45, 0));

      const equippedSkin = this.getTowerEquippedSkinSpec(tower.kind);
      const primaryFXColor = !equippedSkin.isDefault ? equippedSkin.primaryGlow : spec.color;
      const secondaryFXColor = !equippedSkin.isDefault
        ? equippedSkin.secondaryGlow
        : spec.secondaryColor;

      if (spec.attackType === 'beam' || spec.attackType === 'hybrid_beam') {
        soundEngine.playShoot('beam');
        const targetCenter = bestTarget.position.clone().add(new THREE.Vector3(0, 0.7, 0));
        if (isQuartzDesign) {
          // Runic Void-Spire Tower: Rapid-Fire / Piercing Crystalline Void-Shard Volley
          this.spawnLaserBeam(muzzlePos, targetCenter, secondaryFXColor);
          const perpX = Math.cos(aimYaw) * 0.24;
          const perpZ = -Math.sin(aimYaw) * 0.24;
          this.spawnLaserBeam(
            muzzlePos,
            targetCenter.clone().add(new THREE.Vector3(perpX, 0.12, perpZ)),
            primaryFXColor
          );
          this.spawnLaserBeam(
            muzzlePos,
            targetCenter.clone().add(new THREE.Vector3(-perpX, -0.1, -perpZ)),
            primaryFXColor
          );
          this.particleSystem.emitPreset('fusion_sparks', muzzlePos, primaryFXColor, 0.45);
        } else {
          this.spawnLaserBeam(muzzlePos, targetCenter, primaryFXColor);
        }
        this.applyStatusEffectsToEnemy(
          bestTarget,
          {
            slowFactor: spec.slowFactor,
            slowDuration: spec.slowDuration,
            freezeChance: spec.freezeChance,
            freezeDuration: spec.freezeDuration,
            burnDps: spec.burnDps ? Math.round(spec.burnDps * levelScale) : undefined,
            burnDuration: spec.burnDuration,
          },
          towerKey
        );
        tower.totalDamage += effectiveDamage;
        this.recordTowerMasteryDamage(tower.kind, effectiveDamage, towerPos);
        const killed = this.applyDamageToEnemy(
          bestTarget,
          effectiveDamage,
          false,
          spec.armorShred || 0,
          spec.isSuper ? 0.34 : 0.24,
          primaryFXColor
        );
        if (killed) this.awardTowerKillXp(tower, bestTarget);
      } else if (spec.attackType === 'nova') {
        soundEngine.playShoot('nova');
        // Focused cryo-beam from the Gyroscopic Cryo-Lens prism tip + radial frost nova pulse (0 Damage, Pure Slow/Freeze Control!)
        this.spawnLaserBeam(
          muzzlePos,
          bestTarget.position.clone().add(new THREE.Vector3(0, 0.7, 0)),
          secondaryFXColor
        );
        this.particleSystem.emitPreset(
          'frost_nova',
          towerPos.clone().add(new THREE.Vector3(0, 0.5, 0)),
          primaryFXColor
        );
        this.decalSystem.spawnDecal({
          preset: 'stasis_glyph',
          position: towerPos,
          radius: effectiveRange * 0.85,
          colorHex: primaryFXColor,
          lifetime: 2.6,
          spinSpeed: 0.35,
          surfaceY: 0.025,
        });
        let affectedCount = 0;
        for (const e of this.enemies) {
          if (e.hp > 0 && e.position.distanceTo(towerPos) <= effectiveRange) {
            affectedCount += 1;
            this.applyStatusEffectsToEnemy(
              e,
              {
                slowFactor: spec.slowFactor || 0.45,
                slowDuration: spec.slowDuration || 3.2,
                freezeChance: spec.freezeChance,
                freezeDuration: spec.freezeDuration,
                burnDps: spec.burnDps ? Math.round(spec.burnDps * levelScale) : undefined,
                burnDuration: spec.burnDuration,
              },
              towerKey
            );
            // Pilar de Escarcha has damage: 0 (only slows or freezes, never deals HP damage!)
            if (effectiveDamage > 0) {
              tower.totalDamage += effectiveDamage;
              this.recordTowerMasteryDamage(tower.kind, effectiveDamage, towerPos);
              if (
                this.applyDamageToEnemy(
                  e,
                  effectiveDamage,
                  false,
                  0,
                  spec.isSuper ? 0.32 : 0.2,
                  primaryFXColor
                )
              ) {
                this.awardTowerKillXp(tower, e);
              }
            }
          }
        }
        if (effectiveDamage <= 0 && affectedCount > 0) {
          // Award control XP & Cryo-Control Mastery progress for slowing/freezing enemies
          const controlScore = affectedCount * 42;
          tower.totalDamage += controlScore;
          this.awardTowerControlXp(tower, affectedCount);
          this.recordTowerMasteryDamage('frost', controlScore, towerPos);
        }
      } else {
        soundEngine.playShoot(spec.isSuper ? 'hybrid' : 'mortar');
        // Volcanic Blaze Tower: Focused flame-stream projection from the Blaze Core lens + explosive magma orb
        const targetFlamePos = bestTarget.position.clone().add(new THREE.Vector3(0, 0.65, 0));
        this.spawnLaserBeam(muzzlePos, targetFlamePos, secondaryFXColor);
        this.spawnLaserBeam(
          muzzlePos.clone().add(new THREE.Vector3(0, -0.06, 0)),
          targetFlamePos,
          primaryFXColor
        );
        this.particleSystem.emitPreset('fusion_sparks', muzzlePos, primaryFXColor, 0.45);

        const orbGeo = new THREE.DodecahedronGeometry(spec.isSuper ? 0.26 : 0.18, 0);
        const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(primaryFXColor) });
        const orbMesh = new THREE.Mesh(orbGeo, orbMat);
        orbMesh.position.copy(muzzlePos);
        this.effectsGroup.add(orbMesh);

        this.projectiles.push({
          mesh: orbMesh,
          start: muzzlePos.clone(),
          targetPos: bestTarget.position.clone(),
          targetEnemyId: bestTarget.id,
          sourceTowerKey: towerKey,
          progress: 0,
          speed: spec.isSuper ? 2.6 : 2.2,
          arcHeight: spec.isSuper ? 2.8 : 2.1,
          damage: effectiveDamage,
          splashRadius: (spec.splashRadius || 2.0) * (TILE_SIZE * 0.55),
          slowFactor: spec.slowFactor || 0,
          slowDuration: spec.slowDuration || 0,
          freezeChance: spec.freezeChance || 0,
          freezeDuration: spec.freezeDuration || 0,
          burnDps: spec.burnDps ? Math.round(spec.burnDps * levelScale) : 0,
          burnDuration: spec.burnDuration || 0,
          chainCount: spec.chainCount || 0,
          color: primaryFXColor,
          isSuper: spec.isSuper,
        });
      }
    });

    // Update Artillery Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.progress += simDt * proj.speed;

      if (proj.targetEnemyId) {
        const tracked = this.enemies.find((e) => e.id === proj.targetEnemyId);
        if (tracked) {
          proj.targetPos.copy(tracked.position);
        }
      }

      if (proj.progress >= 1) {
        this.particleSystem.emitPreset(
          proj.isSuper ? 'boss_explosion' : 'boss_shockwave',
          proj.targetPos.clone().add(new THREE.Vector3(0, 0.4, 0)),
          proj.color,
          proj.isSuper ? 0.85 : 0.7
        );
        this.decalSystem.spawnDecal({
          preset: 'meteor_scorch',
          position: proj.targetPos,
          radius: proj.splashRadius * 0.78,
          colorHex: proj.color,
          lifetime: proj.isSuper ? 9.5 : 6.5,
          surfaceY: -0.028,
        });
        const sourceTower = proj.sourceTowerKey
          ? this.towers.get(proj.sourceTowerKey)
          : undefined;
        for (const e of this.enemies) {
          if (e.hp > 0 && e.position.distanceTo(proj.targetPos) <= proj.splashRadius) {
            this.applyStatusEffectsToEnemy(
              e,
              {
                slowFactor: proj.slowFactor,
                slowDuration: proj.slowDuration,
                freezeChance: proj.freezeChance,
                freezeDuration: proj.freezeDuration,
                burnDps: proj.burnDps,
                burnDuration: proj.burnDuration,
              },
              proj.sourceTowerKey
            );
            if (sourceTower) {
              sourceTower.totalDamage += proj.damage;
              this.recordTowerMasteryDamage(sourceTower.kind, proj.damage, proj.targetPos);
            }
            const killed = this.applyDamageToEnemy(
              e,
              proj.damage,
              false,
              0,
              proj.isSuper ? 0.36 : 0.25,
              proj.color
            );
            if (killed && sourceTower) {
              this.awardTowerKillXp(sourceTower, e);
            }
          }
        }
        this.effectsGroup.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        this.projectiles.splice(i, 1);
      } else {
        proj.mesh.position.lerpVectors(proj.start, proj.targetPos, proj.progress);
        proj.mesh.position.y += Math.sin(proj.progress * Math.PI) * proj.arcHeight;
      }
    }

    // Clean up finished enemies & check Wave Completion
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    const remaining = this.spawnQueue.length + this.enemies.length;
    if (remaining !== this.state.enemiesRemaining) {
      this.state.enemiesRemaining = remaining;
      cooldownChanged = true;
    }

    if (this.state.waveInProgress && remaining === 0) {
      this.state.waveInProgress = false;
      this.state.musicState = 'exploration';
      soundEngine.setMusicState('exploration');
      const waveBonus = 55 + this.state.wave * 15;
      this.state.gold += waveBonus;
      this.state.mana = Math.min(this.state.maxMana, this.state.mana + 28);

      if (this.state.wave >= this.currentMap.totalWaves) {
        this.state.phase = 'victory';
        this.state.nextWaveCountdown = null;
        soundEngine.playSuperFusion();
      } else {
        this.state.nextWaveCountdown = AUTO_WAVE_DELAY_SECONDS;
        this.showBanner(
          `¡Oleada ${this.state.wave} completada! +${waveBonus} Oro — Oleada ${this.state.wave + 1} en ${AUTO_WAVE_DELAY_SECONDS}s`
        );
      }
      cooldownChanged = true;
    }

    if (cooldownChanged) {
      this.emitState();
    }
  }

  private spawnLaserBeam(from: THREE.Vector3, to: THREE.Vector3, colorHex: string) {
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.25, 0));
    const geo = new THREE.BufferGeometry().setFromPoints([from, mid, to]);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.95,
    });
    const line = new THREE.Line(geo, mat);
    this.effectsGroup.add(line);
    this.beams.push({ line, ttl: 0.14, maxTtl: 0.14 });
  }

  private updateVisualEffects(dt: number) {
    const elapsed = this.clock.elapsedTime;

    if (this.riverWaterMesh) {
      const mat = this.riverWaterMesh.material as THREE.MeshPhysicalMaterial;
      if (mat && mat.map) {
        mat.map.offset.y -= dt * 0.08;
      }
      if (mat && mat.bumpMap) {
        mat.bumpMap.offset.y -= dt * 0.12;
      }
    }
    for (const portal of this.portalsAndCore) {
      const crystal = portal.userData.coreCrystal as THREE.Mesh | undefined;
      const ring = portal.userData.ring as THREE.Mesh | undefined;
      if (crystal) {
        crystal.rotation.y = elapsed * 1.4;
        const baseY = typeof crystal.userData.baseY === 'number' ? crystal.userData.baseY : 1.05;
        crystal.position.y = baseY + Math.sin(elapsed * 2.5) * 0.1;
      }
      if (ring) {
        ring.rotation.z = elapsed * 0.8;
      }
      const voidSingularity = portal.userData.voidSingularity as THREE.Mesh | undefined;
      if (voidSingularity) {
        voidSingularity.rotation.z = -elapsed * 1.65;
      }
      const innerSwirlDisc = portal.userData.innerSwirlDisc as THREE.Mesh | undefined;
      if (innerSwirlDisc) {
        innerSwirlDisc.rotation.z = -elapsed * 2.6;
        const pulse = 1 + Math.sin(elapsed * 3.4) * 0.06;
        innerSwirlDisc.scale.set(pulse, pulse, 1);
      }
      const gatePortalDisc = portal.userData.gatePortalDisc as THREE.Mesh | undefined;
      if (gatePortalDisc) {
        gatePortalDisc.rotation.z = -elapsed * 2.2;
      }
      const shieldDome = portal.userData.shieldDome as THREE.Mesh | undefined;
      if (shieldDome) {
        shieldDome.rotation.y = elapsed * 0.28;
      }
    }

    if (this.state.phase === 'title') {
      const angle = elapsed * 0.18;
      this.camera.position.x = Math.sin(angle) * 24;
      this.camera.position.z = Math.cos(angle) * 24;
      this.camera.position.y = 18 + Math.sin(elapsed * 0.4) * 2;
      this.camera.lookAt(0, 0.5, 0);
    } else if (this.state.cinematicCamera && this.state.phase === 'playing') {
      // Epic Boss Cinematic Camera: orbits slowly around the battlefield & subtly tracks active boss
      const bossEntity = this.enemies.find((e) => e.hp > 0 && ENEMY_SPECS[e.kind].isBoss);
      if (bossEntity) {
        _vec3A.set(bossEntity.position.x * 0.36, 0.45, bossEntity.position.z * 0.36);
      } else {
        _vec3A.set(0, 0.25, 0);
      }
      this.cinematicFocusPos.lerp(_vec3A, 1 - Math.exp(-3.2 * dt));

      const shakeX =
        this.shakeIntensity > 0.001 ? (Math.random() - 0.5) * this.shakeIntensity : 0;
      const shakeZ =
        this.shakeIntensity > 0.001 ? (Math.random() - 0.5) * this.shakeIntensity : 0;
      if (this.shakeIntensity > 0.001) {
        this.shakeIntensity *= Math.exp(-8 * dt);
      }

      this.controls.target.set(
        this.cinematicFocusPos.x + shakeX,
        this.cinematicFocusPos.y,
        this.cinematicFocusPos.z + shakeZ
      );

      if (this.isPointerDownOnCanvas) {
        this.syncCinematicAngleFromCamera();
      } else {
        this.cinematicAngle += dt * 0.24;
        const epicRadius = 21.5 + Math.cos(elapsed * 0.38) * 2.2;
        const epicHeight = 15.2 + Math.sin(elapsed * 0.45) * 2.3;
        const desiredX =
          this.cinematicFocusPos.x + Math.sin(this.cinematicAngle) * epicRadius;
        const desiredZ =
          this.cinematicFocusPos.z + Math.cos(this.cinematicAngle) * epicRadius;
        const smoothFactor = 1 - Math.exp(-4.5 * dt);
        this.camera.position.x += (desiredX - this.camera.position.x) * smoothFactor;
        this.camera.position.y += (epicHeight - this.camera.position.y) * smoothFactor;
        this.camera.position.z += (desiredZ - this.camera.position.z) * smoothFactor;
      }

      this.controls.update();
      this.updateHoverCell();
    } else {
      this.cinematicFocusPos.lerp(_vec3A.set(0, 0, 0), 1 - Math.exp(-6 * dt));
      if (this.shakeIntensity > 0.001) {
        this.controls.target.set(
          (Math.random() - 0.5) * this.shakeIntensity,
          0,
          (Math.random() - 0.5) * this.shakeIntensity
        );
        this.shakeIntensity *= Math.exp(-8 * dt);
      } else {
        this.controls.target.lerp(_vec3A.set(0, 0, 0), 1 - Math.exp(-8 * dt));
      }
      if (!this.isSoftwareGl) {
        this.controls.update();
      }
    }

    // Billboard overhead 3D XP progress bars above each tower toward the camera
    this.towers.forEach((tower) => {
      const xpBarGroup = tower.mesh.userData.xpBarGroup as THREE.Group | undefined;
      if (xpBarGroup) {
        xpBarGroup.quaternion.copy(this.camera.quaternion);
      }
    });

    // Billboard mob and golem health bars toward the camera every frame so they are visible from all 360° angles
    for (const enemy of this.enemies) {
      enemy.hpBarGroup.quaternion.copy(this.camera.quaternion);
    }
    for (const golem of this.golems) {
      golem.hpBarGroup.quaternion.copy(this.camera.quaternion);
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.ttl -= dt;
      if (b.ttl <= 0) {
        this.effectsGroup.remove(b.line);
        b.line.geometry.dispose();
        this.beams.splice(i, 1);
      } else {
        (b.line.material as THREE.LineBasicMaterial).opacity = b.ttl / b.maxTtl;
      }
    }

    this.particleSystem.update(dt);
    this.decalSystem.update(dt, elapsed);
    this.weatherSystem.update(dt, elapsed, this.scene, this.keyLight, this.hemiLight);
    this.floatingTextSystem.update(dt);

    if (this.state.autoWeather && this.state.phase === 'playing') {
      this.autoWeatherTimer -= dt;
      if (this.autoWeatherTimer <= 0) {
        this.autoWeatherTimer = 28.0;
        const idx = WEATHER_ORDER.indexOf(this.state.weather);
        const nextWeather = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
        this.setWeather(nextWeather, false);
      }
    }
  }

  private triggerCameraShake(amount: number) {
    this.shakeIntensity = Math.min(0.85, this.shakeIntensity + amount);
  }

  private showBanner(msg: string) {
    this.state.statusBanner = msg;
    this.emitState();
    window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      if (this.state.statusBanner === msg) {
        this.state.statusBanner = null;
        this.emitState();
      }
    }, 3200);
  }

  private createEntityHealthBar(
    barWidth: number,
    barY: number,
    fillColorHex: number
  ): {
    hpBarGroup: THREE.Group;
    hpBarFill: THREE.Group;
    hpBarMaterial: THREE.MeshBasicMaterial;
  } {
    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, barY, 0);

    // 3D dark slate backing plate visible from all angles
    const hpBg = new THREE.Mesh(
      new THREE.BoxGeometry(barWidth, 0.13, 0.016),
      new THREE.MeshBasicMaterial({ color: 0x090d16 })
    );
    hpBarGroup.add(hpBg);

    const hpBarMaterial = new THREE.MeshBasicMaterial({
      color: fillColorHex,
      side: THREE.DoubleSide,
    });

    const fillWidth = barWidth - 0.04;
    const hpBarFill = new THREE.Group();
    const fillGeo = new THREE.PlaneGeometry(fillWidth, 0.088);

    // Dual front (+Z) and back (-Z) fill planes so neither side is ever occluded by hpBg
    const fillFront = new THREE.Mesh(fillGeo, hpBarMaterial);
    fillFront.position.set(0, 0, 0.014);
    const fillBack = new THREE.Mesh(fillGeo, hpBarMaterial);
    fillBack.position.set(0, 0, -0.014);
    hpBarFill.add(fillFront, fillBack);

    hpBarGroup.add(hpBarFill);
    hpBarGroup.quaternion.copy(this.camera.quaternion);

    return { hpBarGroup, hpBarFill, hpBarMaterial };
  }

  public getActiveDailyEvent(): DailyVoidEventSpec | null {
    if (!this.state.activeDailyEventId) return null;
    return DAILY_VOID_EVENTS.find((ev) => ev.id === this.state.activeDailyEventId) || null;
  }

  public setDailyEvent(eventId: DailyVoidEventId | null) {
    soundEngine.playClick();
    this.state.activeDailyEventId = eventId;
    if (eventId) {
      const ev = DAILY_VOID_EVENTS.find((item) => item.id === eventId);
      if (ev && this.state.phase === 'title') {
        this.loadMap(ev.featuredMapId, true);
        return;
      }
    }
    this.emitState();
  }

  public launchDailyEvent(eventId: DailyVoidEventId) {
    soundEngine.playBuild();
    this.state.activeDailyEventId = eventId;
    const ev = DAILY_VOID_EVENTS.find((item) => item.id === eventId) || DAILY_VOID_EVENTS[0];
    this.camera.position.set(0, 22, 21);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.loadMap(ev.featuredMapId, false);
  }

  public startGame(mapId: string) {
    soundEngine.playBuild();
    this.camera.position.set(0, 22, 21);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.loadMap(mapId, false);
  }

  public previewMapInTitle(mapId: string) {
    soundEngine.playClick();
    this.loadMap(mapId, true);
  }

  public setWeather(weather: WeatherType, manual = true) {
    if (manual) {
      soundEngine.playClick();
    }
    this.state.weather = weather;
    this.weatherSystem.setWeather(weather, this.currentMap, false);
    this.autoWeatherTimer = 28.0;
    const spec = WEATHER_SPECS[weather];
    if (this.state.phase !== 'title') {
      this.showBanner(`Clima Dinámico: ${spec.label} (${spec.subtitle})`);
    } else {
      this.emitState();
    }
  }

  public cycleWeather() {
    const idx = WEATHER_ORDER.indexOf(this.state.weather);
    const next = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    this.setWeather(next, true);
  }

  public toggleAutoWeather() {
    soundEngine.playClick();
    this.state.autoWeather = !this.state.autoWeather;
    this.autoWeatherTimer = 24.0;
    this.showBanner(
      this.state.autoWeather
        ? 'Ciclo de Clima Dinámico Automático: ACTIVADO'
        : 'Ciclo de Clima Dinámico Automático: MANUAL'
    );
  }

  public setDifficulty(difficulty: DifficultyLevel) {
    if (this.state.difficulty === difficulty) return;
    soundEngine.playClick();
    this.state.difficulty = difficulty;
    const diffSpec = DIFFICULTY_SPECS[difficulty];

    // Update starting gold if match hasn't started waves or built towers yet
    if (this.state.wave === 0 && this.towers.size === 0) {
      this.state.gold = Math.max(60, this.currentMap.startingGold + diffSpec.startingGoldOffset);
    }

    // Refresh selected tower fusion candidate costs if a tower is currently selected
    if (this.state.selectedPlacedTower) {
      const selKey = coordKey(this.state.selectedPlacedTower.col, this.state.selectedPlacedTower.row);
      const activeTower = this.towers.get(selKey) || null;
      this.selectPlacedTower(activeTower);
    }

    if (this.state.phase !== 'title') {
      this.showBanner(
        `Dificultad: ${diffSpec.label} (Salud Enemiga ${Math.round(
          diffSpec.enemyHpMultiplier * 100
        )}% · Costo Torres ${Math.round(diffSpec.towerCostMultiplier * 100)}%)`
      );
    } else {
      this.emitState();
    }
  }

  public selectBuildTower(type: BaseTowerType) {
    soundEngine.playClick();
    this.state.selectedBuildTower = type;
    this.state.activeAbilityTargeting = null;
    this.selectPlacedTower(null);
  }

  public clearSelection() {
    soundEngine.playClick();
    this.selectPlacedTower(null);
  }

  public toggleGameSpeed() {
    soundEngine.playClick();
    this.state.gameSpeed = this.state.gameSpeed === 1 ? 2 : 1;
    this.emitState();
  }

  public togglePause() {
    soundEngine.playClick();
    if (this.state.phase === 'playing') {
      this.state.phase = 'paused';
    } else if (this.state.phase === 'paused') {
      this.state.phase = 'playing';
    }
    this.emitState();
  }

  /**
   * Synchronizes modal overlay open state from the UI so that opening any menu
   * (Opciones, Códice, Crónicas, Maestría, Logros, VFX) genuinely freezes the simulation.
   */
  public setMenuOverlayOpen(isOpen: boolean) {
    this.menuOverlayOpen = isOpen;
  }

  public testAudioEngine() {
    soundEngine.playTestSound();
    const settings = soundEngine.getAudioSettings();
    this.state.isMuted = settings.muted;
    this.emitState();
  }

  public returnToTitle() {
    soundEngine.playClick();
    this.loadMap(this.state.mapId, true);
  }

  public toggleMute() {
    const next = !this.state.isMuted;
    soundEngine.setMuted(next);
    this.state.isMuted = next;
    if (!next) soundEngine.playClick();
    this.emitState();
  }

  public setMasterVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    soundEngine.setMasterVolume(clamped);
    const settings = soundEngine.getAudioSettings();
    this.state.masterVolume = settings.masterVolume;
    this.state.isMuted = settings.muted;
    this.emitState();
  }

  public setMusicVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    soundEngine.setMusicVolume(clamped);
    this.state.musicVolume = soundEngine.getAudioSettings().musicVolume;
    this.emitState();
  }

  public setSfxVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    soundEngine.setSfxVolume(clamped);
    this.state.sfxVolume = soundEngine.getAudioSettings().sfxVolume;
    soundEngine.playClick();
    this.emitState();
  }

  public setDynamicMusicState(trackState: AudioTrackState) {
    soundEngine.startBackgroundMusic();
    soundEngine.setMusicState(trackState, 0.8);
    this.state.musicState = trackState;
    this.emitState();
  }

  public toggleDockCollapsed() {
    soundEngine.playClick();
    this.state.dockCollapsed = !this.state.dockCollapsed;
    this.emitState();
  }

  private syncCinematicAngleFromCamera() {
    const dx = this.camera.position.x - this.controls.target.x;
    const dz = this.camera.position.z - this.controls.target.z;
    this.cinematicAngle = Math.atan2(dx, dz);
  }

  public toggleCinematicCamera() {
    soundEngine.playClick();
    const nextState = !this.state.cinematicCamera;
    if (nextState) {
      this.syncCinematicAngleFromCamera();
    }
    this.state.cinematicCamera = nextState;
    this.cinematicWasAutoActivated = false;
    this.showBanner(
      nextState
        ? 'Cámara Cinemática activada: rotación orbital épica alrededor del campo de batalla (Tecla C)'
        : 'Cámara Cinemática desactivada: control táctico manual restaurado'
    );
    this.emitState();
  }

  public toggleAutoCinematicCamera() {
    soundEngine.playClick();
    this.state.autoCinematicCamera = !this.state.autoCinematicCamera;
    this.showBanner(
      this.state.autoCinematicCamera
        ? 'Cámara Cinemática Automática en Jefes: ACTIVADA'
        : 'Cámara Cinemática Automática en Jefes: DESACTIVADA'
    );
    this.emitState();
  }

  public resetCameraView() {
    soundEngine.playClick();
    this.state.cinematicCamera = false;
    this.cinematicWasAutoActivated = false;
    this.cinematicFocusPos.set(0, 0, 0);
    this.camera.position.set(0, 22, 21);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.emitState();
  }

  private loadPersistedAchievements(): {
    metrics: AchievementMetrics;
    unlocked: AchievementId[];
  } {
    const defaultMetrics: AchievementMetrics = {
      golemsSummoned: 0,
      superTowersCreated: 0,
      bossesDefeated: 0,
      monstersEliminated: 0,
      abilitiesCast: 0,
    };
    try {
      const raw = localStorage.getItem('aegis_arcana_achievements_v1');
      if (!raw) return { metrics: defaultMetrics, unlocked: [] };
      const parsed = JSON.parse(raw);
      return {
        metrics: { ...defaultMetrics, ...(parsed.metrics || {}) },
        unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      };
    } catch {
      return { metrics: defaultMetrics, unlocked: [] };
    }
  }

  private savePersistedAchievements() {
    try {
      localStorage.setItem(
        'aegis_arcana_achievements_v1',
        JSON.stringify({
          metrics: this.state.achievementMetrics,
          unlocked: this.state.unlockedAchievements,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  private incrementAchievementMetric(
    metric: AchievementMetricKey,
    amount = 1,
    worldBurstPos?: THREE.Vector3
  ) {
    if (amount <= 0 || !(metric in this.state.achievementMetrics)) return;

    this.state.achievementMetrics = {
      ...this.state.achievementMetrics,
      [metric]: (this.state.achievementMetrics[metric] || 0) + amount,
    };

    const currentVal = this.state.achievementMetrics[metric];
    let unlockedAny = false;

    for (const ach of ACHIEVEMENTS) {
      if (
        ach.metric === metric &&
        currentVal >= ach.target &&
        !this.state.unlockedAchievements.includes(ach.id)
      ) {
        this.state.unlockedAchievements = [...this.state.unlockedAchievements, ach.id];
        this.state.gold += ach.rewardGold;
        unlockedAny = true;

        const notification: UnlockedAchievementNotification = {
          id: ach.id,
          title: ach.title,
          categoryLabel: ach.categoryLabel,
          description: ach.description,
          rewardGold: ach.rewardGold,
          accentColor: ach.accentColor,
          unlockedAt: Date.now(),
        };
        this.enqueueAchievementToast(notification);

        if (worldBurstPos) {
          this.particleSystem.emitPreset(
            'fusion_sparks',
            worldBurstPos.clone().add(new THREE.Vector3(0, 1.4, 0)),
            ach.accentColor,
            1.25
          );
        }
      }
    }

    this.savePersistedAchievements();
    if (unlockedAny) {
      soundEngine.playAchievementUnlock();
    }
    this.emitState();
  }

  private enqueueAchievementToast(notification: UnlockedAchievementNotification) {
    if (!this.state.activeAchievementToast) {
      this.showAchievementToastNow(notification);
    } else {
      this.achievementToastQueue.push(notification);
    }
  }

  private showAchievementToastNow(notification: UnlockedAchievementNotification) {
    this.state.activeAchievementToast = notification;
    this.emitState();
    window.clearTimeout(this.achievementToastTimeout);
    this.achievementToastTimeout = window.setTimeout(() => {
      this.advanceAchievementToastQueue();
    }, 4800);
  }

  private advanceAchievementToastQueue() {
    window.clearTimeout(this.achievementToastTimeout);
    if (this.achievementToastQueue.length > 0) {
      const next = this.achievementToastQueue.shift()!;
      this.showAchievementToastNow(next);
    } else {
      this.state.activeAchievementToast = null;
      this.emitState();
    }
  }

  public dismissAchievementToast() {
    soundEngine.playClick();
    this.advanceAchievementToastQueue();
  }

  public triggerDemoAchievementToast() {
    const sample =
      ACHIEVEMENTS.find((a) => !this.state.unlockedAchievements.includes(a.id)) ||
      ACHIEVEMENTS[0];
    soundEngine.playAchievementUnlock();
    this.showAchievementToastNow({
      id: sample.id,
      title: sample.title,
      categoryLabel: sample.categoryLabel,
      description: sample.description,
      rewardGold: sample.rewardGold,
      accentColor: sample.accentColor,
      unlockedAt: Date.now(),
    });
  }

  public resetAchievements() {
    soundEngine.playClick();
    this.state.achievementMetrics = {
      golemsSummoned: 0,
      superTowersCreated: 0,
      bossesDefeated: 0,
      monstersEliminated: 0,
      abilitiesCast: 0,
    };
    this.state.unlockedAchievements = [];
    this.achievementToastQueue = [];
    this.state.activeAchievementToast = null;
    this.savePersistedAchievements();
    this.emitState();
  }

  private loadPersistedTowerMastery(): TowerMasteryState {
    const defaultMastery: TowerMasteryState = {
      damageAccumulated: {
        quartz: 0,
        frost: 0,
        magma: 0,
      },
      unlockedSkins: ['quartz_default', 'frost_default', 'magma_default'],
      equippedSkins: {
        quartz: 'quartz_default',
        frost: 'frost_default',
        magma: 'magma_default',
      },
    };
    try {
      const raw = localStorage.getItem('aegis_arcana_tower_mastery_v1');
      if (!raw) return defaultMastery;
      const parsed = JSON.parse(raw);
      return {
        damageAccumulated: {
          ...defaultMastery.damageAccumulated,
          ...(parsed.damageAccumulated || {}),
        },
        unlockedSkins: Array.isArray(parsed.unlockedSkins)
          ? Array.from(new Set([...defaultMastery.unlockedSkins, ...parsed.unlockedSkins]))
          : defaultMastery.unlockedSkins,
        equippedSkins: {
          ...defaultMastery.equippedSkins,
          ...(parsed.equippedSkins || {}),
        },
      };
    } catch {
      return defaultMastery;
    }
  }

  private savePersistedTowerMastery() {
    try {
      localStorage.setItem(
        'aegis_arcana_tower_mastery_v1',
        JSON.stringify(this.state.towerMastery)
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  private getTowerEquippedSkinSpec(kind: TowerKind): TowerCosmeticSkinSpec {
    const baseType = getBaseTowerForKind(kind);
    const skinId = this.state.towerMastery.equippedSkins[baseType] || (`${baseType}_default` as TowerSkinId);
    return getSkinSpecById(skinId);
  }

  private refreshPlacedTowersForBaseType(baseType: BaseTowerType) {
    this.towers.forEach((tower) => {
      if (getBaseTowerForKind(tower.kind) === baseType) {
        const worldPos = this.gridToWorld(tower.col, tower.row);
        this.entitiesGroup.remove(tower.mesh);
        const newMesh = buildTowerModel(
          tower.kind,
          tower.level,
          this.isSoftwareGl,
          this.getTowerEquippedSkinSpec(tower.kind)
        );
        newMesh.position.copy(worldPos);
        this.entitiesGroup.add(newMesh);
        tower.mesh = newMesh;
        this.syncTowerXpBarVisual(tower);
        this.particleSystem.emitPreset(
          'fusion_sparks',
          worldPos.clone().add(new THREE.Vector3(0, 1.25, 0)),
          this.getTowerEquippedSkinSpec(tower.kind).primaryGlow,
          0.95
        );
      }
    });
  }

  public recordTowerMasteryDamage(
    kind: TowerKind,
    amount: number,
    worldBurstPos?: THREE.Vector3
  ) {
    if (amount <= 0) return;
    const baseType = getBaseTowerForKind(kind);
    const masteryMult = this.getActiveDailyEvent()?.masteryXpMult ?? 1;
    const prevDmg = this.state.towerMastery.damageAccumulated[baseType] || 0;
    const nextDmg = Math.round(prevDmg + amount * masteryMult);

    const nextUnlocked = [...this.state.towerMastery.unlockedSkins];
    const nextEquipped = { ...this.state.towerMastery.equippedSkins };
    let newlyUnlockedSkin: TowerCosmeticSkinSpec | null = null;

    for (const skin of TOWER_MASTERY_SKINS[baseType]) {
      if (nextDmg >= skin.requiredDamage && !nextUnlocked.includes(skin.id)) {
        nextUnlocked.push(skin.id);
        nextEquipped[baseType] = skin.id;
        newlyUnlockedSkin = skin;
      }
    }

    this.state.towerMastery = {
      damageAccumulated: {
        ...this.state.towerMastery.damageAccumulated,
        [baseType]: nextDmg,
      },
      unlockedSkins: nextUnlocked,
      equippedSkins: nextEquipped,
    };

    if (newlyUnlockedSkin) {
      this.savePersistedTowerMastery();
      this.refreshPlacedTowersForBaseType(baseType);
      soundEngine.playAchievementUnlock();
      const baseName = BASE_TOWERS[baseType].name;
      this.showBanner(
        `¡Reto de Maestría Completado (${baseName})! Skin 3D Desbloqueada y Equipada: «${newlyUnlockedSkin.name}»`
      );
      this.enqueueAchievementToast({
        id: 'super_alchemist',
        title: `Skin Desbloqueada: ${newlyUnlockedSkin.name}`,
        categoryLabel: `Maestría · ${baseName}`,
        description: `${newlyUnlockedSkin.challengeTitle} completado. El nuevo aspecto 3D se ha aplicado a tus torres.`,
        rewardGold: 50,
        accentColor: newlyUnlockedSkin.badgeColor,
        unlockedAt: Date.now(),
      });
      this.state.gold += 50;
      if (worldBurstPos) {
        this.particleSystem.emitPreset(
          'fusion_sparks',
          worldBurstPos.clone().add(new THREE.Vector3(0, 1.5, 0)),
          newlyUnlockedSkin.primaryGlow,
          1.3
        );
      }
      this.emitState();
    } else if (Math.floor(nextDmg / 150) > Math.floor(prevDmg / 150)) {
      this.savePersistedTowerMastery();
      this.emitState();
    }
  }

  public equipTowerSkin(towerType: BaseTowerType, skinId: TowerSkinId) {
    if (!this.state.towerMastery.unlockedSkins.includes(skinId)) return;
    soundEngine.playSkinEquip();
    this.state.towerMastery = {
      ...this.state.towerMastery,
      equippedSkins: {
        ...this.state.towerMastery.equippedSkins,
        [towerType]: skinId,
      },
    };
    this.savePersistedTowerMastery();
    this.refreshPlacedTowersForBaseType(towerType);
    const skin = getSkinSpecById(skinId);
    this.showBanner(
      `Skin Cosmética 3D Equipada en ${BASE_TOWERS[towerType].name}: «${skin.name}»`
    );
    this.emitState();
  }

  public boostTowerMasteryDemo(towerType: BaseTowerType, amount = 2500) {
    soundEngine.playClick();
    this.recordTowerMasteryDamage(towerType, amount, new THREE.Vector3(0, 0.8, 0));
    this.savePersistedTowerMastery();
    this.emitState();
  }

  public resetTowerMastery() {
    soundEngine.playClick();
    this.state.towerMastery = {
      damageAccumulated: { quartz: 0, frost: 0, magma: 0 },
      unlockedSkins: ['quartz_default', 'frost_default', 'magma_default'],
      equippedSkins: {
        quartz: 'quartz_default',
        frost: 'frost_default',
        magma: 'magma_default',
      },
    };
    this.savePersistedTowerMastery();
    (['quartz', 'frost', 'magma'] as BaseTowerType[]).forEach((t) =>
      this.refreshPlacedTowersForBaseType(t)
    );
    this.emitState();
  }

  private emitState() {
    this.onStateChange({ ...this.state });
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);

      this.updateSimulation(dt);
      this.updateVisualEffects(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.clearTimeout(this.bannerTimeout);
    window.clearTimeout(this.achievementToastTimeout);
    this.particleSystem.dispose();
    this.decalSystem.dispose();
    this.weatherSystem.dispose();
    this.floatingTextSystem.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
