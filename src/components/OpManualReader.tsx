import { useState } from 'react';
import { BookOpen, Search, Download, ExternalLink, HelpCircle, ArrowRight, ShieldCheck, Cpu, Sliders, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface ManualSection {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  bullets?: string[];
  tips?: string[];
  deckAccent?: 'A' | 'B' | 'both';
}

export default function OpManualReader() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('quickstart');

  const manualSections: ManualSection[] = [
    {
      id: 'quickstart',
      title: '01 // QUICK START INTAKE',
      subtitle: 'Perform your first transition in under 60 seconds',
      deckAccent: 'both',
      content: 'Get up and running instantly by loading and blending tracks:',
      bullets: [
        'Load Track A: In the library under System Samples, load a track into Deck A.',
        'Play Deck A: Push CH A volume fader to 100%, move crossfader fully back to the far left, and hit Play.',
        'Load Track B: Load a different track into Deck B in silent isolation (CH B fader at 0%).',
        'Match Speed: Press the SYNC button on Deck B. It instantly extracts Deck A\'s tempo and aligns beats.',
        'Transition: Hit Play on Deck B. Gently push up CH B volume fader and slowly drag the crossfader right.'
      ],
      tips: [
        'Use Master Tempo (indicated as "MT") to lock vocal pitches perfectly when speed is shifted.'
      ]
    },
    {
      id: 'decks',
      title: '02 // THE CONTROL DECKS (A & B)',
      subtitle: 'Deck anatomy, transport mechanics, and speed alignment',
      deckAccent: 'A',
      content: 'Each side of the console behaves as an independent playback engine:',
      bullets: [
        'Transport HUD: Shows active Waveform, remaining time in minutes/seconds, and active BPM.',
        'Jogwheels / Vinyl: Displays rotating slipmats. Click/tap and drag horizontally to dynamic-scratch or nudge.',
        'Tempo Slope Fader: Multi-percent pitch adjustment. Slide up or down to vary the deck\'s BPM manually.',
        'Cue & Cup Points: Store up to three hot markers in real-time. Hit direct digits (1, 2, 3) to trigger jumping.',
        'Key Lock (MT): Activates professional Master Tempo pitch stabilization. Keeps vocal tracks in natural keys even at extreme speeds.'
      ]
    },
    {
      id: 'mixer',
      title: '03 // CHANNEL MIXER & CROSSFADER',
      subtitle: 'Acoustics frequency separation and audio routing',
      deckAccent: 'both',
      content: 'The center console controls how individual signals blend together into the Master Output:',
      bullets: [
        'Gain Stages: Calibrate input volumes to normalize quiet uploads or hot recording volumes.',
        'EQ Isolation Nodes: Real-time 3-band acoustic isolates. Kill high notes (Hi), warm frequencies (Mid), or bass beats (Low). Double-click/double-tap to instantly reset nodes back to flat (0dB).',
        'Isolator Filter Sweeps: Center rotary dial sweeps Low-pass filters (LPF, turn left to roll off highs) and High-pass filters (HPF, turn right to extract low clutter).',
        'Line Faders (CH A & CH B): Controls separate volume channels before cross-fader stages.',
        'Asymmetrical Crossfader: Smooth physical slider at the very base. Links and morphs the relative volumes of Deck A and Deck B across a single horizontal axis.'
      ],
      tips: [
        'Double-click or double-tap any rotary EQ or volume knob to quickly snap it back to its neutral 0 or default position.'
      ]
    },
    {
      id: 'fx',
      title: '04 // PERFORMANCE FX & XY VECTOR PAD',
      subtitle: 'Cinema delay, flangers, phase shifters, and beat stutter rolls',
      deckAccent: 'B',
      content: 'Expose the specialized FX panel by clicking the double-chevron arrow. Switch between three interactive controllers:',
      bullets: [
        'Knobs Mode: Four separate rotary knobs (ECHO, FLANGER, BITCRUSHER, REVERB) for precise live dial twirling.',
        'Sliders Mode: Converts the same FX processors into direct tactile vertical faders. Designed for high-speed tracking.',
        'XY Vector Pad: Gesture pad that maps Delay (Echo) to the horizontal X-axis and Phasing (Flanger) to the vertical Y-axis. Perform complex compound sweeps with a single motion.',
        'Beat rolls (1/4, 1/8, 1/16): Tap-and-hold stutter block pads. Instantly captures audio slices and repetitions without stopping the background timeline. Releasing the button snaps playback back onto live grid.',
        'Preset Saver: Save your calibrated EQ and FX state straight onto the active track. Reloading the track immediately rebuilds your custom dials!'
      ]
    },
    {
      id: 'crate',
      title: '05 // MUSIC INSTAKE SHELF',
      subtitle: 'Manage local audio, cloud database links, and full set backups',
      deckAccent: 'both',
      content: 'Load tracks into your record crate using multiple input pipelines:',
      bullets: [
        'System Samples: Default library containing royalty-free tracks to practice on.',
        'Audius Hits: Search 1 million+ underground tracks instantly over decentralised cloud API feeds.',
        'YouTube & Spotify Ingest: Paste any third-party stream URL to track your references or overlay media.',
        'Local File Drops: Click "LOAD FILE" or drag-and-drop any standard WAV, MP3, or AIFF from your files.',
        'Session Backup: Save your currently programmed playlist and favorites lists to a JSON backup file on your PC. Import it anytime to restore your full crate state instantly.'
      ]
    }
  ];

  const filteredSections = manualSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.bullets?.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-[#0b0b0e] border border-white/5 rounded-lg overflow-hidden select-none font-sans text-white/90">
      {/* Search and Action Bar */}
      <div className="p-3 bg-zinc-950/60 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="text-indigo-400" size={16} />
          <h3 className="text-xs font-bold font-display uppercase tracking-wider text-indigo-400">CONSOLE OPERATIONS REFERENCE</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <a 
            href="/instruction_manual.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all font-sans"
            title="Open comprehensive manual in full browser window"
          >
            <ExternalLink size={10} /> OPEN FULL MANUAL
          </a>
          <a 
            href="/instruction_manual.html"
            download="dj_studio_operator_manual.html"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all font-sans"
            title="Download full offline HTML Operator's Manual with retro terminal visual dashboard"
          >
            <Download size={10} /> DOWNLOAD HTML
          </a>
        </div>
      </div>

      <div className="p-3 bg-white/[0.01] border-b border-white/5 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search manual sections, controls..." 
            className="w-full bg-black/40 border border-white/5 rounded-md py-1.5 pl-8 pr-4 text-[10.5px] text-white/90 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40 transition-all font-mono"
          />
        </div>
      </div>

      {/* Manual content reader */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {filteredSections.length > 0 ? (
          filteredSections.map((section) => {
            const isExpanded = expandedSection === section.id;
            const accentClass = section.deckAccent === 'A' 
              ? 'border-brand-cyan/25' 
              : section.deckAccent === 'B' 
                ? 'border-brand-purple/25' 
                : 'border-white/5';

            return (
              <div 
                key={section.id} 
                className={`bg-white/[0.01] border rounded-lg transition-all ${
                  isExpanded ? `${accentClass} bg-white/[0.02]` : 'border-white/5 hover:bg-white/[0.01]'
                }`}
              >
                {/* Header Toggle */}
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full p-3 font-mono text-left flex items-start justify-between cursor-pointer gap-2"
                >
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-zinc-300 block tracking-wide uppercase">
                      {section.title}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-sans block leading-none">
                      {section.subtitle}
                    </span>
                  </div>
                  <div className="pt-1 text-zinc-500">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-3 pb-4 pt-1 text-xs border-t border-white/5 font-sans space-y-3 animate-fade-in">
                    <p className="text-zinc-300 leading-relaxed text-[11px]">
                      {section.content}
                    </p>

                    {section.bullets && (
                      <ul className="space-y-1.5 text-zinc-300 pl-4 list-disc text-[11px]">
                        {section.bullets.map((bullet, bIdx) => {
                          const parts = bullet.split(':');
                          if (parts.length > 1) {
                            return (
                              <li key={bIdx} className="leading-relaxed">
                                <strong className="text-white font-semibold">{parts[0]}:</strong>{parts.slice(1).join(':')}
                              </li>
                            );
                          }
                          return (
                            <li key={bIdx} className="leading-relaxed">
                              {bullet}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {section.tips && (
                      <div className="p-2.5 rounded bg-zinc-950 border border-yellow-500/10 space-y-1">
                        <div className="flex items-center gap-1.5 text-[9px] text-yellow-500 font-bold uppercase tracking-wider">
                          <Zap size={10} /> PRO OPERATOR TIP
                        </div>
                        {section.tips.map((tip, tIdx) => (
                          <p key={tIdx} className="text-[10px] text-zinc-400 italic font-mono leading-relaxed pl-1">
                            "{tip}"
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-white/20 italic font-mono text-[10px]">
            No manual sections match your search query.
          </div>
        )}

        {/* Informational Callout / Hardware disclaimer */}
        <div className="p-3 bg-zinc-950 rounded-lg border border-white/5 space-y-2 mt-4 text-center">
          <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-1">
            <ShieldCheck size={12} /> CERTIFIED DJ ENGINE
          </div>
          <p className="text-[9.5px] text-zinc-500 leading-relaxed font-mono">
            DJ Studio operating console Rev 2.9 system architecture complies with advanced Web Audio DSP standards. Full-frequency sweeps and loop buffering optimized.
          </p>
        </div>
      </div>
    </div>
  );
}
