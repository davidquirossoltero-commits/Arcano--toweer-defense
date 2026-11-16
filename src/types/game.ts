export type BaseTowerType = 'quartz' | 'frost' | 'magma';

export type SuperTowerType =
  | 'prism_glacial'      // quartz + frost
  | 'plasma_colossus'    // quartz + magma
  | 'cryo_volcano';      // frost + magma

export type TowerKind = BaseTowerType | SuperTowerType;

export type EnemyStatusEffectType = 'frozen' | 'burned' | 'slowed';

export type TowerSkinId =
  | 'quartz_default'
  | 'quartz_crimson_eclipse'
  | 'quartz_astral_platinum'
  | 'quartz_celestial_gold'
  | 'frost_default'
  | 'frost_abyssal_glacier'
  | 'frost_emerald_permafrost'
  | 'frost_celestial_zero'
  | 'magma_default'
  | 'magma_fel_inferno'
  | 'magma_void_volcano'
  | 'magma_supernova_gold';

export interface TowerCosmeticSkinSpec {
  id: TowerSkinId;
  towerType: BaseTowerType;
  tier: 0 | 1 | 2 | 3;
  name: string;
  challengeTitle: string;
  requiredDamage: number;
  isDefault?: boolean;
  stoneTint: string;
  metalTint: string;
  primaryGlow: string;
  secondaryGlow: string;
  badgeColor: string;
  description: string;
}

export const TOWER_MASTERY_SKINS: Record<BaseTowerType, TowerCosmeticSkinSpec[]> = {
  quartz: [
    {
      id: 'quartz_default',
      towerType: 'quartz',
      tier: 0,
      name: 'Aguja del Vacío Rúnico',
      challengeTitle: 'Diseño Base Original',
      requiredDamage: 0,
      isDefault: true,
      stoneTint: '#262338',
      metalTint: '#d97706',
      primaryGlow: '#c084fc',
      secondaryGlow: '#f3e8ff',
      badgeColor: '#c084fc',
      description: 'Obsidiana oscura con conductos de cobre-oro y cristales perforantes violeta del vacío.',
    },
    {
      id: 'quartz_crimson_eclipse',
      towerType: 'quartz',
      tier: 1,
      name: 'Eclipse Carmesí Sangriento',
      challengeTitle: 'Reto I: Acumula 1.500 de Daño con Cuarzo',
      requiredDamage: 1500,
      stoneTint: '#2a1218',
      metalTint: '#991b1b',
      primaryGlow: '#f43f5e',
      secondaryGlow: '#fecdd3',
      badgeColor: '#f43f5e',
      description: 'Basalto carmesí con runas de rubí sangriento, anillo rúnico escarlata y ráfagas láser rubí.',
    },
    {
      id: 'quartz_astral_platinum',
      towerType: 'quartz',
      tier: 2,
      name: 'Obelisco Astral de Platino',
      challengeTitle: 'Reto II: Acumula 4.500 de Daño con Cuarzo',
      requiredDamage: 4500,
      stoneTint: '#1e293b',
      metalTint: '#e2e8f0',
      primaryGlow: '#38bdf8',
      secondaryGlow: '#e0f2fe',
      badgeColor: '#38bdf8',
      description: 'Mármol estelar y bobinas de platino bruñido con singularidad azul cian y cristales estelares.',
    },
    {
      id: 'quartz_celestial_gold',
      towerType: 'quartz',
      tier: 3,
      name: 'Soberano Solar Dorado',
      challengeTitle: 'Reto III: Acumula 10.000 de Daño con Cuarzo',
      requiredDamage: 10000,
      stoneTint: '#422006',
      metalTint: '#facc15',
      primaryGlow: '#fbbf24',
      secondaryGlow: '#fef9c3',
      badgeColor: '#fbbf24',
      description: 'Aspecto supremo de oro imperial forjado, corona celestial flotante y lanzas de luz divina.',
    },
  ],
  frost: [
    {
      id: 'frost_default',
      towerType: 'frost',
      tier: 0,
      name: 'Pilar Criogénico Ancestral',
      challengeTitle: 'Diseño Base Original',
      requiredDamage: 0,
      isDefault: true,
      stoneTint: '#475569',
      metalTint: '#64748b',
      primaryGlow: '#22d3ee',
      secondaryGlow: '#e0f2fe',
      badgeColor: '#22d3ee',
      description: 'Piedra rúnica invernal con corazón de hielo glaciar y lente criogénico cian.',
    },
    {
      id: 'frost_abyssal_glacier',
      towerType: 'frost',
      tier: 1,
      name: 'Glaciar Abisal de Aurora',
      challengeTitle: 'Reto I: 1.500 Pts de Control Criogénico / Fusión',
      requiredDamage: 1500,
      stoneTint: '#1e1b4b',
      metalTint: '#6366f1',
      primaryGlow: '#a855f7',
      secondaryGlow: '#f3e8ff',
      badgeColor: '#a855f7',
      description: 'Hielo abisal bioluminiscente en tonos índigo y violeta boreal con cristales amatista.',
    },
    {
      id: 'frost_emerald_permafrost',
      towerType: 'frost',
      tier: 2,
      name: 'Permafrost de Jade Eterno',
      challengeTitle: 'Reto II: 4.500 Pts de Control Criogénico / Fusión',
      requiredDamage: 4500,
      stoneTint: '#064e3b',
      metalTint: '#10b981',
      primaryGlow: '#34d399',
      secondaryGlow: '#d1fae5',
      badgeColor: '#34d399',
      description: 'Santuario tallado en jade helado y bronce esmeralda con ventisca bioluminiscente.',
    },
    {
      id: 'frost_celestial_zero',
      towerType: 'frost',
      tier: 3,
      name: 'Cero Absoluto Celestial',
      challengeTitle: 'Reto III: 10.000 Pts de Control Criogénico / Fusión',
      requiredDamage: 10000,
      stoneTint: '#0f172a',
      metalTint: '#d97706',
      primaryGlow: '#0284c7',
      secondaryGlow: '#38bdf8',
      badgeColor: '#38bdf8',
      description: 'Marfil astral y filigrana de oro blanco con diamante prismático y halo solar helado.',
    },
  ],
  magma: [
    {
      id: 'magma_default',
      towerType: 'magma',
      tier: 0,
      name: 'Bastión de Llamas Volcánicas',
      challengeTitle: 'Diseño Base Original',
      requiredDamage: 0,
      isDefault: true,
      stoneTint: '#1c1917',
      metalTint: '#44403c',
      primaryGlow: '#f97316',
      secondaryGlow: '#fde047',
      badgeColor: '#f97316',
      description: 'Roca volcánica y obsidiana con vórtice de fuego solar y cañón ígneo Blaze Core.',
    },
    {
      id: 'magma_fel_inferno',
      towerType: 'magma',
      tier: 1,
      name: 'Infierno Alquímico Esmeralda',
      challengeTitle: 'Reto I: Acumula 1.500 de Daño con Magma',
      requiredDamage: 1500,
      stoneTint: '#14261c',
      metalTint: '#047857',
      primaryGlow: '#10b981',
      secondaryGlow: '#bef264',
      badgeColor: '#10b981',
      description: 'Obsidiana azufrada con magma alquímico verde esmeralda y chorros de fuego fatuo jade.',
    },
    {
      id: 'magma_void_volcano',
      towerType: 'magma',
      tier: 2,
      name: 'Volcán de Plasma Ultravioleta',
      challengeTitle: 'Reto II: Acumula 4.500 de Daño con Magma',
      requiredDamage: 4500,
      stoneTint: '#2e1065',
      metalTint: '#7e22ce',
      primaryGlow: '#ec4899',
      secondaryGlow: '#f5d0fe',
      badgeColor: '#ec4899',
      description: 'Forja oscura con lava magenta-ultravioleta y braseros de nebulosa cósmica.',
    },
    {
      id: 'magma_supernova_gold',
      towerType: 'magma',
      tier: 3,
      name: 'Coloso Supernova Dorado',
      challengeTitle: 'Reto III: Acumula 10.000 de Daño con Magma',
      requiredDamage: 10000,
      stoneTint: '#451a03',
      metalTint: '#f59e0b',
      primaryGlow: '#fde047',
      secondaryGlow: '#ffffff',
      badgeColor: '#fde047',
      description: 'Ciudadela revestida en oro solar puro con núcleo de estrella blanca incandescente.',
    },
  ],
};

export interface TowerMasteryState {
  damageAccumulated: Record<BaseTowerType, number>;
  unlockedSkins: TowerSkinId[];
  equippedSkins: Record<BaseTowerType, TowerSkinId>;
}

export function getBaseTowerForKind(kind: TowerKind): BaseTowerType {
  if (kind === 'quartz' || kind === 'frost' || kind === 'magma') return kind;
  if (kind === 'prism_glacial') return 'frost';
  if (kind === 'plasma_colossus') return 'magma';
  return 'magma';
}

export function getSkinSpecById(skinId: TowerSkinId): TowerCosmeticSkinSpec {
  for (const list of Object.values(TOWER_MASTERY_SKINS)) {
    const found = list.find((s) => s.id === skinId);
    if (found) return found;
  }
  return TOWER_MASTERY_SKINS.quartz[0];
}

export interface TowerSpec {
  id: TowerKind;
  name: string;
  subtitle: string;
  isSuper: boolean;
  recipe?: [BaseTowerType, BaseTowerType];
  cost: number;
  range: number;
  damage: number;
  fireRate: number; // shots per second
  color: string;
  secondaryColor: string;
  attackType: 'beam' | 'nova' | 'mortar' | 'hybrid_beam' | 'hybrid_artillery';
  slowFactor?: number; // 0..1 (e.g. 0.4 means 40% slow)
  slowDuration?: number;
  freezeChance?: number; // 0..1 probability to freeze enemy solid
  freezeDuration?: number; // seconds frozen
  burnDps?: number; // fire damage per second
  burnDuration?: number; // seconds burning
  splashRadius?: number;
  chainCount?: number;
  armorShred?: number;
  description: string;
  hotkey?: string;
}

export const BASE_TOWERS: Record<BaseTowerType, TowerSpec> = {
  quartz: {
    id: 'quartz',
    name: 'Obelisco de Cuarzo',
    subtitle: 'Aguja del Vacío: Precisión Monobjetivo',
    isSuper: false,
    cost: 60,
    range: 5.2,
    damage: 46,
    fireRate: 2.45,
    color: '#c084fc',
    secondaryColor: '#f3e8ff',
    attackType: 'beam',
    armorShred: 3,
    description: 'Concentra ráfagas cristalinas del vacío sobre un único objetivo con alta cadencia y perforación de armadura (-3 Armadura). No inflige daño en área.',
    hotkey: '1',
  },
  frost: {
    id: 'frost',
    name: 'Pilar de Escarcha',
    subtitle: 'Control Criogénico Puro (0 Daño)',
    isSuper: false,
    cost: 65,
    range: 4.4,
    damage: 0,
    fireRate: 1.35,
    color: '#22d3ee',
    secondaryColor: '#a5f3fc',
    attackType: 'nova',
    slowFactor: 0.52,
    slowDuration: 3.6,
    freezeChance: 0.42,
    freezeDuration: 2.0,
    description: 'No inflige daño directo (0 Daño): ralentiza (-52%), congela en hielo (42%) y aplica Fragilidad Criogénica (+25% a +45% de daño recibido de otras torres).',
    hotkey: '2',
  },
  magma: {
    id: 'magma',
    name: 'Mortero de Magma',
    subtitle: 'Artillería Pesada: Única Torre de Daño en Área',
    isSuper: false,
    cost: 220,
    range: 6.2,
    damage: 115,
    fireRate: 0.85,
    color: '#f97316',
    secondaryColor: '#fde047',
    attackType: 'mortar',
    splashRadius: 2.6,
    burnDps: 38,
    burnDuration: 4.4,
    description: 'Artillería pesada de mitad/final de partida y única torre base con Daño en Área (AoE). Lanza orbes volcánicos que explotan e incendian grupos enteros con Quemadura continua (38 DPS).',
    hotkey: '3',
  },
};

export const SUPER_TOWERS: Record<SuperTowerType, TowerSpec> = {
  prism_glacial: {
    id: 'prism_glacial',
    name: 'Prisma Glacial Absoluto',
    subtitle: 'Supertorre Monobjetivo: Cuarzo + Escarcha (o 2x Cuarzo / 2x Escarcha)',
    isSuper: true,
    recipe: ['quartz', 'frost'],
    cost: 110,
    range: 6.8,
    damage: 165,
    fireRate: 2.85,
    color: '#06b6d4',
    secondaryColor: '#e0f2fe',
    attackType: 'hybrid_beam',
    slowFactor: 0.65,
    slowDuration: 3.8,
    freezeChance: 0.48,
    freezeDuration: 2.2,
    armorShred: 6,
    description: 'Dispara un haz criogénico concentrado de altísimo daño contra un único objetivo prioritario, ralentizando (-65%), congelando en cristal y fracturando armadura (-6).',
  },
  plasma_colossus: {
    id: 'plasma_colossus',
    name: 'Coloso de Plasma Solar',
    subtitle: 'Supertorre de Artillería en Área: Cuarzo + Magma (o 2x Magma)',
    isSuper: true,
    recipe: ['quartz', 'magma'],
    cost: 260,
    range: 7.4,
    damage: 250,
    fireRate: 1.45,
    color: '#f59e0b',
    secondaryColor: '#fef047',
    attackType: 'hybrid_artillery',
    splashRadius: 3.1,
    burnDps: 68,
    burnDuration: 4.6,
    armorShred: 8,
    description: 'Artillería orbital de plasma solar con devastador daño en área que funde grupos enteros y aplica Quemadura solar extrema (68 DPS).',
  },
  cryo_volcano: {
    id: 'cryo_volcano',
    name: 'Santuario de Escarcha Ígnea',
    subtitle: 'Supertorre de Artillería en Área: Escarcha + Magma',
    isSuper: true,
    recipe: ['frost', 'magma'],
    cost: 250,
    range: 7.0,
    damage: 215,
    fireRate: 1.35,
    color: '#ec4899',
    secondaryColor: '#67e8f9',
    attackType: 'hybrid_artillery',
    splashRadius: 3.5,
    slowFactor: 0.6,
    slowDuration: 3.8,
    freezeChance: 0.45,
    freezeDuration: 2.1,
    burnDps: 58,
    burnDuration: 4.4,
    description: 'Artillería pesada de choque térmico en área: aplica simultáneamente daño explosivo en área, Congelación, Ralentización (-60%) y Quemadura ígnea (58 DPS).',
  },
};

export const ALL_TOWERS: Record<TowerKind, TowerSpec> = {
  ...BASE_TOWERS,
  ...SUPER_TOWERS,
};

const SAME_TYPE_SUPER_MAP: Record<BaseTowerType, SuperTowerType> = {
  quartz: 'prism_glacial',
  frost: 'prism_glacial',
  magma: 'plasma_colossus',
};

export function findSuperTowerRecipe(a: TowerKind, b: TowerKind): SuperTowerSpecMatch | null {
  if (BASE_TOWERS[a as BaseTowerType] === undefined || BASE_TOWERS[b as BaseTowerType] === undefined) {
    return null;
  }
  if (a === b) {
    const superId = SAME_TYPE_SUPER_MAP[a as BaseTowerType];
    return { spec: SUPER_TOWERS[superId] };
  }
  const pair = [a, b].sort().join('+');
  for (const spec of Object.values(SUPER_TOWERS)) {
    if (spec.recipe) {
      const rPair = [...spec.recipe].sort().join('+');
      if (pair === rPair) {
        return { spec };
      }
    }
  }
  return null;
}

export interface SuperTowerSpecMatch {
  spec: TowerSpec;
}

export interface GridCoord {
  col: number;
  row: number;
}

export const MAX_TOWER_LEVEL = 5;

export function getTowerMaxXpForLevel(level: number): number {
  const table = [70, 125, 195, 280, 280];
  return table[Math.max(0, Math.min(table.length - 1, level - 1))];
}

export function getTowerEffectiveRange(spec: TowerSpec, level: number): number {
  return spec.range * (1 + (level - 1) * 0.1);
}

export function getTowerEffectiveFireRate(spec: TowerSpec, level: number): number {
  return Number((spec.fireRate * (1 + (level - 1) * 0.13)).toFixed(2));
}

export function getTowerEffectiveDamage(spec: TowerSpec, level: number): number {
  return Math.round(spec.damage * (1 + (level - 1) * 0.26));
}

export interface PlacedTowerData {
  id: string;
  col: number;
  row: number;
  kind: TowerKind;
  level: number;
  xp: number;
  maxXp: number;
  totalInvested: number;
  kills: number;
  totalDamage: number;
  stunTimer: number;
}

export interface FusionCandidate {
  neighborTower: PlacedTowerData;
  resultSpec: TowerSpec;
  fusionCost: number;
}

export type EnemyKind =
  | 'wisp'       // Fast crystal scout
  | 'construct'  // Balanced stone automaton
  | 'basalt'     // Heavy armored golem
  | 'weaver'     // Arcane shielder/healer
  | 'swarm'      // Fast shard cluster
  | 'boss_titan' // Wave 5 Boss: Obsidian Titan
  | 'boss_archon'; // Wave 10 Boss: Void Archon

export interface EnemySpec {
  kind: EnemyKind;
  name: string;
  isBoss: boolean;
  hp: number;
  speed: number;
  armor: number;
  rewardGold: number;
  rewardMana: number;
  coreDamage: number;
  color: string;
  accentColor: string;
  scale: number;
}

export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
  wisp: {
    kind: 'wisp',
    name: 'Mite — Cíclope Cornudo',
    isBoss: false,
    hp: 90,
    speed: 1.72,
    armor: 0,
    rewardGold: 16,
    rewardMana: 5,
    coreDamage: 1,
    color: '#4ade80',
    accentColor: '#eab308',
    scale: 1.0,
  },
  construct: {
    kind: 'construct',
    name: 'Triclope de Planta de Sustos',
    isBoss: false,
    hp: 185,
    speed: 1.28,
    armor: 3,
    rewardGold: 22,
    rewardMana: 7,
    coreDamage: 1,
    color: '#f97316',
    accentColor: '#facc15',
    scale: 0.95,
  },
  basalt: {
    kind: 'basalt',
    name: 'Coloso Peludo Moteado (Sulley)',
    isBoss: false,
    hp: 420,
    speed: 0.88,
    armor: 9,
    rewardGold: 38,
    rewardMana: 12,
    coreDamage: 1,
    color: '#06b6d4',
    accentColor: '#a855f7',
    scale: 1.22,
  },
  weaver: {
    kind: 'weaver',
    name: 'Camaleón Furtivo (Randall)',
    isBoss: false,
    hp: 235,
    speed: 1.2,
    armor: 4,
    rewardGold: 30,
    rewardMana: 10,
    coreDamage: 1,
    color: '#9333ea',
    accentColor: '#ec4899',
    scale: 0.98,
  },
  swarm: {
    kind: 'swarm',
    name: 'Diablillo Multi-Ojos',
    isBoss: false,
    hp: 65,
    speed: 2.0,
    armor: 0,
    rewardGold: 12,
    rewardMana: 4,
    coreDamage: 1,
    color: '#ec4899',
    accentColor: '#fde047',
    scale: 0.68,
  },
  boss_titan: {
    kind: 'boss_titan',
    name: 'Waternoose, Director Arácnido',
    isBoss: true,
    hp: 2200,
    speed: 0.68,
    armor: 12,
    rewardGold: 220,
    rewardMana: 50,
    coreDamage: 1,
    color: '#dc2626',
    accentColor: '#facc15',
    scale: 1.72,
  },
  boss_archon: {
    kind: 'boss_archon',
    name: 'Emperador del Grito Nocturno',
    isBoss: true,
    hp: 4600,
    speed: 0.72,
    armor: 16,
    rewardGold: 400,
    rewardMana: 90,
    coreDamage: 1,
    color: '#7c3aed',
    accentColor: '#06b6d4',
    scale: 1.98,
  },
};

export type PlayerAbilityId = 'summon_golem' | 'astral_meteor' | 'stasis_pulse';

export interface PlayerAbilitySpec {
  id: PlayerAbilityId;
  name: string;
  subtitle: string;
  manaCost: number;
  cooldown: number;
  requiresTarget: boolean;
  hotkey: string;
  color: string;
  description: string;
}

export const PLAYER_ABILITIES: Record<PlayerAbilityId, PlayerAbilitySpec> = {
  summon_golem: {
    id: 'summon_golem',
    name: 'Invocar Guardián Peludo',
    subtitle: 'Campeón Monstruo en el Camino',
    manaCost: 30,
    cooldown: 11,
    requiresTarget: true,
    hotkey: 'Q',
    color: '#10b981',
    description: 'Haz clic en cualquier punto del camino para desplegar un gigantesco Monstruo Guardián que bloquea invasores y golpea en área.',
  },
  astral_meteor: {
    id: 'astral_meteor',
    name: 'Sobrecarga de Gritos',
    subtitle: 'Explosión de Tanque de Energía',
    manaCost: 40,
    cooldown: 14,
    requiresTarget: true,
    hotkey: 'W',
    color: '#f59e0b',
    description: 'Selecciona una zona del mapa para precipitar una megacarga de energía que inflige 520 de daño en área y aturde por 3.0s.',
  },
  stasis_pulse: {
    id: 'stasis_pulse',
    name: 'Protocolo 23-19 (Estasis)',
    subtitle: 'Paralización + Sobrecarga',
    manaCost: 35,
    cooldown: 16,
    requiresTarget: false,
    hotkey: 'E',
    color: '#38bdf8',
    description: 'Activa la sirena de contención que paraliza a todos los monstruos del mapa durante 4.5 segundos y aumenta un 45% la cadencia de tus torres.',
  },
};

export function buildStaticPathFromWaypoints(waypoints: GridCoord[]): GridCoord[] {
  const cells: GridCoord[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dc = Math.sign(b.col - a.col);
    const dr = Math.sign(b.row - a.row);
    let c = a.col;
    let r = a.row;
    if (i === 0) {
      cells.push({ col: c, row: r });
    }
    while (c !== b.col || r !== b.row) {
      if (c !== b.col) c += dc;
      else if (r !== b.row) r += dr;
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

export interface MapConfig {
  id: string;
  chapter: number;
  chapterTitle: string;
  name: string;
  subtitle: string;
  difficulty: 'Iniciado' | 'Veterano' | 'Maestro Arcano';
  description: string;
  narrator: string;
  storyLore: string;
  tacticalBriefing: string;
  epilogueText: string;
  defaultWeather: WeatherType;
  mapStyle?: 'sanctuary' | 'castle_valley';
  riverCol?: number;
  bridgeRow?: number;
  pedestals?: GridCoord[];
  cols: number;
  rows: number;
  spawns: GridCoord[];
  goal: GridCoord;
  staticPaths: GridCoord[][];
  obstacles: GridCoord[];
  startingGold: number;
  startingMana: number;
  startingLives: number;
  totalWaves: number;
  theme: {
    groundColor: string;
    tileColorA: string;
    tileColorB: string;
    pathColor: string;
    obstacleColor: string;
    crystalColor: string;
    fogColor: string;
    skyColor: string;
  };
}

export const MAPS: MapConfig[] = [
  {
    id: 'bastion_del_alba',
    chapter: 1,
    chapterTitle: 'Capítulo I · El Bastión del Alba',
    name: 'Valle del Castillo Real',
    subtitle: 'Puente de Piedra y Ruinas del Templo',
    difficulty: 'Iniciado',
    description:
      'Dos caminos empedrados con flechas rúnicas descienden desde el bosque y el templo antiguo, uniéndose frente al puente de piedra que cruza el río hacia el Castillo Real.',
    narrator: 'Archimago Sullyvan · Guardián del Bastión',
    storyLore:
      '«Al ponerse el sol tras las montañas del valle, las hordas de Mite han emergido desde el sendero del bosque norte y las ruinas del Templo Antiguo. Sus columnas marchan siguiendo los glifos carmesíes hacia el Puente de Piedra con un único objetivo: derribar las puertas del Castillo Real.»',
    tacticalBriefing:
      'Aprovecha los pedestales octogonales de piedra junto a las curvas del camino y defiende el embudo del Puente de Piedra (columna 11) antes de las murallas del Castillo.',
    epilogueText:
      'El Puente del Alba y las murallas del Castillo Real han resistido el asedio al atardecer. Ahora debemos marchar hacia el Valle de Cuarzo para sellar las puertas interiores.',
    defaultWeather: 'clear',
    mapStyle: 'castle_valley',
    riverCol: 11,
    bridgeRow: 5,
    pedestals: [
      { col: 2, row: 3 },
      { col: 4, row: 2 },
      { col: 5, row: 1 },
      { col: 7, row: 4 },
      { col: 3, row: 6 },
      { col: 4, row: 8 },
      { col: 7, row: 7 },
      { col: 9, row: 3 },
      { col: 9, row: 7 },
      { col: 6, row: 10 },
      { col: 12, row: 4 },
      { col: 12, row: 6 },
      { col: 13, row: 3 },
      { col: 13, row: 7 },
    ],
    cols: 16,
    rows: 11,
    spawns: [
      { col: 0, row: 1 },
      { col: 0, row: 7 },
    ],
    goal: { col: 15, row: 5 },
    staticPaths: [
      buildStaticPathFromWaypoints([
        { col: 0, row: 1 },
        { col: 3, row: 1 },
        { col: 3, row: 4 },
        { col: 6, row: 4 },
        { col: 6, row: 2 },
        { col: 9, row: 2 },
        { col: 9, row: 5 },
        { col: 11, row: 5 },
        { col: 15, row: 5 },
      ]),
      buildStaticPathFromWaypoints([
        { col: 0, row: 7 },
        { col: 2, row: 7 },
        { col: 2, row: 9 },
        { col: 5, row: 9 },
        { col: 5, row: 6 },
        { col: 8, row: 6 },
        { col: 8, row: 8 },
        { col: 10, row: 8 },
        { col: 10, row: 5 },
        { col: 11, row: 5 },
        { col: 15, row: 5 },
      ]),
    ],
    obstacles: [
      { col: 1, row: 4 },
      { col: 1, row: 5 },
      { col: 4, row: 5 },
      { col: 0, row: 10 },
      { col: 3, row: 10 },
      { col: 6, row: 0 },
      { col: 8, row: 0 },
      { col: 7, row: 10 },
      { col: 10, row: 1 },
      { col: 10, row: 10 },
      { col: 13, row: 1 },
      { col: 14, row: 1 },
      { col: 13, row: 9 },
      { col: 14, row: 9 },
    ],
    startingGold: 340,
    startingMana: 85,
    startingLives: 1,
    totalWaves: 10,
    theme: {
      groundColor: '#2d4227',
      tileColorA: '#3d5a32',
      tileColorB: '#314928',
      pathColor: '#856548',
      obstacleColor: '#6b655e',
      crystalColor: '#f43f5e',
      fogColor: '#433046',
      skyColor: '#2c1f33',
    },
  },
  {
    id: 'quartz_valley',
    chapter: 2,
    chapterTitle: 'Capítulo II · El Despertar de las Puertas',
    name: 'Valle de Cuarzo',
    subtitle: 'Pasillo Principal de Puertas',
    difficulty: 'Iniciado',
    description:
      'Una calzada estática serpenteante conecta el Portal de Puertas con el Castillo. Ideal para aprender a fusionar Supertorres.',
    narrator: 'Archimago Sullyvan · Guardián del Santuario',
    storyLore:
      '«Durante siglos, la energía de los cristales astrales mantuvo selladas las Puertas Dimensionales. Pero esta noche, la corporación del Director Waternoose ha forzado la cerradura del Valle de Cuarzo. El escuadrón de vanguardia liderado por Mite, el Cíclope Cornudo, marcha por la calzada antigua para asaltar nuestro Castillo.»',
    tacticalBriefing:
      'Un único portal de entrada con tres curvas pronunciadas. Coloca Pilares de Escarcha en los codos del camino y fusiónalos con Obeliscos de Cuarzo.',
    epilogueText:
      'Has contenido a la vanguardia de Mite en el Valle de Cuarzo, pero los sensores detectan actividad camuflada adentrándose en la Selva Bioluminiscente...',
    defaultWeather: 'arcane_snow',
    mapStyle: 'castle_valley',
    riverCol: 11,
    bridgeRow: 2,
    pedestals: [
      { col: 2, row: 3 },
      { col: 3, row: 5 },
      { col: 5, row: 3 },
      { col: 5, row: 7 },
      { col: 7, row: 7 },
      { col: 8, row: 5 },
      { col: 10, row: 4 },
      { col: 10, row: 7 },
      { col: 12, row: 4 },
      { col: 14, row: 6 },
    ],
    cols: 16,
    rows: 11,
    spawns: [{ col: 0, row: 2 }],
    goal: { col: 15, row: 8 },
    staticPaths: [
      buildStaticPathFromWaypoints([
        { col: 0, row: 2 },
        { col: 4, row: 2 },
        { col: 4, row: 8 },
        { col: 9, row: 8 },
        { col: 9, row: 2 },
        { col: 13, row: 2 },
        { col: 13, row: 8 },
        { col: 15, row: 8 },
      ]),
    ],
    obstacles: [
      { col: 2, row: 6 },
      { col: 6, row: 4 },
      { col: 7, row: 4 },
      { col: 14, row: 2 },
      { col: 15, row: 2 },
    ],
    startingGold: 310,
    startingMana: 80,
    startingLives: 1,
    totalWaves: 10,
    theme: {
      groundColor: '#1e3346',
      tileColorA: '#28455c',
      tileColorB: '#1f3649',
      pathColor: '#64748b',
      obstacleColor: '#475569',
      crystalColor: '#38bdf8',
      fogColor: '#1b2b3d',
      skyColor: '#132030',
    },
  },
  {
    id: 'emerald_canopy',
    chapter: 3,
    chapterTitle: 'Capítulo III · Sombras en la Espesura',
    name: 'Bosque Bioluminiscente',
    subtitle: 'Espiral del Relicario Esmeralda',
    difficulty: 'Iniciado',
    description:
      'Un largo sendero en espiral rodea el claro sagrado. Las terrazas interiores permiten que tus torres disparen durante casi todo el recorrido.',
    narrator: 'Comandante Roz · División de Contención 23-19',
    storyLore:
      '«Tras el fracaso de su asalto frontal, los infiltradores camaleónicos han abierto una puerta oculta en el corazón del Bosque Bioluminiscente. Pretenden usar la niebla de esporas esmeralda para rodear nuestras líneas y alcanzar el Castillo sin ser detectados.»',
    tacticalBriefing:
      'Aprovecha las terrazas centrales dentro del anillo del camino: una Supertorre de largo alcance en el centro cubrirá múltiples tramos de la espiral.',
    epilogueText:
      'Los escuadrones furtivos han sido revelados y expulsados del bosque. Sin embargo, columnas de humo negro se alzan ahora desde el Cráter de Obsidiana.',
    defaultWeather: 'dense_fog',
    mapStyle: 'castle_valley',
    pedestals: [
      { col: 3, row: 3 },
      { col: 3, row: 7 },
      { col: 5, row: 2 },
      { col: 8, row: 3 },
      { col: 8, row: 6 },
      { col: 11, row: 3 },
      { col: 12, row: 6 },
      { col: 7, row: 9 },
      { col: 11, row: 9 },
      { col: 14, row: 4 },
    ],
    cols: 16,
    rows: 11,
    spawns: [{ col: 0, row: 9 }],
    goal: { col: 15, row: 5 },
    staticPaths: [
      buildStaticPathFromWaypoints([
        { col: 0, row: 9 },
        { col: 2, row: 9 },
        { col: 2, row: 1 },
        { col: 13, row: 1 },
        { col: 13, row: 8 },
        { col: 6, row: 8 },
        { col: 6, row: 4 },
        { col: 10, row: 4 },
        { col: 10, row: 5 },
        { col: 15, row: 5 },
      ]),
    ],
    obstacles: [
      { col: 4, row: 5 },
      { col: 8, row: 2 },
      { col: 11, row: 6 },
      { col: 15, row: 1 },
      { col: 15, row: 9 },
    ],
    startingGold: 330,
    startingMana: 85,
    startingLives: 1,
    totalWaves: 10,
    theme: {
      groundColor: '#163829',
      tileColorA: '#204d38',
      tileColorB: '#183d2c',
      pathColor: '#5c5346',
      obstacleColor: '#2d5a44',
      crystalColor: '#10b981',
      fogColor: '#132e22',
      skyColor: '#0e241a',
    },
  },
  {
    id: 'obsidian_crater',
    chapter: 4,
    chapterTitle: 'Capítulo IV · La Forja de Gritos',
    name: 'Cráter de Obsidiana',
    subtitle: 'Planta de Sustos Volcánica Dual',
    difficulty: 'Veterano',
    description:
      'Dos senderos fijos convergen hacia el puente central del Castillo. Domina la intersección con Supertorres y el Guardián Peludo.',
    narrator: 'Archimago Sullyvan · Guardián del Santuario',
    storyLore:
      '«Waternoose ha encendido las calderas del Cráter de Obsidiana para refinar cilindros de gritos sobrecargados con magma. Dos portales gemelos vomitan constructos acorazados y colosos de basalto que convergen en el puente central hacia nuestro Castillo.»',
    tacticalBriefing:
      'Los dos caminos se unen en la columna 5. Concentra tu artillería de Magma y al Guardián Peludo justo en la confluencia central.',
    epilogueText:
      'Las calderas de obsidiana han quedado selladas. En su retirada, las tropas de Waternoose han huido a través de un portal rumbo a las cumbres heladas del norte.',
    defaultWeather: 'ember_ash',
    mapStyle: 'castle_valley',
    riverCol: 8,
    bridgeRow: 5,
    pedestals: [
      { col: 3, row: 3 },
      { col: 3, row: 7 },
      { col: 6, row: 3 },
      { col: 6, row: 7 },
      { col: 9, row: 3 },
      { col: 9, row: 7 },
      { col: 11, row: 4 },
      { col: 11, row: 6 },
      { col: 14, row: 3 },
      { col: 14, row: 7 },
    ],
    cols: 16,
    rows: 11,
    spawns: [
      { col: 0, row: 1 },
      { col: 0, row: 9 },
    ],
    goal: { col: 15, row: 5 },
    staticPaths: [
      buildStaticPathFromWaypoints([
        { col: 0, row: 1 },
        { col: 5, row: 1 },
        { col: 5, row: 5 },
        { col: 10, row: 5 },
        { col: 10, row: 2 },
        { col: 13, row: 2 },
        { col: 13, row: 5 },
        { col: 15, row: 5 },
      ]),
      buildStaticPathFromWaypoints([
        { col: 0, row: 9 },
        { col: 5, row: 9 },
        { col: 5, row: 5 },
        { col: 10, row: 5 },
        { col: 10, row: 8 },
        { col: 13, row: 8 },
        { col: 13, row: 5 },
        { col: 15, row: 5 },
      ]),
    ],
    obstacles: [
      { col: 2, row: 5 },
      { col: 7, row: 2 },
      { col: 7, row: 8 },
      { col: 15, row: 1 },
      { col: 15, row: 9 },
    ],
    startingGold: 360,
    startingMana: 90,
    startingLives: 1,
    totalWaves: 10,
    theme: {
      groundColor: '#2e1d28',
      tileColorA: '#3f2836',
      tileColorB: '#33202c',
      pathColor: '#574340',
      obstacleColor: '#523847',
      crystalColor: '#f97316',
      fogColor: '#2b1922',
      skyColor: '#21121a',
    },
  },
  {
    id: 'frostbite_pass',
    chapter: 5,
    chapterTitle: 'Capítulo V · El Exilio Helado',
    name: 'Glaciar del Destierro',
    subtitle: 'Encrucijada de la Ventisca',
    difficulty: 'Veterano',
    description:
      'Dos rutas heladas desde el norte y el oeste se entrecruzan en el centro del glaciar antes de asaltar el Castillo oriental.',
    narrator: 'Yeti Guardián · Vigía de las Cumbres',
    storyLore:
      '«¡Bienvenidos al Himalaya! Aquí arriba desterraban a los monstruos rebeldes, pero el Emperador del Grito Nocturno ha roto los sellos de hielo. Dos columnas de bestias acorazadas descienden entre la ventisca arcana para invadir el Castillo.»',
    tacticalBriefing:
      'Las dos calzadas se cruzan en el centro (7,5) y vuelven a separarse antes del Castillo. Las Supertorres de Prisma Glacial y Coloso de Plasma dominan este cruce.',
    epilogueText:
      'El Faro Boreal resplandece de nuevo sobre la tormenta. Con las rutas terrestres aseguradas, solo queda ascender a la Bóveda Astral donde flotan las puertas.',
    defaultWeather: 'arcane_snow',
    mapStyle: 'castle_valley',
    pedestals: [
      { col: 2, row: 2 },
      { col: 3, row: 6 },
      { col: 5, row: 4 },
      { col: 6, row: 6 },
      { col: 8, row: 4 },
      { col: 8, row: 8 },
      { col: 10, row: 3 },
      { col: 10, row: 6 },
      { col: 12, row: 4 },
      { col: 12, row: 7 },
    ],
    cols: 16,
    rows: 11,
    spawns: [
      { col: 0, row: 3 },
      { col: 0, row: 8 },
    ],
    goal: { col: 15, row: 5 },
    staticPaths: [
      buildStaticPathFromWaypoints([
        { col: 0, row: 3 },
        { col: 4, row: 3 },
        { col: 4, row: 7 },
        { col: 11, row: 7 },
        { col: 11, row: 5 },
        { col: 15, row: 5 },
      ]),
      buildStaticPathFromWaypoints([
        { col: 0, row: 8 },
        { col: 7, row: 8 },
        { col: 7, row: 2 },
        { col: 13, row: 2 },
        { col: 13, row: 5 },
        { col: 15, row: 5 },
      ]),
    ],
    obstacles: [
      { col: 2, row: 5 },
      { col: 5, row: 1 },
      { col: 9, row: 5 },
      { col: 10, row: 9 },
      { col: 14, row: 8 },
    ],
    startingGold: 390,
    startingMana: 95,
    startingLives: 1,
    totalWaves: 10,
    theme: {
      groundColor: '#1f364d',
      tileColorA: '#2b4c6b',
      tileColorB: '#223d57',
      pathColor: '#64748b',
      obstacleColor: '#3b6085',
      crystalColor: '#22d3ee',
      fogColor: '#192d42',
      skyColor: '#122233',
    },
  },
  {
    id: 'astral_archipelago',
    chapter: 6,
    chapterTitle: 'Capítulo VI · La Bóveda Infinita',
    name: 'Archipiélago Astral',
    subtitle: 'Bóveda de Puertas Nocturnas',
    difficulty: 'Maestro Arcano',
    description:
      'Puentes estáticos suspendidos sobre el éter conectan dos portales de monstruos hacia el Castillo. Ideal para fuego cruzado de Supertorres.',
    narrator: 'Comandante Roz · División de Contención 23-19',
    storyLore:
      '«Hemos llegado a la Bóveda suspendida en el vacío astral, donde millones de puertas cuelgan sobre el abismo. El enemigo está abriendo portales desde dos flancos perpendiculares para colapsar los puentes de luz que sostienen nuestro Castillo.»',
    tacticalBriefing:
      'Los invasores atacan desde el Oeste (0,5) y desde el Norte (6,0). Protege la isla central (columnas 7–10) con Supertorres de alcance extendido.',
    epilogueText:
      'Los puentes astrales resisten y la Bóveda es nuestra. Ante nosotros se abre por fin el último reducto enemigo: la Ciudadela del Grito Eterno.',
    defaultWeather: 'aether_storm',
    mapStyle: 'castle_valley',
    riverCol: 12,
    bridgeRow: 5,
    pedestals: [
      { col: 2, row: 4 },
      { col: 2, row: 7 },
      { col: 4, row: 6 },
      { col: 5, row: 2 },
      { col: 7, row: 4 },
      { col: 8, row: 7 },
      { col: 10, row: 4 },
      { col: 10, row: 7 },
      { col: 13, row: 4 },
      { col: 13, row: 6 },
    ],
    cols: 16,
    rows: 11,
    spawns: [
      { col: 0, row: 5 },
      { col: 6, row: 0 },
    ],
    goal: { col: 15, row: 5 },
    staticPaths: [
      buildStaticPathFromWaypoints([
        { col: 0, row: 5 },
        { col: 3, row: 5 },
        { col: 3, row: 8 },
        { col: 11, row: 8 },
        { col: 11, row: 5 },
        { col: 15, row: 5 },
      ]),
      buildStaticPathFromWaypoints([
        { col: 6, row: 0 },
        { col: 6, row: 3 },
        { col: 11, row: 3 },
        { col: 11, row: 5 },
        { col: 15, row: 5 },
      ]),
    ],
    obstacles: [
      { col: 2, row: 2 },
      { col: 6, row: 6 },
      { col: 9, row: 5 },
      { col: 13, row: 2 },
      { col: 13, row: 8 },
    ],
    startingGold: 420,
    startingMana: 105,
    startingLives: 1,
    totalWaves: 10,
    theme: {
      groundColor: '#222944',
      tileColorA: '#2f395e',
      tileColorB: '#262e4d',
      pathColor: '#635978',
      obstacleColor: '#434e78',
      crystalColor: '#a855f7',
      fogColor: '#1e2238',
      skyColor: '#151829',
    },
  },
  {
    id: 'scream_citadel',
    chapter: 7,
    chapterTitle: 'Capítulo VII · El Trono del Grito Eterno',
    name: 'Ciudadela Carmesí',
    subtitle: 'Asedio Triple del Emperador',
    difficulty: 'Maestro Arcano',
    description:
      'El capítulo final de la campaña: TRES Portales de Sustos activos lanzan oleadas simultáneas por tres calzadas hacia el Gran Castillo Imperial.',
    narrator: 'Archimago Sullyvan · Guardián del Santuario',
    storyLore:
      '«Este es el desenlace de la guerra por los Santuarios. En lo alto de la Ciudadela Carmesí, el Emperador del Grito Nocturno ha activado tres Portales Maestros a la vez. Todas las criaturas de la dimensión oscura marchan unidas en un último intento por derribar el Castillo de Aegis Arcana para siempre.»',
    tacticalBriefing:
      '¡Atención a los 3 Portales (Norte, Centro y Sur)! Todas las rutas convergen en el cuello de botella de la columna 12. Despliega Supertorres y usa el Meteoro y el Protocolo 23-19 en los momentos críticos.',
    epilogueText:
      '¡VICTORIA SUPREMA! El Emperador del Grito Nocturno ha caído y las Puertas Dimensionales han sido selladas en los santuarios. ¡Tu nombre quedará grabado para siempre en las Crónicas de Aegis Arcana!',
    defaultWeather: 'aether_storm',
    mapStyle: 'castle_valley',
    riverCol: 13,
    bridgeRow: 5,
    pedestals: [
      { col: 2, row: 3 },
      { col: 4, row: 2 },
      { col: 3, row: 7 },
      { col: 6, row: 6 },
      { col: 8, row: 2 },
      { col: 8, row: 4 },
      { col: 10, row: 6 },
      { col: 11, row: 2 },
      { col: 11, row: 4 },
      { col: 11, row: 7 },
      { col: 14, row: 4 },
      { col: 14, row: 6 },
    ],
    cols: 16,
    rows: 11,
    spawns: [
      { col: 0, row: 1 },
      { col: 0, row: 5 },
      { col: 0, row: 9 },
    ],
    goal: { col: 15, row: 5 },
    staticPaths: [
      buildStaticPathFromWaypoints([
        { col: 0, row: 1 },
        { col: 6, row: 1 },
        { col: 6, row: 3 },
        { col: 12, row: 3 },
        { col: 12, row: 5 },
        { col: 15, row: 5 },
      ]),
      buildStaticPathFromWaypoints([
        { col: 0, row: 5 },
        { col: 4, row: 5 },
        { col: 4, row: 7 },
        { col: 9, row: 7 },
        { col: 9, row: 5 },
        { col: 15, row: 5 },
      ]),
      buildStaticPathFromWaypoints([
        { col: 0, row: 9 },
        { col: 8, row: 9 },
        { col: 8, row: 8 },
        { col: 12, row: 8 },
        { col: 12, row: 5 },
        { col: 15, row: 5 },
      ]),
    ],
    obstacles: [
      { col: 3, row: 3 },
      { col: 7, row: 5 },
      { col: 10, row: 2 },
      { col: 14, row: 2 },
      { col: 14, row: 8 },
    ],
    startingGold: 460,
    startingMana: 120,
    startingLives: 1,
    totalWaves: 10,
    theme: {
      groundColor: '#361c28',
      tileColorA: '#4a2637',
      tileColorB: '#3b1e2c',
      pathColor: '#694e52',
      obstacleColor: '#5c3447',
      crystalColor: '#f43f5e',
      fogColor: '#2e1622',
      skyColor: '#221019',
    },
  },
];

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  interval: number;
  delayBefore: number;
}

export interface WaveDefinition {
  waveNumber: number;
  title: string;
  isBossWave: boolean;
  bossName?: string;
  groups: WaveGroup[];
}

export const WAVE_DEFINITIONS: WaveDefinition[] = [
  {
    waveNumber: 1,
    title: 'Turno de Cíclopes Saltarines',
    isBossWave: false,
    groups: [{ kind: 'wisp', count: 7, interval: 1.35, delayBefore: 0 }],
  },
  {
    waveNumber: 2,
    title: 'Brigada de la Planta de Sustos',
    isBossWave: false,
    groups: [
      { kind: 'wisp', count: 5, interval: 1.15, delayBefore: 0 },
      { kind: 'construct', count: 4, interval: 1.6, delayBefore: 2.0 },
    ],
  },
  {
    waveNumber: 3,
    title: 'Fuga de Diablillos Multi-Ojos',
    isBossWave: false,
    groups: [
      { kind: 'swarm', count: 11, interval: 0.78, delayBefore: 0 },
      { kind: 'construct', count: 4, interval: 1.45, delayBefore: 1.8 },
    ],
  },
  {
    waveNumber: 4,
    title: 'Colosos Peludos y Camaleones',
    isBossWave: false,
    groups: [
      { kind: 'basalt', count: 4, interval: 2.2, delayBefore: 0 },
      { kind: 'weaver', count: 4, interval: 1.8, delayBefore: 1.8 },
    ],
  },
  {
    waveNumber: 5,
    title: 'Inspección del Director Waternoose',
    isBossWave: true,
    bossName: 'Waternoose, Director Arácnido',
    groups: [
      { kind: 'construct', count: 5, interval: 1.35, delayBefore: 0 },
      { kind: 'boss_titan', count: 1, interval: 3.2, delayBefore: 2.8 },
      { kind: 'wisp', count: 6, interval: 0.95, delayBefore: 2.5 },
    ],
  },
  {
    waveNumber: 6,
    title: 'Escuadrón Camaleón Boggs',
    isBossWave: false,
    groups: [
      { kind: 'weaver', count: 6, interval: 1.4, delayBefore: 0 },
      { kind: 'basalt', count: 4, interval: 1.85, delayBefore: 1.8 },
    ],
  },
  {
    waveNumber: 7,
    title: 'Alerta 23-19 en Planta Central',
    isBossWave: false,
    groups: [
      { kind: 'swarm', count: 16, interval: 0.62, delayBefore: 0 },
      { kind: 'basalt', count: 5, interval: 1.7, delayBefore: 1.5 },
    ],
  },
  {
    waveNumber: 8,
    title: 'Élite de Asustadores Moteados',
    isBossWave: false,
    groups: [
      { kind: 'basalt', count: 7, interval: 1.6, delayBefore: 0 },
      { kind: 'weaver', count: 5, interval: 1.5, delayBefore: 1.5 },
      { kind: 'wisp', count: 9, interval: 0.75, delayBefore: 1.5 },
    ],
  },
  {
    waveNumber: 9,
    title: 'Motín de la Junta Directiva',
    isBossWave: false,
    groups: [
      { kind: 'boss_titan', count: 1, interval: 2.8, delayBefore: 0 },
      { kind: 'basalt', count: 6, interval: 1.5, delayBefore: 2.4 },
      { kind: 'swarm', count: 12, interval: 0.65, delayBefore: 1.8 },
    ],
  },
  {
    waveNumber: 10,
    title: 'El Emperador del Grito Nocturno',
    isBossWave: true,
    bossName: 'Emperador del Grito Nocturno',
    groups: [
      { kind: 'basalt', count: 5, interval: 1.5, delayBefore: 0 },
      { kind: 'weaver', count: 5, interval: 1.35, delayBefore: 1.8 },
      { kind: 'boss_archon', count: 1, interval: 4.0, delayBefore: 2.8 },
      { kind: 'boss_titan', count: 1, interval: 3.5, delayBefore: 4.5 },
    ],
  },
];

export interface ActiveBossHudInfo {
  name: string;
  subtitle: string;
  hp: number;
  maxHp: number;
  armor: number;
}

export type AchievementMetricKey =
  | 'golemsSummoned'
  | 'superTowersCreated'
  | 'bossesDefeated'
  | 'monstersEliminated'
  | 'abilitiesCast';

export type AchievementId =
  | 'golem_initiate'
  | 'golem_commander'
  | 'super_alchemist'
  | 'super_architect'
  | 'boss_slayer'
  | 'boss_vanquisher'
  | 'monster_containment'
  | 'scream_overloader';

export interface AchievementSpec {
  id: AchievementId;
  title: string;
  categoryLabel: 'Golems invocados' | 'Supertorres creadas' | 'Jefes derrotados' | 'Maestría de Defensa';
  description: string;
  metric: AchievementMetricKey;
  target: number;
  rewardGold: number;
  accentColor: string;
}

export const ACHIEVEMENTS: AchievementSpec[] = [
  {
    id: 'golem_initiate',
    title: '¡Guardián en Camino!',
    categoryLabel: 'Golems invocados',
    description: 'Invoca tu primer Gólem / Guardián Peludo aliado sobre la calzada estática.',
    metric: 'golemsSummoned',
    target: 1,
    rewardGold: 45,
    accentColor: '#10b981',
  },
  {
    id: 'golem_commander',
    title: 'Escuadrón de Contención',
    categoryLabel: 'Golems invocados',
    description: 'Invoca un total de 5 Gólems / Guardianes Peludos para frenar las oleadas.',
    metric: 'golemsSummoned',
    target: 5,
    rewardGold: 110,
    accentColor: '#34d399',
  },
  {
    id: 'super_alchemist',
    title: 'Alquimia Adyacente',
    categoryLabel: 'Supertorres creadas',
    description: 'Fusiona dos torres base adyacentes para crear tu primera Supertorre híbrida.',
    metric: 'superTowersCreated',
    target: 1,
    rewardGold: 60,
    accentColor: '#f59e0b',
  },
  {
    id: 'super_architect',
    title: 'Arquitecto de Supertorres',
    categoryLabel: 'Supertorres creadas',
    description: 'Crea 3 Supertorres híbridas mediante fusión de torres adyacentes.',
    metric: 'superTowersCreated',
    target: 3,
    rewardGold: 140,
    accentColor: '#fbbf24',
  },
  {
    id: 'boss_slayer',
    title: 'Cazador de Directores',
    categoryLabel: 'Jefes derrotados',
    description: 'Derrota a tu primer Jefe Final (Waternoose o Emperador del Grito Nocturno).',
    metric: 'bossesDefeated',
    target: 1,
    rewardGold: 120,
    accentColor: '#f43f5e',
  },
  {
    id: 'boss_vanquisher',
    title: 'Terror de la Junta Directiva',
    categoryLabel: 'Jefes derrotados',
    description: 'Derrota a un total de 3 Jefes Finales defendiendo los santuarios.',
    metric: 'bossesDefeated',
    target: 3,
    rewardGold: 220,
    accentColor: '#e11d48',
  },
  {
    id: 'monster_containment',
    title: 'Protocolo 23-19 Completado',
    categoryLabel: 'Maestría de Defensa',
    description: 'Elimina a 35 monstruos invasores con tus torres y guardianes.',
    metric: 'monstersEliminated',
    target: 35,
    rewardGold: 80,
    accentColor: '#38bdf8',
  },
  {
    id: 'scream_overloader',
    title: 'Maestro de Energía de Gritos',
    categoryLabel: 'Maestría de Defensa',
    description: 'Activa 5 habilidades especiales del jugador durante la batalla.',
    metric: 'abilitiesCast',
    target: 5,
    rewardGold: 90,
    accentColor: '#a855f7',
  },
];

export interface AchievementMetrics {
  golemsSummoned: number;
  superTowersCreated: number;
  bossesDefeated: number;
  monstersEliminated: number;
  abilitiesCast: number;
}

export interface UnlockedAchievementNotification {
  id: AchievementId;
  title: string;
  categoryLabel: string;
  description: string;
  rewardGold: number;
  accentColor: string;
  unlockedAt: number;
}

export type DifficultyLevel = 'facil' | 'normal' | 'arcana';

export const DIFFICULTY_ORDER: DifficultyLevel[] = ['facil', 'normal', 'arcana'];

export interface DifficultySpec {
  id: DifficultyLevel;
  label: 'Fácil' | 'Normal' | 'Arcana';
  subtitle: string;
  enemyHpMultiplier: number;
  towerCostMultiplier: number;
  spawnIntervalMultiplier: number;
  extraGroupEnemies: number;
  startingGoldOffset: number;
  accentColor: string;
  description: string;
}

export const DIFFICULTY_SPECS: Record<DifficultyLevel, DifficultySpec> = {
  facil: {
    id: 'facil',
    label: 'Fácil',
    subtitle: 'Iniciado del Santuario',
    enemyHpMultiplier: 0.72,
    towerCostMultiplier: 0.85,
    spawnIntervalMultiplier: 1.2,
    extraGroupEnemies: 0,
    startingGoldOffset: 50,
    accentColor: '#10b981',
    description: 'Salud enemiga al 72%, torres un 15% más económicas y +50 de Oro inicial (Muerte Súbita si llegan al Castillo).',
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    subtitle: 'Guardián Rúnico',
    enemyHpMultiplier: 0.95,
    towerCostMultiplier: 1.0,
    spawnIntervalMultiplier: 1.05,
    extraGroupEnemies: 0,
    startingGoldOffset: 0,
    accentColor: '#38bdf8',
    description: 'Equilibrio táctico para Muerte Súbita: un solo enemigo en el Castillo termina la partida.',
  },
  arcana: {
    id: 'arcana',
    label: 'Arcana',
    subtitle: 'Maestría Astral',
    enemyHpMultiplier: 1.28,
    towerCostMultiplier: 1.15,
    spawnIntervalMultiplier: 0.9,
    extraGroupEnemies: 1,
    startingGoldOffset: 0,
    accentColor: '#f43f5e',
    description: 'Salud enemiga al 128%, costo de torres al 115% y oleadas más intensas en modo Muerte Súbita.',
  },
};

export function getAdjustedTowerCost(baseCost: number, difficulty: DifficultyLevel): number {
  const mult = DIFFICULTY_SPECS[difficulty]?.towerCostMultiplier ?? 1.0;
  return Math.max(5, Math.round((baseCost * mult) / 5) * 5);
}

export type WeatherType = 'clear' | 'arcane_snow' | 'dense_fog' | 'ember_ash' | 'aether_storm';

export const WEATHER_ORDER: WeatherType[] = [
  'clear',
  'arcane_snow',
  'dense_fog',
  'ember_ash',
  'aether_storm',
];

export interface WeatherSpec {
  id: WeatherType;
  label: string;
  subtitle: string;
  accentColor: string;
  fogDensity: number;
  fogColorTint: string;
  skyColorTint: string;
  lightColorTint: string;
  lightIntensityMult: number;
  particleCount: number;
  windX: number;
  windZ: number;
  fallSpeed: number;
  description: string;
}

export const WEATHER_SPECS: Record<WeatherType, WeatherSpec> = {
  clear: {
    id: 'clear',
    label: 'Atardecer Dorado',
    subtitle: 'Sol Poniente del Valle',
    accentColor: '#fbbf24',
    fogDensity: 0.0048,
    fogColorTint: '#4a3248',
    skyColorTint: '#36233b',
    lightColorTint: '#ffedd5',
    lightIntensityMult: 1.18,
    particleCount: 160,
    windX: 0.35,
    windZ: 0.2,
    fallSpeed: -0.35,
    description: 'Cálida luz dorada de atardecer sobre las montañas del valle con motas de maná flotando en la brisa.',
  },
  arcane_snow: {
    id: 'arcane_snow',
    label: 'Nieve Arcana',
    subtitle: 'Ventisca Cristalina',
    accentColor: '#67e8f9',
    fogDensity: 0.011,
    fogColorTint: '#1e3a5f',
    skyColorTint: '#152c47',
    lightColorTint: '#e0f2fe',
    lightIntensityMult: 1.02,
    particleCount: 480,
    windX: 1.4,
    windZ: 0.75,
    fallSpeed: 2.6,
    description: 'Copos de cristal helado caen en espiral con bruma glacial y reflejos cian.',
  },
  dense_fog: {
    id: 'dense_fog',
    label: 'Niebla Esmeralda',
    subtitle: 'Bruma del Bosque Antiguo',
    accentColor: '#34d399',
    fogDensity: 0.014,
    fogColorTint: '#1b3634',
    skyColorTint: '#132826',
    lightColorTint: '#d1fae5',
    lightIntensityMult: 0.95,
    particleCount: 340,
    windX: 0.65,
    windZ: -0.45,
    fallSpeed: 0.25,
    description: 'Bancos místicos de bruma bioluminiscente que envuelven los pinos y las ruinas del valle.',
  },
  ember_ash: {
    id: 'ember_ash',
    label: 'Ceniza y Brasas',
    subtitle: 'Pavesas Volcánicas',
    accentColor: '#f97316',
    fogDensity: 0.011,
    fogColorTint: '#3b1d1e',
    skyColorTint: '#291214',
    lightColorTint: '#fed7aa',
    lightIntensityMult: 1.12,
    particleCount: 420,
    windX: -1.1,
    windZ: 0.9,
    fallSpeed: -1.4,
    description: 'Pavesas incandescentes y ceniza obsidiana que ascienden en corrientes térmicas.',
  },
  aether_storm: {
    id: 'aether_storm',
    label: 'Tormenta de Éter',
    subtitle: 'Tempestad Eléctrica',
    accentColor: '#facc15',
    fogDensity: 0.012,
    fogColorTint: '#1e294a',
    skyColorTint: '#141c36',
    lightColorTint: '#bae6fd',
    lightIntensityMult: 0.98,
    particleCount: 580,
    windX: 2.8,
    windZ: 1.5,
    fallSpeed: 7.2,
    description: 'Precipitación veloz de plasma astral acompañada de ráfagas de viento y relámpagos ambientales.',
  },
};

export type AudioTrackState = 'exploration' | 'combat' | 'boss_combat';

export type DailyVoidEventId =
  | 'eclipse_runico'
  | 'convergencia_criogenica'
  | 'forja_sobrecargada'
  | 'asedio_guardianes';

export interface DailyVoidEventSpec {
  id: DailyVoidEventId;
  title: string;
  subtitle: string;
  dayLabel: string;
  featuredMapId: string;
  weather: WeatherType;
  accentColor: string;
  narrator: string;
  lore: string;
  modifiersSummary: string[];
  bonusStartingGold: number;
  bonusStartingMana: number;
  quartzDamageMult: number;
  burnDamageMult: number;
  cryoFragilityBonus: number;
  golemStatMult: number;
  abilityCooldownMult: number;
  enemySpeedMult: number;
  masteryXpMult: number;
}

export const DAILY_VOID_EVENTS: DailyVoidEventSpec[] = [
  {
    id: 'eclipse_runico',
    title: 'Eclipse del Vacío Rúnico',
    subtitle: 'Resonancia de los Obeliscos de Obsidiana',
    dayLabel: 'Evento Destacado del Día',
    featuredMapId: 'bastion_del_alba',
    weather: 'aether_storm',
    accentColor: '#c084fc',
    narrator: 'Archimago Sullyvan · Guardián del Bastión',
    lore: '«El eclipse púrpura alinea el vórtice de agujero negro del Castillo con los portales de aparición. Los Obeliscos de Cuarzo sobrecargan sus lanzas de cristal, aunque las sombras emergen con mayor frenesí.»',
    modifiersSummary: [
      '+25% Daño en Obelisco de Cuarzo y Prisma Glacial',
      '+80 Oro Rúnico inicial para defensas tempranas',
      '+50% Progreso en Retos de Maestría y Skins 3D',
      '+8% Velocidad de movimiento enemigo',
    ],
    bonusStartingGold: 80,
    bonusStartingMana: 15,
    quartzDamageMult: 1.25,
    burnDamageMult: 1.0,
    cryoFragilityBonus: 0,
    golemStatMult: 1.0,
    abilityCooldownMult: 1.0,
    enemySpeedMult: 1.08,
    masteryXpMult: 1.5,
  },
  {
    id: 'convergencia_criogenica',
    title: 'Ventisca del Cero Absoluto',
    subtitle: 'Dominio de los Pilares de Escarcha',
    dayLabel: 'Rotación Diaria · Glaciar',
    featuredMapId: 'frostbite_pass',
    weather: 'arcane_snow',
    accentColor: '#38bdf8',
    narrator: 'Yeti Guardián · Vigía de las Cumbres',
    lore: '«Una frente polar desciende desde el Himalaya astral. Aunque el Pilar de Escarcha no inflige daño directo, el frío extremo vuelve quebradizas las armaduras enemigas al instante.»',
    modifiersSummary: [
      'Fragilidad Criogénica aumentada (+35% ralentizado / +60% congelado)',
      '+45 Maná inicial para Protocolo 23-19 y Guardianes',
      '+55% Progreso en Retos de Maestría y Skins 3D',
    ],
    bonusStartingGold: 40,
    bonusStartingMana: 45,
    quartzDamageMult: 1.0,
    burnDamageMult: 1.0,
    cryoFragilityBonus: 0.15,
    golemStatMult: 1.0,
    abilityCooldownMult: 1.0,
    enemySpeedMult: 1.0,
    masteryXpMult: 1.55,
  },
  {
    id: 'forja_sobrecargada',
    title: 'Erupción de la Forja de Magma',
    subtitle: 'Caudal Volcánico de las Fisuras Doradas',
    dayLabel: 'Rotación Diaria · Volcán',
    featuredMapId: 'obsidian_crater',
    weather: 'ember_ash',
    accentColor: '#f97316',
    narrator: 'Comandante Roz · División 23-19',
    lore: '«Las fisuras doradas bajo los Portales del Vacío han entrado en erupción. Los Morteros de Magma y el Impacto de Sobrecarga absorben el calor telúrico para calcinar las columnas blindadas.»',
    modifiersSummary: [
      '+35% Daño de Quemadura en Mortero de Magma y Supertorres',
      '-20% Enfriamiento en todas las Habilidades del Jugador',
      '+65 Oro Rúnico inicial · +60% Progreso de Maestría',
    ],
    bonusStartingGold: 65,
    bonusStartingMana: 25,
    quartzDamageMult: 1.0,
    burnDamageMult: 1.35,
    cryoFragilityBonus: 0,
    golemStatMult: 1.0,
    abilityCooldownMult: 0.8,
    enemySpeedMult: 1.0,
    masteryXpMult: 1.6,
  },
  {
    id: 'asedio_guardianes',
    title: 'Juramento del Bosque Rúnico',
    subtitle: 'Despliegue de los Guardianes Peludos',
    dayLabel: 'Rotación Diaria · Arboleda',
    featuredMapId: 'emerald_canopy',
    weather: 'dense_fog',
    accentColor: '#10b981',
    narrator: 'Archimago Sullyvan · Guardián del Santuario',
    lore: '«Los Árboles Rúnicos de Oro y Vacío exhalan néctar bioluminiscente sobre los senderos. Los Guardianes Peludos invocados en la calzada reciben vitalidad ancestral y fuerza colosal.»',
    modifiersSummary: [
      '+35% Salud y Daño de área para el Guardián Peludo (Q)',
      '+50 Maná inicial y +40 Oro Rúnico inicial',
      '+50% Progreso en Retos de Maestría y Skins 3D',
    ],
    bonusStartingGold: 40,
    bonusStartingMana: 50,
    quartzDamageMult: 1.0,
    burnDamageMult: 1.0,
    cryoFragilityBonus: 0,
    golemStatMult: 1.35,
    abilityCooldownMult: 0.9,
    enemySpeedMult: 1.0,
    masteryXpMult: 1.5,
  },
];

export function getFeaturedDailyEventIdForToday(): DailyVoidEventId {
  const now = new Date();
  const dayIndex =
    Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000) %
    DAILY_VOID_EVENTS.length;
  return DAILY_VOID_EVENTS[Math.abs(dayIndex)]?.id || 'eclipse_runico';
}

export interface GameHudState {
  phase: 'title' | 'playing' | 'paused' | 'victory' | 'gameover';
  mapId: string;
  difficulty: DifficultyLevel;
  activeDailyEventId: DailyVoidEventId | null;
  weather: WeatherType;
  autoWeather: boolean;
  gold: number;
  mana: number;
  maxMana: number;
  lives: number;
  maxLives: number;
  wave: number;
  totalWaves: number;
  waveInProgress: boolean;
  nextWaveCountdown: number | null;
  enemiesRemaining: number;
  gameSpeed: 1 | 2;
  selectedBuildTower: BaseTowerType | null;
  selectedPlacedTower: PlacedTowerData | null;
  fusionCandidates: FusionCandidate[];
  activeAbilityTargeting: PlayerAbilityId | null;
  abilityCooldowns: Record<PlayerAbilityId, number>;
  stasisTimer: number;
  activeBoss: ActiveBossHudInfo | null;
  activeGolemsCount: number;
  superTowersBuilt: number;
  totalKills: number;
  statusBanner: string | null;
  isMuted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  musicState: AudioTrackState;
  cinematicCamera: boolean;
  autoCinematicCamera: boolean;
  dockCollapsed: boolean;
  achievementMetrics: AchievementMetrics;
  unlockedAchievements: AchievementId[];
  activeAchievementToast: UnlockedAchievementNotification | null;
  towerMastery: TowerMasteryState;
}



