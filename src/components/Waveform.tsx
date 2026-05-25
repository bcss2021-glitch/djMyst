import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { audioEngine } from '../lib/audioEngine';

interface WaveformProps {
  url: string | null;
  isPlaying: boolean;
  color?: string;
  deckId?: 'A' | 'B';
}

export default function Waveform({ url, isPlaying, color = '#00f5ff', deckId }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

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
      interact: false,
      cursorWidth: 1
    });

    try {
      wavesurferRef.current.setVolume(0);
    } catch (e) {
      console.warn("WaveSurfer setVolume failed on creation", e);
    }

    return () => {
      wavesurferRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (url && wavesurferRef.current) {
      wavesurferRef.current.load(url);
      try {
        wavesurferRef.current.setVolume(0);
      } catch (e) {
        console.warn("WaveSurfer setVolume failed, continuing since muted: true occupies this", e);
      }
    }
  }, [url]);

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
      
      if (isPlaying) {
        const data = audioEngine.getFrequencyData(deckId) as Float32Array;
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
  }, [isPlaying, deckId, color]);

  return (
    <div className="relative w-full h-[60px] hardware-surface rounded-sm overflow-hidden border border-white/10 group">
      <div className="absolute inset-0 bg-[#050508]" />
      <div className="scanline opacity-10" />
      
      <div ref={containerRef} className="absolute inset-x-0 bottom-0 top-0 opacity-40 z-10" />
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={60} 
        className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen z-20"
      />
      
      {/* Playback pointer */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/20 z-30" />
    </div>
  );
}
