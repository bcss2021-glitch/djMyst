import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { audioEngine } from '../lib/audioEngine';

interface WaveformProps {
  url: string | null;
  isPlaying: boolean;
  color?: string;
  deckId?: 'A' | 'B';
  onSeek?: (time: number) => void;
  duration?: number;
  cuePoint?: number | null;
  hotCues?: number[];
  sourceType?: 'AUDIO' | 'EXTERNAL';
}

export default function Waveform({ url, isPlaying, color = '#00f5ff', deckId, onSeek, duration, cuePoint, hotCues, sourceType = 'AUDIO' }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [localDuration, setLocalDuration] = useState(0);
  const [cachedPeaks, setCachedPeaks] = useState<number[]>([]);

  const finalDuration = duration || localDuration || 180;

  useEffect(() => {
    if (sourceType === 'EXTERNAL' && url) {
      // Deterministically generate a nice looking song waveform profile based on the URL
      const peaks: number[] = [];
      let seed = 0;
      for (let c = 0; c < url.length; c++) {
        seed += url.charCodeAt(c);
      }
      
      const count = 100;
      for (let i = 0; i < count; i++) {
        const x = i / count;
        const baseForm = Math.sin(x * Math.PI) * 0.4; // dome shape
        const sub1 = Math.sin(x * Math.PI * 6.2 + seed * 0.1) * 0.25;
        const sub2 = Math.sin(x * Math.PI * 18.7 + seed * 0.05) * 0.15;
        const envelope = Math.sin(x * Math.PI); // drop off at edges
        
        let val = Math.max(0.05, Math.abs(baseForm + sub1 + sub2) * envelope);
        val = val * 0.8 + (Math.sin(i * 123.45 + seed) * 0.05 + 0.05) * 0.2; // some fuzz
        peaks.push(val);
      }
      setCachedPeaks(peaks);
    } else {
      setCachedPeaks([]);
    }
  }, [url, sourceType]);

  useEffect(() => {
    if (!containerRef.current) return;

    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255, 255, 255, 0.05)',
      progressColor: `${color}22`,
      cursorColor: color,
      barWidth: 1,
      barGap: 1,
      height: 40,
      normalize: true,
      interact: true, // Enable clicking on the spectrum
      cursorWidth: 1
    });

    try {
      wavesurferRef.current.setVolume(0);
    } catch (e) {
      console.warn("WaveSurfer setVolume failed on creation", e);
    }

    wavesurferRef.current.on('interaction', (newProgress) => {
      if (onSeek) {
        const dur = wavesurferRef.current?.getDuration() || finalDuration || 0;
        onSeek(newProgress * dur);
      }
    });

    wavesurferRef.current.on('ready', () => {
      try {
        const dur = wavesurferRef.current?.getDuration() || 0;
        if (dur > 0) {
          setLocalDuration(dur);
        }
      } catch (e) {
        console.error("Failed to get duration from wavesurfer:", e);
      }
    });

    return () => {
      wavesurferRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (url && wavesurferRef.current) {
      if (sourceType === 'EXTERNAL') {
        try {
          wavesurferRef.current.empty();
        } catch (e) {
          // ignore empty failures
        }
        return;
      }
      
      wavesurferRef.current.load(url);
      try {
        wavesurferRef.current.setVolume(0);
      } catch (e) {
        console.warn("WaveSurfer setVolume failed, continuing since muted: true occupies this", e);
      }
    }
  }, [url, sourceType]);

  useEffect(() => {
    if (wavesurferRef.current) {
      if (isPlaying) {
        wavesurferRef.current.play();
      } else {
        wavesurferRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Real-time spectrum drawing
  useEffect(() => {
    if (!deckId || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for(let x=0; x<canvas.width; x+=40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }

      // 1. Draw procedural background scrolling waveform for EXTERNAL sources
      if (sourceType === 'EXTERNAL' && cachedPeaks.length > 0) {
        const barWidth = canvas.width / cachedPeaks.length;
        const speed = isPlaying ? 0.035 : 0;
        const scrollFactor = (Date.now() * speed) % (canvas.width * 10);
        
        ctx.fillStyle = color === '#3b82f6' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(168, 85, 247, 0.08)';
        for (let i = 0; i < cachedPeaks.length; i++) {
          const shift = Math.floor(scrollFactor / barWidth);
          const idx = (i + shift) % cachedPeaks.length;
          const h = cachedPeaks[idx] * canvas.height * 0.85;
          ctx.fillRect(i * barWidth, canvas.height / 2 - h / 2, barWidth - 1, h);
        }
      }
      
      // 2. Draw real-time FFT spectrum overlay
      if (isPlaying) {
        let data: Float32Array;
        if (sourceType === 'EXTERNAL') {
          // Synthesize high-fidelity external spectrum feedback so it vibrates with life
          const time = Date.now() * 0.005;
          const simulated = new Float32Array(64);
          for (let i = 0; i < 64; i++) {
            const bassFreq = Math.sin(time * 1.5 + i * 0.05) * 15;
            const midFreq = Math.cos(time * 3.0 - i * 0.2) * 10;
            const noise = (Math.random() - 0.5) * 5;
            const taper = Math.exp(-i / 20);
            simulated[i] = -85 + Math.abs(bassFreq + midFreq + noise + 25) * taper;
          }
          data = simulated;
        } else {
          data = audioEngine.getFrequencyData(deckId) as Float32Array;
        }

        const barCount = data.length;
        const barWidth = canvas.width / barCount;
        
        ctx.fillStyle = color;
        
        for (let i = 0; i < barCount; i++) {
          let val = data[i];
          if (val === -Infinity) val = -100;
          
          const normalized = (val + 105) / 105;
          const h = normalized * canvas.height * 0.9;
          
          ctx.globalAlpha = 0.4;
          ctx.fillRect(i * barWidth, canvas.height / 2 - h / 2, barWidth - 1, h);
          
          // Glow effect
          ctx.globalAlpha = 0.1;
          ctx.fillRect(i * barWidth - 1, canvas.height / 2 - h / 2 - 1, barWidth + 1, h + 2);
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, deckId, color, sourceType, cachedPeaks]);

  return (
    <div className="relative w-full h-[60px] hardware-surface rounded-sm overflow-hidden border border-white/10 group">
      <div className="absolute inset-0 bg-[#050508]" />
      <div className="scanline opacity-10" />
      
      <div ref={containerRef} className="absolute inset-x-0 bottom-0 top-0 opacity-40 z-10 cursor-pointer" />
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={60} 
        className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen z-20"
      />
      
      {/* Active CUE point visualization */}
      {finalDuration && finalDuration > 0 && cuePoint !== undefined && cuePoint !== null && (
        <div 
          className="absolute top-0 bottom-0 w-[2px] bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)] z-30 pointer-events-none"
          style={{ left: `${(cuePoint / finalDuration) * 100}%` }}
        >
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[6px] font-black px-1 py-0.2 rounded-sm select-none shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            CUE
          </div>
        </div>
      )}

      {/* Active Hot Cues visualization */}
      {finalDuration && finalDuration > 0 && hotCues && hotCues.map((hc, idx) => {
        if (hc === undefined || hc === null) return null;
        return (
          <div 
            key={idx}
            className="absolute top-0 bottom-0 w-[1.5px] bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)] z-30 pointer-events-none"
            style={{ left: `${(hc / finalDuration) * 100}%` }}
          >
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[6px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-sm select-none shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
              HC{idx + 1}
            </div>
          </div>
        );
      })}
      
      {/* Playback pointer */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/20 z-30 pointer-events-none" />
    </div>
  );
}
