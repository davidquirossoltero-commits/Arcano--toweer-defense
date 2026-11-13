import React, { useState } from 'react';
import { ParticleEmitterConfig, ParticlePreset } from '../three/ParticleSystem';
import { WEATHER_ORDER, WEATHER_SPECS, WeatherType } from '../types/game';
import { Sparkles, Flame, Zap, Shield, Snowflake, Sliders, CloudSnow, X } from 'lucide-react';

export interface ParticleEffectTriggerItem {
  id: ParticlePreset;
  label: string;
  subtitle: string;
  accentColor: string;
}

export const VFX_PRESET_ITEMS: ParticleEffectTriggerItem[] = [
  {
    id: 'fusion_sparks',
    label: 'Chispas Mágicas de Fusión',
    subtitle: 'Espiral ascendente dorada/cian + anillo rúnico',
    accentColor: '#f59e0b',
  },
  {
    id: 'boss_explosion',
    label: 'Explosión de Jefe Final',
    subtitle: 'Detonación ígnea de orbes + onda expansiva',
    accentColor: '#ef4444',
  },
  {
    id: 'boss_shockwave',
    label: 'Onda Sísmica de Titán',
    subtitle: 'Impacto tectónico con fragmentos de obsidiana',
    accentColor: '#f97316',
  },
  {
    id: 'golem_summon',
    label: 'Pulso de Gólem Guardián',
    subtitle: 'Vórtice de cristal esmeralda en ruta',
    accentColor: '#10b981',
  },
  {
    id: 'meteor_cataclysm',
    label: 'Cataclismo de Meteoro',
    subtitle: 'Lluvia de plasma solar de alto impacto',
    accentColor: '#eab308',
  },
  {
    id: 'frost_nova',
    label: 'Nova Criogénica',
    subtitle: 'Cristales de escarcha y anillo glacial',
    accentColor: '#22d3ee',
  },
];

interface ParticleSystemModalProps {
  isOpen: boolean;
  currentWeather: WeatherType;
  autoWeather: boolean;
  onClose: () => void;
  onSelectWeather: (weather: WeatherType) => void;
  onToggleAutoWeather: () => void;
  onTriggerPreset: (preset: ParticlePreset, scaleMultiplier?: number) => void;
  onTriggerCustom: (config: ParticleEmitterConfig) => void;
}

/**
 * Generic React Particle & Dynamic Weather Controller component that triggers both
 * global atmospheric weather states (Arcane Snow, Abyssal Fog, Embers, Aether Storm)
 * and local 3D particle bursts.
 */
export const ParticleSystemModal: React.FC<ParticleSystemModalProps> = ({
  isOpen,
  currentWeather,
  autoWeather,
  onClose,
  onSelectWeather,
  onToggleAutoWeather,
  onTriggerPreset,
  onTriggerCustom,
}) => {
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(1.2);
  const [customCount, setCustomCount] = useState<number>(48);
  const [customSwirl, setCustomSwirl] = useState<number>(6.0);
  const [customStartColor, setCustomStartColor] = useState<string>('#fde047');
  const [customEndColor, setCustomEndColor] = useState<string>('#38bdf8');

  if (!isOpen) return null;

  const handleFireCustom = () => {
    onTriggerCustom({
      shape: 'spark',
      count: customCount,
      startColor: customStartColor,
      endColor: customEndColor,
      minSpeed: 2.5,
      maxSpeed: 6.5,
      minLife: 0.6,
      maxLife: 1.25,
      minSize: 0.9 * scaleMultiplier,
      maxSize: 1.6 * scaleMultiplier,
      gravity: customSwirl !== 0 ? -2.0 : 8.5,
      drag: 0.95,
      swirlSpeed: customSwirl,
      upwardBias: 2.2,
      shockwaveRing: {
        color: customStartColor,
        maxRadius: 4.2 * scaleMultiplier,
        duration: 0.65,
        yOffset: 0.12,
      },
    });
  };

  return (
    <div
      className="fixed top-20 right-4 z-20 w-80 sm:w-96 max-h-[82vh] overflow-y-auto rounded-xl border border-slate-600 p-4 shadow-2xl pointer-events-auto"
      style={{ backgroundColor: 'rgba(11, 15, 25, 0.96)' }}
    >
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="font-display text-sm font-bold text-white">
            Clima Dinámico y Partículas 3D
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
          title="Cerrar panel de efectos"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Global Dynamic Weather Control Section */}
      <div className="mb-3.5 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <CloudSnow className="w-3.5 h-3.5 text-sky-400" />
            <span>Clima Global del Mapa</span>
          </div>
          <button
            onClick={onToggleAutoWeather}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
              autoWeather
                ? 'border-emerald-400 bg-emerald-950 text-emerald-300'
                : 'border-slate-600 bg-slate-800 text-slate-200'
            }`}
          >
            {autoWeather ? 'Ciclo Auto: SÍ' : 'Ciclo Auto: NO'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {WEATHER_ORDER.map((wKey) => {
            const spec = WEATHER_SPECS[wKey];
            const isActive = currentWeather === wKey;
            return (
              <button
                key={spec.id}
                onClick={() => onSelectWeather(wKey)}
                className={`w-full px-3 py-1.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 border-2 shadow-md'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800/80'
                }`}
                style={{ borderColor: isActive ? spec.accentColor : undefined }}
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: spec.accentColor }}
                    />
                    <span>{spec.label}</span>
                    <span className="text-[11px] font-normal text-slate-300">
                      · {spec.subtitle}
                    </span>
                  </div>
                </div>
                <span
                  className="text-[11px] font-mono-tabular font-bold shrink-0"
                  style={{ color: spec.accentColor }}
                >
                  {isActive ? 'Activo' : 'Activar'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-200 mb-2 leading-relaxed font-semibold">
        Efectos Locales de Combate y Fusión:
      </p>

      {/* Preset Effect Triggers */}
      <div className="grid grid-cols-1 gap-1.5 mb-3.5">
        {VFX_PRESET_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTriggerPreset(item.id, scaleMultiplier)}
            className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/90 hover:border-sky-400/80 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
                {item.id === 'fusion_sparks' && <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {item.id === 'boss_explosion' && <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                {item.id === 'boss_shockwave' && <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                {item.id === 'golem_summon' && <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                {item.id === 'meteor_cataclysm' && <Flame className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                {item.id === 'frost_nova' && <Snowflake className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
            </div>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-mono-tabular font-semibold text-slate-950 shrink-0"
              style={{ backgroundColor: item.accentColor }}
            >
              Probar
            </span>
          </button>
        ))}
      </div>

      {/* Custom Emitter Controls */}
      <div className="pt-3 border-t border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-2">
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          <span>Emisor Personalizado en Vivo</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2.5 text-xs font-mono-tabular">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Escala ({scaleMultiplier.toFixed(1)}x)
            </label>
            <input
              type="range"
              min="0.6"
              max="2.2"
              step="0.1"
              value={scaleMultiplier}
              onChange={(e) => setScaleMultiplier(parseFloat(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Partículas ({customCount})
            </label>
            <input
              type="range"
              min="16"
              max="96"
              step="8"
              value={customCount}
              onChange={(e) => setCustomCount(parseInt(e.target.value, 10))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Vórtice</label>
            <input
              type="range"
              min="-8"
              max="8"
              step="1"
              value={customSwirl}
              onChange={(e) => setCustomSwirl(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Color Inicial</label>
            <input
              type="color"
              value={customStartColor}
              onChange={(e) => setCustomStartColor(e.target.value)}
              className="w-full h-6 rounded bg-slate-900 border border-slate-700 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Color Final</label>
            <input
              type="color"
              value={customEndColor}
              onChange={(e) => setCustomEndColor(e.target.value)}
              className="w-full h-6 rounded bg-slate-900 border border-slate-700 cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleFireCustom}
          className="w-full py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Disparar Efecto Personalizado</span>
        </button>
      </div>
    </div>
  );
};
