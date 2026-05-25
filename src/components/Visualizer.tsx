import { useEffect, useRef } from 'react';
import { audioEngine } from '../lib/audioEngine';

interface VisualizerProps {
  deck: 'A' | 'B';
  color: string;
  isPlaying: boolean;
  mode?: 'bars' | 'spectrum';
}

export default function Visualizer({ deck, color, isPlaying, mode = 'bars' }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      const data = audioEngine.getFrequencyData(deck) as Float32Array;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for(let x=0; x<width; x+=20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for(let y=0; y<height; y+=10) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      
      if (mode === 'bars') {
        const barWidth = (width / data.length) * 1.5;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
          const normalized = (data[i] + 110) / 110;
          const barHeight = Math.max(2, normalized * height * 0.8);

          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, 'transparent');

          ctx.fillStyle = isPlaying ? gradient : 'rgba(255,255,255,0.05)';
          ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
          
          // Cap on top of bar
          if (isPlaying) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x, height - barHeight - 1, barWidth - 2, 1);
          }
          
          x += barWidth;
        }
      } else {
        // Spectrum / Wave mode
        ctx.beginPath();
        ctx.strokeStyle = isPlaying ? color : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        
        const sliceWidth = width / data.length;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
          const normalized = (data[i] + 100) / 100;
          const y = height - (normalized * height);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }
        ctx.stroke();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [deck, color, isPlaying, mode]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={60} 
      className="w-full h-full opacity-60 mix-blend-screen"
    />
  );
}
