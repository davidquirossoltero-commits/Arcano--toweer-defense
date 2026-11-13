import React from 'react';
import {
  AudioTrackState,
  BASE_TOWERS,
  GameHudState,
  MAPS,
  SUPER_TOWERS,
  getAdjustedTowerCost,
} from '../types/game';
import {
  Play,
  RotateCcw,
  Home,
  Sparkles,
  Trophy,
  Skull,
  X,
  Volume2,
  VolumeX,
  Music,
  Sliders,
} from 'lucide-react';

interface GameStatusModalProps {
  state: GameHudState;
  codexOpen: boolean;
  optionsOpen: boolean;
  onCloseCodex: () => void;
  onCloseOptions: () => void;
  onResume: () => void;
  onRestart: () => void;
  onNextMap: (nextMapId: string) => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
  onChangeMasterVolume: (vol: number) => void;
  onChangeMusicVolume: (vol: number) => void;
  onChangeSfxVolume: (vol: number) => void;
  onPreviewMusicState: (trackState: AudioTrackState) => void;
  onTestAudio?: () => void;
}

const MUSIC_STATE_META: Record<
  AudioTrackState,
  { label: string; subtitle: string; color: string }
> = {
  exploration: {
    label: 'Exploración',
    subtitle: 'Arpa cristalina y pad astral D Dórico',
    color: '#38bdf8',
  },
  combat: {
    label: 'Combate Activo',
    subtitle: 'Ostinato rítmico y percusión táctica',
    color: '#f59e0b',
  },
  boss_combat: {
    label: 'Combate de Jefe',
    subtitle: 'Tempo acelerado y metales graves',
    color: '#ef4444',
  },
};

export const GameStatusModal: React.FC<GameStatusModalProps> = ({
  state,
  codexOpen,
  optionsOpen,
  onCloseCodex,
  onCloseOptions,
  onResume,
  onRestart,
  onNextMap,
  onReturnTitle,
  onToggleMute,
  onChangeMasterVolume,
  onChangeMusicVolume,
  onChangeSfxVolume,
  onPreviewMusicState,
  onTestAudio,
}) => {
  // 1. Supertower Fusion Codex Modal
  if (codexOpen) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
        <div
          className="w-full max-w-3xl rounded-xl border border-slate-700 p-6 shadow-2xl max-h-[88vh] overflow-y-auto"
          style={{ backgroundColor: '#0b0f19' }}
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="font-display text-xl font-bold text-slate-100">
                Códice de Fusión de Supertorres Arcanas
              </h2>
            </div>
            <button
              onClick={onCloseCodex}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs md:text-sm text-slate-300 mb-4 leading-relaxed">
            Coloca dos torres base en celdas cercanas o usa la fusión directa para ascenderlas a una{' '}
            <strong className="text-amber-300">Supertorre Híbrida</strong>. Solo el{' '}
            <strong className="text-orange-400">Mortero de Magma</strong> y sus fusiones poseen daño en área (AoE).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.values(SUPER_TOWERS).map((superSpec) => {
              const [a, b] = superSpec.recipe!;
              const towerA = BASE_TOWERS[a];
              const towerB = BASE_TOWERS[b];
              const adjustedFusionCost = getAdjustedTowerCost(superSpec.cost, state.difficulty);
              const hasSplash = Boolean(superSpec.splashRadius && superSpec.splashRadius > 0);
              return (
                <div
                  key={superSpec.id}
                  className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/90 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className="font-display font-bold text-sm"
                        style={{ color: superSpec.color }}
                      >
                        {superSpec.name}
                      </span>
                      <span className="font-mono-tabular text-xs font-bold text-amber-400">
                        {adjustedFusionCost} Oro
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300 mb-2">
                      <span>
                        {towerA.name} + {towerB.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-bold border ${
                          hasSplash
                            ? 'border-orange-500/70 bg-orange-950/70 text-orange-300'
                            : 'border-sky-500/70 bg-sky-950/70 text-sky-300'
                        }`}
                      >
                        {hasSplash ? `AoE ${superSpec.splashRadius}m` : '1 Objetivo'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">
                      {superSpec.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono-tabular text-slate-300 pt-2 border-t border-slate-800">
                    <span>Daño: {superSpec.damage}</span>
                    <span>·</span>
                    <span>Alcance: {superSpec.range}m</span>
                    <span>·</span>
                    <span>Cadencia: {superSpec.fireRate}/s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const showModal =
    optionsOpen ||
    state.phase === 'paused' ||
    state.phase === 'victory' ||
    state.phase === 'gameover';

  if (!showModal) {
    return null;
  }

  const mapIdx = MAPS.findIndex((m) => m.id === state.mapId);
  const currentMap = MAPS[mapIdx >= 0 ? mapIdx : 0];
  const nextMap = MAPS[(mapIdx + 1) % MAPS.length];
  const currentMusicMeta = MUSIC_STATE_META[state.musicState];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div
        className="w-full max-w-lg rounded-xl border border-slate-700 p-5 sm:p-6 text-center shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: '#0b0f19' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-7" />
          <div className="flex justify-center">
            {state.phase === 'victory' && !optionsOpen && (
              <Trophy className="w-10 h-10 text-amber-400" />
            )}
            {state.phase === 'gameover' && !optionsOpen && (
              <Skull className="w-10 h-10 text-rose-500" />
            )}
            {(state.phase === 'paused' || optionsOpen) && (
              <Sliders className="w-10 h-10 text-sky-400" />
            )}
          </div>
          {optionsOpen ? (
            <button
              onClick={onCloseOptions}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Cerrar menú de opciones"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-7" />
          )}
        </div>

        <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-100 mb-1.5">
          {optionsOpen && state.phase === 'title'
            ? 'Configuración de Audio y Sonido'
            : state.phase === 'victory' && !optionsOpen
            ? `¡Capítulo ${currentMap.chapter} Completado!`
            : state.phase === 'gameover' && !optionsOpen
            ? '¡El Castillo Ha Sido Invadido!'
            : 'Partida en Pausa · Opciones y Audio'}
        </h2>

        <p className="text-xs sm:text-sm text-slate-300 mb-4">
          {state.phase === 'victory' && !optionsOpen
            ? currentMap.epilogueText
            : state.phase === 'gameover' && !optionsOpen
            ? 'Un invasor logró cruzar el portal del Castillo del Vacío Rúnico (Muerte Súbita). Combina la Fragilidad Criogénica del Pilar de Escarcha con tus torres de daño y vuelve a intentarlo.'
            : state.phase === 'title'
            ? 'Ajusta el volumen general, música atmosférica y efectos de sonido o pulsa "Probar Sonido" para verificar el sintetizador Web Audio.'
            : 'La simulación se encuentra pausada mientras este menú está abierto. Ajusta el sonido o reanuda la defensa cuando estés listo.'}
        </p>

        {/* Global Audio & Dynamic Music Settings Panel */}
        <div className="text-left mb-5 p-3.5 rounded-xl bg-slate-900/95 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="font-display text-xs sm:text-sm font-bold text-white">
                Gestor de Audio Global y Música Dinámica
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {onTestAudio && (
                <button
                  onClick={onTestAudio}
                  className="px-2.5 py-1 rounded-lg border border-sky-400/80 bg-sky-950/90 hover:bg-sky-900 text-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Desbloquear y reproducir acorde de prueba de sonido y música"
                >
                  <Volume2 className="w-3.5 h-3.5 text-sky-300" />
                  <span>Probar Sonido</span>
                </button>
              )}
              <button
                onClick={onToggleMute}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  state.isMuted
                    ? 'border-rose-500/80 bg-rose-950 text-rose-200'
                    : 'border-emerald-500/70 bg-emerald-950/80 text-emerald-300'
                }`}
              >
                {state.isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Silenciado</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Audio Activo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3 Volume Sliders: Master, Music, SFX */}
          <div className="space-y-2.5 font-mono-tabular text-xs mb-3.5">
            <div>
              <div className="flex items-center justify-between text-slate-200 mb-1">
                <span className="font-sans font-semibold">Volumen General (Master)</span>
                <span className="font-bold text-sky-300">
                  {state.isMuted ? '0%' : `${Math.round(state.masterVolume * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.isMuted ? 0 : state.masterVolume}
                onChange={(e) => onChangeMasterVolume(parseFloat(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-slate-200 mb-1">
                <span className="font-sans font-semibold">
                  Música Atmosférica (Exploración / Combate)
                </span>
                <span className="font-bold text-amber-300">
                  {Math.round(state.musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.musicVolume}
                onChange={(e) => onChangeMusicVolume(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-slate-200 mb-1">
                <span className="font-sans font-semibold">Efectos de Sonido (SFX Combate)</span>
                <span className="font-bold text-emerald-300">
                  {Math.round(state.sfxVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.sfxVolume}
                onChange={(e) => onChangeSfxVolume(parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Dynamic Music State Indicator & Interactive Crossfade Tester */}
          <div className="pt-2.5 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5">
              <span>Estado Musical Dinámico Actual:</span>
              <span
                className="font-bold"
                style={{ color: currentMusicMeta.color }}
              >
                {currentMusicMeta.label} ({currentMusicMeta.subtitle})
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['exploration', 'combat', 'boss_combat'] as AudioTrackState[]).map((trackKey) => {
                const meta = MUSIC_STATE_META[trackKey];
                const isActive = state.musicState === trackKey;
                return (
                  <button
                    key={trackKey}
                    onClick={() => onPreviewMusicState(trackKey)}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800/70'
                    }`}
                    style={{
                      borderColor: isActive ? meta.color : undefined,
                      color: isActive ? meta.color : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Match Telemetry (when in match) */}
        {state.phase !== 'title' && (
          <div className="grid grid-cols-3 gap-2 mb-5 p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono-tabular text-xs">
            <div>
              <div className="text-slate-400">Oleadas</div>
              <div className="text-base font-bold text-slate-100">
                {state.wave}/{state.totalWaves}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Supertorres</div>
              <div className="text-base font-bold text-amber-400">{state.superTowersBuilt}</div>
            </div>
            <div>
              <div className="text-slate-400">Bajas</div>
              <div className="text-base font-bold text-sky-400">{state.totalKills}</div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {optionsOpen && state.phase === 'title' ? (
            <button
              onClick={onCloseOptions}
              className="w-full py-2.5 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Guardar y Volver al Santuario</span>
            </button>
          ) : (
            <>
              {(state.phase === 'paused' || optionsOpen) && (
                <button
                  onClick={() => {
                    onCloseOptions();
                    if (state.phase === 'paused') onResume();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Reanudar Defensa (Esc)</span>
                </button>
              )}

              {state.phase === 'victory' && (
                <button
                  onClick={() => onNextMap(nextMap.id)}
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Siguiente Mapa: {nextMap.name}</span>
                </button>
              )}

              <button
                onClick={() => {
                  onCloseOptions();
                  onRestart();
                }}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reiniciar Santuario</span>
              </button>

              <button
                onClick={() => {
                  onCloseOptions();
                  onReturnTitle();
                }}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Volver a Selección de Mapa</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
