/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';

interface KnobProps {
  label: string;
  min?: number;
  max?: number;
  value: number;
  onChange: (val: number) => void;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  defaultValue?: number;
}

export default function Knob({ label, min = -20, max = 20, value, onChange, color = '#00f5ff', size = 'md', defaultValue }: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const rotation = useMotionValue(0);
  
  const sizeClasses = {
    xs: { track: 'w-7 h-7', knob: 'w-5 h-5', dot: 'w-0.5 h-0.5', label: 'text-[6px]' },
    sm: { track: 'w-9 h-9', knob: 'w-7 h-7', dot: 'w-1 h-1', label: 'text-[7px]' },
    md: { track: 'w-10 h-10', knob: 'w-8 h-8', dot: 'w-1 h-1', label: 'text-[8px]' },
    lg: { track: 'w-12 h-12', knob: 'w-10 h-10', dot: 'w-1.5 h-1.5', label: 'text-[9px]' },
  }[size];

  useEffect(() => {
    // Map initial value to rotation: -135deg to 135deg
    const initialRotation = ((value - min) / (max - min)) * 270 - 135;
    rotation.set(initialRotation);
  }, [value, min, max, rotation]);

  const resetToDefault = () => {
    const cleanDefault = defaultValue !== undefined ? defaultValue : (min >= 0 ? min : 0);
    onChange(cleanDefault);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    resetToDefault();
  };

  // Double tap detection for touch screens
  let lastTap = 0;
  const handleTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      resetToDefault();
      return;
    }
    lastTap = now;

    const touch = e.changedTouches[0] || e.touches[0];
    if (!touch) return;
    const touchId = touch.identifier;

    setIsDragging(true);
    const startY = touch.clientY;
    const startVal = value;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }
      let trackedTouch = null;
      for (let i = 0; i < moveEvent.touches.length; i++) {
        if (moveEvent.touches[i].identifier === touchId) {
          trackedTouch = moveEvent.touches[i];
          break;
        }
      }
      if (!trackedTouch) return;

      const deltaY = startY - trackedTouch.clientY;
      const range = max - min;
      const sensitivity = 1.0;
      let newVal = startVal + (deltaY / 110) * range * sensitivity;
      newVal = Math.max(min, Math.min(max, newVal));
      onChange(newVal);
    };

    const handleTouchEnd = (endEvent: TouchEvent) => {
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
        setIsDragging(false);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchEnd);
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startY = e.clientY;
    const startVal = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const range = max - min;
      const sensitivity = 1.0;
      let newVal = startVal + (deltaY / 110) * range * sensitivity;
      newVal = Math.max(min, Math.min(max, newVal));
      onChange(newVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const currentRotation = useTransform(rotation, (r) => `${r}deg`);

  return (
    <div className={`flex flex-col items-center select-none ${size === 'xs' || size === 'sm' ? 'gap-0.5' : 'gap-1'}`}>
      <div 
        className={`${sizeClasses.track} relative rounded-full bg-black/40 border border-white/5 shadow-inner flex items-center justify-center cursor-ns-resize touch-none`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        title="Drag up/down to adjust. Double-click/tap to reset default."
      >
        {/* Scale marks */}
        <div className="absolute inset-0 pointer-events-none opacity-10">
          {[...Array(9)].map((_, i) => (
            <div 
              key={i} 
              className="absolute top-1/2 left-1/2 w-full h-[1px] bg-white/20"
              style={{ transform: `translate(-50%, -50%) rotate(${i * 30 - 120}deg)` }}
            />
          ))}
        </div>

        <motion.div 
          className={`${sizeClasses.knob} rounded-full bg-[#18181b] border-t border-white/10 shadow-lg relative flex items-center justify-center`}
          style={{ rotate: currentRotation }}
        >
          {/* Indicator Dot */}
          <div 
            className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-2 rounded-full" 
            style={{ 
              backgroundColor: color,
              boxShadow: isDragging ? `0 0 8px ${color}` : `0 0 2px ${color}`
            }} 
          />
          <div className="w-2 h-2 rounded-full bg-black/40" />
        </motion.div>
      </div>
      <span className={`${sizeClasses.label} uppercase font-black text-white/20 tracking-widest font-mono text-center leading-none mt-1`}>
        {label}
      </span>
    </div>
  );
}
