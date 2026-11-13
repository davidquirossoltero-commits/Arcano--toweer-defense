import React, { useEffect, useRef, useState } from 'react';
import {
  ALL_TOWERS,
  BASE_TOWERS,
  BaseTowerType,
  GameHudState,
  MAX_TOWER_LEVEL,
  PLAYER_ABILITIES,
  PlayerAbilityId,
  TowerKind,
  TowerSpec,
  findSuperTowerRecipe,
  getAdjustedTowerCost,
  getBaseTowerForKind,
  getSkinSpecById,
  getTowerEffectiveDamage,
  getTowerEffectiveFireRate,
  getTowerEffectiveRange,
} from '../types/game';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowUpCircle,
  Trash2,
  Shield,
  Flame,
  Clock,
  Crosshair,
  Zap,
  Snowflake,
  Target,
  Crown,
  X,
} from 'lucide-react';

interface BottomControlDockProps {
  state: GameHudState;
  onSelectBuildTower: (type: BaseTowerType) => void;
  onTriggerAbility: (id: PlayerAbilityId) => void;
  onCancelTargeting: () => void;
  onUpgradeTower: () => void;
  onSellTower: () => void;
  onFuseTower: (neighborId: string) => void;
  onDirectAscendTower: (partnerType: BaseTowerType) => void;
  onOpenMastery: () => void;
  onCloseInspector: () => void;
  onToggleCollapse: () => void;
}

function getAttackTypeMeta(attackType: TowerSpec['attackType']): {
  label: string;
  accent: string;
} {
  switch (attackType) {
    case 'beam':
      return { label: 'Precisión (1 Objetivo)', accent: '#a855f7' };
    case 'nova':
      return { label: 'Control Criogénico (Sin Daño)', accent: '#22d3ee' };
    case 'mortar':
      return { label: 'Artillería (Único Daño AoE)', accent: '#f97316' };
    case 'hybrid_beam':
      return { label: 'Haz Criogénico (1 Objetivo)', accent: '#06b6d4' };
    case 'hybrid_artillery':
      return { label: 'Artillería Híbrida (AoE)', accent: '#f59e0b' };
  }
}

function getCompactSpecialAbilities(spec: TowerSpec): {
  label: string;
  color: string;
  icon: 'shred' | 'slow' | 'freeze' | 'burn' | 'splash' | 'chain';
}[] {
  const list: {
    label: string;
    color: string;
    icon: 'shred' | 'slow' | 'freeze' | 'burn' | 'splash' | 'chain';
  }[] = [];

  if (spec.freezeChance) {
    list.push({
      label: `Congela ${Math.round(spec.freezeChance * 100)}% (${spec.freezeDuration || 1.8}s)`,
      color: '#67e8f9',
      icon: 'freeze',
    });
  }
  if (spec.burnDps) {
    list.push({
      label: `Quema ${spec.burnDps} DPS (${spec.burnDuration || 3.5}s)`,
      color: '#fb923c',
      icon: 'burn',
    });
  }
  if (spec.slowFactor) {
    list.push({
      label: `Ralentiza ${Math.round(spec.slowFactor * 100)}% (${spec.slowDuration || 3.2}s)`,
      color: '#38bdf8',
      icon: 'slow',
    });
  }
  if (spec.armorShred) {
    list.push({
      label: `-${spec.armorShred} Armadura`,
      color: '#c084fc',
      icon: 'shred',
    });
  }
  if (spec.splashRadius) {
    list.push({
      label: `Explosión ${spec.splashRadius}m`,
      color: '#f97316',
      icon: 'splash',
    });
  }
  if (spec.chainCount) {
    list.push({
      label: `${spec.chainCount} Saltos`,
      color: '#c084fc',
      icon: 'chain',
    });
  }
  return list;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  state,
  onSelectBuildTower,
  onTriggerAbility,
  onCancelTargeting,
  onUpgradeTower,
  onSellTower,
  onFuseTower,
  onDirectAscendTower,
  onOpenMastery,
  onCloseInspector,
  onToggleCollapse,
}) => {
  const [hoveredTowerKind, setHoveredTowerKind] = useState<TowerKind | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  const showTowerTooltip = (kind: TowerKind) => {
    if (tooltipTimeoutRef.current !== null) {
      window.clearTimeout(tooltipTimeoutRef.current);
    }
    setHoveredTowerKind(kind);
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setHoveredTowerKind(null);
      tooltipTimeoutRef.current = null;
    }, 1000);
  };

  const hideTowerTooltip = () => {
    if (tooltipTimeoutRef.current !== null) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setHoveredTowerKind(null);
  };

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current !== null) {
        window.clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const selectedPlaced = state.selectedPlacedTower;
  const selectedSpec = selectedPlaced ? ALL_TOWERS[selectedPlaced.kind] : null;
  const upgradeCost =
    selectedPlaced && selectedSpec
      ? getAdjustedTowerCost(
          Math.round(selectedSpec.cost * 0.75 * selectedPlaced.level),
          state.difficulty
        )
      : 0;
  const sellRefund = selectedPlaced ? Math.round(selectedPlaced.totalInvested * 0.75) : 0;

  const directFusionOptions =
    selectedPlaced && selectedSpec && !selectedSpec.isSuper && state.fusionCandidates.length === 0
      ? (['quartz', 'frost', 'magma'] as BaseTowerType[])
          .filter((t) => t !== selectedPlaced.kind)
          .map((partnerKey) => {
            const match = findSuperTowerRecipe(selectedPlaced.kind, partnerKey)!;
            return {
              partnerKey,
              partnerName: BASE_TOWERS[partnerKey].name,
              resultSpec: match.spec,
              cost: getAdjustedTowerCost(match.spec.cost, state.difficulty),
            };
          })
      : [];

  const hoveredSpec = hoveredTowerKind ? ALL_TOWERS[hoveredTowerKind] : null;
  const hoveredCost = hoveredSpec ? getAdjustedTowerCost(hoveredSpec.cost, state.difficulty) : 0;
  const hoveredAttackMeta = hoveredSpec ? getAttackTypeMeta(hoveredSpec.attackType) : null;
  const hoveredSpecialAbilities = hoveredSpec ? getCompactSpecialAbilities(hoveredSpec) : [];
  const hoveredDps = hoveredSpec ? Math.round(hoveredSpec.damage * hoveredSpec.fireRate) : 0;

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-full px-3"
      style={{ maxWidth: 'min(1180px, 98vw)' }}
    >
      {/* Compact 1-Second Auto-Dismiss Hover Tooltip */}
      {!state.dockCollapsed && hoveredSpec && hoveredAttackMeta && (
        <div className="flex justify-center mb-1.5">
          <div
            role="tooltip"
            className="w-fit max-w-md rounded-lg border px-3 py-1.5 shadow-xl text-[11px]"
            style={{
              backgroundColor: 'rgba(11, 15, 25, 0.96)',
              borderColor: hoveredSpec.color,
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: hoveredSpec.color }}
              />
              <span className="font-display font-bold text-xs text-white">
                {hoveredSpec.name}
              </span>
              <span
                className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-semibold"
                style={{ color: hoveredAttackMeta.accent }}
              >
                {hoveredAttackMeta.label}
              </span>
              <span className="font-mono-tabular font-bold text-amber-300">
                {hoveredCost} Oro
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 mt-1 pt-1 border-t border-slate-800 font-mono-tabular text-slate-200">
              {hoveredSpec.damage > 0 ? (
                <span className="flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <strong>{hoveredSpec.damage}</strong> ({hoveredDps} DPS)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-cyan-300 font-bold">
                  <Snowflake className="w-3 h-3 text-cyan-400" />
                  <span>0 Daño (Control Puro)</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-emerald-300">
                <Target className="w-3 h-3 text-emerald-400" />
                <strong>{hoveredSpec.range.toFixed(1)}m</strong>
              </span>
              <span className="flex items-center gap-1 text-purple-300">
                <Clock className="w-3 h-3 text-purple-400" />
                <strong>{hoveredSpec.fireRate}/s</strong>
              </span>
              {hoveredSpecialAbilities.map((ab) => (
                <span
                  key={ab.label}
                  className="inline-flex items-center gap-1 font-sans font-semibold"
                  style={{ color: ab.color }}
                >
                  {ab.icon === 'shred' && <Crosshair className="w-3 h-3 shrink-0" />}
                  {ab.icon === 'freeze' && <Snowflake className="w-3 h-3 shrink-0" />}
                  {ab.icon === 'burn' && <Flame className="w-3 h-3 shrink-0" />}
                  {ab.icon === 'slow' && <Clock className="w-3 h-3 shrink-0" />}
                  {ab.icon === 'splash' && <Flame className="w-3 h-3 shrink-0" />}
                  {ab.icon === 'chain' && <Zap className="w-3 h-3 shrink-0" />}
                  <span>{ab.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Collapse / Expand Tab */}
      <div className="flex justify-center mb-1">
        <button
          onClick={onToggleCollapse}
          className="pointer-events-auto px-4 py-1.5 rounded-t-lg border border-b-0 border-slate-600 text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.96)' }}
        >
          {state.dockCollapsed ? (
            <>
              <ChevronUp className="w-4 h-4 text-sky-400" />
              <span className="text-white">Mostrar Controles (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 text-sky-400" />
              <span className="text-white">Ocultar Controles (H)</span>
            </>
          )}
        </button>
      </div>

      {!state.dockCollapsed && (
        <div
          className="pointer-events-auto rounded-xl border border-slate-600 p-3.5 shadow-2xl"
          style={{ backgroundColor: 'rgba(11, 15, 25, 0.96)' }}
        >
          {/* Active Ability Targeting Banner */}
          {state.activeAbilityTargeting && (
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-3.5 py-2.5 rounded-lg bg-emerald-950 border-2 border-emerald-400 text-xs text-white">
              <div>
                <span className="font-bold text-emerald-300">
                  Modo de Apuntamiento: {PLAYER_ABILITIES[state.activeAbilityTargeting].name}
                </span>
                <span className="ml-2 text-white">
                  — Haz clic en cualquier punto del camino 3D para desplegar la habilidad.
                </span>
              </div>
              <button
                onClick={onCancelTargeting}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Cancelar (Esc)</span>
              </button>
            </div>
          )}

          {/* Contextual Selected Tower Inspector & Supertower Fusion Panel */}
          {selectedPlaced && selectedSpec && (
            <div className="mb-3 pb-3 border-b border-slate-700 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/95 p-3 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor: selectedSpec.color,
                    backgroundColor: '#0f172a',
                  }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: selectedSpec.color }} />
                </div>
                <div className="min-w-[240px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-sm text-white">
                      {selectedSpec.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500/70 text-xs font-mono-tabular font-bold text-sky-300">
                      Nivel {selectedPlaced.level}/{MAX_TOWER_LEVEL}
                    </span>
                    {selectedSpec.isSuper && (
                      <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-400 text-xs font-bold text-amber-300">
                        ★ Supertorre Activa
                      </span>
                    )}
                    {(() => {
                      const baseType = getBaseTowerForKind(selectedPlaced.kind);
                      const skinId = state.towerMastery.equippedSkins[baseType];
                      const skinSpec = getSkinSpecById(skinId);
                      return (
                        <span
                          className="px-2 py-0.5 rounded border text-[11px] font-bold flex items-center gap-1"
                          style={{
                            borderColor: `${skinSpec.badgeColor}88`,
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            color: skinSpec.badgeColor,
                          }}
                        >
                          <Crown className="w-3 h-3" />
                          <span>Skin: {skinSpec.name}</span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-slate-200 font-mono-tabular mt-0.5">
                    {selectedSpec.damage > 0 ? (
                      <>
                        Daño: <strong>{getTowerEffectiveDamage(selectedSpec, selectedPlaced.level)}</strong>
                      </>
                    ) : (
                      <span className="text-cyan-300 font-bold">
                        Control Puro (0 Daño · Ralentiza 45% / Congela 36%)
                      </span>
                    )}{' '}
                    · Alcance:{' '}
                    <strong className="text-emerald-300">
                      {getTowerEffectiveRange(selectedSpec, selectedPlaced.level).toFixed(1)}m
                    </strong>{' '}
                    · Cadencia:{' '}
                    <strong className="text-purple-300">
                      {getTowerEffectiveFireRate(selectedSpec, selectedPlaced.level)}/s
                    </strong>
                    {selectedSpec.damage > 0 && (
                      <>
                        {' '}
                        · Bajas: <strong className="text-amber-300">{selectedPlaced.kills}</strong>
                      </>
                    )}
                  </div>
                  {/* Tower Individual Experience Progress Bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                      <div
                        className="h-full transition-all duration-200"
                        style={{
                          width: `${
                            selectedPlaced.level >= MAX_TOWER_LEVEL
                              ? 100
                              : Math.max(
                                  4,
                                  Math.min(
                                    100,
                                    Math.round(
                                      (selectedPlaced.xp / Math.max(1, selectedPlaced.maxXp)) * 100
                                    )
                                  )
                                )
                          }%`,
                          backgroundColor:
                            selectedPlaced.level >= MAX_TOWER_LEVEL
                              ? '#fbbf24'
                              : selectedSpec.color,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono-tabular font-bold text-amber-300 whitespace-nowrap">
                      {selectedPlaced.level >= MAX_TOWER_LEVEL
                        ? 'XP MÁX.'
                        : `XP ${selectedPlaced.xp}/${selectedPlaced.maxXp}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tower Action Buttons: Fusion + Upgrade + Skins + Sell */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Fusion with another placed tower */}
                {state.fusionCandidates.map((cand) => {
                  const canAffordFusion = state.gold >= cand.fusionCost;
                  const neighborSpec = ALL_TOWERS[cand.neighborTower.kind];
                  return (
                    <button
                      key={cand.neighborTower.id}
                      onClick={() => onFuseTower(cand.neighborTower.id)}
                      onMouseEnter={() => showTowerTooltip(cand.resultSpec.id)}
                      onMouseLeave={hideTowerTooltip}
                      onFocus={() => showTowerTooltip(cand.resultSpec.id)}
                      onBlur={hideTowerTooltip}
                      className={`px-3.5 py-2 rounded-lg border-2 text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                        canAffordFusion
                          ? 'border-amber-200 bg-amber-400 hover:bg-amber-300 text-slate-950'
                          : 'border-amber-500/80 bg-amber-950/90 hover:bg-amber-900 text-amber-100'
                      }`}
                    >
                      <Sparkles
                        className={`w-4 h-4 shrink-0 ${
                          canAffordFusion ? 'text-slate-950' : 'text-amber-300'
                        }`}
                      />
                      <span>
                        Fusionar con {neighborSpec.name} → {cand.resultSpec.name} ({cand.fusionCost} Oro)
                      </span>
                    </button>
                  );
                })}

                {/* 2. Direct Fusion if only 1 tower is placed on the map */}
                {directFusionOptions.map((opt) => {
                  const canAfford = state.gold >= opt.cost;
                  return (
                    <button
                      key={opt.partnerKey}
                      onClick={() => onDirectAscendTower(opt.partnerKey)}
                      onMouseEnter={() => showTowerTooltip(opt.resultSpec.id)}
                      onMouseLeave={hideTowerTooltip}
                      onFocus={() => showTowerTooltip(opt.resultSpec.id)}
                      onBlur={hideTowerTooltip}
                      className={`px-3.5 py-2 rounded-lg border-2 text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                        canAfford
                          ? 'border-amber-200 bg-amber-400 hover:bg-amber-300 text-slate-950'
                          : 'border-amber-500/80 bg-amber-950/90 hover:bg-amber-900 text-amber-100'
                      }`}
                    >
                      <Sparkles
                        className={`w-4 h-4 shrink-0 ${
                          canAfford ? 'text-slate-950' : 'text-amber-300'
                        }`}
                      />
                      <span>
                        Fusionar → {opt.resultSpec.name} ({opt.cost} Oro)
                      </span>
                    </button>
                  );
                })}

                {/* 3. Upgrade Level Button */}
                {selectedPlaced.level < MAX_TOWER_LEVEL && (
                  <button
                    onClick={onUpgradeTower}
                    className={`px-3.5 py-2 rounded-lg border-2 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                      state.gold >= upgradeCost
                        ? 'border-sky-200 bg-sky-400 hover:bg-sky-300 text-slate-950'
                        : 'border-sky-500/80 bg-sky-950/90 hover:bg-sky-900 text-sky-100'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4 shrink-0" />
                    <span>Mejorar Nv.{selectedPlaced.level + 1} ({upgradeCost} Oro)</span>
                  </button>
                )}

                {/* 4. Mastery & Skins Button */}
                <button
                  onClick={onOpenMastery}
                  className="px-3 py-2 rounded-lg border border-purple-400/80 bg-purple-950/90 hover:bg-purple-900 text-purple-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  title="Cambiar Skin 3D y ver Retos de Maestría de esta torre"
                >
                  <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Skins / Maestría</span>
                </button>

                {/* 5. Sell Button */}
                <button
                  onClick={onSellTower}
                  className="px-3.5 py-2 rounded-lg border border-rose-400 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Vender (+{sellRefund} Oro)</span>
                </button>

                <button
                  onClick={onCloseInspector}
                  className="px-2.5 py-2 rounded-lg border border-slate-500 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Cerrar inspector"
                >
                  <X className="w-4 h-4" />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Dock Row: 3 Base Towers + 3 Active Player Abilities */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Left 7 Cols: 3 Base Towers (Hover triggers compact 1s auto-dismiss Tooltip) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(BASE_TOWERS) as BaseTowerType[]).map((tKey) => {
                const spec = BASE_TOWERS[tKey];
                const adjustedCost = getAdjustedTowerCost(spec.cost, state.difficulty);
                const isSelected = state.selectedBuildTower === tKey && !state.selectedPlacedTower;
                const isHovered = hoveredTowerKind === tKey;
                const canAfford = state.gold >= adjustedCost;
                const equippedSkin = getSkinSpecById(state.towerMastery.equippedSkins[tKey]);

                return (
                  <button
                    key={spec.id}
                    onClick={() => onSelectBuildTower(tKey)}
                    onMouseEnter={() => showTowerTooltip(tKey)}
                    onMouseLeave={hideTowerTooltip}
                    onFocus={() => showTowerTooltip(tKey)}
                    onBlur={hideTowerTooltip}
                    className={`p-2.5 rounded-lg border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected || isHovered
                        ? 'border-sky-400 bg-slate-800 shadow-lg'
                        : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-xs font-extrabold text-white leading-snug">
                          {spec.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-600 text-[11px] font-mono-tabular font-bold text-sky-300 shrink-0">
                          {spec.hotkey}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-200 leading-tight mb-1">
                        {spec.subtitle}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-300 mb-1.5">
                        {spec.damage > 0 ? (
                          <span>
                            Daño <strong>{spec.damage}</strong> · {spec.range}m
                          </span>
                        ) : (
                          <span className="text-cyan-300 font-semibold">
                            0 Daño (Ralentiza/Congela) · {spec.range}m
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between font-mono-tabular text-xs pt-1.5 border-t border-slate-700/80 gap-1">
                      <span
                        className={`px-2 py-0.5 rounded font-bold shrink-0 ${
                          canAfford
                            ? 'bg-amber-500/20 border border-amber-400/70 text-amber-300'
                            : 'bg-rose-950/90 border border-rose-500/70 text-rose-200'
                        }`}
                      >
                        {adjustedCost} Oro
                      </span>
                      <span
                        className="text-[10px] font-sans font-bold truncate px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 flex items-center gap-1"
                        style={{ color: equippedSkin.badgeColor }}
                        title={`Skin Equipada: ${equippedSkin.name}`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: equippedSkin.badgeColor }}
                        />
                        <span className="truncate">{equippedSkin.name}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right 5 Cols: Player Special Abilities */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(PLAYER_ABILITIES) as PlayerAbilityId[]).map((abId) => {
                const ab = PLAYER_ABILITIES[abId];
                const cd = state.abilityCooldowns[abId];
                const hasMana = state.mana >= ab.manaCost;
                const isTargeting = state.activeAbilityTargeting === abId;
                const isReady = cd <= 0 && hasMana;

                return (
                  <button
                    key={ab.id}
                    onClick={() => onTriggerAbility(abId)}
                    className={`p-2.5 rounded-lg border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isTargeting
                        ? 'border-emerald-400 bg-emerald-950 shadow-lg'
                        : isReady
                        ? 'border-slate-600 bg-slate-900 hover:border-sky-400 hover:bg-slate-800'
                        : 'border-slate-700 bg-slate-900/95'
                    }`}
                    title={ab.description}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-xs font-extrabold text-white leading-snug flex items-center gap-1.5">
                          {abId === 'summon_golem' && <Shield className="w-4 h-4 text-emerald-400 shrink-0" />}
                          {abId === 'astral_meteor' && <Flame className="w-4 h-4 text-amber-400 shrink-0" />}
                          {abId === 'stasis_pulse' && <Clock className="w-4 h-4 text-sky-400 shrink-0" />}
                          <span>{ab.name}</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-600 text-[11px] font-mono-tabular font-bold text-amber-300 shrink-0">
                          {ab.hotkey}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-200 leading-tight mb-2">
                        {ab.subtitle}
                      </div>
                    </div>

                    <div className="flex items-center justify-between font-mono-tabular text-xs pt-1.5 border-t border-slate-700/80">
                      <span
                        className={`font-bold ${
                          hasMana ? 'text-sky-300' : 'text-rose-300'
                        }`}
                      >
                        {ab.manaCost} Maná
                      </span>
                      {cd > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/70 text-amber-300 font-bold">
                          {cd.toFixed(1)}s
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/70 text-emerald-300 font-bold">
                          Listo
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



