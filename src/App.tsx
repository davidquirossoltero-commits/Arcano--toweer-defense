/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './three/GameEngine';
import { GameHudState, MAPS, getFeaturedDailyEventIdForToday } from './types/game';
import { TitleScreenModal } from './components/TitleScreenModal';
import { TopHudBar } from './components/TopHudBar';
import { BottomControlDock } from './components/BottomControlDock';
import { GameStatusModal } from './components/GameStatusModal';
import { ParticleSystemModal } from './components/ParticleSystemOverlay';
import { AchievementToast, AchievementsModal } from './components/AchievementsOverlay';
import { StoryCampaignModal } from './components/StoryCampaignModal';
import { MasteryChallengesModal } from './components/MasteryChallengesModal';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [codexOpen, setCodexOpen] = useState(false);
  const [vfxPanelOpen, setVfxPanelOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [masteryOpen, setMasteryOpen] = useState(false);

  const [hudState, setHudState] = useState<GameHudState>({
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
    isMuted: false,
    masterVolume: 0.8,
    musicVolume: 0.65,
    sfxVolume: 0.85,
    musicState: 'exploration',
    cinematicCamera: false,
    autoCinematicCamera: true,
    dockCollapsed: false,
    achievementMetrics: {
      golemsSummoned: 0,
      superTowersCreated: 0,
      bossesDefeated: 0,
      monstersEliminated: 0,
      abilitiesCast: 0,
    },
    unlockedAchievements: [],
    activeAchievementToast: null,
    towerMastery: {
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
    },
    activeDailyEventId: getFeaturedDailyEventIdForToday(),
  });

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new GameEngine(mount, (newState) => {
      setHudState(newState);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const anyModalOpen =
      optionsOpen ||
      codexOpen ||
      storyOpen ||
      masteryOpen ||
      achievementsOpen ||
      vfxPanelOpen;
    engineRef.current?.setMenuOverlayOpen(anyModalOpen);
  }, [optionsOpen, codexOpen, storyOpen, masteryOpen, achievementsOpen, vfxPanelOpen]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b0f19] select-none">
      {/* Isolated Full-Viewport WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="w-full h-full"
        aria-label="Escena 3D de Aegis Arcana Tower Defense"
      />

      {/* Global On-Screen Achievement Unlock Notification Toast */}
      <AchievementToast
        toast={hudState.activeAchievementToast}
        onDismiss={() => engineRef.current?.dismissAchievementToast()}
        onOpenModal={() => setAchievementsOpen(true)}
      />

      {/* Achievements & Milestones Modal */}
      <AchievementsModal
        isOpen={achievementsOpen}
        metrics={hudState.achievementMetrics}
        unlockedIds={hudState.unlockedAchievements}
        onClose={() => setAchievementsOpen(false)}
        onTriggerDemoToast={() => engineRef.current?.triggerDemoAchievementToast()}
        onResetAchievements={() => engineRef.current?.resetAchievements()}
      />

      {/* Tower Mastery Challenges & 3D Cosmetic Skins Modal */}
      <MasteryChallengesModal
        isOpen={masteryOpen}
        mastery={hudState.towerMastery}
        onClose={() => setMasteryOpen(false)}
        onEquipSkin={(baseTower, skinId) => engineRef.current?.equipTowerSkin(baseTower, skinId)}
        onBoostMasteryDemo={(baseTower) => engineRef.current?.boostTowerMasteryDemo(baseTower)}
        onResetMastery={() => engineRef.current?.resetTowerMastery()}
      />

      {/* Story Campaign & 6-Chapter Chronicles Modal */}
      <StoryCampaignModal
        isOpen={storyOpen}
        activeMapId={hudState.mapId}
        onClose={() => setStoryOpen(false)}
        onSelectMapPreview={(mapId) => {
          if (hudState.phase === 'title') {
            engineRef.current?.previewMapInTitle(mapId);
          }
        }}
        onLaunchChapter={(mapId) => engineRef.current?.startGame(mapId)}
      />

      {/* Title Screen Overlay over Live 3D World */}
      {hudState.phase === 'title' && (
        <TitleScreenModal
          selectedMapId={hudState.mapId}
          selectedDifficulty={hudState.difficulty}
          activeDailyEventId={hudState.activeDailyEventId}
          unlockedCount={hudState.unlockedAchievements.length}
          unlockedSkinsCount={hudState.towerMastery.unlockedSkins.length}
          onSelectMap={(mapId) => engineRef.current?.previewMapInTitle(mapId)}
          onSelectDifficulty={(diff) => engineRef.current?.setDifficulty(diff)}
          onSelectDailyEvent={(evId) => engineRef.current?.setDailyEvent(evId)}
          onLaunchDailyEvent={(evId) => engineRef.current?.launchDailyEvent(evId)}
          onStartGame={(mapId) => engineRef.current?.startGame(mapId)}
          onOpenStory={() => setStoryOpen(true)}
          onOpenMastery={() => setMasteryOpen(true)}
          onOpenAchievements={() => setAchievementsOpen(true)}
          onOpenOptions={() => setOptionsOpen(true)}
          onTestAudio={() => engineRef.current?.testAudioEngine()}
        />
      )}

      {/* Active Gameplay HUD Overlays */}
      {hudState.phase !== 'title' && (
        <>
          <TopHudBar
            state={hudState}
            vfxPanelOpen={vfxPanelOpen}
            onStartWave={() => engineRef.current?.startNextWave()}
            onChangeDifficulty={(diff) => engineRef.current?.setDifficulty(diff)}
            onCycleWeather={() => engineRef.current?.cycleWeather()}
            onToggleSpeed={() => engineRef.current?.toggleGameSpeed()}
            onTogglePause={() => engineRef.current?.togglePause()}
            onToggleMute={() => engineRef.current?.toggleMute()}
            onResetCamera={() => engineRef.current?.resetCameraView()}
            onToggleCinematicCamera={() => engineRef.current?.toggleCinematicCamera()}
            onOpenStory={() => setStoryOpen(true)}
            onOpenCodex={() => setCodexOpen(true)}
            onOpenMastery={() => setMasteryOpen(true)}
            onOpenAchievements={() => setAchievementsOpen(true)}
            onToggleVfxPanel={() => setVfxPanelOpen((prev) => !prev)}
            onOpenOptions={() => setOptionsOpen(true)}
          />

          <ParticleSystemModal
            isOpen={vfxPanelOpen}
            currentWeather={hudState.weather}
            autoWeather={hudState.autoWeather}
            onClose={() => setVfxPanelOpen(false)}
            onSelectWeather={(weather) => engineRef.current?.setWeather(weather, true)}
            onToggleAutoWeather={() => engineRef.current?.toggleAutoWeather()}
            onTriggerPreset={(preset, scale) =>
              engineRef.current?.triggerParticlePreset(preset, undefined, undefined, scale)
            }
            onTriggerCustom={(cfg) => engineRef.current?.triggerCustomParticleEffect(cfg)}
          />

          <BottomControlDock
            state={hudState}
            onSelectBuildTower={(type) => engineRef.current?.selectBuildTower(type)}
            onTriggerAbility={(id) => engineRef.current?.triggerAbility(id)}
            onCancelTargeting={() => engineRef.current?.setAbilityTargeting(null)}
            onUpgradeTower={() => engineRef.current?.upgradeSelectedTower()}
            onSellTower={() => engineRef.current?.sellSelectedTower()}
            onFuseTower={(neighborId) => engineRef.current?.fuseSelectedTowerWith(neighborId)}
            onDirectAscendTower={(partnerType) =>
              engineRef.current?.directAscendSelectedTower(partnerType)
            }
            onOpenMastery={() => setMasteryOpen(true)}
            onCloseInspector={() => engineRef.current?.clearSelection()}
            onToggleCollapse={() => engineRef.current?.toggleDockCollapsed()}
          />
        </>
      )}

      {/* Pause, Options/Audio, Victory, Game Over & Supertower Fusion Codex Modals */}
      <GameStatusModal
        state={hudState}
        codexOpen={codexOpen}
        optionsOpen={optionsOpen}
        onCloseCodex={() => setCodexOpen(false)}
        onCloseOptions={() => setOptionsOpen(false)}
        onResume={() => engineRef.current?.togglePause()}
        onRestart={() => engineRef.current?.startGame(hudState.mapId)}
        onNextMap={(nextMapId) => engineRef.current?.startGame(nextMapId)}
        onReturnTitle={() => engineRef.current?.returnToTitle()}
        onToggleMute={() => engineRef.current?.toggleMute()}
        onChangeMasterVolume={(vol) => engineRef.current?.setMasterVolume(vol)}
        onChangeMusicVolume={(vol) => engineRef.current?.setMusicVolume(vol)}
        onChangeSfxVolume={(vol) => engineRef.current?.setSfxVolume(vol)}
        onPreviewMusicState={(trackState) =>
          engineRef.current?.setDynamicMusicState(trackState)
        }
        onTestAudio={() => engineRef.current?.testAudioEngine()}
      />
    </main>
  );
}
