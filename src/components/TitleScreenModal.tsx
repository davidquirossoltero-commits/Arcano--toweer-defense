import React, { useState } from 'react';
import {
  ACHIEVEMENTS,
  DAILY_VOID_EVENTS,
  DIFFICULTY_ORDER,
  DIFFICULTY_SPECS,
  DailyVoidEventId,
  DailyVoidEventSpec,
  DifficultyLevel,
  MAPS,
  MapConfig,
  WEATHER_SPECS,
  getFeaturedDailyEventIdForToday,
} from '../types/game';
import {
  Play,
  Compass,
  Trophy,
  Shield,
  Sliders,
  BookOpen,
  Sparkles,
  Crown,
  Calendar,
  Flame,
  Zap,
  ScrollText,
  CheckCircle2,
  Volume2,
} from 'lucide-react';

const STORY_PROLOGUE = {
  title: 'Prólogo: El Pacto del Bastión y la Brecha del Vacío',
  subtitle: 'Archivo Secreto de los Centinelas de Aegis Arcana',
  paragraphs: [
    'Durante eras, la Cúpula Púrpura del Castillo Real mantuvo selladas las grietas dimensionales del valle. Sin embargo, el despertar de los Portales Rúnicos del Vacío ha corrompido los antiguos bosques y desatado legiones de constructos y bestias.',
    'La regla de defensa del Bastión es absoluta (Muerte Súbita 1/1): si una sola criatura del Vacío cruza el umbral del Castillo, el núcleo colapsará. Despliega Obeliscos de Cuarzo, Pilares de Escarcha (control criogénico puro) y Morteros de Magma.',
    'Cada día, las alineaciones astrales provocan Eventos Diarios del Vacío que alteran el clima, potencian tus torres y aceleran los Retos de Maestría para desbloquear Skins Cosméticas 3D.',
  ],
};

interface TitleScreenModalProps {
  selectedMapId: string;
  selectedDifficulty: DifficultyLevel;
  activeDailyEventId: DailyVoidEventId | null;
  unlockedCount: number;
  unlockedSkinsCount: number;
  onSelectMap: (mapId: string) => void;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  onSelectDailyEvent: (eventId: DailyVoidEventId | null) => void;
  onLaunchDailyEvent: (eventId: DailyVoidEventId) => void;
  onStartGame: (mapId: string) => void;
  onOpenStory: () => void;
  onOpenMastery: () => void;
  onOpenAchievements: () => void;
  onOpenOptions: () => void;
  onTestAudio?: () => void;
}

type InitialScreenTab = 'overview' | 'daily_events' | 'story_chronicles';

export const TitleScreenModal: React.FC<TitleScreenModalProps> = ({
  selectedMapId,
  selectedDifficulty,
  activeDailyEventId,
  unlockedCount,
  unlockedSkinsCount,
  onSelectMap,
  onSelectDifficulty,
  onSelectDailyEvent,
  onLaunchDailyEvent,
  onStartGame,
  onOpenStory,
  onOpenMastery,
  onOpenAchievements,
  onOpenOptions,
  onTestAudio,
}) => {
  const [activeTab, setActiveTab] = useState<InitialScreenTab>('overview');
  const [showPrologueBanner, setShowPrologueBanner] = useState<boolean>(false);

  const currentMap: MapConfig = MAPS.find((m) => m.id === selectedMapId) || MAPS[0];
  const currentDiff = DIFFICULTY_SPECS[selectedDifficulty];
  const featuredTodayId = getFeaturedDailyEventIdForToday();
  const activeDailyEvent: DailyVoidEventSpec | null =
    DAILY_VOID_EVENTS.find((ev) => ev.id === activeDailyEventId) || null;
  const displayedEvent: DailyVoidEventSpec =
    activeDailyEvent ||
    DAILY_VOID_EVENTS.find((ev) => ev.id === featuredTodayId) ||
    DAILY_VOID_EVENTS[0];

  const recommendedEventMap =
    MAPS.find((m) => m.id === displayedEvent.featuredMapId) || MAPS[0];

  const effectiveStartingGold = Math.max(
    60,
    currentMap.startingGold +
      currentDiff.startingGoldOffset +
      (activeDailyEvent ? activeDailyEvent.bonusStartingGold : 0)
  );
  const effectiveStartingMana = Math.min(
    150,
    currentMap.startingMana + (activeDailyEvent ? activeDailyEvent.bonusStartingMana : 0)
  );

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 md:p-5 overflow-y-auto">
      {/* Return to Games Portal */}
      <div className="pointer-events-auto max-w-4xl w-full mx-auto flex items-center justify-start mb-1">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-400/50 bg-slate-950/80 hover:bg-sky-950/90 text-sky-300 hover:text-white text-xs font-bold transition-all shadow-lg cursor-pointer"
          title="Volver al portal de juegos"
        >
          ← Volver a Juegos
        </a>
      </div>
      {/* Top Hero Lockup & Daily Event Live Ticker over live 3D Sanctuary */}
      <div className="pointer-events-auto max-w-4xl w-full mx-auto text-center mt-0.5">
        <div className="inline-flex flex-wrap items-center justify-center gap-3 mb-1">
          {/* Bespoke Multi-Faceted Crystalline Void-Bastion Crest SVG */}
          <svg
            width="44"
            height="44"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0 drop-shadow-[0_0_12px_rgba(168,85,247,0.55)]"
          >
            <defs>
              <linearGradient id="obsidianFrameGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b0764" />
                <stop offset="50%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>
              <linearGradient id="arcaneGoldGrad" x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id="voidCrystalGrad" x1="32" y1="10" x2="32" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f3e8ff" />
                <stop offset="45%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#6b21a8" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="29" fill="url(#obsidianFrameGrad)" stroke="url(#arcaneGoldGrad)" strokeWidth="2" />
            <circle cx="32" cy="32" r="24" stroke="#a855f7" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <polygon
              points="32,5 53,19 46,53 18,53 11,19"
              fill="#090d16"
              stroke="url(#arcaneGoldGrad)"
              strokeWidth="2"
            />
            <polygon
              points="32,10 46,22 40,48 24,48 18,22"
              fill="url(#voidCrystalGrad)"
              fillOpacity="0.35"
              stroke="#e9d5ff"
              strokeWidth="1.2"
            />
            <polygon points="32,12 40,32 32,50 24,32" fill="url(#voidCrystalGrad)" stroke="#f3e8ff" strokeWidth="1" />
            <polygon points="32,12 40,32 32,36" fill="#ffffff" fillOpacity="0.35" />
            <polygon points="32,21 36,32 32,41 28,32" fill="url(#arcaneGoldGrad)" />
          </svg>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h1
                className="font-display text-2xl md:text-4xl font-bold tracking-wider text-slate-50"
                style={{ textWrap: 'balance', textShadow: '0 4px 24px rgba(0,0,0,0.85)' }}
              >
                AEGIS ARCANA
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded border border-purple-400/60 bg-purple-950/80 text-purple-200 text-[10px] font-mono-tabular font-bold">
                <Sparkles className="w-3 h-3 text-amber-300" />
                CRÓNICAS DEL VACÍO
              </span>
            </div>
            <p className="text-[11px] md:text-xs text-slate-300">
              Defiende el Castillo Real (Muerte Súbita 1/1) frente a los Portales del Vacío a través de 6 Capítulos y Eventos Diarios.
            </p>
          </div>
        </div>

        {/* Floating Quick-Status Ribbon for Active Daily Event & Chapter */}
        <div
          className="mt-1.5 inline-flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs shadow-lg"
          style={{ backgroundColor: 'rgba(11, 15, 25, 0.88)' }}
        >
          <span className="flex items-center gap-1.5 font-semibold text-amber-300">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Evento Diario Destacado:</span>
          </span>
          <button
            onClick={() => setActiveTab('daily_events')}
            className="font-bold underline decoration-dotted cursor-pointer hover:opacity-90"
            style={{ color: displayedEvent.accentColor }}
          >
            {displayedEvent.title} (+{Math.round((displayedEvent.masteryXpMult - 1) * 100)}% Maestría)
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-mono-tabular text-[11px]">
            Vista 3D en vivo:{' '}
            <strong className="text-sky-300">
              {currentMap.chapterTitle} — {currentMap.name}
            </strong>
          </span>
        </div>
      </div>

      {/* Center Negative Space (unobstructed live 3D rotating sanctuary) */}
      <div className="flex-1 min-h-[18px]" />

      {/* Bottom Interactive Initial Screen Command Hub */}
      <div
        className="pointer-events-auto max-w-6xl w-full mx-auto rounded-xl border border-slate-700/85 p-3 md:p-4 shadow-2xl"
        style={{ backgroundColor: 'rgba(11, 15, 25, 0.94)' }}
      >
        {/* Navigation Tabs & Meta-Progression Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800">
          {/* Primary Section Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'overview'
                  ? 'border-sky-400 bg-sky-950/80 text-sky-200 shadow-sm'
                  : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Campaña y Despliegue (6 Capítulos)</span>
            </button>

            <button
              onClick={() => setActiveTab('daily_events')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'daily_events'
                  ? 'border-purple-400 bg-purple-950/80 text-purple-200 shadow-sm'
                  : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>Eventos Diarios del Vacío</span>
              {activeDailyEvent && (
                <span className="px-1.5 py-0.2 rounded bg-purple-500/30 border border-purple-400/50 text-[10px] text-purple-200 font-mono-tabular">
                  ACTIVO
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('story_chronicles')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'story_chronicles'
                  ? 'border-amber-400 bg-amber-950/80 text-amber-200 shadow-sm'
                  : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Historia Integrada y Crónicas</span>
            </button>
          </div>

          {/* Right Quick Actions (Mastery Skins, Full Story Modal, Audio, Achievements) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={onOpenMastery}
              className="px-2.5 py-1 rounded-lg border border-purple-400/80 bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>Maestría y Skins ({unlockedSkinsCount}/12)</span>
            </button>
            <button
              onClick={onOpenStory}
              className="px-2.5 py-1 rounded-lg border border-amber-400/70 bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ScrollText className="w-3.5 h-3.5 text-amber-400" />
              <span>Archivo Completo</span>
            </button>
            {onTestAudio && (
              <button
                onClick={onTestAudio}
                className="px-2.5 py-1 rounded-lg border border-emerald-400/80 bg-emerald-950/75 hover:bg-emerald-900/85 text-emerald-200 font-bold flex items-center gap-1.5 cursor-pointer"
                title="Activar y probar el sonido y la música inmediatamente"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Probar Sonido</span>
              </button>
            )}
            <button
              onClick={onOpenOptions}
              className="px-2.5 py-1 rounded-lg border border-sky-500/60 bg-slate-900 hover:bg-slate-800 text-sky-300 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Audio</span>
            </button>
            <button
              onClick={onOpenAchievements}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Logros ({unlockedCount}/{ACHIEVEMENTS.length})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: OVERVIEW (Integrated Story + Daily Event Banner + Difficulty + 6 Maps) */}
        {activeTab === 'overview' && (
          <>
            {/* Dual Top Feature Row: Integrated Chapter Story & Active Daily Event Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 mb-2.5">
              {/* Left 7 Cols: Integrated Story Narrative & Chapter Chronicle */}
              <div className="lg:col-span-7 p-2.5 rounded-lg border border-amber-500/35 bg-slate-950/90 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono-tabular text-[10px] font-bold">
                        {currentMap.chapterTitle}
                      </span>
                      <span className="text-[11px] font-semibold text-sky-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        {currentMap.narrator}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowPrologueBanner((prev) => !prev)}
                      className="text-[11px] text-amber-300 hover:text-amber-200 underline decoration-dotted cursor-pointer font-semibold"
                    >
                      {showPrologueBanner ? 'Ver Crónica del Capítulo' : 'Leer Prólogo del Mundo'}
                    </button>
                  </div>

                  {showPrologueBanner ? (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-amber-200">
                        {STORY_PROLOGUE.title} — {STORY_PROLOGUE.subtitle}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {STORY_PROLOGUE.paragraphs[0]} {STORY_PROLOGUE.paragraphs[1]}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-200 italic leading-snug mb-1.5">
                        “{currentMap.storyLore}”
                      </p>
                      <div className="text-[11px] text-slate-400 bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                        <strong className="text-sky-300">Directiva Táctica:</strong>{' '}
                        {currentMap.tacticalBriefing}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-400 truncate">
                    Epílogo al vencer: <em className="text-slate-300">{currentMap.epilogueText}</em>
                  </span>
                  <button
                    onClick={() => setActiveTab('story_chronicles')}
                    className="text-amber-300 hover:text-amber-200 font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ver Historia Completa →
                  </button>
                </div>
              </div>

              {/* Right 5 Cols: Daily Void Event Spotlight Card */}
              <div
                className="lg:col-span-5 p-2.5 rounded-lg border bg-slate-950/90 flex flex-col justify-between gap-2"
                style={{ borderColor: `${displayedEvent.accentColor}66` }}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-bold border"
                      style={{
                        color: displayedEvent.accentColor,
                        borderColor: `${displayedEvent.accentColor}66`,
                        backgroundColor: `${displayedEvent.accentColor}1a`,
                      }}
                    >
                      {displayedEvent.dayLabel}
                    </span>
                    <button
                      onClick={() =>
                        onSelectDailyEvent(activeDailyEvent ? null : displayedEvent.id)
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                        activeDailyEvent
                          ? 'border-emerald-400/70 bg-emerald-950/80 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {activeDailyEvent ? '✓ Modificador Activo' : 'Activar Modificador'}
                    </button>
                  </div>

                  <div className="font-display text-xs sm:text-sm font-bold text-slate-100">
                    {displayedEvent.title}
                  </div>
                  <p className="text-[11px] text-slate-300 italic line-clamp-2 mt-0.5 mb-1.5">
                    {displayedEvent.lore}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {displayedEvent.modifiersSummary.slice(0, 2).map((mod: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200"
                      >
                        • {mod}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                  <button
                    onClick={() => setActiveTab('daily_events')}
                    className="text-[11px] text-purple-300 hover:text-purple-200 font-bold cursor-pointer"
                  >
                    Cambiar Evento ({DAILY_VOID_EVENTS.length}) →
                  </button>
                  <button
                    onClick={() => onLaunchDailyEvent(displayedEvent.id)}
                    className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    <span>Jugar Misión Diaria</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Difficulty Selector Bar (Fácil, Normal, Arcana) */}
            <div className="mb-2.5 p-2 rounded-lg border border-slate-800 bg-slate-950/85">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span>Dificultad de Campaña:</span>
                  <span style={{ color: currentDiff.accentColor }} className="font-bold">
                    {currentDiff.label} ({currentDiff.subtitle})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">{currentDiff.description}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DIFFICULTY_ORDER.map((diffKey) => {
                  const spec = DIFFICULTY_SPECS[diffKey];
                  const isSelected = selectedDifficulty === diffKey;
                  return (
                    <button
                      key={spec.id}
                      onClick={() => onSelectDifficulty(diffKey)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-slate-900 shadow-md'
                          : 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700'
                      }`}
                      style={{
                        borderColor: isSelected ? spec.accentColor : undefined,
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: spec.accentColor }}
                          />
                          <span className="font-display text-xs font-bold text-slate-100">
                            {spec.label}
                          </span>
                          <span className="text-[11px] text-slate-400">· {spec.subtitle}</span>
                        </div>
                        <div className="text-[10px] font-mono-tabular text-slate-300 mt-0.5">
                          HP Mobs:{' '}
                          <strong style={{ color: spec.accentColor }}>
                            {Math.round(spec.enemyHpMultiplier * 100)}%
                          </strong>{' '}
                          · Costo Torres:{' '}
                          <strong className="text-amber-300">
                            {Math.round(spec.towerCostMultiplier * 100)}%
                          </strong>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6 Story Campaign Maps (2 rows of 3 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              {MAPS.map((map) => {
                const isSelected = map.id === currentMap.id;
                const isRecommendedDaily =
                  activeDailyEvent && activeDailyEvent.featuredMapId === map.id;
                const adjustedGold = Math.max(
                  60,
                  map.startingGold +
                    currentDiff.startingGoldOffset +
                    (activeDailyEvent ? activeDailyEvent.bonusStartingGold : 0)
                );
                const portalLabel =
                  map.spawns.length === 1 ? '1 Portal' : `${map.spawns.length} Portales`;
                return (
                  <button
                    key={map.id}
                    onClick={() => onSelectMap(map.id)}
                    className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-sky-400 bg-slate-900/95 shadow-lg'
                        : 'border-slate-800 bg-slate-950/75 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono-tabular font-bold text-amber-300">
                          CAPÍTULO {map.chapter}
                        </span>
                        {isRecommendedDaily && (
                          <span className="px-1 py-0.2 rounded bg-purple-500/30 border border-purple-400/50 text-[9px] font-mono-tabular text-purple-200 font-bold">
                            EVENTO HOY
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono-tabular text-sky-400 shrink-0">
                        {map.difficulty} · {portalLabel}
                      </span>
                    </div>
                    <div className="font-display text-xs sm:text-sm font-bold text-slate-100 truncate">
                      {map.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mb-1">
                      {map.subtitle}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug line-clamp-2 mb-1.5">
                      {map.description}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-mono-tabular text-slate-400 pt-1.5 border-t border-slate-800/80">
                      <span className="text-amber-300">Oro: {adjustedGold}</span>
                      <span>·</span>
                      <span>Maná: {effectiveStartingMana}</span>
                      <span>·</span>
                      <span>{map.totalWaves} Oleadas</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* TAB 2: DAILY VOID EVENTS (Eventos Diarios del Vacío) */}
        {activeTab === 'daily_events' && (
          <div className="mb-3 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-purple-500/40 bg-purple-950/25">
              <div>
                <div className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span>Eventos Diarios del Vacío — Anomalías Astrales Rotativas</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Selecciona el evento del día o cualquier convergencia astral para aplicar modificadores tácticos de Oro, Maná y Maestría de Skins (+50% a +60%).
                </p>
              </div>
              <button
                onClick={() => onSelectDailyEvent(null)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer shrink-0 ${
                  activeDailyEventId === null
                    ? 'border-sky-400 bg-sky-950/80 text-sky-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                }`}
              >
                {activeDailyEventId === null
                  ? '✓ Modo Campaña Estándar Activo'
                  : 'Desactivar Modificador Diario'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {DAILY_VOID_EVENTS.map((ev) => {
                const isSelected = activeDailyEventId === ev.id;
                const isTodayFeatured = ev.id === featuredTodayId;
                const recMap = MAPS.find((m) => m.id === ev.featuredMapId) || MAPS[0];
                const weatherSpec = WEATHER_SPECS[ev.weather];

                return (
                  <div
                    key={ev.id}
                    onClick={() => onSelectDailyEvent(ev.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-slate-900/95 shadow-xl'
                        : 'border-slate-800 bg-slate-950/80 hover:border-slate-600'
                    }`}
                    style={{
                      borderColor: isSelected ? ev.accentColor : undefined,
                    }}
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono-tabular font-bold border"
                            style={{
                              color: ev.accentColor,
                              borderColor: `${ev.accentColor}66`,
                              backgroundColor: `${ev.accentColor}1a`,
                            }}
                          >
                            {ev.dayLabel}
                          </span>
                          {isTodayFeatured && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-mono-tabular font-bold">
                              DESTACADO DE HOY
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono-tabular font-bold text-emerald-300">
                          +{Math.round((ev.masteryXpMult - 1) * 100)}% Maestría · +{ev.bonusStartingGold} Oro
                        </span>
                      </div>

                      <div className="font-display text-sm font-bold text-slate-100">
                        {ev.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mb-1">
                        {ev.subtitle} · Escenario: <strong className="text-sky-300">Cap. {recMap.chapter} ({recMap.name})</strong> · Clima: {weatherSpec.label}
                      </div>
                      <p className="text-xs text-slate-300 italic leading-snug mb-2">
                        {ev.lore}
                      </p>

                      <div className="space-y-1 bg-slate-950/90 border border-slate-800/90 rounded-lg p-2">
                        {ev.modifiersSummary.map((mod: string, idx: number) => (
                          <div
                            key={idx}
                            className="text-[11px] font-mono-tabular text-slate-200 flex items-center gap-1.5"
                          >
                            <Flame
                              className="w-3 h-3 shrink-0"
                              style={{ color: ev.accentColor }}
                            />
                            <span>{mod}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <strong className="text-emerald-300">Evento Seleccionado</strong>
                          </>
                        ) : (
                          'Clic para previsualizar en 3D'
                        )}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchDailyEvent(ev.id);
                        }}
                        className="px-3 py-1.5 rounded-lg font-bold text-xs text-slate-950 flex items-center gap-1.5 cursor-pointer shadow-md"
                        style={{ backgroundColor: ev.accentColor }}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Iniciar Evento en Cap. {recMap.chapter}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: INTEGRATED STORY CHRONICLES (Historia Integrada y Crónicas) */}
        {activeTab === 'story_chronicles' && (
          <div className="mb-3 space-y-2.5">
            {/* Prologue Card */}
            <div className="p-3 rounded-xl border border-amber-500/40 bg-slate-950/95">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span className="font-display text-xs sm:text-sm font-bold text-amber-300">
                    {STORY_PROLOGUE.title} — {STORY_PROLOGUE.subtitle}
                  </span>
                </div>
                <span className="text-[10px] font-mono-tabular text-slate-400">
                  CÓDICE DE LA ORDEN DEL ÉTER
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs text-slate-300 leading-relaxed">
                {STORY_PROLOGUE.paragraphs.map((p: string, idx: number) => (
                  <p
                    key={idx}
                    className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px]"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>

            {/* Interactive 6-Chapter Story Timeline + Live 3D Map Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              {/* Chapter List (Left 5 cols) */}
              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 max-h-[230px] overflow-y-auto pr-1">
                {MAPS.map((map) => {
                  const isSelected = map.id === currentMap.id;
                  return (
                    <button
                      key={map.id}
                      onClick={() => onSelectMap(map.id)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-amber-400 bg-amber-950/40 text-slate-100'
                          : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="text-[10px] font-mono-tabular font-bold text-amber-300">
                          {map.chapterTitle}
                        </div>
                        <div className="text-xs font-bold truncate">{map.name}</div>
                      </div>
                      <span className="text-[10px] font-mono-tabular text-sky-400 shrink-0">
                        {map.spawns.length} {map.spawns.length === 1 ? 'Portal' : 'Portales'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Chapter Full Story Details (Right 7 cols) */}
              <div className="lg:col-span-7 p-3 rounded-xl border border-slate-800 bg-slate-950/90 flex flex-col justify-between gap-2">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono-tabular text-xs font-bold">
                      {currentMap.chapterTitle} — {currentMap.name}
                    </span>
                    <span className="text-xs font-semibold text-sky-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {currentMap.narrator}
                    </span>
                  </div>

                  <blockquote className="p-2.5 rounded-lg border-l-4 border-amber-400 bg-slate-900/90 text-xs text-slate-100 italic leading-relaxed">
                    “{currentMap.storyLore}”
                  </blockquote>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-900/75 border border-slate-800">
                      <div className="font-bold text-sky-300 mb-0.5">Directiva de Defensa</div>
                      <p className="text-slate-300 leading-snug">{currentMap.tacticalBriefing}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/75 border border-slate-800">
                      <div className="font-bold text-emerald-300 mb-0.5">Profecía de Victoria</div>
                      <p className="text-slate-300 leading-snug italic">
                        “{currentMap.epilogueText}”
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400 font-mono-tabular text-[11px]">
                    Oro Inicial: <strong className="text-amber-300">{effectiveStartingGold}</strong> · Maná: <strong className="text-sky-300">{effectiveStartingMana}</strong>
                  </span>
                  <button
                    onClick={onOpenStory}
                    className="text-amber-300 hover:text-amber-200 font-bold cursor-pointer"
                  >
                    Abrir Lector de Pantalla Completa →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Primary CTA + Single Flat Control-Hint Line */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-800/90">
          <div className="text-[11px] text-slate-400 font-mono-tabular">
            Clic Izq Construir/Seleccionar · Arrastrar Rotar Cámara 360° · 1-3 Torres · Q Invocar Guardián · Esc Pausa
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {activeDailyEvent && (
              <button
                onClick={() => onLaunchDailyEvent(activeDailyEvent.id)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-purple-400/80 bg-purple-950/90 hover:bg-purple-900 text-purple-100 font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
                <span>
                  Jugar Evento: {activeDailyEvent.title} (Cap. {recommendedEventMap.chapter})
                </span>
              </button>
            )}

            <button
              onClick={() => onStartGame(currentMap.id)}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                Jugar Cap. {currentMap.chapter}: {currentMap.name} [{currentDiff.label}]
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

