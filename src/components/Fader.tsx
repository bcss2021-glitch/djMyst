import { motion } from 'motion/react';
import { useRef } from 'react';

interface FaderProps {
  value: number;
  onChange: (val: number) => void;
  vertical?: boolean;
  label?: string;
  className?: string;
}

export default function Fader({ value, onChange, vertical = true, label, className = "" }: FaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const updateValueFromCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let newValue = 0;
    if (vertical) {
      newValue = (rect.bottom - clientY) / rect.height;
    } else {
      newValue = (clientX - rect.left) / rect.width;
    }
    newValue = Math.max(0, Math.min(1, newValue));
    onChange(newValue);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleInteractionStart(e.clientX, e.clientY, null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    const touch = e.changedTouches[0] || e.touches[0];
    if (touch) {
      handleInteractionStart(touch.clientX, touch.clientY, touch.identifier);
    }
  };

  const handleInteractionStart = (clientX: number, clientY: number, touchId: number | null) => {
    const isTouchEvent = touchId !== null;
    updateValueFromCoords(clientX, clientY);

    const handleMove = (e: MouseEvent | TouchEvent) => {
      let currentX = 0;
      let currentY = 0;
      if ('touches' in e) {
        let trackedTouch = null;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === touchId) {
            trackedTouch = e.touches[i];
            break;
          }
        }
        if (trackedTouch) {
          currentX = trackedTouch.clientX;
          currentY = trackedTouch.clientY;
        } else {
          return;
        }
      } else {
        currentX = e.clientX;
        currentY = e.clientY;
      }
      updateValueFromCoords(currentX, currentY);
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (isTouchEvent && 'touches' in e) {
        let isStillTracking = false;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === touchId) {
            isStillTracking = true;
            break;
          }
        }
        let touchEnded = false;
        if ('changedTouches' in e) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchId) {
              touchEnded = true;
              break;
            }
          }
        }
        if (!isStillTracking || touchEnded) {
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('touchend', handleEnd);
          window.removeEventListener('touchcancel', handleEnd);
        }
      } else {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
      }
    };

    if (isTouchEvent) {
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
      window.addEventListener('touchcancel', handleEnd);
    } else {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div 
        ref={containerRef}
        className={`relative cursor-pointer ${vertical ? 'h-full w-10' : 'w-full h-8'}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Track Markings */}
        <div className={`absolute inset-0 pointer-events-none ${vertical ? 'flex flex-col justify-between py-1' : 'flex justify-between px-1'}`}>
          {[...Array(11)].map((_, i) => (
            <div 
              key={i} 
              className={`${vertical ? 'w-full h-[1px]' : 'h-full w-[1px]'} bg-white/5`} 
            />
          ))}
        </div>
        
        {/* Physical Track */}
        <div className={`
          pointer-events-none absolute bg-[#0a0a0f] rounded-sm ring-1 ring-white/5 shadow-inner
          ${vertical ? 'w-1.5 h-full left-1/2 -translate-x-1/2' : 'h-1.5 w-full top-1/2 -translate-y-1/2'}
        `} />
        
        {/* Thumb */}
        <motion.div 
          className={`
            pointer-events-none absolute bg-[#1c1c21] border border-white/10 shadow-2xl rounded-[2px] z-10 flex items-center justify-center
            ${vertical ? 'w-8 h-12 left-1/2 -ml-4' : 'h-8 w-12 top-1/2 -mt-4'}
          `}
          style={{ 
            [vertical ? 'bottom' : 'left']: `${value * 100}%`,
            transform: vertical ? 'translateY(50%)' : 'translateX(-50%)'
          }}
        >
          {/* Fader Handle Line */}
          <div className={`${vertical ? 'w-full h-[2px] bg-white/40' : 'h-full w-[2px] bg-white/40 shadow-[0_0_8px_white]'}`} />
          
          {/* Grip texture */}
          <div className="absolute inset-x-1 inset-y-2 flex flex-col justify-around opacity-20">
             {[...Array(3)].map((_, i) => <div key={i} className="w-full h-[1px] bg-white" />)}
          </div>
        </motion.div>
      </div>
      {label && <span className="text-[7px] uppercase font-black text-white/20 tracking-widest font-mono mt-4 leading-none">{label}</span>}
    </div>
  );
}
