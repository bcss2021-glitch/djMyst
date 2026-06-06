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

interface OpManualReaderProps {
  showDiagnosticsWidget?: boolean;
  onToggleDiagnostics?: (show: boolean) => void;
}

export default function OpManualReader({ showDiagnosticsWidget = true, onToggleDiagnostics }: OpManualReaderProps) {
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
        'Transport HUD: Shows active Waveform, remaining time in minutes/seconds, and active BPM. Tapping the TAP BPM button allows manual tempo calculation.',
        'Jogwheels / Vinyl: Displays rotating platters. Click/tap and drag horizontally to scratch or nudge. Select styling (VINYL grooves, CDJ strobe rings, or NEON spiral wave) to change platter visuals.',
        'Tempo Slope Fader: Multi-percent pitch adjustment. Slide up or down to vary the deck\'s BPM. Double-tap to reset to normal.',
        'Hot Cues Quadrant (1, 2, 3, 4): Store up to 4 instant trigger markings per song. Tap an empty pad to write, tap again to instantly warp to that spot. Press and hold (0.7s) to invoke a clean red wiping overlay to delete a cue, or right-click to clear.',
        'Key Lock (MT): Activates professional Master Tempo pitch stabilization. Keeps vocal tracks in natural keys even at extreme speeds.',
        'Slip Mode (SLIP Button): Keeps a virtual background playhead running silently during scratches or loops. On release, playback snaps seamlessly to this background spot.',
        'Favorite Toggle (Heart Icon): Tapping the heart button next to the loaded track title instantly toggles the song on or off your Favorites list.'
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
        'EQ Isolation Nodes & Kills: Real-time 3-band acoustic isolates (Hi, Mid, Low). Double-click/double-tap to instantly reset nodes back to flat (0dB). Press the "K" (Kill) buttons next to each dial to instantly mute that frequency band completely.',
        'Isolator Filter Sweeps: Center rotary dial sweeps Low-pass filters (LPF, turn left to muffle) and High-pass filters (HPF, turn right to thin).',
        'Line Faders (CH A & CH B): Controls separate volume channels before cross-fader stages.',
        '3-Stage Curve Selector: Adjust the Curve knob to cycle fader response: Linear (0.0-0.3) for smooth blending, Constant Power (0.3-0.7) for standard mixing, and Battle Cut (0.7-1.0) for scratch-cutting.',
        'Touch Cohesion (Tablet Friendly): Complete conflict-free simultaneous touchscreen controls. Slide Channel A and B volumes or speed pitch controls in completely different directions at the same time.'
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
      title: '05 // MUSIC INTAKE SHELF',
      subtitle: 'Manage local audio, cloud database links, and full set backups',
      deckAccent: 'both',
      content: 'Load tracks into your record crate using multiple input pipelines:',
      bullets: [
        'System Samples: Default library containing royalty-free tracks to practice on.',
        'Audius Hits: Search 1 million+ underground tracks instantly over decentralised cloud API feeds.',
        'YouTube & Spotify Ingest: Paste any third-party stream URL to track your references or overlay media.',
        'Local File Drops: Click "LOAD FILE" or drag-and-drop any standard WAV, MP3, or AIFF from your files.',
        'Offline Crate: Upload files directly into the browser\'s persistent IndexedDB cache storage. Stored tracks show size, delete buttons, and direct load to Deck A or Deck B actions.',
        'Session Backup: Save your currently programmed playlist and favorites lists to a JSON backup file on your PC. Import it anytime to restore your full crate state instantly.'
      ]
    },
    {
      id: 'mobile',
      title: '06 // MOBILE APP COMPILATION (APK/IPA)',
      subtitle: 'Compile to native Android Packages or iOS Xcode bundles',
      deckAccent: 'both',
      content: 'The standalone client-side nature makes this console fully compatible with native wrappers:',
      bullets: [
        'Capacitor Wrap: Run `npm i @capacitor/core @capacitor/cli` in your project folder.',
        'Initialization: Run `npx cap init "DJ Studio" "com.dargonheart.djstudio" --web-dir=dist` to configure standard inputs.',
        'Binary Target: Add packages via `npm i @capacitor/android @capacitor/ios`.',
        'Sync Build: Run `npm run build` and then sync with `npx cap add android && npx cap sync`.',
        'Android Studio / Xcode: Execute `npx cap open android` to test fully and output signed release APK.'
      ]
    },
    {
      id: 'troubleshooting',
      title: '07 // TROUBLESHOOTING & SYSTEM LOGS',
      subtitle: 'Diagnose playback, clipping noise, or hardware clock drift issues',
      deckAccent: 'both',
      content: 'If you encounter audio distortion, crackling clicks, speed changes, or drift after a song has looped multiple times, use the interactive diagnostic features:',
      bullets: [
        'Live Audio Tester: Tap the "🐞 LIVE AUDIO TESTER" floating button in the bottom right corner to open the real-time diagnostic panel.',
        'Distortion Flagger: When you hear crackling or pitch distortion, tap the large red "Flag Distortion Event" button. This takes a detailed snapshot of Web Audio clock rates, sampler speed, current position, buffer sizes, and logs it immediately.',
        'Real-time Observations: Type notes under the "Real-Time Note / Audio Observation" field to describe exactly what you hear, and hit Enter/Log Note. This attaches your description directly to the timeline without causing any audio stutter/disruptions.',
        'Durable Portability: The diagnostic engine is backed by a local system file. Every event and heartbeat tick automatically saves in real-time directly to "diagnostics_report.txt" in your app workspace, keeping information preserved safe even between browser refreshes or phone screens.',
        'Log Clears & Splits: To clear previous runs so a new download or report file contains only your latest test run, press "Clear" inside the tester panel. This purges both browser and disk buffers so you can isolate fresh errors.'
      ],
      tips: [
        'Always press "Clear" to flush previous runs when starting a brand new troubleshoot sequence, and press "Copy Log" or download the .txt file of your targeted test once finished!'
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

      {onToggleDiagnostics && (
        <div className="mx-3 my-2 p-2 bg-[#121218] rounded border border-indigo-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${showDiagnosticsWidget ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-650'}`}></span>
            <span className="text-[10px] font-mono tracking-wide text-zinc-400 uppercase">
              Floating Diagnostics Panel: <strong className={showDiagnosticsWidget ? 'text-indigo-450 font-black' : 'text-zinc-500'}>{showDiagnosticsWidget ? 'VISIBLE' : 'MUTED / HIDDEN'}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onToggleDiagnostics(!showDiagnosticsWidget)}
            className={`px-2.5 py-1 text-[8.5px] font-mono font-black uppercase rounded cursor-pointer transition-all duration-150 shrink-0 ${
              showDiagnosticsWidget 
                ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-white/5' 
                : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.12)] animate-pulse'
            }`}
          >
            {showDiagnosticsWidget ? '🙈 TEMPORARY HIDE FLOATING WIDGET' : '👁️ RESTORE FLOATING WIDGET'}
          </button>
        </div>
      )}

      {/* Manual content reader */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pb-24 space-y-3">
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

        {/* Informational Callout / Hardware disclaimer & Credits */}
        <div className="p-3 bg-zinc-950 rounded-lg border border-white/5 space-y-3 mt-4">
          <div className="text-center space-y-1 pb-2 border-b border-white/5">
            <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-1">
              <ShieldCheck size={12} /> CERTIFIED DJ ENGINE
            </div>
            <p className="text-[9.5px] text-zinc-500 leading-relaxed font-mono">
              DJ Studio operating console Rev 2.9 system architecture complies with advanced Web Audio DSP standards. Full-frequency sweeps and loop buffering optimized.
            </p>
          </div>

          <div className="space-y-1 px-1">
            <span className="text-[7.5px] font-black font-mono tracking-widest text-zinc-500 uppercase block">COLLABORATIVE DESIGN & ENGINEERING DIRECTS</span>
            <div className="grid grid-cols-2 gap-3 text-left pt-1">
              <div>
                <span className="text-[8.5px] font-black text-indigo-400 font-mono block leading-none">DARGONHEART</span>
                <span className="text-[7.5px] font-mono text-zinc-500 block hover:text-indigo-300 transition-colors mt-0.5 select-all">visiolucis2025@gmail.com</span>
                <span className="text-[8px] text-zinc-400 font-sans block mt-1">Lead Concept, FX Architecture & Deck UX Director</span>
              </div>
              <div className="border-l border-white/5 pl-3">
                <span className="text-[8.5px] font-black text-emerald-400 font-mono block leading-none">GEMINI</span>
                <span className="text-[7.5px] font-mono text-zinc-500 block mt-0.5">Google AI Studio Build</span>
                <span className="text-[8px] text-zinc-400 font-sans block mt-1">AI Software Engineer, Waveform & Web Audio DSP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
