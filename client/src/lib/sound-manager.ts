import { BlockTexture } from "@shared/schema";

class SoundManager {
  private audioContext: AudioContext | null = null;
  private isUnlocked = false;
  private unlockAttempted = false;

  private async ensureAudioContext(): Promise<boolean> {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('Failed to create AudioContext:', e);
        return false;
      }
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('Failed to resume AudioContext:', e);
        return false;
      }
    }

    this.isUnlocked = this.audioContext.state === 'running';
    return this.isUnlocked;
  }

  private createOscillator(
    frequency: number,
    type: OscillatorType,
    duration: number,
    gainValue: number,
    attackTime: number = 0.01,
    decayTime: number = 0.1
  ) {
    if (!this.audioContext || this.audioContext.state !== 'running') return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(gainValue, this.audioContext.currentTime + attackTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      console.warn('Failed to create oscillator:', e);
    }
  }

  private createNoise(duration: number, gainValue: number, filterFreq: number) {
    if (!this.audioContext || this.audioContext.state !== 'running') return;

    try {
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      noise.start();
    } catch (e) {
      console.warn('Failed to create noise:', e);
    }
  }

  async playBlockPlace(texture: BlockTexture) {
    const ready = await this.ensureAudioContext();
    if (!ready) return;
    
    switch (texture) {
      case 'metallic':
        this.playMetallicPlace();
        break;
      case 'wood':
        this.playWoodPlace();
        break;
      default:
        this.playDefaultPlace();
        break;
    }
  }

  async playLineClear(texture: BlockTexture) {
    const ready = await this.ensureAudioContext();
    if (!ready) return;
    
    switch (texture) {
      case 'metallic':
        this.playMetallicClear();
        break;
      case 'wood':
        this.playWoodClear();
        break;
      default:
        this.playDefaultClear();
        break;
    }
  }

  private playDefaultPlace() {
    this.createOscillator(220, 'sine', 0.15, 0.15);
    setTimeout(() => this.createOscillator(330, 'sine', 0.1, 0.1), 30);
  }

  private playDefaultClear() {
    const frequencies = [523, 659, 784, 1047];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 'sine', 0.2, 0.12);
      }, i * 50);
    });
  }

  private playMetallicPlace() {
    this.createOscillator(880, 'triangle', 0.3, 0.08);
    this.createOscillator(1760, 'sine', 0.2, 0.04);
    this.createOscillator(2640, 'sine', 0.15, 0.02);
    this.createNoise(0.05, 0.03, 8000);
  }

  private playMetallicClear() {
    const frequencies = [880, 1108, 1318, 1760];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 'triangle', 0.4, 0.1);
        this.createOscillator(freq * 2, 'sine', 0.3, 0.05);
        this.createOscillator(freq * 3, 'sine', 0.2, 0.02);
      }, i * 80);
    });
    this.createNoise(0.1, 0.02, 6000);
  }

  private playWoodPlace() {
    this.createOscillator(180, 'sine', 0.12, 0.2);
    this.createOscillator(360, 'sine', 0.08, 0.1);
    this.createNoise(0.08, 0.08, 1500);
  }

  private playWoodClear() {
    const frequencies = [220, 277, 330, 440];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 'sine', 0.25, 0.15);
        this.createOscillator(freq * 2, 'sine', 0.15, 0.05);
        this.createNoise(0.06, 0.05, 2000);
      }, i * 60);
    });
  }

  async initialize() {
    await this.ensureAudioContext();
  }

  setupGlobalUnlock() {
    if (this.unlockAttempted) return;
    this.unlockAttempted = true;

    const unlock = async () => {
      if (this.isUnlocked) return;
      
      await this.ensureAudioContext();
      
      if (this.isUnlocked) {
        document.removeEventListener('touchstart', unlock, true);
        document.removeEventListener('touchend', unlock, true);
        document.removeEventListener('click', unlock, true);
        document.removeEventListener('keydown', unlock, true);
      }
    };

    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('touchend', unlock, true);
    document.addEventListener('click', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }
}

export const soundManager = new SoundManager();

if (typeof window !== 'undefined') {
  soundManager.setupGlobalUnlock();
}
