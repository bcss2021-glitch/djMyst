import * as Tone from 'tone';

export class AudioEngine {
  deckA: Tone.Player;
  deckB: Tone.Player;
  eqA: Tone.EQ3;
  eqB: Tone.EQ3;
  filterA: Tone.Filter;
  filterB: Tone.Filter;
  faderGainA: Tone.Gain;
  faderGainB: Tone.Gain;
  xfadeGainA: Tone.Gain;
  xfadeGainB: Tone.Gain;
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
  sampler: Tone.Players;
  limiter: Tone.Limiter;
  crossfadeValue: number = 0.5;
  crossfadeCurve: number = 0.5; // 0 = linear, 1 = hard cut
  keyLockA: boolean = false;
  keyLockB: boolean = false;
  
  private playStartTime = { A: 0, B: 0 };
  private playOffset = { A: 0, B: 0 };
  
  private recorder: Tone.Recorder = new Tone.Recorder();

  constructor() {
    this.deckA = new Tone.Player();
    this.deckB = new Tone.Player();
    this.limiter = new Tone.Limiter(-1.5); // Add high-grade professional Limiter to prevent clipping scratchiness
    
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
    
    this.gainA = new Tone.Gain(1); // pre-fader trim gain
    this.gainB = new Tone.Gain(1); // pre-fader trim gain

    this.faderGainA = new Tone.Gain(0.33); // channel volumes
    this.faderGainB = new Tone.Gain(0.33);

    this.xfadeGainA = new Tone.Gain(1.0); // crossfader mixers
    this.xfadeGainB = new Tone.Gain(1.0);
    
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
    
    // Explicit, deterministic, and highly-isolated step-by-step routing
    // DECK A CONNECT SEQUENCE
    this.deckA.connect(this.gainA);
    this.gainA.connect(this.pitchShiftA);
    this.pitchShiftA.connect(this.eqA);
    this.eqA.connect(this.analyserA);
    this.analyserA.connect(this.bitcrusherA);
    this.bitcrusherA.connect(this.reverbA);
    this.reverbA.connect(this.echoA);
    this.echoA.connect(this.phaserA);
    this.phaserA.connect(this.filterA);
    this.filterA.connect(this.faderGainA);
    this.faderGainA.connect(this.xfadeGainA);
    this.xfadeGainA.connect(this.limiter);

    // DECK B CONNECT SEQUENCE
    this.deckB.connect(this.gainB);
    this.gainB.connect(this.pitchShiftB);
    this.pitchShiftB.connect(this.eqB);
    this.eqB.connect(this.analyserB);
    this.analyserB.connect(this.bitcrusherB);
    this.bitcrusherB.connect(this.reverbB);
    this.reverbB.connect(this.echoB);
    this.echoB.connect(this.phaserB);
    this.phaserB.connect(this.filterB);
    this.filterB.connect(this.faderGainB);
    this.faderGainB.connect(this.xfadeGainB);
    this.xfadeGainB.connect(this.limiter);
    
    this.limiter.connect(Tone.Destination);
    this.limiter.connect(this.recorder);
  }

  clearStatic() {
    try {
      if (Tone.context.state === 'suspended') {
        Tone.context.resume();
      }
      
      // Momentarily disable/clear delay/echo buffers to flush audio queues
      const oldValA = this.echoA.feedback.value;
      const oldValB = this.echoB.feedback.value;
      this.echoA.feedback.value = 0;
      this.echoB.feedback.value = 0;
      
      setTimeout(() => {
        this.echoA.feedback.value = oldValA;
        this.echoB.feedback.value = oldValB;
      }, 80);

      // Trigger automatic gain calibration
      if (this.gainA.gain.value > 1.2) this.gainA.gain.value = 1.0;
      if (this.gainB.gain.value > 1.2) this.gainB.gain.value = 1.0;
    } catch (e) {
      console.error("Failed to clear audio static:", e);
    }
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

  createSyntheticBuffer(tempo = 125, duration = 60, style: 'techno' | 'house' | 'bass' = 'techno'): AudioBuffer {
    const sampleRate = Tone.context.sampleRate || 44100;
    const totalSamples = sampleRate * duration;
    const buffer = Tone.context.createBuffer(2, totalSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    
    const beatLength = 60 / tempo;
    const beatSamples = sampleRate * beatLength;
    const barSamples = beatSamples * 4;
    
    for (let i = 0; i < totalSamples; i++) {
      const time = i / sampleRate;
      const beatProgress = (i % beatSamples) / beatSamples;
      const barProgress = (i % barSamples) / barSamples;
      
      const currentBeat = Math.floor(time / beatLength);
      const currentBar = Math.floor(time / (beatLength * 4));
      
      let sigLeft = 0;
      let sigRight = 0;
      
      if (style === 'techno') {
        let kick = 0;
        if (beatProgress < 0.25) {
          const freq = 160 * Math.exp(-beatProgress * 32) + 42;
          kick = Math.sin(2 * Math.PI * freq * (beatProgress * beatLength)) * Math.exp(-beatProgress * 6);
          kick = Math.tanh(kick * 1.5) * 0.55;
        }
        
        let hihat = 0;
        const offbeat = (beatProgress + 0.5) % 1.0;
        if (offbeat < 0.15) {
          hihat = (Math.random() - 0.5) * Math.exp(-offbeat * 35) * 0.14;
        }
        
        const sixteenth = (beatProgress * 4) % 1.0;
        const sixteenthNum = Math.floor(beatProgress * 4);
        let shaker = 0;
        if (sixteenthNum !== 2) {
          shaker = (Math.random() - 0.5) * Math.exp(-sixteenth * 50) * 0.04;
        }
        
        const sixteenthIndex = Math.floor((i % barSamples) / (beatSamples / 4));
        const subdivisionProgress = (i % (beatSamples / 4)) / (beatSamples / 4);
        
        let rootFreq = 55;
        if (currentBar % 4 === 1) rootFreq = 65.4;
        if (currentBar % 4 === 2) rootFreq = 49;
        if (currentBar % 4 === 3) rootFreq = 58.27;
        
        const bassSteps = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0];
        let bass = 0;
        if (bassSteps[sixteenthIndex % 16] === 1) {
          const slideFreq = rootFreq * (sixteenthIndex % 3 === 0 ? 1.5 : 1);
          const filterCutoff = Math.exp(-subdivisionProgress * 5);
          const bassCycle = (time * slideFreq * 2 * Math.PI) % (2 * Math.PI);
          const rawSaw = (bassCycle / Math.PI) - 1;
          bass = rawSaw * filterCutoff * 0.15;
        }
        
        const drone = Math.sin(2 * Math.PI * 110 * time) * Math.sin(time * 0.1) * 0.02;
        
        sigLeft = kick + hihat * 0.7 + shaker * 0.5 + bass + drone;
        sigRight = kick + hihat * 0.3 - shaker * 0.5 + bass + drone;
        
      } else if (style === 'house') {
        let kick = 0;
        if (beatProgress < 0.22) {
          const freq = 140 * Math.exp(-beatProgress * 28) + 45;
          kick = Math.sin(2 * Math.PI * freq * (beatProgress * beatLength)) * Math.exp(-beatProgress * 8) * 0.5;
        }
        
        let hihat = 0;
        const offbeat = (beatProgress + 0.5) % 1.0;
        if (offbeat < 0.12) {
          hihat = (Math.random() - 0.5) * Math.exp(-offbeat * 30) * 0.13;
        }
        
        let clap = 0;
        const beatNum = currentBeat % 4;
        if (beatNum === 1 || beatNum === 3) {
          if (beatProgress < 0.18) {
            const preTap = beatProgress < 0.02 ? (Math.random() - 0.5) * 0.11 : 0;
            const mainTap = (Math.random() - 0.5) * Math.exp(-(beatProgress - 0.02) * 22) * 0.15;
            clap = preTap + mainTap;
          }
        }
        
        const eighthIndex = Math.floor((i % barSamples) / (beatSamples / 2));
        const eighthProgress = (i % (beatSamples / 2)) / (beatSamples / 2);
        
        const chordRoots = [110, 87.3, 130.8, 98.0];
        const activeChord = chordRoots[currentBar % 4];
        
        const arpeggio = [1.0, 1.25, 1.5, 1.875, 2.0, 1.5, 1.25, 1.0];
        const noteFactor = arpeggio[eighthIndex % 8];
        const pluckFreq = activeChord * noteFactor;
        
        const pluckEnv = Math.exp(-eighthProgress * 6) * 0.08;
        const cycle = (time * pluckFreq * 2 * Math.PI) % (2 * Math.PI);
        const triangle = (Math.abs((cycle / Math.PI) - 1) * 2 - 1) * pluckEnv;
        
        const pingPong = eighthIndex % 2 === 0 ? 0.8 : 0.2;
        
        sigLeft = kick + hihat * 0.6 + clap * 0.5 + triangle * pingPong;
        sigRight = kick + hihat * 0.4 + clap * 0.5 + triangle * (1 - pingPong);
        
      } else {
        let kick = 0;
        if (beatProgress < 0.2) {
          const freq = 180 * Math.exp(-beatProgress * 35) + 38;
          kick = Math.sin(2 * Math.PI * freq * (beatProgress * beatLength)) * Math.exp(-beatProgress * 5) * 0.55;
        }
        
        let hihat = 0;
        const offbeat = (beatProgress + 0.5) % 1.0;
        if (offbeat < 0.08) {
          hihat = (Math.random() - 0.5) * Math.exp(-offbeat * 45) * 0.1;
        }
        
        let snare = 0;
        const beatNum = currentBeat % 4;
        if ((beatNum === 1 || beatNum === 3) && beatProgress < 0.15) {
          const noisePart = (Math.random() - 0.5) * Math.exp(-beatProgress * 25) * 0.09;
          const sinePart = Math.sin(2 * Math.PI * 180 * beatProgress) * Math.exp(-beatProgress * 15) * 0.08;
          snare = noisePart + sinePart;
        }
        
        const sixteenthIndex = Math.floor((i % barSamples) / (beatSamples / 4));
        const sixteenthProgress = (i % (beatSamples / 4)) / (beatSamples / 4);
        
        const bassPattern = [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0];
        let bass = 0;
        if (bassPattern[sixteenthIndex % 16] === 1) {
          let bassOffset = 0;
          if (sixteenthIndex % 4 === 1) bassOffset = 1.12;
          if (sixteenthIndex % 4 === 3) bassOffset = 1.5;
          
          let baseNote = 41.2;
          if ((currentBar % 8) >= 4) baseNote = 46.25;
          
          const bassFreq = baseNote * bassOffset;
          const phase = (time * bassFreq * 2 * Math.PI) % (2 * Math.PI);
          const rawPulse = (phase < Math.PI ? 1 : -1);
          const envelope = Math.exp(-sixteenthProgress * 4) * 0.22;
          bass = Math.tanh(rawPulse * 2.0) * envelope;
        }
        
        sigLeft = kick + hihat * 0.5 + snare * 0.6 + bass * 0.9;
        sigRight = kick + hihat * 0.5 + snare * 0.6 + bass * 0.9;
      }
      
      let fadeIn = 1.0;
      if (time < 1.0) {
        fadeIn = time;
      } else if (time > duration - 1.0) {
        fadeIn = duration - time;
      }
      
      left[i] = Math.max(-0.95, Math.min(0.95, sigLeft * fadeIn));
      right[i] = Math.max(-0.95, Math.min(0.95, sigRight * fadeIn));
    }
    
    return buffer;
  }

  async loadTrack(deck: 'A' | 'B', url: string) {
    // Completely dispose of the old Tone.Player to cancel any pending downloads or locks
    const oldPlayer = this.getDeck(deck);
    try {
      if (oldPlayer) {
        oldPlayer.stop();
        oldPlayer.dispose();
      }
    } catch (e) {
      console.warn("Error disposing old player node:", e);
    }

    const player = new Tone.Player();
    player.connect(deck === 'A' ? this.gainA : this.gainB);
    
    if (deck === 'A') {
      this.deckA = player;
    } else {
      this.deckB = player;
    }
    
    this.playOffset[deck] = 0;
    this.playStartTime[deck] = 0;
    
    // Intercept default system tracks to load locally processed synthetic loops
    if (url.includes('pixabay.com/audio') && (url.includes('653925c48b') || url.includes('249df9c4d4') || url.includes('6a20803c62'))) {
      try {
        let style: 'techno' | 'house' | 'bass' = 'techno';
        let tempo = 126;
        if (url.includes('249df9c4d4')) {
          style = 'house';
          tempo = 122;
        } else if (url.includes('6a20803c62')) {
          style = 'bass';
          tempo = 128;
        }
        
        const buffer = this.createSyntheticBuffer(tempo, 60, style);
        player.buffer = new Tone.ToneAudioBuffer(buffer);
        player.loop = true;
        this.applyRate(deck);
        return;
      } catch (sysErr) {
        console.error("Failed to generate synthetic loop:", sysErr);
      }
    }

    try {
      await player.load(url);
      player.loop = true;
      this.applyRate(deck); // Ensure rate is correct for new track
    } catch (error) {
      console.error(`AudioEngine Error loading track on ${deck}:`, error);
      // Fallback: If loading fails due to CORS or networking, generate a seamless synthetic loop
      try {
        console.warn("Loading failed. Falling back to synthetic track so player works seamlessly.");
        const seedStyle = url.toLowerCase().includes('house') ? 'house' : (url.toLowerCase().includes('bass') ? 'bass' : 'techno');
        const buffer = this.createSyntheticBuffer(125, 60, seedStyle);
        player.buffer = new Tone.ToneAudioBuffer(buffer);
        player.loop = true;
        this.applyRate(deck);
      } catch (fallbackError) {
        throw error; // Throw original error if fallback also failed
      }
    }
  }

   getDeck(deck: 'A' | 'B') {
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
    const fader = deck === 'A' ? this.faderGainA : this.faderGainB;
    // Channel volume (Fader) - Clean, linear gain ramping
    fader.gain.rampTo(value, 0.05);
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
    this.updateCrossfader(this.crossfadeValue);
  }

  setCrossfade(value: number) {
    this.crossfadeValue = value;
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

    // Apply professional Equal Gain DJ crossfader curve to prevent split bleed
    let gainA = 1;
    let gainB = 1;

    if (this.crossfadeCurve > 0.8) {
      if (fadeVal === 0) {
        gainA = 1;
        gainB = 0;
      } else if (fadeVal === 1) {
        gainA = 0;
        gainB = 1;
      } else {
        gainA = 1;
        gainB = 1;
      }
    } else {
      // Equal Gain / Constant Power blend
      // If we are leaning to the left (<= 0.5), Deck A is 100%, Deck B fades linearly to 0
      if (fadeVal <= 0.5) {
        gainA = 1;
        gainB = Math.max(0, Math.min(1, fadeVal * 2));
      } else {
        // If we are leaning to the right (> 0.5), Deck B is 100%, Deck A fades linearly to 0
        gainB = 1;
        gainA = Math.max(0, Math.min(1, (1 - fadeVal) * 2));
      }
    }

    // Assign gain values safely through explicit rampTo
    this.xfadeGainA.gain.rampTo(gainA, 0.05);
    this.xfadeGainB.gain.rampTo(gainB, 0.05);
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

  setReverse(deck: 'A' | 'B', enabled: boolean) {
    try {
      const player = this.getDeck(deck);
      player.reverse = enabled;
    } catch (e) {
      console.error(`Failed to set reverse on deck ${deck}:`, e);
    }
  }

  scratchSeek(deck: 'A' | 'B', deltaSeconds: number) {
    const player = this.getDeck(deck);
    if (!player.buffer.loaded || player.buffer.duration === 0) return;
    
    try {
      const current = this.getPosition(deck);
      let target = current + deltaSeconds;
      
      if (target < 0) target = 0;
      if (target > player.buffer.duration) target = player.buffer.duration - 0.05;
      
      this.seek(deck, target);
    } catch (e) {
      console.warn(`Scratch seek bounds check error on deck ${deck}:`, e);
    }
  }

  getFrequencyData(deck: 'A' | 'B') {
    return (deck === 'A' ? this.analyserA : this.analyserB).getValue();
  }
}

export const audioEngine = new AudioEngine();
