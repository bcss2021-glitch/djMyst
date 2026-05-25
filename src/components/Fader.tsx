import { motion } from 'motion/react';

interface FaderProps {
  value: number;
  onChange: (val: number) => void;
  vertical?: boolean;
  label?: string;
  className?: string;
}

export default function Fader({ value, onChange, vertical = true, label, className = "" }: FaderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div className={`relative ${vertical ? 'h-full w-10' : 'w-full h-8'}`}>
        {/* Track Markings */}
        <div className={`absolute inset-0 pointer-events-none ${vertical ? 'flex flex-col justify-between py-1' : 'flex justify-between px-1'}`}>
          {[...Array(11)].map((_, i) => (
            <div 
              key={i} 
              className={`${vertical ? 'w-full h-[1px]' : 'h-full w-[1px]'} bg-white/5`} 
            />
          ))}
        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={value}
          onChange={handleChange}
          className={`
            absolute appearance-none bg-transparent cursor-pointer z-20
            ${vertical ? '-rotate-90 origin-center w-32 h-10 -translate-y-1/2 top-1/2 left-1/2 -translate-x-1/2' : 'w-full h-full'}
          `}
        />
        
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
            [vertical ? 'translateY' : 'translateX']: '50%'
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
