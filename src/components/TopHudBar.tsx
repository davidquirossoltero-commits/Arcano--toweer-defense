import React from 'react';
import {
  ACHIEVEMENTS,
  DIFFICULTY_ORDER,
  DIFFICULTY_SPECS,
  DifficultyLevel,
  GameHudState,
  MAPS,
  WEATHER_SPECS,
} from '../types/game';
import {
  Play,
  Pause,
  FastForward,
  Volume2,
  VolumeX,
  RotateCcw,
  BookOpen,
  ShieldAlert,
  Sparkles,
  Trophy,
  CloudSnow,
  Music,
  Sliders,
  Video,
  Crown,
} from 'lucide-react';

interface TopHudBarProps {
  state: GameHudState;
  vfxPanelOpen: boolean;
  onStartWave: () => void;
  onChangeDifficulty: (difficulty: DifficultyLevel) => void;
  onCycleWeather: () => void;
  onToggleSpeed: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onResetCamera: () => void;
  onToggleCinematicCamera: () => void;
  onOpenStory: () => void;
  onOpenCodex: () => void;
  onOpenMastery: () => void;
  onOpenAchievements: () => void;
  onToggleVfxPanel: () => void;
  onOpenOptions: () => void;
}

export const TopHudBar: React.FC<TopHudBarProps> = ({
  state,
  vfxPanelOpen,
  onStartWave,
  onChangeDifficulty,
  onCycleWeather,
  onToggleSpeed,
  onTogglePause,
  onToggleMute,
  onResetCamera,
  onToggleCinematicCamera,
  onOpenStory,
  onOpenCodex,
  onOpenMastery,
  onOpenAchievements,
  onToggleVfxPanel,
  onOpenOptions,
}) => {
  const currentMap = MAPS.find((m) => m.id === state.mapId) || MAPS[0];
  const currentWeather = WEATHER_SPECS[state.weather];

  return (
    <div className="fixed top-0 left-0 right-0 z-10 pointer-events-none flex flex-col items-center px-4 pt-3 gap-2">
      {/* Main Perimeter Status Cluster */}
      <div
        className="pointer-events-auto w-full max-w-6xl rounded-xl border border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xl"
        style={{ backgroundColor: 'rgba(11, 15, 25, 0.92)' }}
      >
        {/* Left: Brand, Chapter & Map Name, Segmented Difficulty & Dynamic Weather Button */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/"
            className="px-2.5 py-1 rounded-lg border border-sky-500/50 bg-sky-950/70 hover:bg-sky-900/90 text-sky-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm mr-1"
            title="Volver al portal de juegos"
          >
            ← Volver a Juegos
          </a>
          <span className="font-display text-sm md:text-base font-bold tracking-wider text-sky-400 whitespace-nowrap">
            AEGIS ARCANA
          </span>
          <span className="text-slate-600">·</span>
          <button
            onClick={onOpenStory}
            className="px-2 py-0.5 rounded border border-amber-400/50 bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            title={`${currentMap.chapterTitle} — Haz clic para abrir las Crónicas de la Historia`}
          >
            <BookOpen className="w-3 h-3 text-amber-400" />
            <span>
              Cap. {currentMap.chapter}: {currentMap.name}
            </span>
          </button>

          {/* Segmented Difficulty Switcher (Fácil / Normal / Arcana) */}
          <div
            className="flex items-center rounded-lg border border-slate-600 bg-slate-900 p-0.5 ml-1"
            title="Cambiar dificultad (ajusta el multiplicador de salud enemiga y el costo de las torres)"
          >
            {DIFFICULTY_ORDER.map((diffKey) => {
              const spec = DIFFICULTY_SPECS[diffKey];
              const active = state.difficulty === diffKey;
              return (
                <button
                  key={spec.id}
                  onClick={() => onChangeDifficulty(diffKey)}
                  className={`px-2 py-0.5 rounded text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-slate-800 text-white border border-slate-500 shadow-sm'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800/60'
                  }`}
                  style={{
                    borderColor: active ? spec.accentColor : undefined,
                    color: active ? spec.accentColor : undefined,
                  }}
                  title={`${spec.label}: ${Math.round(spec.enemyHpMultiplier * 100)}% Salud Enemiga · ${Math.round(spec.towerCostMultiplier * 100)}% Costo Torres`}
                >
                  {spec.label}
                </button>
              );
            })}
          </div>

          {/* Dynamic Weather Cycler Button */}
          <button
            onClick={onCycleWeather}
            className="px-2.5 py-1 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            style={{ borderColor: currentWeather.accentColor }}
            title={`Clima Dinámico: ${currentWeather.label} (${currentWeather.description}) — Haz clic para cambiar el clima`}
          >
            <CloudSnow className="w-3.5 h-3.5 shrink-0" style={{ color: currentWeather.accentColor }} />
            <span style={{ color: currentWeather.accentColor }}>{currentWeather.label}</span>
          </button>
        </div>

        {/* Center: World-Matched Resource Readouts (Tabular Numerals) */}
        <div className="flex items-center gap-4 font-mono-tabular text-xs md:text-sm">
          {/* Castle Integrity (Sudden-Death: 1/1) */}
          <div
            className="flex items-center gap-1.5"
            title="Integridad del Castillo (Muerte Súbita: si un solo enemigo llega al Castillo, termina la partida)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path
                d="M12 2L19 9L12 22L5 9L12 2Z"
                fill="#c084fc"
                stroke="#f3e8ff"
                strokeWidth="1.5"
              />
            </svg>
            <span className="text-slate-200">Castillo:</span>
            <span className="font-bold text-purple-300">
              {state.lives}/{state.maxLives}
            </span>
          </div>

          {/* Gold */}
          <div className="flex items-center gap-1.5" title="Oro Rúnico para construir y fusionar torres">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <circle cx="12" cy="12" r="9" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
              <polygon points="12,7 15,12 12,17 9,12" fill="#78350f" />
            </svg>
            <span className="text-slate-200">Oro:</span>
            <span className="font-bold text-amber-400">{state.gold}</span>
          </div>

          {/* Arcane Essence (Mana) */}
          <div className="flex items-center gap-1.5" title="Esencia Arcana para invocar Gólems y habilidades">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <polygon
                points="12,2 20,12 12,22 4,12"
                fill="#38bdf8"
                stroke="#e0f2fe"
                strokeWidth="1.5"
              />
            </svg>
            <span className="text-slate-200">Maná:</span>
            <span className="font-bold text-sky-400">
              {state.mana}/{state.maxMana}
            </span>
          </div>

          {/* Wave Counter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-200">Oleada:</span>
            <span className="font-bold text-white">
              {state.wave}/{state.totalWaves}
            </span>
            {state.waveInProgress && (
              <span className="text-xs text-rose-400 font-bold ml-1">
                ({state.enemiesRemaining} rest.)
              </span>
            )}
            {!state.waveInProgress && state.nextWaveCountdown !== null && state.wave < state.totalWaves && (
              <span className="text-xs text-amber-300 font-bold ml-1">
                (en {state.nextWaveCountdown.toFixed(1)}s)
              </span>
            )}
          </div>
        </div>

        {/* Right: Wave Trigger & Utility Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {!state.waveInProgress && state.wave < state.totalWaves && (
            <button
              onClick={onStartWave}
              className="px-3.5 py-1.5 rounded-lg border-2 border-amber-200 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md"
              title="Las oleadas avanzan automáticamente tras 7 segundos de preparación; haz clic para adelantarla ahora"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {state.nextWaveCountdown !== null
                  ? `Oleada ${state.wave + 1} en ${state.nextWaveCountdown.toFixed(1)}s`
                  : `Lanzar Oleada ${state.wave + 1}`}
              </span>
            </button>
          )}

          <button
            onClick={onOpenCodex}
            className="px-2.5 py-1.5 rounded-lg border border-amber-500/70 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Recetas de Fusión de Supertorres"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Fusiones</span>
          </button>

          <button
            onClick={onOpenMastery}
            className="px-2.5 py-1.5 rounded-lg border border-purple-400/80 bg-purple-950/80 hover:bg-purple-900 text-xs font-bold text-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Retos de Maestría y Skins Cosméticas 3D por daño acumulado"
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>Skins ({state.towerMastery.unlockedSkins.length}/12)</span>
          </button>

          <button
            onClick={onOpenAchievements}
            className="px-2.5 py-1.5 rounded-lg border border-emerald-500/70 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Ver Registro de Logros (Golems invocados, Supertorres creadas y Jefes derrotados)"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Logros ({state.unlockedAchievements.length}/{ACHIEVEMENTS.length})</span>
          </button>

          <button
            onClick={onToggleVfxPanel}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              vfxPanelOpen
                ? 'border-sky-300 bg-sky-500 text-slate-950'
                : 'border-sky-500/70 bg-slate-800 hover:bg-slate-700 text-sky-200'
            }`}
            title="Abrir controlador del Sistema de Partículas 3D"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>VFX</span>
          </button>

          <button
            onClick={onToggleSpeed}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono-tabular font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              state.gameSpeed === 2
                ? 'border-sky-300 bg-sky-500 text-slate-950'
                : 'border-slate-600 bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title="Cambiar velocidad de simulación (1x / 2x)"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{state.gameSpeed}x</span>
          </button>

          <button
            onClick={onToggleCinematicCamera}
            className={`px-2 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              state.cinematicCamera
                ? 'border-amber-300 bg-amber-400 text-slate-950 shadow-sm'
                : 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title="Modo Cámara Cinemática (Tecla C) — Se activa automáticamente durante batallas contra jefes rotando lentamente alrededor del campo de batalla"
          >
            <Video
              className={`w-3.5 h-3.5 ${
                state.cinematicCamera ? 'text-slate-950' : 'text-amber-400'
              }`}
            />
            <span>{state.cinematicCamera ? 'Cine: ON' : 'Cine'}</span>
          </button>

          <button
            onClick={onResetCamera}
            className="px-2 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="Centrar Cámara y volver a vista táctica"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-300" />
            <span>Cámara</span>
          </button>

          <button
            onClick={onToggleMute}
            className="px-2 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title={
              state.isMuted
                ? 'Activar Sonido'
                : `Silenciar Sonido (${Math.round(state.masterVolume * 100)}%)`
            }
          >
            {state.isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="font-mono-tabular">
              {state.isMuted ? 'Mudo' : `${Math.round(state.masterVolume * 100)}%`}
            </span>
          </button>

          <button
            onClick={onOpenOptions}
            className="px-2.5 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Menú de Opciones y Volumen de Música Dinámica (Exploración / Combate)"
          >
            <Music
              className={`w-3.5 h-3.5 ${
                state.musicState === 'boss_combat'
                  ? 'text-rose-400'
                  : state.musicState === 'combat'
                  ? 'text-amber-400'
                  : 'text-sky-400'
              }`}
            />
            <span>
              {state.musicState === 'boss_combat'
                ? 'BSO: Jefe'
                : state.musicState === 'combat'
                ? 'BSO: Combate'
                : 'BSO: Exploración'}
            </span>
            <Sliders className="w-3 h-3 text-slate-300" />
          </button>

          <button
            onClick={onTogglePause}
            className="px-2.5 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="Pausar Juego y Opciones (Esc)"
          >
            <Pause className="w-3.5 h-3.5 text-amber-300" />
            <span>Pausa</span>
          </button>
        </div>
      </div>

      {/* Active Boss Health Bar Banner */}
      {state.activeBoss && (
        <div
          className="pointer-events-auto w-full max-w-xl rounded-lg border border-rose-500/70 px-4 py-2 shadow-xl"
          style={{ backgroundColor: 'rgba(24, 10, 18, 0.94)' }}
        >
          <div className="flex items-center justify-between text-xs mb-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-display font-bold text-rose-200 tracking-wide truncate">
                {state.activeBoss.name}
              </span>
              <span className="text-rose-400/80 hidden sm:inline truncate">
                · {state.activeBoss.subtitle}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onToggleCinematicCamera}
                className={`px-2 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  state.cinematicCamera
                    ? 'border-amber-400/80 bg-amber-500/20 text-amber-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
                title="Alternar rotación de Cámara Cinemática de Jefe (Tecla C)"
              >
                <Video className="w-3 h-3 text-amber-400" />
                <span>
                  {state.cinematicCamera ? 'Cámara Cinemática 360°' : 'Activar Cámara Cine'}
                </span>
              </button>
              <span className="font-mono-tabular font-bold text-amber-300">
                {state.activeBoss.hp} / {state.activeBoss.maxHp} HP (Arm. {state.activeBoss.armor})
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded overflow-hidden border border-rose-900/60">
            <div
              className="h-full bg-gradient-to-r from-rose-600 via-amber-500 to-rose-400 transition-all duration-150"
              style={{
                width: `${Math.max(2, (state.activeBoss.hp / state.activeBoss.maxHp) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Transient Status Banner */}
      {state.statusBanner && (
        <div
          className="pointer-events-none px-4 py-1.5 rounded-lg border border-sky-500/50 text-xs font-medium text-sky-100 shadow-lg"
          style={{ backgroundColor: 'rgba(11, 15, 25, 0.92)' }}
        >
          {state.statusBanner}
        </div>
      )}
    </div>
  );
};
