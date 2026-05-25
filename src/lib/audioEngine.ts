import * as Tone from 'tone';

export class AudioEngine {
  deckA: Tone.Player;
  deckB: Tone.Player;
  eqA: Tone.EQ3;
  eqB: Tone.EQ3;
  filterA: Tone.Filter;
  filterB: Tone.Filter;
  crossfader: Tone.CrossFade;
  analyserA: Tone.Analyser;
  analyserB: Tone.Analyser;
  bitcrusherA: Tone.BitCrusher;
  bitcrusherB: Tone.BitCrusher;
  reverbA: Tone.Reverb;
  reverbB: Tone.Reverb;
  echoA: Tone.FeedbackDelay;
  echoB: Tone.FeedbackDelay;
  phaserA: Tone.Phaser;
  phaserB: Tone.Phaser;
  pitchShiftA: Tone.PitchShift;
  pitchShiftB: Tone.PitchShift;
  gainA: Tone.Gain;
  gainB: Tone.Gain;
  xfadeMuteGainA: Tone.Gain;
  xfadeMuteGainB: Tone.Gain;
  sampler: Tone.Players;
  crossfadeCurve: number = 0.5; // 0 = linear, 1 = hard cut
  keyLockA: boolean = false;
  keyLockB: boolean = false;
  
  private playStartTime = { A: 0, B: 0 };
  private playOffset = { A: 0, B: 0 };
  
  private recorder: Tone.Recorder = new Tone.Recorder();

  constructor() {
    this.deckA = new Tone.Player();
    this.deckB = new Tone.Player();
    
    this.analyserA = new Tone.Analyser("fft", 64);
    this.analyserB = new Tone.Analyser("fft", 64);

    this.bitcrusherA = new Tone.BitCrusher(4);
    this.bitcrusherB = new Tone.BitCrusher(4);
    this.bitcrusherA.wet.value = 0;
    this.bitcrusherB.wet.value = 0;

    this.reverbA = new Tone.Reverb(2);
    this.reverbB = new Tone.Reverb(2);
    this.reverbA.wet.value = 0;
    this.reverbB.wet.value = 0;

    this.echoA = new Tone.FeedbackDelay("1/4n", 0.5);
    this.echoB = new Tone.FeedbackDelay("1/4n", 0.5);
    this.echoA.wet.value = 0;
    this.echoB.wet.value = 0;

    this.phaserA = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 1000 });
    this.phaserB = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 1000 });
    this.phaserA.wet.value = 0;
    this.phaserB.wet.value = 0;

    this.pitchShiftA = new Tone.PitchShift(0);
    this.pitchShiftB = new Tone.PitchShift(0);
    
    this.gainA = new Tone.Gain(1);
    this.gainB = new Tone.Gain(1);

    this.xfadeMuteGainA = new Tone.Gain(1);
    this.xfadeMuteGainB = new Tone.Gain(1);
    
    this.sampler = new Tone.Players({
      "kick": "https://cdn.pixabay.com/audio/2022/03/10/audio_5594b39b03.mp3",
      "snare": "https://cdn.pixabay.com/audio/2022/03/10/audio_6500e5728a.mp3",
      "clap": "https://cdn.pixabay.com/audio/2021/11/24/audio_95932560f4.mp3",
      "hihat": "https://cdn.pixabay.com/audio/2022/03/10/audio_730248c823.mp3",
      "scratch": "https://cdn.pixabay.com/audio/2022/03/10/audio_c3c3a44f01.mp3",
      "fx_1": "https://cdn.pixabay.com/audio/2022/03/15/audio_731e84d471.mp3",
      "fx_2": "https://cdn.pixabay.com/audio/2023/04/16/audio_946a36c84c.mp3",
      "fx_3": "https://cdn.pixabay.com/audio/2022/01/18/audio_824553d10c.mp3",
    }).toDestination();
    
    this.eqA = new Tone.EQ3(0, 0, 0);
    this.eqB = new Tone.EQ3(0, 0, 0);
    
    this.filterA = new Tone.Filter(20000, "lowpass");
    this.filterB = new Tone.Filter(20000, "lowpass");
    
    this.crossfader = new Tone.CrossFade(0.5);
    
    // Routing: Player -> Gain -> Pitch -> EQ -> Analyser -> bitcrusher -> reverb -> Echo -> Phaser -> Filter -> XfadeMuteGain -> Crossfader -> Master
    this.deckA.chain(this.gainA, this.pitchShiftA, this.eqA, this.analyserA, this.bitcrusherA, this.reverbA, this.echoA, this.phaserA, this.filterA, this.xfadeMuteGainA, this.crossfader.a);
    this.deckB.chain(this.gainB, this.pitchShiftB, this.eqB, this.analyserB, this.bitcrusherB, this.reverbB, this.echoB, this.phaserB, this.filterB, this.xfadeMuteGainB, this.crossfader.b);
    
    this.crossfader.toDestination();
    this.crossfader.connect(this.recorder);
  }

  startRecording() {
    this.recorder.start();
  }

  async stopRecording() {
    const blob = await this.recorder.stop();
    return URL.createObjectURL(blob);
  }

  stop(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    if (player.state === 'started') {
      player.stop();
    }
  }

  private basePlaybackRates = { A: 1, B: 1 };
  private bends = { A: 1, B: 1 };

  setFX(deck: 'A' | 'B', type: 'crush' | 'reverb' | 'echo' | 'flanger', wet: number) {
    let fx;
    if (type === 'crush') fx = deck === 'A' ? this.bitcrusherA : this.bitcrusherB;
    else if (type === 'reverb') fx = deck === 'A' ? this.reverbA : this.reverbB;
    else if (type === 'echo') fx = deck === 'A' ? this.echoA : this.echoB;
    else fx = deck === 'A' ? this.phaserA : this.phaserB;
    
    fx.wet.rampTo(wet, 0.1);
  }

  async loadTrack(deck: 'A' | 'B', url: string) {
    const player = this.getDeck(deck);
    
    // Stop and clear before loading new
    if (player.state === 'started') {
      player.stop();
    }
    this.playOffset[deck] = 0;
    this.playStartTime[deck] = 0;
    
    try {
      await player.load(url);
      player.loop = true;
      this.applyRate(deck); // Ensure rate is correct for new track
    } catch (error) {
      console.error(`AudioEngine Error loading track on ${deck}:`, error);
      throw error;
    }
  }

  private getDeck(deck: 'A' | 'B') {
    switch (deck) {
      case 'A': return this.deckA;
      case 'B': return this.deckB;
    }
  }

  playPause(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    if (player.state === 'started') {
      this.playOffset[deck] += (Tone.now() - this.playStartTime[deck]) * player.playbackRate;
      player.stop();
    } else {
      try {
        if (player.buffer && player.buffer.loaded && player.buffer.duration > 0) {
          this.playStartTime[deck] = Tone.now();
          player.start(undefined, this.playOffset[deck] % player.buffer.duration);
        } else {
          console.warn(`Deck ${deck} buffer not ready`);
        }
      } catch (e) {
        console.error(`Error starting deck ${deck}:`, e);
      }
    }
  }

  seek(deck: 'A' | 'B', time: number) {
    const player = this.getDeck(deck);
    if (!player.buffer.loaded) return;
    
    const wasPlaying = player.state === 'started';
    player.stop();
    this.playOffset[deck] = time;
    if (wasPlaying) {
      this.playStartTime[deck] = Tone.now();
      player.start(undefined, time % player.buffer.duration);
    }
  }

  getPosition(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    if (player.state === 'started') {
      const elapsed = (Tone.now() - this.playStartTime[deck]) * player.playbackRate;
      return (this.playOffset[deck] + elapsed) % player.buffer.duration;
    }
    return this.playOffset[deck] % (player.buffer.duration || 1);
  }

  setLoop(deck: 'A' | 'B', start: number, end: number) {
    const player = this.getDeck(deck);
    player.loop = true;
    player.loopStart = start;
    player.loopEnd = end;
  }

  clearLoop(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    player.loop = false;
  }

  setGain(deck: 'A' | 'B', value: number) {
    const gainNode = deck === 'A' ? this.gainA : this.gainB;
    gainNode.gain.rampTo(value, 0.1);
  }

  setVolume(deck: 'A' | 'B', value: number) {
    const player = this.getDeck(deck);
    // Channel volume (Fader)
    player.volume.value = Tone.gainToDb(value);
  }

  setKeyLock(deck: 'A' | 'B', enabled: boolean) {
    if (deck === 'A') this.keyLockA = enabled;
    else this.keyLockB = enabled;
    this.applyRate(deck);
  }

  setEQ(deck: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) {
    let eq;
    switch (deck) {
      case 'A': eq = this.eqA; break;
      case 'B': eq = this.eqB; break;
    }
    eq[band].value = value;
  }

  setFilter(deck: 'A' | 'B', value: number) {
    let filter;
    switch (deck) {
      case 'A': filter = this.filterA; break;
      case 'B': filter = this.filterB; break;
    }
    // -50 to 50 input
    if (value < 0) {
      filter.type = "lowpass";
      filter.frequency.value = Tone.mtof((Tone.ftom(20000) as any) + value * 2); 
    } else {
      filter.type = "highpass";
      filter.frequency.value = value * 100;
    }
  }

  setCrossfaderCurve(value: number) {
    this.crossfadeCurve = value;
    this.updateCrossfader(this.crossfader.fade.value);
  }

  setCrossfade(value: number) {
    this.updateCrossfader(value);
  }

  private updateCrossfader(value: number) {
    // Battle curve logic: 0 = linear blend, 1 = instant on
    let fadeVal = value;
    if (this.crossfadeCurve > 0.8) {
        // Hard cut
        if (value < 0.45) fadeVal = 0;
        else if (value > 0.55) fadeVal = 1;
        else fadeVal = 0.5;
    }
    
    this.crossfader.fade.value = fadeVal;

    // To prevent any sound bleed at the extremes, explicitly mute via the gain nodes:
    // If we are fully on the left (fadeVal is 0), Channel B should be completely silent (0 gain)
    if (fadeVal <= 0.01) {
      this.xfadeMuteGainA.gain.value = 1;
      this.xfadeMuteGainB.gain.value = 0;
    } 
    // If we are fully on the right (fadeVal is 1), Channel A should be completely silent (0 gain)
    else if (fadeVal >= 0.99) {
      this.xfadeMuteGainA.gain.value = 0;
      this.xfadeMuteGainB.gain.value = 1;
    } 
    // Otherwise, both gains are 1 (since the Tone.CrossFade is handling the blending in between)
    else {
      this.xfadeMuteGainA.gain.value = 1;
      this.xfadeMuteGainB.gain.value = 1;
    }
  }

  setPlaybackRate(deck: 'A' | 'B', rate: number) {
    this.basePlaybackRates[deck] = rate;
    this.applyRate(deck);
  }

  setPitchBend(deck: 'A' | 'B', bend: number) {
    this.bends[deck] = bend;
    this.applyRate(deck);
  }

  private applyRate(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    const pitchShift = deck === 'A' ? this.pitchShiftA : this.pitchShiftB;
    const keyLock = deck === 'A' ? this.keyLockA : this.keyLockB;

    try {
      if (player.buffer && player.buffer.loaded) {
        const rate = this.basePlaybackRates[deck] * this.bends[deck];
        player.playbackRate = rate;

        if (keyLock) {
          // Compensate pitch shift to keep original key
          // semitones = 12 * log2(rate)
          const semitones = 12 * Math.log2(rate);
          pitchShift.pitch = -semitones;
        } else {
          pitchShift.pitch = 0;
        }
      }
    } catch (e) {
      console.warn(`Could not set playback rate for deck ${deck}:`, e);
    }
  }

  triggerSample(name: string) {
    if (this.sampler.has(name)) {
      const player = this.sampler.player(name);
      // Randomize pitch slightly for more natural repetition
      if (name === 'scratch') {
        player.playbackRate = 0.8 + Math.random() * 0.4;
      } else {
        player.playbackRate = 1;
      }
      player.start();
    }
  }

  scratchWheel(velocity: number) {
    if (this.sampler.has('scratch')) {
      const player = this.sampler.player('scratch');
      // Normalize velocity: 400-2000 -> 0.5-2.0 playback rate
      const rate = Math.max(0.5, Math.min(2.5, velocity / 800));
      player.playbackRate = rate;
      
      // If already playing, don't restart too often but update rate?
      // Actually Players.player(name) restarts by default.
      player.start();
    }
  }

  getFrequencyData(deck: 'A' | 'B') {
    return (deck === 'A' ? this.analyserA : this.analyserB).getValue();
  }
}

export const audioEngine = new AudioEngine();
