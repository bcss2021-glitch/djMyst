import { motion } from 'motion/react';
import { Play, Pause, FastForward, Rewind, ChevronRight, ChevronLeft, Zap, Layers, Music4, Save, ExternalLink, AlertTriangle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;
import { audioEngine } from '../lib/audioEngine';
import Waveform from './Waveform';
import Fader from './Fader';
import Knob from './Knob';

interface JogWheelProps {
    isPlaying: boolean;
    isLoading?: boolean;
    id: 'A' | 'B';
    playbackRate: number;
    progress: number;
    rotation: number;
    onPitchBend?: (bend: number) => void;
    onPadTrigger?: (sample: string) => void;
    onScratchDrag?: (sec: number) => void;
    onScratchStart?: () => void;
    onScratchEnd?: () => void;
}

function JogWheel({ isPlaying, isLoading, id, playbackRate, rotation, onClick, onPitchBend, onPadTrigger, onScratchDrag, onScratchStart, onScratchEnd }: JogWheelProps & { onClick?: () => void }) {
  const [bend, setBend] = useState(1);
  const [isScratching, setIsScratching] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0); 
  const [isGrabbing, setIsGrabbing] = useState(false);
  
  const wheelRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Platter spinning animation frame
  useEffect(() => {
    if (isPlaying && !isGrabbing) {
      let lastTime = performance.now();
      const spin = (time: number) => {
        const delta = time - lastTime;
        lastTime = time;
        // ~200 degrees of rotation per second at 1x play rate
        const angleChange = 200 * playbackRate * (delta / 1000);
        setRotationAngle(prev => (prev + angleChange) % 360);
        animationFrameRef.current = requestAnimationFrame(spin);
      };
      animationFrameRef.current = requestAnimationFrame(spin);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isGrabbing, playbackRate]);

  const handleStart = (clientX: number, clientY: number) => {
    if (!wheelRef.current || isLoading) return;
    setIsGrabbing(true);
    
    if (onScratchStart) {
      onScratchStart();
    }

    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    lastAngleRef.current = angle;
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isGrabbing || !wheelRef.current || lastAngleRef.current === null) return;
    
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    
    let angleDiff = currentAngle - lastAngleRef.current;
    
    // Handle circle border crossing (-180 to 180 discontinuity)
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    
    if (Math.abs(angleDiff) > 0.1) {
      setRotationAngle(prev => (prev + angleDiff + 360) % 360);
      
      // Calculate playhead seek delta: 360 deg = 2 seconds of song
      const secDelta = angleDiff * 0.006;
      if (onScratchDrag) {
        onScratchDrag(secDelta);
      }
      
      const velocity = Math.abs(angleDiff) * 35;
      if (velocity > 350 && !isScratching) {
        audioEngine.scratchWheel(velocity);
        setIsScratching(true);
        setTimeout(() => setIsScratching(false), 100);
      }
      
      lastAngleRef.current = currentAngle;
    }
  };

  const handleEnd = () => {
    if (!isGrabbing) return;
    setIsGrabbing(false);
    lastAngleRef.current = null;
    
    if (onScratchEnd) {
      onScratchEnd();
    }

    setBend(1);
    onPitchBend?.(1);
    setIsScratching(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    handleStart(e.clientX, e.clientY);
    
    const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
      handleMove(moveEvent.clientX, moveEvent.clientY);
    };
    
    const handleGlobalMouseUp = () => {
      handleEnd();
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
    
    const handleGlobalTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const t = moveEvent.touches[0];
      handleMove(t.clientX, t.clientY);
    };
    
    const handleGlobalTouchEnd = () => {
      handleEnd();
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
    
    document.addEventListener('touchmove', handleGlobalTouchMove);
    document.addEventListener('touchend', handleGlobalTouchEnd);
  };

  return (
    <div 
      ref={wheelRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`relative w-44 h-44 rounded-full bg-[#0a0a0c] border-6 border-[#1c1c20] shadow-[0_0_30px_rgba(0,0,0,0.95),inset_0_0_20px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden transition-all duration-150 select-none ${
        isGrabbing 
          ? 'cursor-grabbing border-zinc-700 ring-2 ring-brand-cyan/20 scale-[0.99]' 
          : 'cursor-grab hover:border-zinc-800'
      }`}
    >
      {/* Vinyl record shiny grooves */}
      <div 
        className="absolute inset-0 rounded-full opacity-40 pointer-events-none" 
        style={{ 
          background: 'repeating-radial-gradient(circle, #010101, #010101 2px, #18181e 3px, #010101 4px)' 
        }} 
      />
      
      {/* Ambient lighting shine highlights */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-white/[0.03] to-transparent pointer-events-none" />

      {/* Rotating Platter Chassis */}
      <div 
        className="w-full h-full rounded-full flex items-center justify-center relative pointer-events-none"
        style={{ transform: `rotate(${rotationAngle}deg)` }}
      >
        {/* Visual feedback for pitch bend */}
        {bend !== 1 && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className={`w-full h-full rounded-full border-4 ${bend > 1 ? 'border-green-500 scale-105' : 'border-red-500 scale-95'} transition-all`} />
          </div>
        )}

        {/* Traditional White Platter Marker (Strobe dots / stripe) */}
        <div className={`absolute top-0 w-1.5 h-6 shadow-[0_0_8px_currentColor] rounded-b-full ${
          id === 'A' ? 'bg-blue-400 text-blue-500' : 'bg-purple-400 text-purple-500'
        }`} />
        <div className="absolute bottom-0 w-1 h-3 bg-white/10 rounded-t-full" />
        <div className="absolute left-0 w-3 h-1 bg-white/10 rounded-r-full" />
        <div className="absolute right-0 w-3 h-1 bg-white/10 rounded-l-full" />
      </div>

      {/* Center Metal Cap Display */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="absolute w-24 h-24 rounded-full bg-gradient-to-b from-[#18181b] to-[#0f0f11] border border-white/[0.08] flex flex-col items-center justify-center shadow-2xl z-10 cursor-pointer active:scale-95 transition-transform"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 rounded-full z-20">
             <div className={`w-8 h-8 border-2 border-t-transparent animate-spin rounded-full ${id === 'A' ? 'border-blue-500' : 'border-purple-500'}`} />
          </div>
        )}
        
        {isGrabbing && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#101014] rounded-full z-20">
             <span className={`text-[9px] font-black uppercase tracking-widest animate-pulse ${
               id === 'A' ? 'text-blue-400 drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]' : 'text-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]'
             }`}>TOUCH</span>
          </div>
        )}

        <div className={`text-xl font-mono font-black tracking-tighter leading-none ${
          isGrabbing 
            ? 'text-zinc-500' 
            : (id === 'A' ? 'text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.3)]' : 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.3)]')
        }`}>
          {(128 * playbackRate * bend).toFixed(1)}
        </div>
        
        <div className="text-[7px] text-zinc-500/80 uppercase font-bold tracking-widest mt-1">
          {bend === 1 ? 'BPM' : (bend > 1 ? 'BEND +' : 'BEND -')}
        </div>
        
        <div className="text-[6px] text-zinc-600 font-mono mt-0.5">
          {((playbackRate * bend - 1) * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

interface DeckProps {
  id: 'A' | 'B';
  trackUrl: string | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onPlayPause: () => void;
  onSync: () => void;
  playbackRate: number;
  onRateChange: (val: number) => void;
  onPitchBend?: (bend: number) => void;
  fx?: { crush: number; reverb: number; echo: number; flanger: number };
  onFxChange?: (type: 'crush' | 'reverb' | 'echo' | 'flanger', val: number) => void;
  onPadTrigger: (sample: string) => void;
  onRoll?: (division: '1/4' | '1/8' | '1/16' | null) => void;
  activeRoll?: string | null;
  onSaveConfig?: () => void;
  sourceType?: 'AUDIO' | 'EXTERNAL';
  externalUrl?: string | null;
  keyLock?: boolean;
  onKeyLockToggle?: () => void;
  gain?: number;
  onGainChange?: (val: number) => void;
  hotCues?: number[];
  onHotCue?: (index: number) => void;
  onClearCues?: () => void;
  loop?: { in: number | null, active: boolean };
  onLoopIn?: () => void;
  onLoopOut?: () => void;
  onExitLoop?: () => void;
  resolvedVolume?: number;
  onRewind?: () => void;
  onCuePress?: () => void;
  onCueRelease?: () => void;
  isCueActive?: boolean;
  onReverseToggle?: () => void;
  isReversed?: boolean;
  onScratchDrag?: (sec: number) => void;
  onScratchStart?: () => void;
  onScratchEnd?: () => void;
  onPlayerReady?: () => void;
  onPlayerBuffer?: () => void;
  isSynced?: boolean;
}

interface InteractiveSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color: string;
}

function InteractiveSlider({ label, value, min, max, onChange, color }: InteractiveSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleStart = (e: React.MouseEvent | React.TouchEvent, clientY: number) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    const updateValue = (currY: number) => {
      const relativeY = Math.max(0, Math.min(rect.height, currY - rect.top));
      const fraction = 1 - (relativeY / rect.height);
      const val = min + fraction * (max - min);
      onChange(Math.max(min, Math.min(max, val)));
    };

    updateValue(clientY);

    const handleMove = (moveEvent: MouseEvent) => {
      updateValue(moveEvent.clientY);
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      updateValue(moveEvent.touches[0].clientY);
    };

    const handleStop = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleStop);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleStop);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleStop);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleStop);
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col items-center gap-1 select-none h-full justify-between">
      <div className="flex flex-col items-center">
        <span className="text-[7px] font-black tracking-wider text-white/30 font-mono uppercase leading-none">{label}</span>
        <span className="text-[8px] font-mono font-bold text-white/60 mt-0.5 leading-none">{(value / max * 100).toFixed(0)}%</span>
      </div>

      <div className="relative h-20 w-10 bg-black/35 border border-white/5 rounded-md flex items-center justify-center p-1">
        <div 
          className="relative h-full w-4 flex items-center justify-center cursor-pointer"
          onMouseDown={(e) => handleStart(e, e.clientY)}
          onTouchStart={(e) => handleStart(e, e.touches[0].clientY)}
          onDoubleClick={() => onChange(min)}
          title="Drag vertical fader. Double-tap/click to clear."
        >
          <div className="absolute inset-y-0 w-1 bg-black/60 border border-white/5 rounded-full" />
          
          <div 
            className="absolute bottom-0 w-1 rounded-full pointer-events-none" 
            style={{ height: `${percentage}%`, backgroundColor: color, opacity: 0.3 }}
          />

          <div 
            className="absolute left-1/2 -translate-x-1/2 w-7 h-4 bg-[#18181b] border-y border-white/10 rounded-sm shadow-xl flex items-center justify-center cursor-ns-resize"
            style={{ 
              bottom: `calc(${percentage}% - 8px)`,
              boxShadow: isDragging ? `0 0 10px ${color}` : 'none'
            }}
          >
            <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: color }} />
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        <button 
          onClick={() => onChange(Math.max(min, value - (max - min) * 0.1))}
          className="w-4 h-4 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[8px] font-black text-white/40 active:bg-white/15"
        >
          -
        </button>
        <button 
          onClick={() => onChange(Math.min(max, value + (max - min) * 0.1))}
          className="w-4 h-4 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[8px] font-black text-white/40 active:bg-white/15"
        >
          +
        </button>
      </div>
    </div>
  );
}

interface XYPadProps {
  fx: { crush: number; reverb: number; echo: number; flanger: number } | undefined;
  onFxChange: ((type: 'crush' | 'reverb' | 'echo' | 'flanger', val: number) => void) | undefined;
  accentColor: string;
}

function XYPad({ fx, onFxChange, accentColor }: XYPadProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [coords, setCoords] = useState({ x: 0.0, y: 0.0 });

  useEffect(() => {
    if (!isPressing && fx) {
      const curX = (fx.echo || 0) / 0.8;
      const curY = (fx.flanger || 0) / 0.8;
      setCoords({ x: Math.min(1, Math.max(0, curX)), y: Math.min(1, Math.max(0, curY)) });
    }
  }, [fx, isPressing]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsPressing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;

    const updatePoint = (clientX: number, clientY: number) => {
      const xNorm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const yNorm = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      
      setCoords({ x: xNorm, y: yNorm });
      
      onFxChange?.('echo', xNorm * 0.8);
      onFxChange?.('flanger', yNorm * 0.8);
    };

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    updatePoint(clientX, clientY);

    const handleMove = (moveEvent: MouseEvent) => {
      updatePoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      updatePoint(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
    };

    const handleStop = () => {
      setIsPressing(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleStop);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleStop);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleStop);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleStop);
  };

  const handleReset = () => {
    setCoords({ x: 0, y: 0 });
    onFxChange?.('echo', 0);
    onFxChange?.('flanger', 0);
  };

  return (
    <div className="flex flex-col gap-1.5 h-full justify-between select-none">
      <div className="flex justify-between items-center px-1">
        <span className="text-[6.5px] font-black text-white/30 font-mono tracking-wider uppercase">XY CONTROL // DELAY (X) × PHASER (Y)</span>
        <button 
          onClick={handleReset}
          className="text-[6.5px] font-mono font-black px-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all uppercase leading-none py-0.5"
        >
          Reset pad
        </button>
      </div>

      <div 
        className="relative flex-1 min-h-[90px] h-[95px] bg-black/60 rounded border border-white/5 overflow-hidden cursor-crosshair touch-none"
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-5">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="border border-white/10" />
          ))}
        </div>

        {isPressing && (
          <>
            <div className="absolute inset-x-0 h-[1px] bg-white/10 pointer-events-none" style={{ bottom: `${coords.y * 100}%` }} />
            <div className="absolute inset-y-0 w-[1px] bg-white/10 pointer-events-none" style={{ left: `${coords.x * 100}%` }} />
          </>
        )}

        <div 
          className="absolute w-3.5 h-3.5 rounded-full border-2 -translate-x-1/2 translate-y-1/2 flex items-center justify-center"
          style={{ 
            left: `${coords.x * 100}%`, 
            bottom: `${coords.y * 100}%`, 
            borderColor: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
            backgroundColor: isPressing ? `${accentColor}25` : `${accentColor}10`
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
        </div>

        <div className="absolute bottom-1 left-1.5 text-[5px] font-mono text-white/10 uppercase">MIN</div>
        <div className="absolute top-1 right-1.5 text-[5px] font-mono text-white/10 uppercase">MAX SWEEP</div>
      </div>
    </div>
  );
}

export default function Deck({ 
  id, trackUrl, isPlaying, isLoading, onPlayPause, onSync, 
  playbackRate, onRateChange, onPitchBend, fx, onFxChange, 
  onPadTrigger, onRoll, activeRoll, onSaveConfig, sourceType = 'AUDIO', externalUrl,
  keyLock, onKeyLockToggle, gain = 1, onGainChange, hotCues = [], onHotCue, onClearCues,
  loop, onLoopIn, onLoopOut, onExitLoop, resolvedVolume = 1,
  onRewind, onCuePress, onCueRelease, isCueActive = false, onReverseToggle, isReversed = false,
  onScratchDrag, onScratchStart, onScratchEnd, onPlayerReady, onPlayerBuffer, isSynced = false
}: DeckProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fxViewMode, setFxViewMode] = useState<'KNOBS' | 'SLIDERS' | 'XY_PAD'>('KNOBS');
  const accentColor = id === 'A' ? 'var(--color-brand-cyan)' : 'var(--color-brand-purple)';
  const glowClass = id === 'A' ? 'active-glow-cyan' : 'active-glow-purple';

  const samples = ["scratch", "fx_1", "fx_2", "fx_3"];

  return (
    <div className={`flex flex-col items-center justify-between py-3 flex-1 h-full relative hardware-panel ${id === 'A' ? 'deck-gradient-a' : 'deck-gradient-b'}`}>
      {sourceType === 'EXTERNAL' && externalUrl && (
        <div className="absolute inset-0 z-40 bg-brand-deep/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center rounded-lg border border-white/10">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-blue-500/20 ${glowClass}`}>
            <ExternalLink size={24} />
          </div>
          
          <h3 className="text-xs font-black uppercase tracking-widest text-white mb-2 font-mono">External Stream Active</h3>
          <div className="lcd-display text-[9px] mb-2 max-w-[200px] truncate">{externalUrl}</div>

          <div className="text-[10px] text-zinc-400 mb-4 font-mono flex items-center justify-center gap-2">
            <span>VOLUME: <strong className={resolvedVolume > 0 ? "text-blue-400" : "text-white/40"}>{(resolvedVolume * 100).toFixed(0)}%</strong></span>
            <span>•</span>
            <span>STATE: <strong className={isPlaying ? "text-emerald-400" : "text-amber-500"}>{isPlaying ? "PLAYING" : "PAUSED"}</strong></span>
          </div>

          <div className="w-full aspect-video bg-black rounded overflow-hidden border border-white/5 relative mb-6">
            <Player 
              url={externalUrl} 
              playing={isPlaying}
              volume={resolvedVolume}
              controls={true}
              playsinline={true}
              width="100%"
              height="100%"
              style={{ position: 'absolute', top: 0, left: 0 }}
              onReady={onPlayerReady}
              onBuffer={onPlayerBuffer}
              onBufferEnd={onPlayerReady}
              onError={onPlayerReady}
              config={{
                youtube: {
                  playerVars: {
                    autoplay: 0,
                    playsinline: 1,
                    controls: 1,
                    enablejsapi: 1,
                    origin: window.location.origin
                  }
                }
              }}
            />
          </div>

          <div className="w-full flex justify-center mb-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 max-w-sm text-center flex flex-col gap-2 items-center">
              <div className="flex items-center justify-center gap-1.5 text-amber-500 text-[9px] font-black uppercase tracking-wider">
                <AlertTriangle size={12} className="animate-pulse" /> Iframe Sandbox Restrictions
              </div>
              <p className="text-[10px] text-zinc-300 leading-normal max-w-xs">
                Browsers block audio contexts and intercept clicks inside third-party embeds (like YouTube) when they are nested inside preview windows.
              </p>
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-1 px-3 py-1.5 bg-amber-500 border border-amber-600 hover:bg-amber-400 text-black rounded text-[9px] font-black uppercase tracking-widest transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)] flex items-center gap-1"
              >
                <ExternalLink size={10} /> Open App in top-level New Tab
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
               onClick={onPlayPause}
               disabled={isLoading}
               style={{ opacity: isLoading ? 0.35 : 1, pointerEvents: isLoading ? 'none' : 'auto' }}
               className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                 isLoading 
                   ? 'bg-zinc-800 text-zinc-500' 
                   : (isPlaying ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]')
               }`}
               title={isLoading ? "Track is buffering... please wait" : "Play / Pause"}
             >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent animate-spin rounded-full" />
                ) : isPlaying ? (
                  <Pause size={20} fill="white" className="text-white" />
                ) : (
                  <Play size={20} fill="white" className="text-white translate-x-0.5" />
                )}
             </button>
          </div>
        </div>
      )}

      {/* Header Loop Info */}
      <div className="w-full px-4 flex justify-between items-center z-10">
         <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-20">Transport Area</span>
            <div className="lcd-display text-[11px] font-bold text-brand-cyan min-w-[60px] text-center">
               {loop?.active ? 'LOOP ON' : (isLoading ? 'LOADING...' : (isPlaying ? 'PLAYING' : 'READY'))}
            </div>
         </div>
         <div className="flex flex-col items-end">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-20">Playback Speed</span>
            <div className="lcd-display text-[11px] font-bold text-brand-cyan min-w-[60px] text-center tabular-nums">
               {((playbackRate - 1) * 100).toFixed(2)}%
            </div>
         </div>
      </div>

      {/* Platter Area */}
      <div className="flex flex-col items-center gap-4 relative w-full px-4">
        <div className="relative group">
            <JogWheel 
                id={id}
                playbackRate={playbackRate}
                isLoading={isLoading}
                isPlaying={isPlaying} 
                progress={0} 
                rotation={0} 
                onPitchBend={onPitchBend}
                onPadTrigger={onPadTrigger}
                onScratchDrag={onScratchDrag}
                onScratchStart={onScratchStart}
                onScratchEnd={onScratchEnd}
                onClick={() => onPadTrigger('scratch')} 
            />
            
            {/* Toggle Button */}
            <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`absolute ${id === 'A' ? '-right-8' : '-left-8'} top-1/2 -translate-y-1/2 p-2 bg-brand-panel border border-white/10 text-white/40 hover:text-white transition-all z-20 shadow-2xl rounded-full tactile-button`}
                title={showAdvanced ? "Back to Deck" : "Show FX"}
            >
                {showAdvanced ? (id === 'A' ? <ChevronLeft size={12} /> : <ChevronRight size={12} />) : (id === 'A' ? <ChevronRight size={12} /> : <ChevronLeft size={12} />)}
            </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full">
            {/* Loops & Cues Left Column */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                    <div className="text-[7px] font-black uppercase tracking-widest text-white/20">Loop Region</div>
                    {loop?.active && <div className="text-[6px] text-brand-cyan font-black animate-pulse">LOCK</div>}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <button 
                        onClick={onLoopIn}
                        className={`h-7 border rounded-sm text-[8px] font-black transition-all tactile-button ${loop?.in !== null ? glowClass : 'bg-white/5 border-white/10 text-white/20 hover:text-white/40'}`}
                    >
                        IN
                    </button>
                    <button 
                        onClick={onLoopOut}
                        disabled={loop?.in === null}
                        className={`h-7 border rounded-sm text-[8px] font-black transition-all tactile-button ${loop?.active ? glowClass : 'bg-white/5 border-white/10 text-white/20 hover:text-white/40 disabled:opacity-30'}`}
                    >
                        OUT
                    </button>
                    <button 
                        onClick={onExitLoop}
                        className="h-7 border border-white/5 rounded-sm text-[7px] font-black text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all bg-white/5 col-span-2 tactile-button"
                    >
                        EXIT LOOP
                    </button>
                </div>
            </div>

            {/* Hot Cues Right Column */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                    <div className="text-[7px] font-black uppercase tracking-widest text-white/20">Hot Points</div>
                    <button onClick={onClearCues} className="text-[6px] text-white/10 hover:text-red-500 uppercase font-black tracking-tighter">RESET</button>
                </div>
                <div className="grid grid-cols-2 grid-rows-2 gap-1.5">
                    {[0, 1, 2, 3].map((i) => {
                        const hasCue = hotCues[i] !== undefined;
                        return (
                            <button 
                                key={i} 
                                onClick={() => onHotCue?.(i)}
                                className={`h-7 border rounded-sm transition-all tactile-button ${hasCue ? glowClass : 'bg-white/5 border-white/5 text-white/20 hover:bg-white/10'}`}
                            >
                                <span className="text-[8px] font-black">{i + 1}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>

      {/* Advanced FX Overlay */}
      {showAdvanced && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-2 top-2 bottom-16 bg-brand-panel/95 backdrop-blur-2xl border border-white/10 z-30 p-4 flex flex-col gap-4 rounded-lg shadow-2xl overflow-y-auto custom-scrollbar"
          >
             <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">SPECIALIZED FX ENGINE // {id}</div>
                <button onClick={() => setShowAdvanced(false)} className="text-[8px] font-bold text-white/20 hover:text-white uppercase transition-colors px-1">Close</button>
             </div>
             
             {/* Beat Rolls */}
             <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-[7px] font-black uppercase tracking-widest text-white/20">Beat Roll / Repeat</div>
                  {sourceType === 'EXTERNAL' && (
                    <div className="text-[6px] font-black text-amber-500 uppercase tracking-widest leading-none bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded-sm">Local Only</div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {(['1/4', '1/8', '1/16'] as const).map((div) => (
                        <button 
                            key={div}
                            onClick={() => {
                              if (sourceType === 'EXTERNAL') return;
                              if (activeRoll === div) {
                                onRoll?.(null);
                              } else {
                                onRoll?.(div);
                              }
                            }}

                            disabled={sourceType === 'EXTERNAL'}
                            title={sourceType === 'EXTERNAL' ? "Beat rolls are not supported for YouTube/Spotify tracks" : `Toggle ${div} Beat Loop`}
                            className={`h-8 rounded-sm border text-[8px] font-black transition-all tactile-button ${
                              sourceType === 'EXTERNAL'
                                ? 'bg-zinc-900/40 border-white/5 text-zinc-550/40 cursor-not-allowed opacity-40 select-none'
                                : activeRoll === div 
                                ? glowClass 
                                : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'
                            }`}
                        >
                            {div}
                        </button>
                    ))}
                </div>
             </div>
             {/* FX Layout View Selector */}
             <div className="flex gap-1 bg-black/40 border border-white/5 p-1 rounded-sm mt-1">
                {(['KNOBS', 'SLIDERS', 'XY_PAD'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFxViewMode(mode)}
                    className={`flex-1 py-1 text-[7px] font-black uppercase tracking-widest rounded-sm transition-all border ${
                      fxViewMode === mode 
                        ? (id === 'A' 
                          ? 'bg-brand-cyan/25 text-brand-cyan border-brand-cyan/30 shadow-[0_0_8px_rgba(0,245,255,0.15)]' 
                          : 'bg-brand-purple/25 text-brand-purple border-brand-purple/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]')
                        : 'text-white/30 hover:text-white/60 hover:bg-white/5 border-transparent'
                    }`}
                  >
                    {mode === 'XY_PAD' ? 'XY Pad' : mode}
                  </button>
                ))}
             </div>

             {/* Dynamic FX Controls depending on chosen View Mode */}
             {fxViewMode === 'KNOBS' && (
               <div className="grid grid-cols-2 gap-4 flex-1 items-center">
                  <Knob 
                      label="ECHO"
                      min={0}
                      max={0.8}
                      value={fx?.echo || 0} 
                      onChange={(v) => onFxChange?.('echo', v)} 
                      size="md"
                      color={accentColor}
                      defaultValue={0}
                  />
                  <Knob 
                      label="FLAN"
                      min={0}
                      max={0.8}
                      value={fx?.flanger || 0} 
                      onChange={(v) => onFxChange?.('flanger', v)} 
                      size="md"
                      color={accentColor}
                      defaultValue={0}
                  />
                  <Knob 
                      label="BIT"
                      min={0}
                      max={1}
                      value={fx?.crush || 0} 
                      onChange={(v) => onFxChange?.('crush', v)} 
                      size="md"
                      color={accentColor}
                      defaultValue={0}
                  />
                  <Knob 
                      label="VERB"
                      min={0}
                      max={1}
                      value={fx?.reverb || 0} 
                      onChange={(v) => onFxChange?.('reverb', v)} 
                      size="md"
                      color={accentColor}
                      defaultValue={0}
                  />
               </div>
             )}

             {fxViewMode === 'SLIDERS' && (
               <div className="grid grid-cols-4 gap-2 flex-1 items-stretch py-2">
                  <InteractiveSlider 
                      label="ECHO"
                      min={0}
                      max={0.8}
                      value={fx?.echo || 0} 
                      onChange={(v) => onFxChange?.('echo', v)} 
                      color={accentColor}
                  />
                  <InteractiveSlider 
                      label="FLAN"
                      min={0}
                      max={0.8}
                      value={fx?.flanger || 0} 
                      onChange={(v) => onFxChange?.('flanger', v)} 
                      color={accentColor}
                  />
                  <InteractiveSlider 
                      label="BIT"
                      min={0}
                      max={1}
                      value={fx?.crush || 0} 
                      onChange={(v) => onFxChange?.('crush', v)} 
                      color={accentColor}
                  />
                  <InteractiveSlider 
                      label="VERB"
                      min={0}
                      max={1}
                      value={fx?.reverb || 0} 
                      onChange={(v) => onFxChange?.('reverb', v)} 
                      color={accentColor}
                  />
               </div>
             )}

             {fxViewMode === 'XY_PAD' && (
               <div className="flex-1 py-1 flex flex-col justify-center">
                 <XYPad 
                   fx={fx} 
                   onFxChange={onFxChange} 
                   accentColor={accentColor} 
                 />
               </div>
             )}
             
             <button 
                onClick={onSaveConfig}
                className="w-full py-2 bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-[8px] font-black uppercase tracking-widest hover:bg-brand-cyan/20 transition-all rounded tactile-button"
             >
                SAVE FX PRESET TO TRACK
             </button>
          </motion.div>
      )}

      {/* Main Transport Surface */}
      <div className="w-full flex justify-between items-end px-4 gap-4 z-10">
        <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 h-7">
              <button 
                onClick={onKeyLockToggle} 
                className={`flex-1 px-3 border rounded-sm text-[8px] font-black tracking-widest transition-all uppercase tactile-button ${keyLock ? glowClass : 'bg-white/5 border-white/10 text-white/20 hover:text-white/40'}`}
                title="Master Tempo"
              >
                MT
              </button>
              <button 
                onClick={onSync} 
                className={`flex-1 px-3 border rounded-sm text-[8px] font-black tracking-widest transition-all uppercase tactile-button ${
                  isSynced 
                    ? 'active-glow-green border-green-500/50' 
                    : 'bg-white/5 border border-white/10 text-white/20 hover:text-brand-cyan hover:border-brand-cyan/30'
                }`}
              >
                SYNC
              </button>
            </div>
            
            <div className="flex gap-1.5 items-center justify-center">
                {/* Quick Rewind button */}
                <button 
                    onClick={onRewind}
                    className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-[8px] font-black tactile-button"
                    title="Rewind track to start (0:00)"
                >
                    <Rewind size={14} fill="currentColor" />
                </button>
                
                {/* Main Play/Pause */}
                <button 
                  onClick={onPlayPause} 
                  disabled={isLoading}
                  style={{ opacity: isLoading ? 0.35 : 1, pointerEvents: isLoading ? 'none' : 'auto' }}
                  className={`play-button w-12 h-12 tactile-button ${isLoading ? 'bg-zinc-800 text-zinc-500' : ''}`}
                  title={isLoading ? "Track is buffering... please wait" : "Play / Pause"}
                >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent animate-spin rounded-full" />
                      </div>
                    ) : isPlaying ? (
                      <Pause size={20} fill="currentColor" />
                    ) : (
                      <Play size={20} className="translate-x-0.5" fill="currentColor" />
                    )}
                </button>

                {/* Reverse Toggle Button */}
                <button 
                  onClick={onReverseToggle}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center text-[8px] font-black tracking-tighter uppercase transition-all tactile-button ${
                    isReversed 
                      ? (id === 'A' ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-pink-500/20 border-pink-500 text-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.3)]')
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                  }`}
                  title="Reverse playback direction"
                >
                  REV
                </button>
            </div>

            <div className="flex gap-1.5 items-center justify-center">
                {/* Fast Rewind button */}
                <button 
                    onClick={() => onScratchDrag?.(-10)}
                    className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-[8px] font-black tactile-button"
                    title="Fast Rewind 10s"
                >
                    <Rewind size={14} />
                </button>

                {/* Hold/Strike Cue Button */}
                <button 
                    onMouseDown={onCuePress}
                    onMouseUp={onCueRelease}
                    onTouchStart={(e) => {
                      if (e.cancelable) e.preventDefault();
                      onCuePress?.();
                    }}
                    onTouchEnd={(e) => {
                      if (e.cancelable) e.preventDefault();
                      onCueRelease?.();
                    }}
                    className={`cue-button w-12 h-12 text-[10px] font-black uppercase tracking-widest border transition-all duration-150 rounded-full flex flex-col items-center justify-center tactile-button select-none ${
                      isCueActive 
                        ? (id === 'A' ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'bg-purple-500 border-purple-400 text-white shadow-[0_0_12px_rgba(168,85,247,0.6)]')
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700/80'
                    }`}
                    title="Press to jump to Cue Point, or hold when paused to preview starting scratch"
                >
                    <span className="text-[10px]">CUE</span>
                </button>

                {/* Fast Forward button */}
                <button 
                    onClick={() => onScratchDrag?.(10)}
                    className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-[8px] font-black tactile-button"
                    title="Fast Forward 10s"
                >
                    <FastForward size={14} />
                </button>
            </div>
        </div>

        <div className="flex flex-col items-center gap-1">
             <div className="lcd-display text-[9px] font-bold text-center w-12 mb-1 tabular-nums">{(gain * 100).toFixed(0)}</div>
             <Knob 
                label="GAIN"
                min={0}
                max={2}
                value={gain} 
                onChange={onGainChange} 
                size="sm"
                color={accentColor}
            />
        </div>

        <div className="flex flex-col items-center gap-2">
            <Fader 
                value={playbackRate - 1 + 0.5} 
                onChange={(v) => onRateChange(v - 0.5 + 1)} 
                label="TEMPO" 
                className="h-28 scale-90"
            />
        </div>
      </div>
    </div>
  );
}
