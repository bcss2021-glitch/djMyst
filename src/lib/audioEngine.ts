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
  reverbA: Tone.JCReverb;
  reverbB: Tone.JCReverb;
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
  
  slipEnabled: { A: boolean, B: boolean } = { A: false, B: false };
  private playStartTime = { A: 0, B: 0 };
  private playOffset = { A: 0, B: 0 };
  private lastScratchTime = { A: 0, B: 0 };
  private loopStartTime = { A: 0, B: 0 };
  private loopStartPos = { A: 0, B: 0 };
  private loopEndPos = { A: 0, B: 0 };
  private slipStartTime = { A: 0, B: 0 };
  private slipStartPos = { A: 0, B: 0 };
  
  private recorder: Tone.Recorder = new Tone.Recorder();
  private lastLoadedUrls = { A: '', B: '' };

  // Procedural synthesizer engines
  private synth: Tone.PolySynth | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private acidSynth: Tone.MonoSynth | null = null;
  
  // Persistent sampler & drum synths to prevent garbage collection
  private kickSynth: Tone.MembraneSynth | null = null;
  private snareSynth: Tone.NoiseSynth | null = null;
  private clapSynth: Tone.NoiseSynth | null = null;
  private hihatSynth: Tone.MetalSynth | null = null;
  private noiseSynth: Tone.NoiseSynth | null = null;
  private sirenOsc: Tone.Oscillator | null = null;
  private sirenGain: Tone.Gain | null = null;
  private subOsc: Tone.Oscillator | null = null;
  private subGain: Tone.Gain | null = null;
  private sweepNoise: Tone.Noise | null = null;
  private sweepFilter: Tone.Filter | null = null;
  private sweepGain: Tone.Gain | null = null;
  private laserSynth: Tone.MonoSynth | null = null;

  constructor() {
    this.deckA = new Tone.Player();
    this.deckB = new Tone.Player();
    this.limiter = new Tone.Limiter(-1.5); // high-grade limiter to catch rare peaks
    
    this.analyserA = new Tone.Analyser("fft", 64);
    this.analyserB = new Tone.Analyser("fft", 64);

    this.bitcrusherA = new Tone.BitCrusher(4);
    this.bitcrusherB = new Tone.BitCrusher(4);
    this.bitcrusherA.wet.value = 0;
    this.bitcrusherB.wet.value = 0;
    (this.bitcrusherA as any).bypass = true;
    (this.bitcrusherB as any).bypass = true;

    // Use lightweight Schroeder/Moorer JCReverb to prevent async-compilation CPU spikes and pops
    this.reverbA = new Tone.JCReverb(0.65);
    this.reverbB = new Tone.JCReverb(0.65);
    this.reverbA.wet.value = 0;
    this.reverbB.wet.value = 0;
    (this.reverbA as any).bypass = true;
    (this.reverbB as any).bypass = true;

    this.echoA = new Tone.FeedbackDelay("1/4n", 0.5);
    this.echoB = new Tone.FeedbackDelay("1/4n", 0.5);
    this.echoA.wet.value = 0;
    this.echoB.wet.value = 0;
    (this.echoA as any).bypass = true;
    (this.echoB as any).bypass = true;

    this.phaserA = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 1000 });
    this.phaserB = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 1000 });
    this.phaserA.wet.value = 0;
    this.phaserB.wet.value = 0;
    (this.phaserA as any).bypass = true;
    (this.phaserB as any).bypass = true;

    this.pitchShiftA = new Tone.PitchShift(0);
    this.pitchShiftB = new Tone.PitchShift(0);
    
    // Balanced pre-fader trim (0.707 = -3 dB) to build in absolute headroom for linear summing
    this.gainA = new Tone.Gain(0.707);
    this.gainB = new Tone.Gain(0.707);

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
    
    // Set explicit professional crossover frequencies to prevent midrange cancellation
    this.eqA = new Tone.EQ3({
      low: 0,
      mid: 0,
      high: 0,
      lowFrequency: 300,
      highFrequency: 3200
    });
    this.eqB = new Tone.EQ3({
      low: 0,
      mid: 0,
      high: 0,
      lowFrequency: 300,
      highFrequency: 3200
    });
    
    this.filterA = new Tone.Filter(20000, "lowpass");
    this.filterB = new Tone.Filter(20000, "lowpass");
    
    // Explicit, deterministic, and highly-isolated step-by-step routing
    // DB Note: pitchShift is bypassed initially by connecting gainA directly to eqA
    this.deckA.connect(this.gainA);
    this.gainA.connect(this.eqA);
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
    this.gainB.connect(this.eqB);
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

  async loadTrack(deck: 'A' | 'B', urlOrFile: string | File | Blob) {
    let url = '';
    let isDirectFile = false;

    if (typeof urlOrFile === 'string') {
      url = urlOrFile;
    } else {
      isDirectFile = true;
    }

    // Clean up the Tone.js global cache and revoke old Blob URL for the previous track on this deck
    const prevUrl = this.lastLoadedUrls[deck];
    if (prevUrl) {
      try {
        if (typeof (Tone as any).ToneAudioBuffer?.removeFromCache === 'function') {
          (Tone as any).ToneAudioBuffer.removeFromCache(prevUrl);
        } else if (typeof (Tone as any).Buffer?.removeFromCache === 'function') {
          (Tone as any).Buffer.removeFromCache(prevUrl);
        }
      } catch (e) {
        console.warn("Could not remove URL from Tone cache:", e);
      }
      
      if (prevUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch (e) {}
      }
    }
    this.lastLoadedUrls[deck] = typeof urlOrFile === 'string' ? urlOrFile : '';

    // Completely dispose of the old Tone.Player to cancel any pending downloads or locks
    const oldPlayer = this.getDeck(deck);
    try {
      if (oldPlayer) {
        oldPlayer.stop();
        oldPlayer.disconnect();
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
    
    if (isDirectFile) {
      try {
        const fileOrBlob = urlOrFile as File | Blob;
        const rawCtx = Tone.context?.rawContext || (Tone.context as any)?._context || new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const arrayBuffer = await fileOrBlob.arrayBuffer();
        const audioBuffer = await rawCtx.decodeAudioData(arrayBuffer);
        player.buffer = new Tone.ToneAudioBuffer(audioBuffer);
        player.loop = true;
        this.applyRate(deck);
        return;
      } catch (err) {
        console.error(`AudioEngine native decodeAudioData failed for direct file on ${deck}:`, err);
        // Fall back to synthetic loop if decoding fails
        url = 'fallback'; 
      }
    }

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
      if (typeof (Tone as any).ToneAudioBuffer?.removeFromCache === 'function') {
        try {
          (Tone as any).ToneAudioBuffer.removeFromCache(url);
        } catch (ce) {}
      }
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

  setPlaybackState(deck: 'A' | 'B', play: boolean) {
    const player = this.getDeck(deck);
    if (play) {
      try {
        player.stop(); // Safe, force clean start from playOffset
        if (player.buffer && player.buffer.loaded && player.buffer.duration > 0) {
          this.playStartTime[deck] = Tone.now();
          player.start(undefined, this.playOffset[deck] % player.buffer.duration);
        } else {
          console.warn(`Deck ${deck} buffer not ready`);
        }
      } catch (e) {
        console.error(`Error starting deck ${deck}:`, e);
      }
    } else {
      if (player.state === 'started') {
        this.playOffset[deck] += (Tone.now() - this.playStartTime[deck]) * player.playbackRate;
      }
      player.stop();
    }
  }

  playPause(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    this.setPlaybackState(deck, player.state !== 'started');
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
    this.loopStartTime[deck] = Tone.now();
    this.loopStartPos[deck] = start;
    this.loopEndPos[deck] = end;
  }

  clearLoop(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    if (player.loop) {
      player.loop = false;
      const loopLen = this.loopEndPos[deck] - this.loopStartPos[deck];
      if (player.state === 'started' && loopLen > 0) {
        if (this.slipEnabled[deck]) {
          // Slip Mode: Snap playhead to background running time since loop start
          const elapsed = (Tone.now() - this.loopStartTime[deck]) * player.playbackRate;
          const currentPos = (this.loopStartPos[deck] + elapsed) % player.buffer.duration;
          this.seek(deck, currentPos);
        } else {
          // Standard Loop: Snap to relative offset inside loop boundaries
          const elapsed = (Tone.now() - this.loopStartTime[deck]) * player.playbackRate;
          const offset = elapsed % loopLen;
          const currentPos = this.loopStartPos[deck] + offset;
          this.seek(deck, currentPos);
        }
      }
    }
  }

  setSlipMode(deck: 'A' | 'B', enabled: boolean) {
    this.slipEnabled[deck] = enabled;
  }

  startSlip(deck: 'A' | 'B') {
    this.slipStartTime[deck] = Tone.now();
    this.slipStartPos[deck] = this.getPosition(deck);
  }

  resolveSlip(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    if (!player.buffer.loaded || player.buffer.duration === 0) return;
    const startPos = this.slipStartPos[deck] || 0;
    const startTime = this.slipStartTime[deck] || Tone.now();
    const elapsed = (Tone.now() - startTime) * player.playbackRate;
    const target = (startPos + elapsed) % player.buffer.duration;
    this.seek(deck, target);
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
    // Prevent filter clicks/exploding signal levels via linear ramping
    eq[band].rampTo(value, 0.05);
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
      filter.frequency.rampTo(Tone.mtof((Tone.ftom(20000) as any) + value * 2), 0.05); 
    } else {
      filter.type = "highpass";
      filter.frequency.rampTo(value * 100, 0.05);
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
    let gainA = 1;
    let gainB = 1;

    if (this.crossfadeCurve <= 0.3) {
      // 1. Linear Crossfader Curve (Smooth constant sum, dip in center volume)
      gainA = 1 - value;
      gainB = value;
    } else if (this.crossfadeCurve <= 0.7) {
      // 2. Constant Power / Equal Gain Curve (Standard DJ curve, no dip in center volume)
      gainA = Math.cos(value * Math.PI / 2);
      gainB = Math.sin(value * Math.PI / 2);
    } else {
      // 3. Scratch / Battle Cut Curve (Instant on volume transition)
      gainA = value < 0.9 ? 1.0 : Math.max(0, Math.min(1, (1 - value) * 10));
      gainB = value > 0.1 ? 1.0 : Math.max(0, Math.min(1, value * 10));
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

  private updateOffsetBeforeRateChange(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    if (player.state === 'started' && player.buffer && player.buffer.loaded) {
      const now = Tone.now();
      const elapsed = (now - this.playStartTime[deck]) * player.playbackRate;
      this.playOffset[deck] = (this.playOffset[deck] + elapsed) % player.buffer.duration;
      this.playStartTime[deck] = now;
    }
  }

  private applyRate(deck: 'A' | 'B') {
    const player = this.getDeck(deck);
    const pitchShift = deck === 'A' ? this.pitchShiftA : this.pitchShiftB;
    const keyLock = deck === 'A' ? this.keyLockA : this.keyLockB;
    const eqNode = deck === 'A' ? this.eqA : this.eqB;
    const gainNode = deck === 'A' ? this.gainA : this.gainB;

    try {
      if (player.buffer && player.buffer.loaded) {
        // Safe playhead preservation to prevent audio skips and coordinate jumps
        this.updateOffsetBeforeRateChange(deck);

        const rate = this.basePlaybackRates[deck] * this.bends[deck];
        player.playbackRate = rate;

        const needsPitchShift = keyLock && Math.abs(rate - 1.0) > 0.001;

        // Surgical zero-overhead disconnect to guarantee no bubbly-vocoder artifacts when keylock or original rate is 1.0
        gainNode.disconnect();
        if (needsPitchShift) {
          gainNode.connect(pitchShift);
          pitchShift.disconnect();
          pitchShift.connect(eqNode);
          
          const semitones = 12 * Math.log2(rate);
          pitchShift.pitch = -semitones;
        } else {
          gainNode.connect(eqNode);
          pitchShift.disconnect();
          pitchShift.pitch = 0;
        }
      }
    } catch (e) {
      console.warn(`Could not set playback rate for deck ${deck}:`, e);
    }
  }

  triggerSample(name: string) {
    try {
      if (Tone.context.state === 'suspended') {
        Tone.context.resume();
      }
    } catch (_) {}

    if (name === 'trance_stab') {
      if (!this.synth) {
        this.delay = new Tone.FeedbackDelay("1/8n", 0.55).toDestination();
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.005, decay: 0.35, sustain: 0.25, release: 0.5 }
        });
        this.synth.connect(this.delay);
      }
      const chords = [
        ['D4', 'F4', 'A4', 'C5', 'E5'], // Dm9
        ['G4', 'A#4', 'D5', 'F5', 'A5'], // Gm9
        ['C4', 'D#4', 'G4', 'A#4', 'D5'], // Cm9
        ['A#3', 'D4', 'F4', 'A4', 'C5']  // A#maj9
      ];
      const selected = chords[Math.floor(Math.random() * chords.length)];
      try {
        this.synth.triggerAttackRelease(selected, "8n");
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'acid_line') {
      if (!this.acidSynth) {
        this.acidSynth = new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          filter: { Q: 8, type: "lowpass", rolloff: -12 },
          envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.1 },
          filterEnvelope: { attack: 0.01, decay: 0.22, baseFrequency: 130, octaves: 4.2, exponent: 2 }
        }).toDestination();
      }
      const now = Tone.now();
      const scale = ["C3", "D#3", "G3", "A#3", "C4", "A#3", "G3", "F3"];
      const r1 = scale[Math.floor(Math.random() * scale.length)];
      const r2 = scale[Math.floor(Math.random() * scale.length)];
      const r3 = scale[Math.floor(Math.random() * scale.length)];
      try {
        this.acidSynth.triggerAttackRelease(r1, "16n", now);
        this.acidSynth.triggerAttackRelease(r2, "16n", now + 0.12);
        this.acidSynth.triggerAttackRelease(r3, "16n", now + 0.24);
        this.acidSynth.triggerAttackRelease("C3", "16n", now + 0.36);
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'rave_siren') {
      try {
        const now = Tone.now();
        const osc = new Tone.Oscillator("sawtooth");
        const lfo = new Tone.LFO(8, 20, 80).start(now); // LFO at 8Hz, amplitude 20 to 80 Hz
        const gain = new Tone.Gain(0);
        const filter = new Tone.Filter(1500, "lowpass");
        
        osc.connect(gain);
        lfo.connect(osc.detune);
        gain.connect(filter);
        filter.toDestination();
        
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 1.5);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.45, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        
        osc.start(now);
        osc.stop(now + 1.5);
        
        // Clean up references to prevent accumulation
        setTimeout(() => {
          osc.dispose();
          lfo.dispose();
          gain.dispose();
          filter.dispose();
        }, 2500);
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'sub_drop') {
      try {
        const now = Tone.now();
        const osc = new Tone.Oscillator("triangle");
        const gain = new Tone.Gain(0);
        const lowpass = new Tone.Filter(120, "lowpass");
        
        osc.connect(gain);
        gain.connect(lowpass);
        lowpass.toDestination();
        
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 1.8);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.75, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        
        osc.start(now);
        osc.stop(now + 1.8);
        
        setTimeout(() => {
          osc.dispose();
          gain.dispose();
          lowpass.dispose();
        }, 3000);
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'noise_sweep') {
      try {
        const now = Tone.now();
        const noise = new Tone.Noise("white");
        const gain = new Tone.Gain(0);
        const filter = new Tone.Filter({ type: "bandpass", Q: 4.5, frequency: 250 });
        
        noise.connect(gain);
        gain.connect(filter);
        filter.toDestination();
        
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.exponentialRampToValueAtTime(7500, now + 1.5);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 1.6);
        
        noise.start(now);
        noise.stop(now + 1.6);
        
        setTimeout(() => {
          noise.dispose();
          gain.dispose();
          filter.dispose();
        }, 2500);
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (this.sampler.has(name)) {
      const player = this.sampler.player(name);
      let isLoaded = false;
      try {
        isLoaded = !!(player.buffer && player.buffer.loaded && player.buffer.duration > 0);
      } catch (err) {}

      if (isLoaded) {
        try {
          if (name === 'scratch') {
            player.playbackRate = 0.8 + Math.random() * 0.4;
          } else {
            player.playbackRate = 1;
          }
          player.start();
          return;
        } catch (e) {
          console.warn(`Sampler player start failed for "${name}", using synth fallback:`, e);
        }
      }
    }

    // High-fidelity fallback synthesizer drum-kit if audio resources failed to load/CORS blocked
    if (name === 'kick') {
      if (!this.kickSynth) {
        this.kickSynth = new Tone.MembraneSynth({
          envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.15 }
        }).toDestination();
      }
      try {
        this.kickSynth.triggerAttackRelease("C1", "8n");
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'snare') {
      if (!this.snareSynth) {
        this.snareSynth = new Tone.NoiseSynth({
          noise: { type: "pink" },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0 }
        }).toDestination();
      }
      try {
        this.snareSynth.triggerAttackRelease("16n");
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'clap') {
      if (!this.clapSynth) {
        this.clapSynth = new Tone.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.001, decay: 0.08, sustain: 0 }
        }).toDestination();
      }
      try {
        const now = Tone.now();
        this.clapSynth.triggerAttack(now);
        this.clapSynth.triggerAttack(now + 0.015);
        this.clapSynth.triggerAttack(now + 0.03);
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'hihat') {
      if (!this.hihatSynth) {
        this.hihatSynth = new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.05, release: 0.05 }
        }).toDestination();
      }
      try {
        this.hihatSynth.triggerAttackRelease("C6", "16n");
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'scratch') {
      if (!this.noiseSynth) {
        this.noiseSynth = new Tone.NoiseSynth({
          noise: { type: "pink" },
          envelope: { attack: 0.02, decay: 0.12, sustain: 0 }
        }).toDestination();
      }
      try {
        this.noiseSynth.triggerAttackRelease("16n");
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'fx_1') {
      if (!this.laserSynth) {
        this.laserSynth = new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.3 }
        }).toDestination();
      }
      try {
        const now = Tone.now();
        this.laserSynth.triggerAttackRelease("C3", "1.1");
        this.laserSynth.frequency.setValueAtTime(140, now);
        this.laserSynth.frequency.exponentialRampToValueAtTime(1100, now + 1.1);
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'fx_2') {
      if (!this.laserSynth) {
        this.laserSynth = new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.3 }
        }).toDestination();
      }
      try {
        const now = Tone.now();
        this.laserSynth.triggerAttackRelease("A3", "8n");
        this.laserSynth.frequency.setValueAtTime(105, now);
        this.laserSynth.frequency.linearRampToValueAtTime(210, now + 0.14);
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    if (name === 'fx_3') {
      if (!this.laserSynth) {
        this.laserSynth = new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.3 }
        }).toDestination();
      }
      try {
        const now = Tone.now();
        this.laserSynth.triggerAttackRelease("C5", "4n");
        this.laserSynth.frequency.setValueAtTime(2400, now);
        this.laserSynth.frequency.exponentialRampToValueAtTime(140, now + 0.32);
      } catch (e) {
        console.warn(e);
      }
      return;
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
      
      this.playOffset[deck] = target;
      
      // Dynamic direction and playbackRate mapping for scratching realism
      const isReverse = deltaSeconds < 0;
      player.reverse = isReverse;
      
      const absDelta = Math.abs(deltaSeconds);
      const rate = Math.max(0.3, Math.min(3.0, absDelta * 120));
      player.playbackRate = rate;
      
      const now = Tone.now();
      // Only stop and restart the player segment if at least 45ms has passed since the last trigger,
      // or if the player is currently stopped. This prevents constant stop() calls cutting off the sound.
      if (now - this.lastScratchTime[deck] > 0.045 || player.state !== 'started') {
        player.stop();
        this.playStartTime[deck] = now;
        player.start(undefined, target % player.buffer.duration, 0.16); // slightly longer to blend
        this.lastScratchTime[deck] = now;
      }
      
      if (absDelta > 0.003) {
        this.scratchWheel(absDelta * 18000);
      }
    } catch (e) {
      console.warn(`Scratch seek bounds check error on deck ${deck}:`, e);
    }
  }

  endScratch(deck: 'A' | 'B', isReversed: boolean) {
    const player = this.getDeck(deck);
    try {
      player.reverse = isReversed;
      this.applyRate(deck);
    } catch (e) {
      console.warn(`Error ending scratch mode on deck ${deck}:`, e);
    }
  }

  getFrequencyData(deck: 'A' | 'B') {
    return (deck === 'A' ? this.analyserA : this.analyserB).getValue();
  }
}

export const audioEngine = new AudioEngine();
