import { motion } from 'motion/react';
import { Play, Pause, FastForward, Rewind, ChevronRight, ChevronLeft, Zap, Layers, Music4, Save, ExternalLink, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
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
}

function JogWheel({ isPlaying, isLoading, id, playbackRate, rotation, onClick, onPitchBend, onPadTrigger }: JogWheelProps & { onClick?: () => void }) {
  const [bend, setBend] = useState(1);
  const [isScratching, setIsScratching] = useState(false);

  const handlePan = (_: any, info: any) => {
    // Map vertical movement to pitch bend +/- 8%
    // 100px = 8% change
    const deltaY = info.offset.y;
    const newBend = 1 - (deltaY / 1250); 
    const clampedBend = Math.max(0.92, Math.min(1.08, newBend));
    setBend(clampedBend);
    onPitchBend?.(clampedBend);

    // Scratch sound logic: trigger based on movement intensity
    const velocity = Math.abs(info.velocity.y || 0) + Math.abs(info.velocity.x || 0);
    if (velocity > 400 && !isScratching) {
      audioEngine.scratchWheel(velocity);
      setIsScratching(true);
      setTimeout(() => setIsScratching(false), 120);
    }
  };

  const handlePanEnd = () => {
    setBend(1);
    onPitchBend?.(1);
    setIsScratching(false);
  };

  return (
    <div 
      className="relative w-44 h-44 rounded-full bg-[#111] border-6 border-[#222] shadow-[0_0_20px_rgba(0,0,0,0.8),inset_0_0_15px_rgba(59,130,246,0.05)] flex items-center justify-center overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30" />
      
      <motion.div 
        className="w-full h-full rounded-full flex items-center justify-center"
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        animate={{ rotate: isPlaying ? 360 : rotation }}
        transition={isPlaying ? { duration: 2, repeat: Infinity, ease: "linear" } : { type: "spring", damping: 15 }}
      >
        {/* Visual feedback for bend */}
        {bend !== 1 && (
          <div className={`absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none`}>
              <div className={`w-full h-full rounded-full border-4 ${bend > 1 ? 'border-green-500 scale-105' : 'border-red-500 scale-95'} transition-transform duration-75`} />
          </div>
        )}

        {/* Position marker */}
        <div className="absolute top-0 w-1.5 h-6 bg-brand-cyan shadow-[0_0_10px_#3b82f6] rounded-b-full" />
        
        {/* Center Display */}
        <div 
          onClick={onClick}
          className="w-24 h-24 rounded-full bg-surface-panel border border-white/5 flex flex-col items-center justify-center shadow-2xl relative z-10"
        >
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full z-20">
               <div className={`w-8 h-8 border-2 border-t-transparent animate-spin rounded-full ${id === 'A' ? 'border-blue-500' : 'border-purple-500'}`} />
            </div>
          ) : null}
          {isScratching && (
            <div className="absolute inset-0 flex items-center justify-center bg-brand-cyan/10 rounded-full z-20 animate-pulse">
               <span className="text-[10px] font-black text-brand-cyan drop-shadow-[0_0_5px_#3b82f6]">SCRATCH</span>
            </div>
          )}
          <div className={`text-brand-cyan text-xl font-mono font-bold leading-none ${bend !== 1 ? 'text-white' : ''}`}>
            {(128 * playbackRate * bend).toFixed(1)}
          </div>
          <div className="text-[7px] opacity-40 uppercase tracking-widest mt-1">
            {bend === 1 ? 'BPM' : (bend > 1 ? 'BEND +' : 'BEND -')} / {((playbackRate * bend - 1) * 100).toFixed(1)}%
          </div>
        </div>
      </motion.div>
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
}

export default function Deck({ 
  id, trackUrl, isPlaying, isLoading, onPlayPause, onSync, 
  playbackRate, onRateChange, onPitchBend, fx, onFxChange, 
  onPadTrigger, onRoll, activeRoll, onSaveConfig, sourceType = 'AUDIO', externalUrl,
  keyLock, onKeyLockToggle, gain = 1, onGainChange, hotCues = [], onHotCue, onClearCues,
  loop, onLoopIn, onLoopOut, onExitLoop, resolvedVolume = 1
}: DeckProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
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
          <div className="lcd-display text-[9px] mb-4 max-w-[200px] truncate">{externalUrl}</div>

          <div className="w-full aspect-video bg-black rounded overflow-hidden border border-white/5 relative mb-6">
            <Player 
              url={externalUrl} 
              playing={isPlaying}
              volume={resolvedVolume}
              muted={resolvedVolume === 0}
              controls={true}
              width="100%"
              height="100%"
              style={{ position: 'absolute', top: 0, left: 0 }}
              config={{
                youtube: { origin: window.location.origin }
              }}
            />
            <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
          </div>

          <div className="flex items-center gap-4">
             <button 
               onClick={onPlayPause}
               className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]'}`}
             >
                {isPlaying ? <Pause size={20} fill="white" className="text-white" /> : <Play size={20} fill="white" className="text-white translate-x-0.5" />}
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
                <div className="text-[7px] font-black uppercase tracking-widest text-white/20">Beat Roll / Repeat</div>
                <div className="grid grid-cols-3 gap-2">
                    {(['1/4', '1/8', '1/16'] as const).map((div) => (
                        <button 
                            key={div}
                            onMouseDown={() => onRoll?.(div)}
                            onMouseUp={() => onRoll?.(null)}
                            onMouseLeave={() => onRoll?.(null)}
                            className={`h-8 rounded-sm border text-[8px] font-black transition-all tactile-button ${activeRoll === div ? glowClass : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'}`}
                        >
                            {div}
                        </button>
                    ))}
                </div>
             </div>

             {/* FX Knobs */}
             <div className="grid grid-cols-2 gap-4 flex-1 items-center">
                <Knob 
                    label="ECHO"
                    min={0}
                    max={0.8}
                    value={fx?.echo || 0} 
                    onChange={(v) => onFxChange?.('echo', v)} 
                    size="md"
                    color={accentColor}
                />
                <Knob 
                    label="FLAN"
                    min={0}
                    max={0.8}
                    value={fx?.flanger || 0} 
                    onChange={(v) => onFxChange?.('flanger', v)} 
                    size="md"
                    color={accentColor}
                />
                <Knob 
                    label="BIT"
                    min={0}
                    max={1}
                    value={fx?.crush || 0} 
                    onChange={(v) => onFxChange?.('crush', v)} 
                    size="md"
                    color={accentColor}
                />
                <Knob 
                    label="VERB"
                    min={0}
                    max={1}
                    value={fx?.reverb || 0} 
                    onChange={(v) => onFxChange?.('reverb', v)} 
                    size="md"
                    color={accentColor}
                />
             </div>
             
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
              <button onClick={onSync} className={`flex-1 px-3 bg-white/5 border border-white/10 rounded-sm text-[8px] font-black tracking-widest text-white/40 hover:text-brand-cyan transition-all tactile-button hover:border-brand-cyan/30 uppercase`}>SYNC</button>
            </div>
            
            <div className="flex gap-2">
                <button className={`cue-button w-12 h-12 text-[10px] tactile-button ${id === 'A' ? 'bg-blue-600 border-blue-400' : 'bg-purple-600 border-purple-400'}`}>CUE</button>
                <button onClick={onPlayPause} className="play-button w-12 h-12 tactile-button">
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="translate-x-0.5" fill="currentColor" />}
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
