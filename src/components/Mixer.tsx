import { useState } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import Knob from './Knob';
import Fader from './Fader';

interface MixerProps {
  eqA: { low: number; mid: number; high: number };
  eqB: { low: number; mid: number; high: number };
  onEqChange: (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', val: number) => void;
  eqKillA: { low: boolean; mid: boolean; high: boolean };
  eqKillB: { low: boolean; mid: boolean; high: boolean };
  onEqKillToggle: (deck: 'A' | 'B', band: 'low' | 'mid' | 'high') => void;
  filterA: number;
  filterB: number;
  onFilterChange: (deck: 'A' | 'B', val: number) => void;
  crossfade: number;
  onCrossfadeChange: (val: number) => void;
  xfaderCurve: number;
  onXfaderCurveChange: (val: number) => void;
  volumeA: number;
  volumeB: number;
  onVolumeChange: (deck: 'A' | 'B', val: number) => void;
  onOptimizeAudio?: () => void;
  onResetMixer?: () => void;
}

export default function Mixer({ 
  eqA, eqB, onEqChange, 
  eqKillA, eqKillB, onEqKillToggle,
  crossfade, onCrossfadeChange,
  volumeA, volumeB, onVolumeChange,
  filterA, filterB, onFilterChange,
  xfaderCurve, onXfaderCurveChange,
  onOptimizeAudio, onResetMixer
 }: MixerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleOptimizeClick = () => {
    setIsOptimizing(true);
    if (onOptimizeAudio) onOptimizeAudio();
    setTimeout(() => {
      setIsOptimizing(false);
    }, 1200);
  };

  const handleResetClick = () => {
    setIsResetting(true);
    if (onResetMixer) onResetMixer();
    setTimeout(() => {
      setIsResetting(false);
    }, 600);
  };

  return (
    <div className="bg-[#111116] border-x border-white/5 flex flex-col items-center py-4 px-2 h-full overflow-y-auto no-scrollbar relative hardware-surface">
      <div className="scanline" />
      
      <div className="flex flex-col items-center mb-4">
        <div className="text-[10px] font-black tracking-[0.3em] text-white/20 uppercase mb-1">Central Console</div>
        <div className="h-[1px] w-12 bg-white/10 mb-3" />
      </div>

      {/* Tactile Diagnostic and Correction Utilities */}
      <div className="flex gap-2 mb-6 w-full max-w-[200px] px-1">
        <button
          onClick={handleOptimizeClick}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1.5 rounded text-[8px] font-black tracking-wider uppercase transition-all duration-300 border ${
            isOptimizing 
            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 cursor-default shadow-[0_0_8px_rgba(16,185,129,0.3)]'
            : 'bg-white/5 border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 text-white/60 active:scale-95 cursor-pointer'
          }`}
          title="Clean and optimize Web Audio engine buffers to stop scratchy sound or latency issues"
        >
          <Sparkles className={`w-3 h-3 ${isOptimizing ? 'animate-spin text-emerald-400' : 'text-emerald-500/60'}`} />
          {isOptimizing ? 'OPTIMIZING' : 'CLEAN SOUND'}
        </button>
        
        <button
          onClick={handleResetClick}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1.5 rounded text-[8px] font-black tracking-wider uppercase transition-all duration-300 border ${
            isResetting 
            ? 'bg-blue-500/20 border-blue-500 text-blue-400 cursor-default shadow-[0_0_8px_rgba(59,130,246,0.3)]'
            : 'bg-white/5 border-white/10 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 text-white/60 active:scale-95 cursor-pointer'
          }`}
          title="Reset EQ bands, faders, filters, and crossfader to default centers"
        >
          <RotateCcw className={`w-3 h-3 ${isResetting ? 'animate-spin text-blue-400' : 'text-blue-500/60'}`} />
          {isResetting ? 'RESETTING' : 'RESET CONSOLE'}
        </button>
      </div>
      
      {/* Gain & EQs */}
      <div className="grid grid-cols-2 gap-8 mb-8 relative">
        {/* Channel A EQ */}
        <div className="flex flex-col gap-4 items-center">
          <div className="flex items-center gap-1.5 relative">
            <button
              onClick={() => onEqKillToggle('A', 'high')}
              className={`w-4 h-4 rounded-full border text-[7px] font-black flex items-center justify-center cursor-pointer transition-all select-none ${
                eqKillA.high 
                  ? 'bg-red-500 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] font-extrabold'
                  : 'bg-black/40 border-white/10 text-white/20 hover:text-white/45 hover:border-white/20'
              }`}
              title="Kill Deck A High frequencies"
            >
              K
            </button>
            <Knob label="HI" value={eqA.high} onChange={(v) => onEqChange('A', 'high', v)} color="var(--color-brand-cyan)" size="sm" />
          </div>
          
          <div className="flex items-center gap-1.5 relative">
            <button
              onClick={() => onEqKillToggle('A', 'mid')}
              className={`w-4 h-4 rounded-full border text-[7px] font-black flex items-center justify-center cursor-pointer transition-all select-none ${
                eqKillA.mid 
                  ? 'bg-red-500 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] font-extrabold'
                  : 'bg-black/40 border-white/10 text-white/20 hover:text-white/45 hover:border-white/20'
              }`}
              title="Kill Deck A Mid frequencies"
            >
              K
            </button>
            <Knob label="MID" value={eqA.mid} onChange={(v) => onEqChange('A', 'mid', v)} color="var(--color-brand-cyan)" size="sm" />
          </div>

          <div className="flex items-center gap-1.5 relative">
            <button
              onClick={() => onEqKillToggle('A', 'low')}
              className={`w-4 h-4 rounded-full border text-[7px] font-black flex items-center justify-center cursor-pointer transition-all select-none ${
                eqKillA.low 
                  ? 'bg-red-500 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] font-extrabold'
                  : 'bg-black/40 border-white/10 text-white/20 hover:text-white/45 hover:border-white/20'
              }`}
              title="Kill Deck A Low frequencies"
            >
              K
            </button>
            <Knob label="LOW" value={eqA.low} onChange={(v) => onEqChange('A', 'low', v)} color="var(--color-brand-cyan)" size="sm" />
          </div>

          <div className="h-2" />
          <Knob label="FILTER" value={filterA} onChange={(v) => onFilterChange('A', v)} color="white" min={-50} max={50} size="md" />
        </div>

        {/* Channel B EQ */}
        <div className="flex flex-col gap-4 items-center">
          <div className="flex items-center gap-1.5 relative">
            <Knob label="HI" value={eqB.high} onChange={(v) => onEqChange('B', 'high', v)} color="var(--color-brand-purple)" size="sm" />
            <button
              onClick={() => onEqKillToggle('B', 'high')}
              className={`w-4 h-4 rounded-full border text-[7px] font-black flex items-center justify-center cursor-pointer transition-all select-none ${
                eqKillB.high 
                  ? 'bg-red-500 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] font-extrabold'
                  : 'bg-black/40 border-white/10 text-white/20 hover:text-white/45 hover:border-white/20'
              }`}
              title="Kill Deck B High frequencies"
            >
              K
            </button>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <Knob label="MID" value={eqB.mid} onChange={(v) => onEqChange('B', 'mid', v)} color="var(--color-brand-purple)" size="sm" />
            <button
              onClick={() => onEqKillToggle('B', 'mid')}
              className={`w-4 h-4 rounded-full border text-[7px] font-black flex items-center justify-center cursor-pointer transition-all select-none ${
                eqKillB.mid 
                  ? 'bg-red-500 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] font-extrabold'
                  : 'bg-black/40 border-white/10 text-white/20 hover:text-white/45 hover:border-white/20'
              }`}
              title="Kill Deck B Mid frequencies"
            >
              K
            </button>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <Knob label="LOW" value={eqB.low} onChange={(v) => onEqChange('B', 'low', v)} color="var(--color-brand-purple)" size="sm" />
            <button
              onClick={() => onEqKillToggle('B', 'low')}
              className={`w-4 h-4 rounded-full border text-[7px] font-black flex items-center justify-center cursor-pointer transition-all select-none ${
                eqKillB.low 
                  ? 'bg-red-500 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] font-extrabold'
                  : 'bg-black/40 border-white/10 text-white/20 hover:text-white/45 hover:border-white/20'
              }`}
              title="Kill Deck B Low frequencies"
            >
              K
            </button>
          </div>

          <div className="h-2" />
          <Knob label="FILTER" value={filterB} onChange={(v) => onFilterChange('B', v)} color="white" min={-50} max={50} size="md" />
        </div>

        {/* Divider */}
        <div className="absolute left-1/2 top-0 bottom-4 w-[1px] bg-white/5 -translate-x-1/2" />
      </div>

      {/* Main Channel Faders */}
      <div className="flex-1 flex gap-12 items-end pb-8 h-48 relative">
          <Fader value={volumeA} onChange={(v) => onVolumeChange('A', v)} label="CH A" className="h-full" />
          
          <div className="flex flex-col items-center gap-4 h-full justify-center">
              <div className="flex flex-col gap-2">
                {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i < 2 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : i < 4 ? 'bg-yellow-400' : 'bg-green-500 opacity-40'} ${i === 0 ? 'animate-pulse' : ''}`} 
                    />
                ))}
              </div>
              <Knob label="CURVE" value={xfaderCurve} onChange={onXfaderCurveChange} min={0} max={1} color="#fff" size="xs" />
          </div>

          <Fader value={volumeB} onChange={(v) => onVolumeChange('B', v)} label="CH B" className="h-full" />
      </div>

      {/* Crossfader Section */}
      <div className="w-full px-4 mt-auto mb-4 flex flex-col items-center">
        <div className="flex justify-between w-full px-2 mb-1 text-[8px] font-black text-white/10 uppercase">
            <span>Left</span>
            <span>A + B Blend</span>
            <span>Right</span>
        </div>
        <div className="w-full h-10 bg-black/60 rounded-sm relative p-1 border border-white/5 flex items-center shadow-inner">
          <Fader value={crossfade} onChange={onCrossfadeChange} vertical={false} label="" className="w-full h-full" />
        </div>
        <div className="text-[7px] font-black text-white/20 tracking-[0.2em] uppercase mt-2">Professional Crossfader Logic</div>
      </div>
    </div>
  );
}
