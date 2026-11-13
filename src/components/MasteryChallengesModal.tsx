import React, { useState } from 'react';
import {
  BASE_TOWERS,
  BaseTowerType,
  TOWER_MASTERY_SKINS,
  TowerMasteryState,
  TowerSkinId,
} from '../types/game';
import {
  Crown,
  CheckCircle2,
  Lock,
  Sparkles,
  Flame,
  Snowflake,
  Crosshair,
  X,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface MasteryChallengesModalProps {
  isOpen: boolean;
  mastery: TowerMasteryState;
  onClose: () => void;
  onEquipSkin: (towerType: BaseTowerType, skinId: TowerSkinId) => void;
  onBoostMasteryDemo: (towerType: BaseTowerType, amount?: number) => void;
  onResetMastery: () => void;
}

const TOWER_ORDER: BaseTowerType[] = ['quartz', 'frost', 'magma'];

export const MasteryChallengesModal: React.FC<MasteryChallengesModalProps> = ({
  isOpen,
  mastery,
  onClose,
  onEquipSkin,
  onBoostMasteryDemo,
  onResetMastery,
}) => {
  const [selectedTab, setSelectedTab] = useState<'all' | BaseTowerType>('all');

  if (!isOpen) return null;

  const unlockedSet = new Set(mastery.unlockedSkins);
  const totalSkins = TOWER_ORDER.reduce((acc, t) => acc + TOWER_MASTERY_SKINS[t].length, 0);
  const unlockedCount = mastery.unlockedSkins.length;

  const visibleTowers = selectedTab === 'all' ? TOWER_ORDER : [selectedTab];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div
        className="w-full max-w-5xl rounded-xl border border-slate-700 p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#0b0f19' }}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-amber-400/60 bg-amber-950/50 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-100">
                Retos de Maestría y Skins Cosméticas 3D
              </h2>
              <p className="text-xs text-slate-400">
                Acumula daño (o control criogénico con el Pilar de Escarcha) para desbloquear aspectos 3D exclusivos con coronas flotantes y efectos visuales propios ({unlockedCount}/{totalSkins} Skins desbloqueadas).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onResetMastery}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Reiniciar progreso de maestría y skins"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Cerrar Retos de Maestría"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tower Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-slate-900 border border-slate-800">
            <button
              onClick={() => setSelectedTab('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                selectedTab === 'all'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Todas las Torres (3)
            </button>
            {TOWER_ORDER.map((tKey) => {
              const spec = BASE_TOWERS[tKey];
              const isSelected = selectedTab === tKey;
              return (
                <button
                  key={tKey}
                  onClick={() => setSelectedTab(tKey)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 text-white border border-slate-600'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  style={{
                    borderColor: isSelected ? spec.color : undefined,
                    color: isSelected ? spec.color : undefined,
                  }}
                >
                  {tKey === 'quartz' && <Crosshair className="w-3.5 h-3.5" />}
                  {tKey === 'frost' && <Snowflake className="w-3.5 h-3.5" />}
                  {tKey === 'magma' && <Flame className="w-3.5 h-3.5" />}
                  <span>{spec.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mastery Sections per Tower */}
        <div className="space-y-6">
          {visibleTowers.map((towerType) => {
            const towerSpec = BASE_TOWERS[towerType];
            const skins = TOWER_MASTERY_SKINS[towerType];
            const currentDamage = mastery.damageAccumulated[towerType] || 0;
            const equippedSkinId = mastery.equippedSkins[towerType];
            const maxMilestone = skins[skins.length - 1].requiredDamage;
            const overallPct = Math.min(100, Math.round((currentDamage / maxMilestone) * 100));
            const metricLabel =
              towerType === 'frost'
                ? 'Control Criogénico / Fusión Acumulado'
                : 'Daño Total Acumulado';

            return (
              <div
                key={towerType}
                className="rounded-xl border border-slate-800 bg-slate-900/75 p-4"
              >
                {/* Tower Mastery Header & Progress Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: towerSpec.color }}
                      />
                      <h3 className="font-display text-base font-bold text-white">
                        {towerSpec.name}
                      </h3>
                      <span className="text-xs text-slate-400">· {towerSpec.subtitle}</span>
                    </div>
                    <div className="text-xs font-mono-tabular text-slate-300 mt-1">
                      {metricLabel}:{' '}
                      <strong className="text-amber-300">
                        {currentDamage.toLocaleString('es-ES')}
                      </strong>{' '}
                      / {maxMilestone.toLocaleString('es-ES')} ({overallPct}%)
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onBoostMasteryDemo(towerType, 2500)}
                      className="px-3 py-1.5 rounded-lg border border-amber-400/70 bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Sumar +2.500 puntos de maestría para desbloquear y probar las skins 3D inmediatamente"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>+2.500 Hito (Probar Skins)</span>
                    </button>
                  </div>
                </div>

                {/* 4 Skin Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {skins.map((skin) => {
                    const isUnlocked = unlockedSet.has(skin.id);
                    const isEquipped = equippedSkinId === skin.id;
                    const progressRatio =
                      skin.requiredDamage <= 0
                        ? 100
                        : Math.min(
                            100,
                            Math.round((Math.min(currentDamage, skin.requiredDamage) / skin.requiredDamage) * 100)
                          );

                    return (
                      <div
                        key={skin.id}
                        className={`rounded-lg border p-3.5 flex flex-col justify-between transition-all ${
                          isEquipped
                            ? 'border-amber-400 bg-slate-900 shadow-lg'
                            : isUnlocked
                            ? 'border-slate-700 bg-slate-950/90 hover:border-slate-500'
                            : 'border-slate-800/80 bg-slate-950/55 opacity-85'
                        }`}
                      >
                        <div>
                          {/* Top Row: Tier Badge + Unlock Status */}
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-mono-tabular font-bold border"
                              style={{
                                borderColor: skin.badgeColor,
                                color: skin.badgeColor,
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              }}
                            >
                              {skin.tier === 0 ? 'BASE' : `MAESTRÍA NV.${skin.tier}`}
                            </span>
                            {isEquipped ? (
                              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                <span>EQUIPADA</span>
                              </span>
                            ) : isUnlocked ? (
                              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Desbloqueada</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono-tabular text-slate-400 flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                <span>{skin.requiredDamage.toLocaleString('es-ES')}</span>
                              </span>
                            )}
                          </div>

                          {/* Skin Title & Challenge Subtitle */}
                          <div
                            className="font-display font-bold text-sm mb-0.5"
                            style={{ color: isUnlocked ? skin.primaryGlow : '#e2e8f0' }}
                          >
                            {skin.name}
                          </div>
                          <div className="text-[11px] font-semibold text-amber-300/90 mb-2">
                            {skin.challengeTitle}
                          </div>

                          {/* Interactive 3D Silhouette & Regalia Preview Box */}
                          <div className="relative mb-2.5 rounded-lg border border-slate-800 bg-slate-950 p-2 flex items-center gap-2.5 overflow-hidden">
                            <svg
                              viewBox="0 0 88 88"
                              className="w-16 h-16 shrink-0 rounded border border-slate-800/90 bg-[#070b14]"
                              aria-hidden="true"
                            >
                              {/* Subtle Ground Halo (Tier 1+) */}
                              {skin.tier >= 1 && (
                                <ellipse
                                  cx="44"
                                  cy="74"
                                  rx="32"
                                  ry="7"
                                  fill="none"
                                  stroke={skin.primaryGlow}
                                  strokeWidth="2"
                                  strokeDasharray={skin.tier >= 2 ? '5 3' : undefined}
                                  opacity="0.75"
                                />
                              )}

                              {/* Tier 3 Sovereign Aura Pillar & Dual Astrolabe Rings */}
                              {skin.tier === 3 && (
                                <>
                                  <rect
                                    x="30"
                                    y="8"
                                    width="28"
                                    height="64"
                                    fill={skin.secondaryGlow}
                                    opacity="0.14"
                                  />
                                  <ellipse
                                    cx="44"
                                    cy="28"
                                    rx="28"
                                    ry="10"
                                    fill="none"
                                    stroke={skin.primaryGlow}
                                    strokeWidth="2"
                                    transform="rotate(-18 44 28)"
                                  />
                                  <ellipse
                                    cx="44"
                                    cy="28"
                                    rx="25"
                                    ry="9"
                                    fill="none"
                                    stroke={skin.secondaryGlow}
                                    strokeWidth="1.6"
                                    transform="rotate(22 44 28)"
                                  />
                                </>
                              )}

                              {/* Tier 1+ Corner Obelisk Pylons */}
                              {skin.tier >= 1 && (
                                <>
                                  <polygon
                                    points="14,72 19,44 24,72"
                                    fill={skin.stoneTint}
                                    stroke={skin.primaryGlow}
                                    strokeWidth="1.3"
                                  />
                                  <polygon
                                    points="64,72 69,44 74,72"
                                    fill={skin.stoneTint}
                                    stroke={skin.primaryGlow}
                                    strokeWidth="1.3"
                                  />
                                  <circle cx="19" cy="41" r="2.8" fill={skin.secondaryGlow} />
                                  <circle cx="69" cy="41" r="2.8" fill={skin.secondaryGlow} />
                                </>
                              )}

                              {/* Tier 2+ Sweeping Turret Wing-Blades */}
                              {skin.tier >= 2 && (
                                <>
                                  <polygon
                                    points="27,48 8,30 16,55"
                                    fill={skin.primaryGlow}
                                    stroke={skin.metalTint}
                                    strokeWidth="1.2"
                                  />
                                  <polygon
                                    points="61,48 80,30 72,55"
                                    fill={skin.primaryGlow}
                                    stroke={skin.metalTint}
                                    strokeWidth="1.2"
                                  />
                                </>
                              )}

                              {/* Main Tower Pedestal & Stone Armor Body */}
                              <polygon
                                points="24,74 30,42 58,42 64,74"
                                fill={skin.stoneTint}
                                stroke={skin.metalTint}
                                strokeWidth="2"
                              />
                              {/* Runic Armor Striping */}
                              <line
                                x1="32"
                                y1="56"
                                x2="56"
                                y2="56"
                                stroke={skin.primaryGlow}
                                strokeWidth="1.8"
                              />
                              <line
                                x1="29"
                                y1="66"
                                x2="59"
                                y2="66"
                                stroke={skin.metalTint}
                                strokeWidth="2"
                              />

                              {/* Core / Spire by Tower Type */}
                              {towerType === 'quartz' && (
                                <polygon
                                  points="44,12 33,38 44,44 55,38"
                                  fill={skin.primaryGlow}
                                  stroke={skin.secondaryGlow}
                                  strokeWidth="1.6"
                                />
                              )}
                              {towerType === 'frost' && (
                                <>
                                  <polygon
                                    points="44,11 35,40 53,40"
                                    fill={skin.primaryGlow}
                                    stroke={skin.secondaryGlow}
                                    strokeWidth="1.6"
                                  />
                                  <polygon
                                    points="28,24 34,42 40,36"
                                    fill={skin.secondaryGlow}
                                  />
                                  <polygon
                                    points="60,24 54,42 48,36"
                                    fill={skin.secondaryGlow}
                                  />
                                </>
                              )}
                              {towerType === 'magma' && (
                                <>
                                  <rect
                                    x="33"
                                    y="24"
                                    width="22"
                                    height="20"
                                    rx="3"
                                    fill={skin.metalTint}
                                    stroke={skin.primaryGlow}
                                    strokeWidth="1.8"
                                  />
                                  <circle
                                    cx="44"
                                    cy="24"
                                    r="7.5"
                                    fill={skin.secondaryGlow}
                                    stroke={skin.primaryGlow}
                                    strokeWidth="1.6"
                                  />
                                </>
                              )}
                            </svg>

                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-1">
                                Geometría 3D Activa:
                              </div>
                              <div className="text-[11px] font-bold text-slate-100 leading-tight mb-1.5">
                                {skin.tier === 0 && 'Armadura Rúnica Estándar'}
                                {skin.tier === 1 && '+4 Pilonos Obelisco + Halo Rúnico'}
                                {skin.tier === 2 && '+Alas de Cristal + Corona Orbital'}
                                {skin.tier === 3 && '+Astrolabio Doble + Pilar Soberano'}
                              </div>
                              {/* 4-Color 3D Material Palette Swatch Bar */}
                              <div className="flex items-center gap-1">
                                <span
                                  className="w-3.5 h-3.5 rounded-sm border border-white/25"
                                  style={{ backgroundColor: skin.stoneTint }}
                                  title="Tinte de Piedra / Armadura"
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-sm border border-white/25"
                                  style={{ backgroundColor: skin.metalTint }}
                                  title="Tinte Metálico / Bobinas"
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-sm border border-white/40"
                                  style={{ backgroundColor: skin.primaryGlow }}
                                  title="Energía Primaria / Cristales"
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-sm border border-white/40"
                                  style={{ backgroundColor: skin.secondaryGlow }}
                                  title="Núcleo / Haz Secundario"
                                />
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed mb-3">
                            {skin.description}
                          </p>
                        </div>

                        {/* Bottom Progress or Equip CTA */}
                        <div>
                          {!skin.isDefault && (
                            <div className="mb-2">
                              <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 mb-1">
                                <span>Progreso del Hito</span>
                                <span className={isUnlocked ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                                  {Math.min(currentDamage, skin.requiredDamage).toLocaleString('es-ES')} /{' '}
                                  {skin.requiredDamage.toLocaleString('es-ES')} ({progressRatio}%)
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className="h-full transition-all duration-300"
                                  style={{
                                    width: `${progressRatio}%`,
                                    backgroundColor: skin.primaryGlow,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <button
                            disabled={!isUnlocked || isEquipped}
                            onClick={() => onEquipSkin(towerType, skin.id)}
                            className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                              isEquipped
                                ? 'bg-amber-500/20 border border-amber-400 text-amber-300 cursor-default'
                                : isUnlocked
                                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer shadow-md'
                                : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {isEquipped ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Skin Activa en Partida</span>
                              </>
                            ) : isUnlocked ? (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Equipar Skin 3D</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Bloqueada (Faltan {(skin.requiredDamage - currentDamage).toLocaleString('es-ES')})</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
