import React, { useState } from 'react';
import {
  ACHIEVEMENTS,
  AchievementId,
  AchievementMetrics,
  UnlockedAchievementNotification,
} from '../types/game';
import { Trophy, CheckCircle2, Lock, X, RotateCcw, BellRing } from 'lucide-react';

interface AchievementToastProps {
  toast: UnlockedAchievementNotification | null;
  onDismiss: () => void;
  onOpenModal: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  toast,
  onDismiss,
  onOpenModal,
}) => {
  if (!toast) return null;

  return (
    <div
      className="fixed top-20 right-4 z-30 pointer-events-auto w-full max-w-sm rounded-xl border p-4 shadow-2xl transition-all duration-300"
      style={{
        backgroundColor: 'rgba(11, 15, 25, 0.96)',
        borderColor: toast.accentColor,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 mt-0.5"
            style={{
              borderColor: toast.accentColor,
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
            }}
          >
            <Trophy className="w-5 h-5" style={{ color: toast.accentColor }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-0.5">
              <span>¡Logro Desbloqueado!</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-300">{toast.categoryLabel}</span>
            </div>
            <h3 className="font-display text-sm font-bold text-slate-100">
              {toast.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
              {toast.description}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs font-mono-tabular">
              <span className="text-amber-400 font-bold">
                Recompensa: +{toast.rewardGold} Oro
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <button
                onClick={onOpenModal}
                className="text-sky-400 hover:underline font-sans font-medium cursor-pointer"
              >
                Ver todos los logros
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface AchievementsModalProps {
  isOpen: boolean;
  metrics: AchievementMetrics;
  unlockedIds: AchievementId[];
  onClose: () => void;
  onTriggerDemoToast: () => void;
  onResetAchievements: () => void;
}

type FilterTab = 'all' | 'Golems invocados' | 'Supertorres creadas' | 'Jefes derrotados';

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  metrics,
  unlockedIds,
  onClose,
  onTriggerDemoToast,
  onResetAchievements,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  if (!isOpen) return null;

  const unlockedSet = new Set(unlockedIds);
  const totalCount = ACHIEVEMENTS.length;
  const unlockedCount = unlockedIds.length;
  const completionPct = Math.round((unlockedCount / totalCount) * 100);

  const filteredAchievements = ACHIEVEMENTS.filter((ach) =>
    activeFilter === 'all' ? true : ach.categoryLabel === activeFilter
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div
        className="w-full max-w-3xl rounded-xl border border-slate-700 p-6 shadow-2xl max-h-[88vh] overflow-y-auto"
        style={{ backgroundColor: '#0b0f19' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-slate-100">
                Registro de Logros y Hitos de Batalla
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Desbloqueados: {unlockedCount}/{totalCount} ({completionPct}%)</span>
                <span aria-hidden="true">·</span>
                <span>Cada logro otorga Oro extra inmediato en partida</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
            title="Cerrar registro de logros"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Core Milestone Counters Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 pb-4 border-b border-slate-800 font-mono-tabular">
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
            <div className="text-xs text-slate-400 font-sans mb-0.5">Golems invocados</div>
            <div className="text-lg font-bold text-emerald-400">{metrics.golemsSummoned}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
            <div className="text-xs text-slate-400 font-sans mb-0.5">Supertorres creadas</div>
            <div className="text-lg font-bold text-amber-400">{metrics.superTowersCreated}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
            <div className="text-xs text-slate-400 font-sans mb-0.5">Jefes derrotados</div>
            <div className="text-lg font-bold text-rose-400">{metrics.bossesDefeated}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
            <div className="text-xs text-slate-400 font-sans mb-0.5">Monstruos eliminados</div>
            <div className="text-lg font-bold text-sky-400">{metrics.monstersEliminated}</div>
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
            {(
              [
                ['all', 'Todos los Hitos'],
                ['Golems invocados', 'Golems invocados'],
                ['Supertorres creadas', 'Supertorres creadas'],
                ['Jefes derrotados', 'Jefes derrotados'],
              ] as [FilterTab, string][]
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                onClick={() => setActiveFilter(tabKey)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeFilter === tabKey
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerDemoToast}
              className="px-3 py-1.5 rounded-lg border border-amber-500/60 bg-amber-950/50 hover:bg-amber-900/60 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Mostrar una notificación de logro en pantalla"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-400" />
              <span>Probar Notificación</span>
            </button>
            <button
              onClick={onResetAchievements}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reiniciar todos los contadores y logros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar</span>
            </button>
          </div>
        </div>

        {/* Achievement List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAchievements.map((ach) => {
            const isUnlocked = unlockedSet.has(ach.id);
            const currentVal = metrics[ach.metric] || 0;
            const clampedVal = Math.min(ach.target, currentVal);
            const ratio = Math.min(100, Math.round((clampedVal / ach.target) * 100));

            return (
              <div
                key={ach.id}
                className={`p-4 rounded-lg border flex flex-col justify-between transition-colors ${
                  isUnlocked
                    ? 'border-amber-500/70 bg-slate-900/95'
                    : 'border-slate-800 bg-slate-950/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {isUnlocked ? (
                        <CheckCircle2
                          className="w-4 h-4 shrink-0"
                          style={{ color: ach.accentColor }}
                        />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span
                        className="font-display font-bold text-sm"
                        style={{ color: isUnlocked ? ach.accentColor : '#f1f5f9' }}
                      >
                        {ach.title}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-xs font-bold text-amber-400 shrink-0">
                      +{ach.rewardGold} Oro
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <span>{ach.categoryLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{isUnlocked ? 'Completado' : 'En progreso'}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {ach.description}
                  </p>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-mono-tabular text-slate-400 mb-1">
                    <span>Progreso</span>
                    <span className={isUnlocked ? 'text-emerald-400 font-bold' : 'text-slate-200'}>
                      {clampedVal} / {ach.target} ({ratio}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded overflow-hidden border border-slate-800">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${ratio}%`,
                        backgroundColor: isUnlocked ? ach.accentColor : '#38bdf8',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
