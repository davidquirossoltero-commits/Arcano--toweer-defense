import React, { useState, useEffect } from 'react';
import { MAPS, MapConfig, WEATHER_SPECS } from '../types/game';
import {
  BookOpen,
  X,
  Play,
  Compass,
  ShieldAlert,
  Sparkles,
  CloudSnow,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface StoryCampaignModalProps {
  isOpen: boolean;
  activeMapId: string;
  onClose: () => void;
  onSelectMapPreview: (mapId: string) => void;
  onLaunchChapter: (mapId: string) => void;
}

export const StoryCampaignModal: React.FC<StoryCampaignModalProps> = ({
  isOpen,
  activeMapId,
  onClose,
  onSelectMapPreview,
  onLaunchChapter,
}) => {
  const [selectedChapterId, setSelectedChapterId] = useState<string>(activeMapId);

  useEffect(() => {
    if (isOpen) {
      setSelectedChapterId(activeMapId);
    }
  }, [isOpen, activeMapId]);

  if (!isOpen) return null;

  const currentChapter: MapConfig =
    MAPS.find((m) => m.id === selectedChapterId) || MAPS[0];
  const chapterIdx = MAPS.findIndex((m) => m.id === currentChapter.id);
  const weatherMeta = WEATHER_SPECS[currentChapter.defaultWeather];

  const handleSelectChapter = (mapId: string) => {
    setSelectedChapterId(mapId);
    onSelectMapPreview(mapId);
  };

  const handlePrev = () => {
    const prevIdx = (chapterIdx - 1 + MAPS.length) % MAPS.length;
    handleSelectChapter(MAPS[prevIdx].id);
  };

  const handleNext = () => {
    const nextIdx = (chapterIdx + 1) % MAPS.length;
    handleSelectChapter(MAPS[nextIdx].id);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-black/80">
      <div
        className="w-full max-w-4xl rounded-xl border border-slate-700 p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: '#0b0f19' }}
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-100">
                Crónicas de Aegis Arcana · La Guerra de las Puertas del Grito
              </h2>
              <p className="text-xs text-slate-400">
                Campaña narrativa en 6 Capítulos: desde el despertar de los Mites hasta la Ciudadela del Grito Eterno
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer shrink-0"
            title="Cerrar Crónicas de la Historia"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Prologue Banner */}
        <div className="mb-4 p-3.5 rounded-lg border border-purple-500/35 bg-slate-900/90 flex flex-col sm:flex-row items-center gap-3.5">
          <div className="w-16 h-16 rounded-lg border border-purple-400/50 bg-slate-950 overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
            <img
              src="/assets/aistudio/image_4f1b52b4.png"
              alt="Ciudadela del Bastión del Vacío"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            <div className="font-display font-bold text-amber-300 text-xs sm:text-sm mb-0.5">
              Prólogo: El Colapso del Velo Dimensional y el Pacto del Bastión
            </div>
            Durante siglos, la Cúpula Púrpura del Castillo Real y los seis Santuarios Astrales mantuvieron sellada la Dimensión del Vacío. Pero cuando el{' '}
            <strong className="text-rose-300">Soberano del Grito Nocturno</strong> corrompió los antiguos Portales Rúnicos, legiones de{' '}
            <strong className="text-emerald-300">Cíclopes del Vacío</strong>, Acechadores Escamosos, Colosos Blindados y Constructos Abisales comenzaron a marchar hacia el Núcleo. Como Alto Artífice, tu misión es liderar al{' '}
            <strong className="text-sky-300">Guardián Centinela</strong> y forjar Supertorres Arcanas a lo largo de los 6 capítulos.
          </div>
        </div>

        {/* 6 Chapter Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {MAPS.map((map) => {
            const isSelected = map.id === currentChapter.id;
            return (
              <button
                key={map.id}
                onClick={() => handleSelectChapter(map.id)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 bg-slate-800/95 shadow-md'
                    : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono-tabular mb-0.5">
                  <span
                    className={
                      isSelected ? 'text-amber-300 font-bold' : 'text-slate-400'
                    }
                  >
                    CAPÍTULO {map.chapter}
                  </span>
                  <span className="text-sky-400">{map.spawns.length}P</span>
                </div>
                <div className="font-display text-xs font-bold text-slate-100 truncate">
                  {map.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {map.difficulty}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Chapter Narrative & Tactical Dossier */}
        <div className="rounded-xl border border-slate-700/90 bg-slate-950/90 p-4 sm:p-5 mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 mb-3.5 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono-tabular text-[11px] font-bold">
                  {currentChapter.chapterTitle}
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 text-sky-300 font-mono-tabular text-[11px] font-semibold">
                  Rango: {currentChapter.difficulty}
                </span>
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-white">
                {currentChapter.name}{' '}
                <span className="text-slate-400 text-sm font-normal">
                  · {currentChapter.subtitle}
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono-tabular">
              <div
                className="px-2.5 py-1 rounded-lg border bg-slate-900 flex items-center gap-1.5"
                style={{ borderColor: weatherMeta.accentColor }}
              >
                <CloudSnow
                  className="w-3.5 h-3.5"
                  style={{ color: weatherMeta.accentColor }}
                />
                <span style={{ color: weatherMeta.accentColor }}>
                  Clima: {weatherMeta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Story Narrative Quote */}
          <div className="mb-4 p-3.5 rounded-lg border border-slate-800 bg-slate-900/90">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Relato de {currentChapter.narrator}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
              “{currentChapter.storyLore}”
            </p>
          </div>

          {/* Two-Column Tactical Briefing & Epilogue Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-lg border border-sky-500/30 bg-slate-900/70">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300 mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
                <span>Informe Táctico del Santuario</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-2">
                {currentChapter.tacticalBriefing}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular text-slate-300 pt-2 border-t border-slate-800">
                <span className="text-rose-300 font-bold">
                  Portales: {currentChapter.spawns.length}
                </span>
                <span>·</span>
                <span className="text-amber-300 font-bold">
                  Oro Inicial: {currentChapter.startingGold}
                </span>
                <span>·</span>
                <span className="text-sky-300 font-bold">
                  Maná: {currentChapter.startingMana}
                </span>
                <span>·</span>
                <span className="text-emerald-300 font-bold">
                  {currentChapter.totalWaves} Oleadas
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-amber-500/30 bg-slate-900/70 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Crónica de Victoria (Desenlace del Capítulo)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentChapter.epilogueText}
                </p>
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-400 pt-2 mt-2 border-t border-slate-800">
                Coordenadas del Núcleo: Columna {currentChapter.goal.col}, Fila{' '}
                {currentChapter.goal.row} · {currentChapter.obstacles.length} Ruinas Arcanas
              </div>
            </div>
          </div>
        </div>

        {/* Footer Controls: Prev/Next Chapter + Launch Chapter CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrev}
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Cap. Anterior</span>
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <span>Sig. Capítulo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              Volver
            </button>
            <button
              onClick={() => {
                onClose();
                onLaunchChapter(currentChapter.id);
              }}
              className="px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                Jugar Capítulo {currentChapter.chapter}: {currentChapter.name}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
