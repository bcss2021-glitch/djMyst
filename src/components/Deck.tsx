import { motion } from 'motion/react';
import { Play, Pause, FastForward, Rewind, ChevronRight, ChevronLeft, Zap, Layers, Music4, Save, ExternalLink, AlertTriangle, Upload, Heart } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { audioEngine } from '../lib/audioEngine';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}
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
    mode?: 'VINYL' | 'CDJ';
    onPitchBend?: (bend: number) => void;
    onPadTrigger?: (sample: string) => void;
    onScratchDrag?: (sec: number) => void;
    onScratchStart?: () => void;
    onScratchEnd?: () => void;
    baseBpm: number;
    platterStyle: 'VINYL' | 'CDJ' | 'NEON';
}

function JogWheel({ isPlaying, isLoading, id, playbackRate, rotation, onClick, onPitchBend, onPadTrigger, onScratchDrag, onScratchStart, onScratchEnd, mode = 'VINYL', baseBpm, platterStyle }: JogWheelProps & { onClick?: () => void }) {
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

  const isCDJActive = mode === 'CDJ' && isPlaying;

  const handleStart = (clientX: number, clientY: number) => {
    if (!wheelRef.current || isLoading) return;
    setIsGrabbing(true);
    
    if (!isCDJActive && onScratchStart) {
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
      
      if (isCDJActive) {
        // CDJ Pitch Bend Mode: speed up or slow down
        const bendAmt = 1 + (angleDiff * 0.012);
        const clampedBend = Math.max(0.75, Math.min(1.25, bendAmt));
        setBend(clampedBend);
        onPitchBend?.(clampedBend);
      } else {
        // Vinyl Mode or paused cueing: standard scratch/seek
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
      }
      
      lastAngleRef.current = currentAngle;
    }
  };

  const handleEnd = () => {
    if (!isGrabbing) return;
    setIsGrabbing(false);
    lastAngleRef.current = null;
    
    // Always reset pitch bend values on release to prevent stuck speeds
    setBend(1);
    onPitchBend?.(1);

    if (!isCDJActive) {
      if (onScratchEnd) {
        onScratchEnd();
      }
      setIsScratching(false);
    }
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
    const touch = e.changedTouches[0] || e.touches[0];
    if (!touch) return;
    const touchId = touch.identifier;
    handleStart(touch.clientX, touch.clientY);
    
    const handleGlobalTouchMove = (moveEvent: TouchEvent) => {
      let trackedTouch = null;
      for (let i = 0; i < moveEvent.touches.length; i++) {
        if (moveEvent.touches[i].identifier === touchId) {
          trackedTouch = moveEvent.touches[i];
          break;
        }
      }
      if (trackedTouch) {
        handleMove(trackedTouch.clientX, trackedTouch.clientY);
      }
    };
    
    const handleGlobalTouchEnd = (endEvent: TouchEvent) => {
      let isStillTracking = false;
      for (let i = 0; i < endEvent.touches.length; i++) {
        if (endEvent.touches[i].identifier === touchId) {
          isStillTracking = true;
          break;
        }
      }
      let touchEnded = false;
      if ('changedTouches' in endEvent) {
        for (let i = 0; i < endEvent.changedTouches.length; i++) {
          if (endEvent.changedTouches[i].identifier === touchId) {
            touchEnded = true;
            break;
          }
        }
      }
      if (!isStillTracking || touchEnded) {
        handleEnd();
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
        document.removeEventListener('touchcancel', handleGlobalTouchEnd);
      }
    };
    
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);
  };

  return (
    <div 
      ref={wheelRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`relative rounded-full bg-[#0a0a0c] border-[5px] sm:border-6 border-[#1c1c20] shadow-[0_0_30px_rgba(0,0,0,0.95),inset_0_0_20px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden transition-all duration-150 select-none jog-wheel-container ${
        isGrabbing 
          ? 'cursor-grabbing border-zinc-700 ring-2 ring-brand-cyan/20 scale-[0.99]' 
          : 'cursor-grab hover:border-zinc-800'
      }`}
      style={{
        width: 'var(--platter-size, 11rem)',
        height: 'var(--platter-size, 11rem)',
      }}
    >
      {/* 1. VINYL Grooves */}
      {platterStyle === 'VINYL' && (
        <div 
          className="absolute inset-0 rounded-full opacity-40 pointer-events-none" 
          style={{ 
            background: 'repeating-radial-gradient(circle, #010101, #010101 2px, #18181e 3px, #010101 4px)' 
          }} 
        />
      )}

      {/* 2. CDJ Strobe Rings */}
      {platterStyle === 'CDJ' && (
        <>
          <div className="absolute inset-2 rounded-full border-4 border-dashed border-zinc-800 opacity-60 pointer-events-none" />
          <div className="absolute inset-4 rounded-full border-2 border-dashed border-zinc-700 opacity-40 pointer-events-none" />
          <div className="absolute inset-6 rounded-full border border-dashed border-zinc-600 pointer-events-none opacity-20" />
        </>
      )}

      {/* 3. NEON Wave Rings */}
      {platterStyle === 'NEON' && (
        <>
          <div className={`absolute inset-1 rounded-full border border-double pointer-events-none ${
            id === 'A' 
              ? 'border-blue-500/35 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
              : 'border-purple-500/35 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
          }`} />
          <div className={`absolute inset-5 rounded-full border border-dotted pointer-events-none animate-[spin_12s_linear_infinite] ${
            id === 'A' ? 'border-cyan-500/40' : 'border-pink-500/40'
          }`} />
        </>
      )}
      
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

        {/* Style-specific markers inside the rotating chassis */}
        {platterStyle === 'CDJ' ? (
          <>
            {/* CDJ Strobe Dots along the outer edge of rotating chassis */}
            {[...Array(24)].map((_, i) => (
              <div 
                key={i}
                className="absolute w-1 h-1 bg-white/20 rounded-full"
                style={{
                  transform: `rotate(${i * 15}deg) translateY(var(--platter-stroke-y, -74px))`
                }}
              />
            ))}
            {/* CDJ Marker Stripe */}
            <div className={`absolute top-0 w-2.5 h-6 shadow-[0_0_10px_currentColor] ${
              id === 'A' ? 'bg-blue-400 text-blue-500' : 'bg-purple-400 text-purple-500'
            }`} />
          </>
        ) : platterStyle === 'NEON' ? (
          <>
            {/* NEON Laser Lines rotating */}
            <div className={`absolute w-full h-[1px] ${
              id === 'A' ? 'bg-gradient-to-r from-blue-500/10 via-blue-500 to-blue-500/10' : 'bg-gradient-to-r from-purple-500/10 via-purple-500 to-purple-500/10'
            }`} />
            <div className={`absolute w-[1px] h-full ${
              id === 'A' ? 'bg-gradient-to-b from-blue-500/10 via-blue-500 to-blue-500/10' : 'bg-gradient-to-b from-purple-500/10 via-purple-500 to-purple-500/10'
            }`} />
            {/* Neon Marker */}
            <div className={`absolute top-0 w-3 h-3 rounded-full shadow-[0_0_12px_currentColor] ${
              id === 'A' ? 'bg-cyan-400 text-cyan-400' : 'bg-pink-400 text-pink-400'
            }`} />
          </>
        ) : (
          <>
            {/* Traditional Vinyl Marker Stripe */}
            <div className={`absolute top-0 w-1.5 h-6 shadow-[0_0_8px_currentColor] rounded-b-full ${
              id === 'A' ? 'bg-blue-400 text-blue-500' : 'bg-purple-400 text-purple-500'
            }`} />
            <div className="absolute bottom-0 w-1 h-3 bg-white/10 rounded-t-full" />
            <div className="absolute left-0 w-3 h-1 bg-white/10 rounded-r-full" />
            <div className="absolute right-0 w-3 h-1 bg-white/10 rounded-l-full" />
          </>
        )}
      </div>

      {/* Center Metal Cap Display */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="absolute rounded-full bg-gradient-to-b from-[#18181b] to-[#0f0f11] border border-white/[0.08] flex flex-col items-center justify-center shadow-2xl z-10 cursor-pointer active:scale-95 transition-transform"
        style={{
          width: 'var(--center-size, 6rem)',
          height: 'var(--center-size, 6rem)',
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 rounded-full z-20">
             <div className={`w-8 h-8 border-2 border-t-transparent animate-spin rounded-full ${id === 'A' ? 'border-blue-500' : 'border-purple-500'}`} />
          </div>
        )}
        
        {isGrabbing && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#101014] rounded-full z-20">
             <span className={`text-[9.5px] font-black uppercase tracking-widest animate-pulse ${
               id === 'A' ? 'text-blue-400 drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]' : 'text-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]'
             }`}>
               {isCDJActive ? (bend !== 1 ? 'NUDGE' : 'TOUCH') : (isScratching ? 'SCRATCH' : 'HOLD')}
             </span>
          </div>
        )}

        <div className={`text-xl font-mono font-black tracking-tighter leading-none ${
          isGrabbing 
            ? 'text-zinc-500' 
            : (id === 'A' ? 'text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.3)]' : 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.3)]')
        }`}>
          {(baseBpm * playbackRate * bend).toFixed(1)}
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
  trackTitle?: string;
  trackArtist?: string;
  onFileDrop?: (file: File) => void;
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
  onHotCue?: (index: number, action?: 'TRIGGER' | 'CLEAR') => void;
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
  onPlayerPlay?: () => void;
  onPlayerPause?: () => void;
  onEject?: () => void;
  onSkip?: (seconds: number) => void;
  isSynced?: boolean;
  baseBpm?: number;
  onBpmTap?: () => void;
  isSlipActive?: boolean;
  onSlipToggle?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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
  
  const handleStart = (e: React.MouseEvent | React.TouchEvent, clientY: number, touchId: number | null) => {
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
      let trackedTouch = null;
      for (let i = 0; i < moveEvent.touches.length; i++) {
        if (moveEvent.touches[i].identifier === touchId) {
          trackedTouch = moveEvent.touches[i];
          break;
        }
      }
      if (trackedTouch) {
        updateValue(trackedTouch.clientY);
      }
    };

    const handleStop = (stopEvent: MouseEvent | TouchEvent) => {
      if (touchId !== null && 'touches' in stopEvent) {
        let isStillTracking = false;
        for (let i = 0; i < stopEvent.touches.length; i++) {
          if (stopEvent.touches[i].identifier === touchId) {
            isStillTracking = true;
            break;
          }
        }
        let touchEnded = false;
        if ('changedTouches' in stopEvent) {
          for (let i = 0; i < stopEvent.changedTouches.length; i++) {
            if (stopEvent.changedTouches[i].identifier === touchId) {
              touchEnded = true;
              break;
            }
          }
        }
        if (!isStillTracking || touchEnded) {
          setIsDragging(false);
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleStop);
          window.removeEventListener('touchmove', handleTouchMove);
          window.removeEventListener('touchend', handleStop);
          window.removeEventListener('touchcancel', handleStop);
        }
      } else {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleStop);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleStop);
        window.removeEventListener('touchcancel', handleStop);
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleStop);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleStop);
    window.addEventListener('touchcancel', handleStop);
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
          onMouseDown={(e) => handleStart(e, e.clientY, null)}
          onTouchStart={(e) => {
            const touch = e.changedTouches[0] || e.touches[0];
            if (touch) {
              handleStart(e, touch.clientY, touch.identifier);
            }
          }}
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

    const isTouchEvent = 'touches' in e;
    const touch = isTouchEvent ? ((e as React.TouchEvent).changedTouches[0] || (e as React.TouchEvent).touches[0]) : null;
    const touchId = touch ? touch.identifier : null;

    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    updatePoint(clientX, clientY);

    const handleMove = (moveEvent: MouseEvent) => {
      updatePoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      let trackedTouch = null;
      for (let i = 0; i < moveEvent.touches.length; i++) {
        if (moveEvent.touches[i].identifier === touchId) {
          trackedTouch = moveEvent.touches[i];
          break;
        }
      }
      if (trackedTouch) {
        updatePoint(trackedTouch.clientX, trackedTouch.clientY);
      }
    };

    const handleStop = (stopEvent: MouseEvent | TouchEvent) => {
      if (touchId !== null && 'touches' in stopEvent) {
        let isStillTracking = false;
        for (let i = 0; i < stopEvent.touches.length; i++) {
          if (stopEvent.touches[i].identifier === touchId) {
            isStillTracking = true;
            break;
          }
        }
        let touchEnded = false;
        if ('changedTouches' in stopEvent) {
          for (let i = 0; i < stopEvent.changedTouches.length; i++) {
            if (stopEvent.changedTouches[i].identifier === touchId) {
              touchEnded = true;
              break;
            }
          }
        }
        if (!isStillTracking || touchEnded) {
          setIsPressing(false);
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleStop);
          window.removeEventListener('touchmove', handleTouchMove);
          window.removeEventListener('touchend', handleStop);
          window.removeEventListener('touchcancel', handleStop);
        }
      } else if (!('touches' in stopEvent)) {
        setIsPressing(false);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleStop);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleStop);
        window.removeEventListener('touchcancel', handleStop);
      }
    };

    if (isTouchEvent) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleStop);
      window.addEventListener('touchcancel', handleStop);
    } else {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleStop);
    }
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

interface HotCueButtonProps {
  index: number;
  hasCue: boolean;
  cueTime?: number;
  glowClass: string;
  formatTime: (sec: number) => string;
  onHotCue?: (index: number, action?: 'TRIGGER' | 'CLEAR') => void;
}

function HotCueButton({ index, hasCue, cueTime, glowClass, formatTime, onHotCue }: HotCueButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wasTriggeredRef = useRef(false);
  const hadCueOnStartRef = useRef(false);
  const hasTouchRef = useRef(false);

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'mousedown') {
      if ((e as React.MouseEvent).button !== 0) return; // Only primary clicks
      if (hasTouchRef.current) return; // Avoid double triggering on hybrid devices
    } else if (e.type === 'touchstart') {
      hasTouchRef.current = true;
    }

    hadCueOnStartRef.current = hasCue;
    wasTriggeredRef.current = false;

    // Trigger instantly for standard DJ zero-latency feel
    onHotCue?.(index, 'TRIGGER');

    if (hasCue) {
      setIsHolding(true);
      timerRef.current = setTimeout(() => {
        onHotCue?.(index, 'CLEAR');
        setIsHolding(false);
        wasTriggeredRef.current = true;
        
        // Tactile Haptic feedback if supported on mobile
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate(50);
          } catch (err) {}
        }
      }, 700);
    }
  };

  const endPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'touchend') {
      setTimeout(() => {
        hasTouchRef.current = false;
      }, 300);
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsHolding(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <button
      onMouseDown={startPress}
      onMouseUp={(e) => endPress(e)}
      onMouseLeave={(e) => endPress(e)}
      onTouchStart={startPress}
      onTouchEnd={(e) => endPress(e)}
      onTouchCancel={(e) => endPress(e)}
      onContextMenu={(e) => {
        e.preventDefault();
        onHotCue?.(index, 'CLEAR');
      }}
      title={hasCue ? `Jump to Cue ${index + 1} (${formatTime(cueTime || 0)}) — Hold to clear, Right-click to clear` : `Set Cue ${index + 1} at current position`}
      className={`h-9 border rounded-sm transition-all tactile-button flex flex-col items-center justify-center leading-none relative overflow-hidden select-none active:scale-95 ${hasCue ? glowClass : 'bg-white/5 border-white/5 text-white/20 hover:bg-white/10'}`}
    >
      <style>{`
        @keyframes cueWipeFill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      
      {/* Wipe Fill overlay indicator for deletion timer */}
      {isHolding && (
        <div 
          className="absolute inset-y-0 left-0 bg-red-600/30 origin-left"
          style={{
            animation: 'cueWipeFill 0.7s linear forwards'
          }}
        />
      )}

      <span className="text-[8px] font-black relative z-10">{index + 1}</span>
      {hasCue && cueTime !== undefined ? (
        <span className="text-[7.5px] font-mono font-bold text-white mt-0.5 tracking-tight relative z-10">
          {formatTime(cueTime)}
        </span>
      ) : (
        <span className="text-[6.5px] font-mono tracking-tighter opacity-30 mt-0.5 relative z-10">
          EMPTY
        </span>
      )}
    </button>
  );
}

export default function Deck({ 
  id, trackUrl, trackTitle, trackArtist, onFileDrop, isPlaying, isLoading, onPlayPause, onSync, 
  playbackRate, onRateChange, onPitchBend, fx, onFxChange, 
  onPadTrigger, onRoll, activeRoll, onSaveConfig, sourceType = 'AUDIO', externalUrl,
  keyLock, onKeyLockToggle, gain = 1, onGainChange, hotCues = [], onHotCue, onClearCues,
  loop, onLoopIn, onLoopOut, onExitLoop, resolvedVolume = 1,
  onRewind, onCuePress, onCueRelease, isCueActive = false, onReverseToggle, isReversed = false,
  onScratchDrag, onScratchStart, onScratchEnd, onPlayerReady, onPlayerBuffer, isSynced = false,
  onPlayerPlay, onPlayerPause, onEject, onSkip,
  baseBpm = 128, onBpmTap, isSlipActive = false, onSlipToggle,
  isFavorite = false, onToggleFavorite
}: DeckProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [jogMode, setJogMode] = useState<'VINYL' | 'CDJ'>('VINYL');
  const [platterStyle, setPlatterStyle] = useState<'VINYL' | 'CDJ' | 'NEON'>('VINYL');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileDrop?.(file);
    }
  };
  const [advancedTab, setAdvancedTab] = useState<'FX' | 'SAMPLER'>('FX');
  const [fxViewMode, setFxViewMode] = useState<'KNOBS' | 'SLIDERS' | 'XY_PAD'>('KNOBS');

  const [extDuration, setExtDuration] = useState(0);
  const [extPlayedSeconds, setExtPlayedSeconds] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [nativeDuration, setNativeDuration] = useState(0);

  const ytPlayerRef = useRef<any>(null);
  const [isYtReady, setIsYtReady] = useState(false);

  // Helper to extract YouTube ID
  const getYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Helper to get Spotify embed URL
  const getSpotifyEmbedUrl = (url: string): string | null => {
    const match = url.match(/\/(track|playlist|album)\/([a-zA-Z0-9]+)/);
    if (match) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
    }
    return null;
  };

  const ytId = externalUrl ? getYouTubeId(externalUrl) : null;
  const spotifyEmbedUrl = externalUrl ? getSpotifyEmbedUrl(externalUrl) : null;

  // Dynamically load YouTube API script if needed
  useEffect(() => {
    if (sourceType !== 'EXTERNAL' || !ytId) return;

    let active = true;

    const initPlayer = (YT: any) => {
      if (!active) return;
      
      // Destroy existing player if any
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
        ytPlayerRef.current = null;
      }

      try {
        const container = document.getElementById(`yt-player-${id}`);
        if (!container) return;

        ytPlayerRef.current = new YT.Player(`yt-player-${id}`, {
          videoId: ytId,
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin && window.location.origin !== 'null' ? window.location.origin : undefined
          },
          events: {
            onReady: (event: any) => {
              if (!active) return;
              setIsYtReady(true);
              event.target.setVolume(resolvedVolume * 100);
              onPlayerReady?.();
              setExtDuration(event.target.getDuration() || 0);
            },
            onStateChange: (event: any) => {
              if (!active) return;
              // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
              const state = event.data;
              if (state === 1) {
                onPlayerPlay?.();
              } else if (state === 2 || state === 0) {
                onPlayerPause?.();
              } else if (state === 3) {
                onPlayerBuffer?.();
              }
            }
          }
        });
      } catch (err) {
        console.error("Error creating YouTube player instance:", err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer(window.YT);
    } else {
      // Setup global callback if not yet defined
      const existingCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (existingCallback) existingCallback();
        if (window.YT && window.YT.Player) {
          initPlayer(window.YT);
        }
      };

      // Inject script if not already in document
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }
    }

    return () => {
      active = false;
      setIsYtReady(false);
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
        ytPlayerRef.current = null;
      }
    };
  }, [externalUrl, sourceType, id]);

  // Synchronize playing/pausing state
  useEffect(() => {
    if (!ytPlayerRef.current || !isYtReady) return;
    try {
      const playerState = ytPlayerRef.current.getPlayerState();
      if (isPlaying && playerState !== 1) {
        ytPlayerRef.current.playVideo();
      } else if (!isPlaying && playerState === 1) {
        ytPlayerRef.current.pauseVideo();
      }
    } catch (e) {}
  }, [isPlaying, isYtReady]);

  // Synchronize volume level
  useEffect(() => {
    if (!ytPlayerRef.current || !isYtReady) return;
    try {
      ytPlayerRef.current.setVolume(resolvedVolume * 100);
    } catch (e) {}
  }, [resolvedVolume, isYtReady]);

  // Track playback time progress for YouTube
  useEffect(() => {
    if (sourceType !== 'EXTERNAL' || !isPlaying || !isYtReady) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const time = ytPlayerRef.current.getCurrentTime();
          setExtPlayedSeconds(time || 0);
          const duration = ytPlayerRef.current.getDuration();
          if (duration && duration !== extDuration) {
            setExtDuration(duration);
          }
        } catch (e) {}
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, sourceType, extDuration, isYtReady]);

  // Read native current position with an optimized, lightweight interval when playing
  useEffect(() => {
    if (sourceType === 'EXTERNAL') return;
    
    // Smooth immediate sync on play state change or loading
    setCurrentTime(audioEngine.getPosition(id));

    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(audioEngine.getPosition(id));
    }, 100); // 10 updates per second is visually instantaneous for digital clocks/bars but 10x lower CPU!
    
    return () => clearInterval(interval);
  }, [id, sourceType, isPlaying, trackUrl]);

  // Read native duration
  useEffect(() => {
    if (sourceType === 'EXTERNAL') return;
    
    const updateDuration = () => {
      const nativePlayer = audioEngine.getDeck(id);
      if (nativePlayer && nativePlayer.buffer && nativePlayer.buffer.loaded) {
        setNativeDuration(nativePlayer.buffer.duration || 0);
      }
    };
    
    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [id, sourceType, trackUrl]);

  const resolvedCurrentTime = sourceType === 'EXTERNAL' ? extPlayedSeconds : currentTime;
  const resolvedDuration = sourceType === 'EXTERNAL' ? extDuration : nativeDuration;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const accentColor = id === 'A' ? 'var(--color-brand-cyan)' : 'var(--color-brand-purple)';
  const glowClass = id === 'A' ? 'active-glow-cyan' : 'active-glow-purple';

  const samples = ["scratch", "fx_1", "fx_2", "fx_3"];

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-between pt-1.5 pb-20 flex-1 h-full relative hardware-panel overflow-y-auto custom-scrollbar ${id === 'A' ? 'deck-gradient-a' : 'deck-gradient-b'}`}
    >
      {/* Drag and Drop File Highlight Overlay */}
      {isDraggingFile && (
        <div className={`absolute inset-0 z-50 rounded-lg backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed p-6 text-center transition-all ${
          id === 'A' 
            ? 'bg-blue-950/90 border-blue-400 text-blue-300 shadow-[0_0_30px_rgba(59,130,246,0.4)]' 
            : 'bg-purple-950/90 border-purple-400 text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.4)]'
        }`}>
          <Upload className="w-10 h-10 mb-2 animate-bounce" />
          <p className="text-xs font-black uppercase tracking-widest">
            DROP FILE TO LOAD ON DECK {id}
          </p>
          <p className="text-[9px] opacity-60 font-mono mt-1">
            Supports MP3, WAV, OGG, M4A, FLAC, etc.
          </p>
        </div>
      )}

      {/* Track info strip with File Loader at the very top */}
      <div className="w-full px-3 flex items-center justify-between gap-1.5 z-10 border-b border-white/5 pb-1 mb-1 shrink-0">
        <div className="flex flex-col min-w-0 flex-1 text-left">
          <span className="text-[7.5px] font-black uppercase tracking-[0.2em] opacity-30">LOADED SOUND SOURCE</span>
          <div className="flex items-center gap-1.5 min-w-0">
            {trackUrl && onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className={`flex-shrink-0 cursor-pointer p-0.5 rounded transition-all ${
                  isFavorite 
                    ? 'text-rose-500 hover:scale-110 drop-shadow-[0_0_4px_rgba(244,63,94,0.5)]' 
                    : 'text-white/20 hover:text-white/40 hover:scale-105'
                }`}
                title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Heart size={11} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            )}
            <span 
              title={trackTitle || undefined}
              className={`block truncate text-[10.5px] font-black font-mono uppercase ${id === 'A' ? 'text-blue-400' : 'text-purple-400'} w-full`}
            >
              {trackTitle || 'NO TRACK LOADED'}
            </span>
          </div>
        </div>
        
        {/* Direct manual file load button for this specific deck */}
        <label className="flex items-center gap-1 px-2 py-1 text-[8.5px] font-bold uppercase tracking-wider rounded border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer select-none">
          <Upload size={10} className={id === 'A' ? 'text-blue-400' : 'text-purple-400'} />
          <span>LOAD FILE</span>
          <input 
            type="file" 
            className="hidden" 
            accept="audio/*" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onFileDrop) {
                onFileDrop(file);
              }
            }} 
          />
        </label>
      </div>

      {sourceType === 'EXTERNAL' && externalUrl && (
        <div className="absolute inset-0 z-40 bg-brand-deep/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center rounded-lg border border-white/10">
          {onEject && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onEject();
              }}
              title="Eject track and reset deck"
              className="absolute top-3 right-3 p-1 rounded bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 text-[9px] font-black uppercase tracking-wider px-2.5 shadow-[0_4px_12px_rgba(239,68,68,0.2)]"
            >
              EJECT
            </button>
          )}

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
            {ytId ? (
              <div id={`yt-player-${id}`} className="absolute inset-0 w-full h-full" />
            ) : spotifyEmbedUrl ? (
              <iframe
                src={spotifyEmbedUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen={false}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="absolute inset-0 w-full h-full"
                title={`Spotify Player Deck ${id}`}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-[10px]">
                Unsupported or invalid stream URL
              </div>
            )}
          </div>

          <div className="w-full flex justify-center mb-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 max-w-sm text-center flex flex-col gap-2 items-center">
              <div className="flex items-center justify-center gap-1.5 text-amber-500 text-[9px] font-black uppercase tracking-wider">
                <AlertTriangle size={12} className="animate-pulse" /> Iframe Sandbox Restrictions
              </div>
              <p className="text-[10px] text-zinc-350 leading-normal max-w-xs">
                Browsers block audio contexts inside third-party embeds (like YouTube) when nested in preview windows.
              </p>
              <p className="text-[10px] text-emerald-400 font-semibold leading-normal max-w-xs bg-emerald-950/20 px-2 py-1.5 rounded border border-emerald-500/10">
                💡 TIP: Click directly on the video's native Play or Volume buttons inside the box above to immediately unblock full sound and auto-sync the deck!
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

      {/* Header Deck Info Grid */}
      <div className="w-full px-3 grid grid-cols-3 gap-1.5 items-center z-10 font-mono shrink-0 mb-1">
         <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-20">STATUS</span>
            <div className="lcd-display text-[10px] font-bold text-brand-cyan text-center truncate">
               {loop?.active ? 'LOOP ON' : (isLoading ? 'LOADING...' : (isPlaying ? 'PLAYING' : 'READY'))}
            </div>
         </div>

         <div className="flex flex-col items-center">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-20">TIME TRACKER</span>
            <div className="lcd-display text-[10px] font-bold text-emerald-400 text-center tabular-nums font-mono tracking-tight flex flex-col items-center w-full">
               <span>{formatTime(resolvedCurrentTime)} / {formatTime(resolvedDuration)}</span>
               {/* Mini visual progress slider */}
               <div className="w-16 h-1 bg-zinc-950/80 rounded-full overflow-hidden mt-0.5 border border-white/5">
                 <div 
                   className={`h-full ${id === 'A' ? 'bg-blue-400' : 'bg-purple-400'} transition-all duration-100`}
                   style={{ width: `${resolvedDuration > 0 ? (resolvedCurrentTime / resolvedDuration) * 100 : 0}%` }}
                 />
               </div>
            </div>
         </div>

         <div className="flex flex-col items-end">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-20 font-sans">SPEED / PITCH</span>
            <div className="lcd-display text-[10px] font-bold text-brand-cyan text-center tabular-nums flex flex-col items-end gap-0.5 min-w-[70px]">
               <span>{((playbackRate - 1) * 100).toFixed(1)}%</span>
               <span className="text-[7.5px] text-zinc-500 font-normal">BASE: {baseBpm.toFixed(0)} BPM</span>
            </div>
            <button
              onClick={onBpmTap}
              className="mt-0.5 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[7px] font-black text-white/50 hover:text-white hover:bg-white/10 active:scale-95 transition-all uppercase tracking-wider cursor-pointer"
              title="Tap to the beat to set the BPM"
            >
              TAP BPM
            </button>
         </div>
      </div>

      {/* Platter Area with Vertical Flow Controls next to JogWheel */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 relative w-full px-2 shrink-0 mt-0.5 mb-1 select-none">
          {/* Left Vertical Platter Controls */}
          <div className="flex flex-col gap-1 shrink-0 z-10 items-center">
              <span className="text-[6.5px] font-bold text-zinc-500 uppercase tracking-widest">JOG MODE</span>
              <div className="flex flex-col gap-1 bg-black/60 p-1 rounded-md border border-white/5 text-[8px] font-mono font-bold w-12 sm:w-14">
                <button
                  onClick={() => setJogMode('VINYL')}
                  className={`py-1 px-0.5 rounded text-[8px] transition-all uppercase select-none cursor-pointer text-center ${
                    jogMode === 'VINYL' 
                      ? 'bg-amber-500 text-black shadow-[0_2px_6px_rgba(245,158,11,0.3)] font-black' 
                      : 'text-white/40 hover:text-white/60'
                  }`}
                  title="Scratch mode"
                >
                  VINYL
                </button>
                <button
                  onClick={() => setJogMode('CDJ')}
                  className={`py-1 px-0.5 rounded text-[8px] transition-all uppercase select-none cursor-pointer text-center ${
                    jogMode === 'CDJ' 
                      ? (id === 'A' ? 'bg-blue-500 text-white shadow-[0_2px_6px_rgba(59,130,246,0.3)] font-black' : 'bg-purple-500 text-white shadow-[0_2px_6px_rgba(168,85,247,0.3)] font-black')
                      : 'text-white/40 hover:text-white/60'
                  }`}
                  title="Pitch bend mode"
                >
                  CDJ
                </button>
              </div>

              {/* Slip Mode Toggle */}
              <button
                onClick={onSlipToggle}
                className={`w-12 sm:w-14 py-1 rounded-md border text-[7.5px] font-mono font-black tracking-wider uppercase transition-all select-none cursor-pointer text-center ${
                  isSlipActive 
                    ? 'bg-red-500 border-red-400 text-white shadow-[0_0_6px_rgba(239,68,68,0.5)]' 
                    : 'bg-black/60 border-white/5 text-white/40 hover:text-white hover:border-white/10'
                }`}
                title="Slip mode"
              >
                SLIP
              </button>
          </div>

          {/* Center JogWheel Disc */}
          <div className="relative group flex flex-col items-center">
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
                  mode={jogMode}
                  baseBpm={baseBpm}
                  platterStyle={platterStyle}
              />
              
              {/* Toggle Button */}
              <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`absolute ${id === 'A' ? '-right-7' : '-left-7'} top-1/2 -translate-y-1/2 p-1.5 bg-brand-panel border border-white/10 text-white/40 hover:text-white transition-all z-20 shadow-2xl rounded-full tactile-button`}
                  title={showAdvanced ? "Back to Deck" : "Show FX"}
              >
                  {showAdvanced ? (id === 'A' ? <ChevronLeft size={10} /> : <ChevronRight size={10} />) : (id === 'A' ? <ChevronRight size={10} /> : <ChevronLeft size={10} />)}
              </button>
          </div>

          {/* Right Vertical Platter Controls */}
          <div className="flex flex-col gap-1 shrink-0 z-10 items-center">
              <span className="text-[6.5px] font-bold text-zinc-500 uppercase tracking-widest">STYLE</span>
              <div className="flex flex-col gap-1 bg-black/60 p-1 rounded-md border border-white/5 text-[7.5px] font-mono font-bold w-12 sm:w-14">
                {(['VINYL', 'CDJ', 'NEON'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setPlatterStyle(style)}
                    className={`py-1 text-[7.5px] rounded transition-all uppercase select-none cursor-pointer text-center ${
                      platterStyle === style 
                        ? 'bg-zinc-700 text-white font-black' 
                        : 'text-white/40 hover:text-white/60'
                    }`}
                    title={`${style} Platter style`}
                  >
                    {style}
                  </button>
                ))}
              </div>
          </div>
      </div>
        
      <div className="grid grid-cols-2 gap-2 w-full shrink-0">
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
                    {[0, 1, 2, 3].map((i) => (
                        <HotCueButton
                            key={i}
                            index={i}
                            hasCue={hotCues[i] !== undefined}
                            cueTime={hotCues[i]}
                            glowClass={glowClass}
                            formatTime={formatTime}
                            onHotCue={onHotCue}
                        />
                    ))}
                </div>
            </div>
        </div>

      {/* Advanced FX Overlay */}
      {showAdvanced && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-2 top-2 bottom-16 bg-[#0c0d10]/98 backdrop-blur-2xl border border-white/10 z-30 p-3.5 flex flex-col gap-3.5 rounded-lg shadow-2xl overflow-y-auto custom-scrollbar"
          >
             <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">CONSOLE DECK EXPANSION // {id}</div>
                <button onClick={() => setShowAdvanced(false)} className="text-[8px] font-bold text-white/20 hover:text-white uppercase transition-colors px-1 pointer-events-auto">Close</button>
             </div>

             {/* Tab Toggle Control */}
             <div className="flex bg-black/45 border border-white/5 p-1 rounded gap-1 flex-shrink-0">
                <button 
                  onClick={() => setAdvancedTab('FX')} 
                  className={`flex-grow py-1.5 px-3 rounded text-[8px] font-black uppercase tracking-widest border transition-all text-center flex items-center justify-center gap-1.5 ${
                    advancedTab === 'FX' 
                      ? (id === 'A' 
                        ? 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/20' 
                        : 'bg-brand-purple/15 text-brand-purple border-brand-purple/20')
                      : 'border-transparent text-white/30 hover:text-white/60 hover:bg-white/5'
                  }`}
                >
                  🎛️ SPECIALIZED FX ENGINE
                </button>
                <button 
                  onClick={() => setAdvancedTab('SAMPLER')} 
                  className={`flex-grow py-1.5 px-3 rounded text-[8px] font-black uppercase tracking-widest border transition-all text-center flex items-center justify-center gap-1.5 ${
                    advancedTab === 'SAMPLER' 
                      ? (id === 'A' 
                        ? 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/20' 
                        : 'bg-brand-purple/15 text-brand-purple border-brand-purple/20')
                      : 'border-transparent text-white/30 hover:text-white/60 hover:bg-white/5'
                  }`}
                >
                  🎹 LIVE SYNTH & SAMPLER
                </button>
             </div>
             
             {advancedTab === 'FX' ? (
               <>
                 {/* Beat Rolls */}
                 <div className="space-y-2 flex-shrink-0">
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
                 <div className="flex gap-1 bg-black/40 border border-white/5 p-1 rounded-sm mt-1 flex-shrink-0">
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
                    className="w-full py-2 bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-[8px] font-black uppercase tracking-widest hover:bg-brand-cyan/20 transition-all rounded tactile-button flex-shrink-0"
                 >
                    SAVE FX PRESET TO TRACK
                 </button>
               </>
             ) : (
               <div className="flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar">
                  {/* Procedural Synths (Trance & Techno) */}
                  <div className="space-y-1.5">
                     <div className="flex justify-between items-center px-0.5">
                        <span className={`text-[7.5px] font-black uppercase tracking-widest font-mono ${id === 'A' ? 'text-brand-cyan' : 'text-brand-purple'}`}>🎹 LIVE PROCEDURAL SYNTHS</span>
                        <span className="text-[6px] text-zinc-400 font-mono">0ms buffering</span>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => onPadTrigger('trance_stab')}
                          className="h-12 rounded bg-cyan-600/10 hover:bg-cyan-600/15 border border-cyan-500/20 active:scale-95 transition-all p-2 flex flex-col justify-center items-start text-left group"
                        >
                           <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-wide group-hover:text-cyan-300">TRANCE DETUNED STAB</span>
                           <span className="text-[6.5px] font-mono text-zinc-400 leading-tight">Super-saw 5-note minor 9th chord shift</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('acid_line')}
                          className="h-12 rounded bg-purple-600/10 hover:bg-purple-600/15 border border-purple-500/20 active:scale-95 transition-all p-2 flex flex-col justify-center items-start text-left group"
                        >
                           <span className="text-[8px] font-bold text-purple-400 uppercase tracking-wide group-hover:text-purple-300">ACID 303 CORE SEQUENCE</span>
                           <span className="text-[6.5px] font-mono text-zinc-400 leading-tight">Resonant filter-swept arps</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('rave_siren')}
                          className="h-12 rounded bg-amber-600/10 hover:bg-amber-600/15 border border-amber-500/20 active:scale-95 transition-all p-2 flex flex-col justify-center items-start text-left group"
                        >
                           <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wide group-hover:text-amber-300">RAVE LFO RISER</span>
                           <span className="text-[6.5px] font-mono text-zinc-400 leading-tight">Vibrato siren sweep (0.2s - 1.2s)</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('sub_drop')}
                          className="h-12 rounded bg-emerald-600/10 hover:bg-emerald-600/15 border border-emerald-500/20 active:scale-95 transition-all p-2 flex flex-col justify-center items-start text-left group"
                        >
                           <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wide group-hover:text-emerald-300">INFRA-SUB DROP</span>
                           <span className="text-[6.5px] font-mono text-zinc-400 leading-tight">Heavy sub-bass sine drop down to 32Hz</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('noise_sweep')}
                          className="h-12 rounded bg-indigo-600/10 hover:bg-indigo-600/15 border border-indigo-500/20 active:scale-95 transition-all p-2 flex flex-col justify-center items-start text-left group col-span-2"
                        >
                           <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-wide group-hover:text-indigo-300">WHITE NOISE transition UPLIFT</span>
                           <span className="text-[6.5px] font-mono text-zinc-400 leading-tight">Bandpass sweep-rise over 1.5s with stereo reverb decay</span>
                        </button>
                     </div>
                  </div>

                  {/* Standard audio sampler grid */}
                  <div className="space-y-1.5 m-0 pb-1">
                     <div className={`text-[7.5px] font-black uppercase tracking-widest font-mono px-0.5 ${id === 'A' ? 'text-brand-cyan' : 'text-brand-purple'}`}>🥁 INSTANT LAUNCHER SAMPLER</div>
                     <div className="grid grid-cols-4 gap-1.5">
                        <button 
                          onClick={() => onPadTrigger('kick')}
                          className={`h-9 border border-rose-800/40 bg-rose-950/20 text-rose-400 rounded text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center leading-none hover:bg-rose-900/10 shadow-[0_0_10px_rgba(244,63,94,0.05)]`}
                        >
                           <span>KICK</span>
                           <span className="text-[5.5px] opacity-30 mt-0.5">DRUM</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('snare')}
                          className={`h-9 border border-amber-800/40 bg-amber-950/20 text-amber-400 rounded text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center leading-none hover:bg-amber-900/10 shadow-[0_0_10px_rgba(245,158,11,0.05)]`}
                        >
                           <span>SNARE</span>
                           <span className="text-[5.5px] opacity-30 mt-0.5">DRUM</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('clap')}
                          className={`h-9 border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 rounded text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center leading-none hover:bg-emerald-900/10 shadow-[0_0_10px_rgba(16,185,129,0.05)]`}
                        >
                           <span>CLAP</span>
                           <span className="text-[5.5px] opacity-30 mt-0.5">SYNTH</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('hihat')}
                          className={`h-9 border border-cyan-800/40 bg-cyan-950/20 text-cyan-400 rounded text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center leading-none hover:bg-cyan-900/10 shadow-[0_0_10px_rgba(6,182,212,0.05)]`}
                        >
                           <span>HI-HAT</span>
                           <span className="text-[5.5px] opacity-30 mt-0.5">CYMBAL</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('scratch')}
                          className={`h-9 border border-indigo-800/40 bg-indigo-950/20 text-indigo-400 rounded text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center leading-none hover:bg-indigo-900/10 shadow-[0_0_10px_rgba(99,102,241,0.05)]`}
                        >
                           <span>SCRATCH</span>
                           <span className="text-[5.5px] opacity-30 mt-0.5">VINYL</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('fx_1')}
                          className={`h-9 border border-fuchsia-800/40 bg-fuchsia-950/20 text-fuchsia-400 rounded text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center leading-none hover:bg-fuchsia-900/10 shadow-[0_0_10px_rgba(217,70,239,0.05)]`}
                        >
                           <span>RISER</span>
                           <span className="text-[5.5px] opacity-30 mt-0.5">IMPACT</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('fx_2')}
                          className={`h-9 border border-purple-800/40 bg-purple-950/20 text-purple-400 rounded text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center leading-none hover:bg-purple-900/10`}
                        >
                           <span>VOCAL HO!</span>
                           <span className="text-[5.5px] opacity-30 mt-0.5">"GO!"</span>
                        </button>
                        <button 
                          onClick={() => onPadTrigger('fx_3')}
                          className={`h-9 border border-blue-800/40 bg-blue-950/20 text-blue-400 rounded text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center leading-none hover:bg-blue-900/10`}
                        >
                           <span>LASER</span>
                           <span className="text-[5.5px] opacity-30 mt-0.5">FX DROP</span>
                        </button>
                     </div>
                  </div>
               </div>
             )}
          </motion.div>
      )}

      {/* Main Transport Surface */}
      <div className="w-full flex justify-between items-end px-4 gap-4 z-10 shrink-0">
         <div className="flex flex-col gap-1.5">
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
                    onClick={() => onSkip?.(-10)}
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
                    onClick={() => onSkip?.(10)}
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
