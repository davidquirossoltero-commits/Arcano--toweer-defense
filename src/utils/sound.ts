import { AudioTrackState } from '../types/game';

const AUDIO_STORAGE_KEY = 'aegis_arcana_audio_settings_v3';

export interface PersistedAudioSettings {
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

type WavSfxKey = 'click' | 'build' | 'shoot' | 'boom' | 'fanfare' | 'horn';

/**
 * Generates an in-memory 16-bit mono PCM WAV Blob URL so HTML5 <audio> elements
 * can play crystal-clear synthesized sound effects and music loops reliably in
 * every browser and iframe environment alongside the Web Audio API synthesizer.
 */
function createPcmWavBlobUrl(
  durationSec: number,
  sampleRate: number,
  renderSample: (t: number, i: number, totalSamples: number) => number
): string {
  const numSamples = Math.max(1, Math.floor(durationSec * sampleRate));
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, 1, true); // Mono = 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit samples
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const raw = renderSample(t, i, numSamples);
    const clamped = Math.max(-1, Math.min(1, raw));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

class SoundEngine {
  private ctx: AudioContext | null = null;

  private muted = false;
  private masterVolume = 0.9;
  private musicVolume = 0.82;
  private sfxVolume = 0.95;
  private musicState: AudioTrackState = 'exploration';

  private isMusicLoopRunning = false;
  private musicTimerId: number | null = null;
  private stepIndex = 0;
  private lastEnemyHitSfxTime = 0;
  private lastClickSfxTime = 0;

  // HTML5 <audio> PCM WAV dual-output engine (guarantees audible output in all iframes/browsers)
  private sfxWavUrls: Record<WavSfxKey, string> | null = null;
  private musicWavUrls: Record<AudioTrackState, string> | null = null;
  private bgMusicAudio: HTMLAudioElement | null = null;

  constructor() {
    this.loadSettings();
    if (typeof window !== 'undefined') {
      this.initPcmWavAssets();
      this.bindGlobalGestureAndButtonAudio();
    }
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedAudioSettings>;
      // Always start unmuted with audible volume so a user is never stuck in silence
      this.muted = false;
      if (typeof parsed.masterVolume === 'number' && parsed.masterVolume >= 0.2) {
        this.masterVolume = Math.max(0.2, Math.min(1, parsed.masterVolume));
      }
      if (typeof parsed.musicVolume === 'number' && parsed.musicVolume >= 0.15) {
        this.musicVolume = Math.max(0.15, Math.min(1, parsed.musicVolume));
      }
      if (typeof parsed.sfxVolume === 'number' && parsed.sfxVolume >= 0.2) {
        this.sfxVolume = Math.max(0.2, Math.min(1, parsed.sfxVolume));
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveSettings() {
    try {
      const payload: PersistedAudioSettings = {
        muted: this.muted,
        masterVolume: this.masterVolume,
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume,
      };
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Pre-builds crisp 16-bit PCM WAV audio clips and ambient loops in memory.
   */
  private initPcmWavAssets() {
    try {
      const sr = 22050;

      const clickUrl = createPcmWavBlobUrl(0.085, sr, (t) => {
        const env = Math.exp(-t * 42);
        const f1 = 720 + t * 3200;
        return (
          (Math.sin(2 * Math.PI * f1 * t) * 0.65 +
            Math.sin(2 * Math.PI * f1 * 1.5 * t) * 0.35) *
          env *
          0.75
        );
      });

      const buildUrl = createPcmWavBlobUrl(0.28, sr, (t) => {
        const freqs = [330, 440, 659.25];
        const idx = Math.min(2, Math.floor(t / 0.085));
        const localT = t - idx * 0.085;
        const env = Math.exp(-localT * 16);
        const f = freqs[idx];
        return (
          (Math.sin(2 * Math.PI * f * t) * 0.6 +
            Math.sin(2 * Math.PI * f * 2 * t) * 0.3) *
          env *
          0.8
        );
      });

      const shootUrl = createPcmWavBlobUrl(0.16, sr, (t) => {
        const env = Math.exp(-t * 22);
        const freq = 880 * Math.exp(-t * 7.5) + 180;
        return (
          (Math.sin(2 * Math.PI * freq * t) * 0.65 +
            Math.sin(2 * Math.PI * freq * 2 * t) * 0.25) *
          env *
          0.75
        );
      });

      const boomUrl = createPcmWavBlobUrl(0.42, sr, (t) => {
        const env = Math.exp(-t * 7.5);
        const freq = 165 * Math.exp(-t * 5.2) + 42;
        const noise = (Math.sin(t * 12987.3) * Math.cos(t * 7919.7)) * 0.35;
        return (Math.sin(2 * Math.PI * freq * t) * 0.75 + noise) * env * 0.85;
      });

      const fanfareUrl = createPcmWavBlobUrl(0.56, sr, (t) => {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const idx = Math.min(3, Math.floor(t / 0.11));
        const localT = t - idx * 0.11;
        const env = Math.exp(-localT * 8.5);
        const f = notes[idx];
        return (
          (Math.sin(2 * Math.PI * f * t) * 0.6 +
            Math.sin(2 * Math.PI * f * 1.5 * t) * 0.25 +
            Math.sin(2 * Math.PI * f * 2 * t) * 0.2) *
          env *
          0.85
        );
      });

      const hornUrl = createPcmWavBlobUrl(0.48, sr, (t) => {
        const env = Math.min(1, t / 0.04) * Math.exp(-t * 4.2);
        return (
          (Math.sin(2 * Math.PI * 220 * t) * 0.45 +
            Math.sin(2 * Math.PI * 329.63 * t) * 0.35 +
            Math.sin(2 * Math.PI * 440 * t) * 0.3) *
          env *
          0.85
        );
      });

      this.sfxWavUrls = {
        click: clickUrl,
        build: buildUrl,
        shoot: shootUrl,
        boom: boomUrl,
        fanfare: fanfareUrl,
        horn: hornUrl,
      };

      // Pre-render 3 seamless 3.84s (16 steps * 0.24s) background music loops at 16000 Hz
      const musicSr = 16000;
      const loopDur = 3.84;

      const explorationLoop = createPcmWavBlobUrl(loopDur, musicSr, (t) => {
        const step = Math.floor(t / 0.24) % 16;
        const stepT = t % 0.24;
        const arpNotes = [
          440.0, 523.25, 659.25, 587.33, 440.0, 659.25, 587.33, 523.25,
          392.0, 493.88, 587.33, 659.25, 523.25, 440.0, 392.0, 440.0,
        ];
        const padRoots = [220.0, 293.66, 261.63, 196.0];
        const root = padRoots[Math.floor(step / 4) % 4];
        const note = arpNotes[step];
        const arpEnv = Math.min(1, stepT / 0.015) * Math.exp(-stepT * 8.5);
        const padWave =
          Math.sin(2 * Math.PI * root * t) * 0.28 +
          Math.sin(2 * Math.PI * root * 1.5 * t) * 0.18;
        const arpWave =
          (Math.sin(2 * Math.PI * note * t) * 0.38 +
            Math.sin(2 * Math.PI * note * 2 * t) * 0.16) *
          arpEnv;
        return (padWave + arpWave) * 0.65;
      });

      const combatLoop = createPcmWavBlobUrl(loopDur, musicSr, (t) => {
        const step = Math.floor(t / 0.24) % 16;
        const stepT = t % 0.24;
        const bassSeq = [220.0, 220.0, 261.63, 293.66];
        const leadSeq = [
          440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 440.0, 392.0,
          440.0, 523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 440.0,
        ];
        const bass = bassSeq[Math.floor(step / 4) % 4];
        const lead = leadSeq[step];
        const noteEnv = Math.min(1, stepT / 0.01) * Math.exp(-stepT * 11);
        const kickEnv = step % 2 === 0 ? Math.exp(-stepT * 22) : 0;
        const kickFreq = 130 * Math.exp(-stepT * 14) + 45;
        return (
          (Math.sin(2 * Math.PI * bass * t) * 0.32 * noteEnv +
            Math.sin(2 * Math.PI * lead * t) * 0.36 * noteEnv +
            Math.sin(2 * Math.PI * kickFreq * stepT) * 0.42 * kickEnv) *
          0.75
        );
      });

      const bossLoop = createPcmWavBlobUrl(loopDur, musicSr, (t) => {
        const step = Math.floor(t / 0.24) % 16;
        const stepT = t % 0.24;
        const bossArp = [
          329.63, 349.23, 415.3, 440.0, 493.88, 554.37, 659.25, 554.37,
          329.63, 415.3, 493.88, 659.25, 554.37, 493.88, 415.3, 349.23,
        ];
        const lead = bossArp[step];
        const noteEnv = Math.min(1, stepT / 0.008) * Math.exp(-stepT * 12);
        const kickEnv = Math.exp(-stepT * 24);
        const kickFreq = 150 * Math.exp(-stepT * 15) + 48;
        return (
          (Math.sin(2 * Math.PI * 164.81 * t) * 0.28 +
            Math.sin(2 * Math.PI * lead * t) * 0.38 * noteEnv +
            Math.sin(2 * Math.PI * lead * 1.5 * t) * 0.2 * noteEnv +
            Math.sin(2 * Math.PI * kickFreq * stepT) * 0.42 * kickEnv) *
          0.8
        );
      });

      this.musicWavUrls = {
        exploration: explorationLoop,
        combat: combatLoop,
        boss_combat: bossLoop,
      };
    } catch {
      // Ignore if Blob URL creation is unavailable
    }
  }

  private playWavSfx(key: WavSfxKey, volumeScale = 1.0) {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    if (!this.sfxWavUrls) return;
    try {
      const url = this.sfxWavUrls[key];
      if (!url) return;
      const audio = new Audio(url);
      audio.volume = Math.max(
        0,
        Math.min(1, this.masterVolume * this.sfxVolume * volumeScale)
      );
      audio.play().catch(() => {});
    } catch {
      // Ignore playback error
    }
  }

  private syncHtmlMusicLoop() {
    if (typeof window === 'undefined' || !this.musicWavUrls) return;
    try {
      if (!this.bgMusicAudio) {
        this.bgMusicAudio = new Audio(this.musicWavUrls[this.musicState]);
        this.bgMusicAudio.loop = true;
      }
      const targetUrl = this.musicWavUrls[this.musicState];
      if (this.bgMusicAudio.src !== targetUrl) {
        const wasPlaying = !this.bgMusicAudio.paused;
        this.bgMusicAudio.src = targetUrl;
        this.bgMusicAudio.loop = true;
        if (wasPlaying && !this.muted) {
          this.bgMusicAudio.play().catch(() => {});
        }
      }
      const targetVol = this.muted
        ? 0
        : Math.max(0, Math.min(1, this.masterVolume * this.musicVolume * 0.55));
      this.bgMusicAudio.volume = targetVol;

      if (this.muted || targetVol <= 0.001) {
        if (!this.bgMusicAudio.paused) {
          this.bgMusicAudio.pause();
        }
      } else if (this.bgMusicAudio.paused && this.isMusicLoopRunning) {
        this.bgMusicAudio.play().catch(() => {});
      }
    } catch {
      // Ignore HTML audio errors
    }
  }

  /**
   * Capture-phase listener on window that:
   * 1) Immediately unlocks/resumes Web Audio & HTML5 Audio on ANY user gesture.
   * 2) Automatically plays a tactile arcane click whenever any <button> is clicked.
   */
  private bindGlobalGestureAndButtonAudio() {
    if (typeof window === 'undefined') return;

    const unlockAndResume = (e: Event) => {
      const ctx = this.ensureContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (!this.isMusicLoopRunning) {
        this.startBackgroundMusic();
      } else {
        this.syncHtmlMusicLoop();
      }

      // Play tactile UI click when clicking any interactive button or tab
      if (e.type === 'click' || e.type === 'pointerdown') {
        const target = e.target as HTMLElement | null;
        if (target && target.closest) {
          const interactive = target.closest('button, [role="button"]');
          if (interactive && e.type === 'click') {
            this.playClick();
          }
        }
      }
    };

    window.addEventListener('pointerdown', unlockAndResume, { capture: true });
    window.addEventListener('mousedown', unlockAndResume, { capture: true });
    window.addEventListener('click', unlockAndResume, { capture: true });
    window.addEventListener('touchend', unlockAndResume, { capture: true });
    window.addEventListener('keydown', unlockAndResume, { capture: true });
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private runWithActiveContext(fn: (ctx: AudioContext) => void) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      fn(ctx);
    } else {
      ctx
        .resume()
        .then(() => {
          if (this.ctx && this.ctx.state === 'running') {
            fn(this.ctx);
          }
        })
        .catch(() => {});
    }
  }

  public getAudioSettings(): PersistedAudioSettings {
    return {
      muted: this.muted,
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
    };
  }

  public getMusicState(): AudioTrackState {
    return this.musicState;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.saveSettings();
    this.syncHtmlMusicLoop();
    if (!muted && !this.isMusicLoopRunning) {
      this.startBackgroundMusic();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterVolume > 0 && this.muted) {
      this.muted = false;
    }
    this.saveSettings();
    this.syncHtmlMusicLoop();
    if (!this.isMusicLoopRunning) {
      this.startBackgroundMusic();
    }
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicVolume > 0 && this.muted) {
      this.muted = false;
    }
    this.saveSettings();
    this.syncHtmlMusicLoop();
    if (!this.isMusicLoopRunning) {
      this.startBackgroundMusic();
    }
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxVolume > 0 && this.muted) {
      this.muted = false;
    }
    this.saveSettings();
  }

  public setMusicState(nextState: AudioTrackState, _fadeSeconds = 0.8) {
    this.musicState = nextState;
    this.syncHtmlMusicLoop();
    if (this.ctx && !this.isMusicLoopRunning) {
      this.startBackgroundMusic();
    }
  }

  public startBackgroundMusic() {
    this.isMusicLoopRunning = true;
    this.syncHtmlMusicLoop();

    if (this.musicTimerId !== null) {
      return;
    }

    const stepMs = 240; // ~125 BPM 8th-note grid
    const tick = () => {
      if (!this.isMusicLoopRunning) return;
      this.scheduleMusicStep(this.stepIndex);
      this.stepIndex = (this.stepIndex + 1) % 32;
      this.musicTimerId = window.setTimeout(tick, stepMs);
    };

    tick();
  }

  public stopBackgroundMusic() {
    this.isMusicLoopRunning = false;
    if (this.musicTimerId !== null) {
      clearTimeout(this.musicTimerId);
      this.musicTimerId = null;
    }
    if (this.bgMusicAudio && !this.bgMusicAudio.paused) {
      this.bgMusicAudio.pause();
    }
  }

  private scheduleMusicStep(step: number) {
    if (this.muted || this.masterVolume <= 0.001 || this.musicVolume <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const musicGainScale = this.masterVolume * this.musicVolume;

    if (this.musicState === 'exploration') {
      // Rich mid-range D-dorian / A-minor celesta & harp arpeggio (audible on all speakers)
      const padRoots = [220.0, 293.66, 261.63, 196.0]; // A3, D4, C4, G3
      if (step % 4 === 0) {
        const root = padRoots[Math.floor(step / 4) % padRoots.length];
        this.playDirectTone(ctx, root, 'triangle', 0.9, 0.16 * musicGainScale, now, 0.04);
        this.playDirectTone(ctx, root * 1.5, 'sine', 0.85, 0.12 * musicGainScale, now, 0.05);
      }

      const arpScale = [440.0, 523.25, 659.25, 587.33, 783.99, 659.25, 523.25, 493.88];
      const note = arpScale[(step + Math.floor(step / 8)) % arpScale.length];
      this.playDirectTone(ctx, note, 'triangle', 0.32, 0.14 * musicGainScale, now, 0.015);
    } else if (this.musicState === 'combat') {
      const bassSequence = [220.0, 220.0, 261.63, 293.66, 220.0, 220.0, 196.0, 261.63];
      const bassFreq = bassSequence[Math.floor(step / 4) % bassSequence.length];

      if (step % 2 === 0) {
        this.playDirectTone(ctx, bassFreq, 'sawtooth', 0.22, 0.14 * musicGainScale, now, 0.01);
        this.playPercussionKick(ctx, now, 0.24 * musicGainScale, 135);
      }

      const combatMotif = [440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 392.0, 440.0];
      const mFreq = combatMotif[step % combatMotif.length];
      this.playDirectTone(ctx, mFreq, 'triangle', 0.22, 0.15 * musicGainScale, now, 0.01);
    } else {
      // boss_combat
      const bossRoots = [164.81, 174.61, 207.65, 174.61]; // E3, F3, G#3, F3
      const root = bossRoots[Math.floor(step / 8) % bossRoots.length];

      this.playDirectTone(ctx, root, 'sawtooth', 0.18, 0.16 * musicGainScale, now, 0.008);
      if (step % 2 === 0) {
        this.playPercussionKick(ctx, now, 0.28 * musicGainScale, 150);
      }

      const bossArp = [329.63, 349.23, 415.3, 440.0, 493.88, 554.37, 659.25, 554.37];
      const leadNote = bossArp[step % bossArp.length];
      this.playDirectTone(ctx, leadNote, 'sawtooth', 0.18, 0.14 * musicGainScale, now, 0.008);
    }
  }

  private playDirectTone(
    ctx: AudioContext,
    freq: number,
    type: OscillatorType,
    duration: number,
    peakGain: number,
    startTime: number,
    attackTime = 0.012
  ) {
    if (peakGain <= 0.0005) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(Math.min(0.95, peakGain), startTime + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playPercussionKick(
    ctx: AudioContext,
    startTime: number,
    peakGain: number,
    startFreq = 130
  ) {
    if (peakGain <= 0.0005) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.15);

    gain.gain.setValueAtTime(Math.min(0.95, peakGain), startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.17);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.18);
  }

  // ============================================================================
  // SOUND EFFECTS (Dual Web Audio + PCM WAV Output)
  // ============================================================================

  public playClick() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    const perfNow = performance.now();
    if (perfNow - this.lastClickSfxTime < 65) return;
    this.lastClickSfxTime = perfNow;

    this.playWavSfx('click', 0.75);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      this.playDirectTone(ctx, 680, 'triangle', 0.075, 0.32 * sfxScale, now, 0.005);
      this.playDirectTone(ctx, 1020, 'sine', 0.085, 0.24 * sfxScale, now + 0.015, 0.005);
    });
  }

  public playBuild() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx('build', 0.85);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      const notes = [330, 440, 659.25];
      notes.forEach((freq, idx) => {
        this.playDirectTone(
          ctx,
          freq,
          'triangle',
          0.16,
          0.34 * sfxScale,
          now + idx * 0.045,
          0.008
        );
      });
    });
  }

  public playSkinEquip() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx('fanfare', 0.85);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        this.playDirectTone(
          ctx,
          freq,
          'triangle',
          0.22,
          0.35 * sfxScale,
          now + idx * 0.05,
          0.008
        );
      });
    });
  }

  public playWaveStart() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx('horn', 0.9);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      const freqs = [220, 329.63, 440];
      freqs.forEach((freq, i) => {
        this.playDirectTone(
          ctx,
          freq,
          i === 0 ? 'sawtooth' : 'triangle',
          0.42,
          0.34 * sfxScale,
          now + i * 0.08,
          0.015
        );
      });
    });
  }

  public playSuperFusion() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx('fanfare', 0.95);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
      chord.forEach((freq, i) => {
        this.playDirectTone(
          ctx,
          freq,
          i % 2 === 0 ? 'triangle' : 'sine',
          0.42,
          0.32 * sfxScale,
          now + i * 0.05,
          0.01
        );
      });
    });
  }

  public playShoot(type: 'beam' | 'nova' | 'mortar' | 'hybrid') {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx(type === 'mortar' ? 'boom' : 'shoot', 0.65);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'beam') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(340, now + 0.11);
        gain.gain.setValueAtTime(0.28 * sfxScale, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      } else if (type === 'nova') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(560, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        gain.gain.setValueAtTime(0.3 * sfxScale, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      } else if (type === 'mortar') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(58, now + 0.24);
        gain.gain.setValueAtTime(0.36 * sfxScale, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.18);
        gain.gain.setValueAtTime(0.32 * sfxScale, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
    });
  }

  public playEnemyHit(isCritical = false) {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    const perfNow = performance.now();
    if (perfNow - this.lastEnemyHitSfxTime < 75) return;
    this.lastEnemyHitSfxTime = perfNow;

    const sfxScale = this.masterVolume * this.sfxVolume;
    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      this.playDirectTone(
        ctx,
        isCritical ? 540 : 350,
        isCritical ? 'sawtooth' : 'triangle',
        0.07,
        (isCritical ? 0.28 : 0.2) * sfxScale,
        now,
        0.004
      );
    });
  }

  public playEnemyDefeat(isBoss = false) {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    if (isBoss) {
      this.playWavSfx('fanfare', 0.9);
    }
    const sfxScale = this.masterVolume * this.sfxVolume;
    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      const notes = isBoss ? [220, 329.63, 440, 659.25] : [392, 523.25];
      notes.forEach((freq, idx) => {
        this.playDirectTone(
          ctx,
          freq,
          'triangle',
          0.14,
          (isBoss ? 0.35 : 0.24) * sfxScale,
          now + idx * 0.04,
          0.006
        );
      });
    });
  }

  public playFreezePulse() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    const sfxScale = this.masterVolume * this.sfxVolume;
    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      this.playDirectTone(ctx, 1180, 'sine', 0.14, 0.26 * sfxScale, now, 0.006);
      this.playDirectTone(ctx, 780, 'triangle', 0.15, 0.22 * sfxScale, now + 0.03, 0.006);
    });
  }

  public playMeteorImpact() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx('boom', 0.95);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.5);

      gain.gain.setValueAtTime(0.45 * sfxScale, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.54);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.56);
    });
  }

  public playGolemSummon() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx('horn', 0.85);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      [196.0, 261.63, 329.63, 392.0].forEach((freq, idx) => {
        this.playDirectTone(
          ctx,
          freq,
          'triangle',
          0.32,
          0.34 * sfxScale,
          now + idx * 0.06,
          0.01
        );
      });
    });
  }

  public playBossAlert() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx('horn', 0.95);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      [220.0, 207.65, 164.81].forEach((freq, idx) => {
        this.playDirectTone(
          ctx,
          freq,
          'sawtooth',
          0.4,
          0.38 * sfxScale,
          now + idx * 0.2,
          0.012
        );
      });
    });
  }

  public playAchievementUnlock() {
    if (this.muted || this.masterVolume <= 0.001 || this.sfxVolume <= 0.001) return;
    this.playWavSfx('fanfare', 0.95);
    const sfxScale = this.masterVolume * this.sfxVolume;

    this.runWithActiveContext((ctx) => {
      const now = ctx.currentTime;
      const fanfare = [523.25, 659.25, 783.99, 1046.5];
      fanfare.forEach((freq, idx) => {
        this.playDirectTone(
          ctx,
          freq,
          'triangle',
          0.36,
          0.38 * sfxScale,
          now + idx * 0.075,
          0.01
        );
      });
    });
  }

  public playTestSound() {
    this.muted = false;
    if (this.masterVolume < 0.5) this.masterVolume = 0.9;
    if (this.musicVolume < 0.4) this.musicVolume = 0.82;
    if (this.sfxVolume < 0.5) this.sfxVolume = 0.95;
    this.saveSettings();
    this.startBackgroundMusic();
    this.playAchievementUnlock();
  }
}

export const soundEngine = new SoundEngine();
