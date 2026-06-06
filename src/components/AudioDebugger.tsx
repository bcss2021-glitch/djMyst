import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Tone from 'tone';
import { Play, Pause, AlertTriangle, Copy, Download, Trash2, Clock, Activity, Cpu, ShieldAlert, X, ChevronRight, Check } from 'lucide-react';
import { audioEngine } from '../lib/audioEngine';

interface AudioDebuggerProps {
  playbackRates: { A: number; B: number };
  playingState: { A: boolean; B: boolean };
  fxState: {
    A: { crush: number; reverb: number; echo: number; flanger: number };
    B: { crush: number; reverb: number; echo: number; flanger: number };
  };
  eqState: {
    A: { low: number; mid: number; high: number };
    B: { low: number; mid: number; high: number };
  };
  trackInfo: {
    A: { title: string; url: string | null; id?: string };
    B: { title: string; url: string | null; id?: string };
  };
  filterState: { A: number; B: number };
}

export default function AudioDebugger({
  playbackRates,
  playingState,
  fxState,
  eqState,
  trackInfo,
  filterState,
}: AudioDebuggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stutterDetected, setStutterDetected] = useState(false);
  const [cpuWarning, setCpuWarning] = useState(false);
  const [fileSaveStatus, setFileSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Raw logs buffered in a ref to avoid React performance choke while playing
  const allLogsRef = useRef<string[]>([]);
  // Store any unsaved logs to flush to the server
  const unsavedLogsRef = useRef<string[]>([]);
  
  // Visual logs state only shows the last 30 items for visual performance
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [logCount, setLogCount] = useState(0);

  // Stream performance profiling variables
  const lastWallTimeRef = useRef<number>(0);
  const lastAudioTimeRef = useRef<number>(0);
  const driftCheckIntervalRef = useRef<any>(null);
  const stutterCountRef = useRef<number>(0);

  // Helper: Flush the unsaved logs buffer to the backend Express server-side file
  const flushLogsToServer = async () => {
    if (unsavedLogsRef.current.length === 0) return;
    
    // Copy reference and clear local buffer immediately to avoid race conditions
    const itemsPending = [...unsavedLogsRef.current];
    unsavedLogsRef.current = [];
    
    setFileSaveStatus('saving');
    try {
      const response = await fetch('/api/diagnostics/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: itemsPending.join('\n') })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      setFileSaveStatus('saved');
      // Revert status to idle after a small delay
      setTimeout(() => setFileSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('[Diagnostics Sync Error] Failed to write to disk:', e);
      setFileSaveStatus('error');
      // Restore the items back to the buffer to ensure they are not lost
      unsavedLogsRef.current = [...itemsPending, ...unsavedLogsRef.current];
    }
  };

  // Check and read any existing log entries from previous runs on mount
  useEffect(() => {
    const fetchExistingLogs = async () => {
      try {
        const response = await fetch('/api/diagnostics/read');
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success && resJson.content) {
            const rawLines = resJson.content.split('\n').filter((l: string) => l.trim().length > 0);
            if (rawLines.length > 0) {
              allLogsRef.current = [...rawLines];
              // Load the last 30 entries into visible logs
              const tailCount = Math.min(30, rawLines.length);
              setVisibleLogs(rawLines.slice(rawLines.length - tailCount));
              setLogCount(rawLines.length);
              
              // Log a system note that historical log has been restored
              const restoredFlag = `[${new Date().toLocaleTimeString()}] [INFO] === RESTORED HISTORICAL LOGS FROM PORTABLE FILE ON DISK (${rawLines.length} traces found) ===`;
              allLogsRef.current.push(restoredFlag);
              setVisibleLogs(prev => [...prev, restoredFlag]);
              setLogCount(allLogsRef.current.length);
            }
          }
        }
      } catch (err) {
        console.error('[Diagnostics Loading error]', err);
      }
    };
    fetchExistingLogs();
  }, []);

  // Flush any remaining buffered logs to the server every 3 seconds if active
  useEffect(() => {
    let flushInterval: any = null;
    if (isLogging) {
      flushInterval = setInterval(() => {
        flushLogsToServer();
      }, 3000);
    }
    return () => {
      if (flushInterval) clearInterval(flushInterval);
      // Flush any lingering entries when logging stops
      flushLogsToServer();
    };
  }, [isLogging]);

  // Helper: Append a new log line with precise timestamp
  const logMessage = (type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'EVENT', message: string, extraJson?: any) => {
    const d = new Date();
    const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
    const extraStr = extraJson ? ` | CONFIG: ${JSON.stringify(extraJson)}` : '';
    const logLine = `[${timeStr}] [${type}] ${message}${extraStr}`;
    
    allLogsRef.current.push(logLine);
    unsavedLogsRef.current.push(logLine);
    
    // Update visual log stream
    setVisibleLogs(prev => {
      const next = [...prev, logLine];
      if (next.length > 50) {
        next.shift();
      }
      return next;
    });
    setLogCount(allLogsRef.current.length);

    // If critical alert or event, flush immediately to guarantee preservation
    if (type === 'EVENT' || type === 'ERROR' || unsavedLogsRef.current.length >= 8) {
      flushLogsToServer();
    }
  };

  // Helper: Generate a full snapshot of the audio system state
  const getSystemSnapshot = () => {
    const rawCtx = Tone.context;
    
    // Attempt to access some lower-level sound card statistics
    const nativeCtx = (rawCtx as any).rawContext || {};
    const baseLatency = nativeCtx.baseLatency || 'N/A';
    const outputLatency = nativeCtx.outputLatency || 'N/A';
    
    return {
      timestamp: Date.now(),
      utcTime: new Date().toISOString(),
      audioContext: {
        state: rawCtx.state,
        currentTime: rawCtx.currentTime.toFixed(3),
        sampleRate: rawCtx.sampleRate,
        baseLatency,
        outputLatency,
      },
      playback: {
        deckA: {
          playing: playingState.A,
          rate: playbackRates.A,
          position: audioEngine.getPosition('A').toFixed(2),
          url: trackInfo.A.url ? 'LOADED_PLAYLIST_OR_STREAM' : 'NONE',
          title: trackInfo.A.title || 'NONE',
          eq: eqState.A,
          fx: fxState.A,
          filter: filterState.A,
        },
        deckB: {
          playing: playingState.B,
          rate: playbackRates.B,
          position: audioEngine.getPosition('B').toFixed(2),
          url: trackInfo.B.url ? 'LOADED_PLAYLIST_OR_STREAM' : 'NONE',
          title: trackInfo.B.title || 'NONE',
          eq: eqState.B,
          fx: fxState.B,
          filter: filterState.B,
        }
      },
      browser: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: (navigator as any).deviceMemory || 'unknown',
      }
    };
  };

  // Start Logging Action
  const startLogging = () => {
    setIsLogging(true);
    allLogsRef.current = [];
    setVisibleLogs([]);
    setLogCount(0);
    setStutterDetected(false);
    stutterCountRef.current = 0;

    logMessage('INFO', '=== AUDIO ENGINE REAL-TIME DIAGNOSTIC RECORDING STARTED ===');
    logMessage('INFO', `Browser hardware details: ${navigator.userAgent}`);
    logMessage('INFO', `Web Audio status: ${Tone.context.state} | SampleRate: ${Tone.context.sampleRate}Hz | CPU Cores: ${navigator.hardwareConcurrency || 'N/A'}`);
    
    const initialSnap = getSystemSnapshot();
    logMessage('INFO', 'Initial Deck Snapshot captured successfully', initialSnap);

    lastWallTimeRef.current = performance.now();
    lastAudioTimeRef.current = Tone.context.currentTime;
  };

  // Stop Logging Action
  const stopLogging = () => {
    setIsLogging(false);
    logMessage('INFO', '=== AUDIO ENGINE REAL-TIME DIAGNOSTIC RECORDING STOPPED ===');
    const finalSnap = getSystemSnapshot();
    logMessage('INFO', 'Final Deck Snapshot captured', finalSnap);
  };

  // User manual flag moment
  const flagDistortionMoment = () => {
    if (!isLogging) {
      // Auto-start logging if not running
      startLogging();
    }
    const snap = getSystemSnapshot();
    const currentNoteValue = noteInputRef.current?.value || '';
    const noteSuffix = currentNoteValue.trim() ? ` | Obs: "${currentNoteValue.trim()}"` : '';
    logMessage('EVENT', `🚨 *** USER FLAGGED DISTORTION MOMENT ***${noteSuffix}`, snap);
    if (noteInputRef.current) {
      noteInputRef.current.value = '';
    }
  };

  // Submit standard type notes to the debugger console list
  const submitNoteToLog = () => {
    const currentNoteValue = noteInputRef.current?.value || '';
    if (!currentNoteValue.trim()) return;
    if (!isLogging) {
      startLogging();
    }
    const snap = getSystemSnapshot();
    logMessage('EVENT', `📝 USER NOTE: "${currentNoteValue.trim()}"`, snap);
    if (noteInputRef.current) {
      noteInputRef.current.value = '';
    }
  };

  // Clear logs action
  const clearLogs = async () => {
    allLogsRef.current = [];
    unsavedLogsRef.current = [];
    setVisibleLogs([]);
    setLogCount(0);
    setStutterDetected(false);
    setCpuWarning(false);
    stutterCountRef.current = 0;
    
    // Purge server file
    try {
      setFileSaveStatus('saving');
      const response = await fetch('/api/diagnostics/clear', { method: 'POST' });
      if (response.ok) {
        setFileSaveStatus('saved');
        setTimeout(() => setFileSaveStatus('idle'), 1500);
      }
    } catch (e) {
      console.error('[Diagnostics Clear Error] Failed to purge server log file:', e);
      setFileSaveStatus('error');
    }
  };

  // Copy to clipboard
  const copyLogs = () => {
    if (allLogsRef.current.length === 0) return;
    
    const formattedLogs = allLogsRef.current.join('\n');
    navigator.clipboard.writeText(formattedLogs).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Download log file
  const downloadLogs = () => {
    if (allLogsRef.current.length === 0) return;
    const formattedLogs = allLogsRef.current.join('\n');
    const blob = new Blob([formattedLogs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audio-diagnostics-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Real-time jitter and system tick tracker
  useEffect(() => {
    if (!isLogging) {
      if (driftCheckIntervalRef.current) {
        clearInterval(driftCheckIntervalRef.current);
        driftCheckIntervalRef.current = null;
      }
      return;
    }

    lastWallTimeRef.current = performance.now();
    lastAudioTimeRef.current = Tone.context.currentTime;

    driftCheckIntervalRef.current = setInterval(() => {
      const currentWall = performance.now();
      const currentAudio = Tone.context.currentTime;

      const deltaWall = (currentWall - lastWallTimeRef.current) / 1000; // seconds
      const deltaAudio = currentAudio - lastAudioTimeRef.current; // seconds

      lastWallTimeRef.current = currentWall;
      lastAudioTimeRef.current = currentAudio;

      // Ensure no divisions by zero or negative frames
      if (deltaWall > 0.05) {
        const jitterRatio = deltaAudio / deltaWall;
        
        // Jitter should ideally be ~1.0 in a perfectly scheduled system.
        // If the main thread hangs or garbage collection halts execution, the ratio drops or spikes wildly.
        if (jitterRatio < 0.85) {
          stutterCountRef.current += 1;
          setStutterDetected(true);
          
          logMessage(
            'WARN', 
            `⚠️ Web Audio Chronometer Lag Detected! Thread choked by ${(deltaWall * 1000).toFixed(0)}ms. Jitter: ${jitterRatio.toFixed(2)}`,
            {
              elapsedAudioDelta: deltaAudio.toFixed(4),
              elapsedWallDelta: deltaWall.toFixed(4),
              currentAudioTime: currentAudio.toFixed(3),
              totalStuttersLog: stutterCountRef.current
            }
          );
        } else if (jitterRatio > 1.25) {
          logMessage(
            'WARN',
            `⚠️ Catch-up event detected. Audio clock recovered. Jitter: ${jitterRatio.toFixed(2)}`,
            {
              elapsedAudioDelta: deltaAudio.toFixed(4),
              elapsedWallDelta: deltaWall.toFixed(4)
            }
          );
        }

        // Periodic snapshot logging (every 5 seconds under standard telemetry checking)
        if (Math.random() < 0.05) {
          logMessage('INFO', `Standard audio monitor heartbeat: context.state=${Tone.context.state}, active ratio=${jitterRatio.toFixed(3)}`);
        }
      }
    }, 400); // lightweight interval to safeguard system performance

    return () => {
      if (driftCheckIntervalRef.current) {
        clearInterval(driftCheckIntervalRef.current);
      }
    };
  }, [isLogging, playingState, playbackRates, eqState, fxState, trackInfo]);

  // Terminal scroll helper
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleLogs]);

  return (
    <>
      {/* FLOATING PERFORMANCE BUTTON COUPLING IN BOTTOM-RIGHT */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        <button
          id="btn-live-audio-debugger-toggle"
          onClick={() => setIsOpen(prev => !prev)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-mono font-bold tracking-tight shadow-lg transition-all hover:scale-105 duration-200 ${
            isOpen 
              ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20' 
              : 'bg-[#151520]/95 text-blue-400 border-blue-500/30 shadow-black/50 hover:border-blue-500/60'
          }`}
        >
          <Activity size={13} className={isLogging ? 'animate-pulse text-red-400' : 'text-blue-400'} />
          <span>🐞 LIVE AUDIO TESTER</span>
          {isLogging && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
      </div>

      {/* DETAILED DIAGNOSTIC SIDEBAR PLANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="panel-audio-diagnostics-drawer"
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-[#0d0d12]/98 border-l border-white/10 shadow-2xl z-[90] flex flex-col font-sans"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#13131b]/95">
              <div className="flex items-center gap-2">
                <Activity className="text-blue-500" size={18} />
                <div>
                  <h3 className="text-xs font-black tracking-widest text-white uppercase font-sans">Audio Engine Diagnostic Station</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Diagnose browser Audio Graph performance & clock anomalies</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Disk File Save Status Bar */}
            <div className="px-4 py-1.5 bg-[#171723]/95 border-b border-white/10 flex items-center justify-between text-[9px] font-mono select-none shrink-0">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-blue-400">💾</span>
                <span className="font-bold">FILE BACKED:</span>
                <span className="bg-black/40 px-1.5 py-0.5 rounded text-[8px] text-indigo-300 border border-indigo-500/10">diagnostics_report.txt</span>
              </div>
              <div className="flex items-center gap-1">
                {fileSaveStatus === 'idle' && (
                  <span className="text-slate-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> IDLE / READY
                  </span>
                )}
                {fileSaveStatus === 'saving' && (
                  <span className="text-[#3b82f6] flex items-center gap-1 animate-pulse font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span> AUTO-SAVING TO DISK...
                  </span>
                )}
                {fileSaveStatus === 'saved' && (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> COPIED ON DISK
                  </span>
                )}
                {fileSaveStatus === 'error' && (
                  <span className="text-red-400 flex items-center gap-1 font-bold animate-bounce">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> DISK WRITE ERROR
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Dashboard */}
            <div className="p-4 bg-[#101016] border-b border-white/15 flex flex-col gap-3 shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[9px] text-[#8e8e9f] font-mono tracking-widest uppercase">TRACING CONTROL</span>
                  <div className="flex gap-2 mt-1">
                    {!isLogging ? (
                      <button
                        id="btn-diagnostics-start"
                        onClick={startLogging}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold uppercase hover:bg-emerald-600/30 transition-all"
                      >
                        <Play size={11} fill="currentColor" /> Start Logs
                      </button>
                    ) : (
                      <button
                        id="btn-diagnostics-stop"
                        onClick={stopLogging}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-red-600/20 border border-red-500/40 text-red-400 text-[10px] font-bold uppercase hover:bg-red-600/30 transition-all animate-pulse"
                      >
                        <Pause size={11} fill="currentColor" /> Stop Logs
                      </button>
                    )}
                    
                    <button
                      id="btn-diagnostics-clear"
                      onClick={clearLogs}
                      className="py-1.5 px-2 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 text-[10px] uppercase font-bold"
                      title="Clear Current Terminal Logs"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-red-950/20 border border-red-500/20 justify-between">
                  <div>
                    <span className="text-[9px] text-red-400 font-mono tracking-widest uppercase flex items-center gap-1">
                      <ShieldAlert size={10} /> DISTORTION FLAGGER
                    </span>
                    <p className="text-[9px] text-slate-400 mt-1 font-sans">Click immediately when you hear cracking, speedups, or glitching!</p>
                  </div>
                  
                  <button
                    id="btn-flag-distortion"
                    onClick={flagDistortionMoment}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-red-500 border border-red-600 text-white text-[10px] font-black uppercase hover:bg-red-600 active:scale-95 shadow-[0_0_12px_rgba(239,68,68,0.3)] transition-all mt-1"
                  >
                    <AlertTriangle size={12} className="animate-bounce" /> Flag Distortion Event
                  </button>
                </div>
              </div>

              {/* REAL-TIME BUG OBSERVER / NOTE SECTION */}
              <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-indigo-950/25 border border-indigo-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-indigo-400 font-mono tracking-widest uppercase flex items-center gap-1.5 font-bold">
                    ✍️ Real-Time Note / Audio Observation
                  </span>
                  <span className="text-[8px] text-indigo-400 font-mono italic opacity-60">
                    Press Enter to Log
                  </span>
                </div>
                
                <div className="flex gap-2 mt-1">
                  <input
                    id="input-diagnostic-user-note"
                    ref={noteInputRef}
                    type="text"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        submitNoteToLog();
                      }
                    }}
                    placeholder="Type what you hear (e.g. 'Song suddenly speeding up' or 'Severe audio crackling starts')"
                    className="flex-1 bg-black/60 border border-indigo-500/30 hover:border-indigo-500/50 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 rounded px-2.5 py-1.5 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none transition-all font-sans"
                  />
                  <button
                    id="btn-submit-user-note"
                    onClick={submitNoteToLog}
                    className="px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-tight bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-md shadow-indigo-500/20 duration-150 transition-all cursor-pointer"
                  >
                    Log Note
                  </button>
                </div>
                <p className="text-[8px] text-slate-500 font-sans leading-normal">
                  Providing descriptions here will automatically include them when copying/downloading logs to share with me.
                </p>
              </div>
            </div>

            {/* Health indicators panel */}
            <div className="px-4 py-3 bg-[#121218]/50 border-b border-white/5 grid grid-cols-3 gap-2 shrink-0">
              <div className="p-2 rounded bg-black/20 border border-white/5 flex flex-col justify-between">
                <span className="text-[8px] text-[#8e8e9f] uppercase tracking-wide font-mono">Audio clock</span>
                <span className={`text-[11px] font-bold font-mono ${Tone.context.state === 'running' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>
                  {Tone.context.state.toUpperCase()}
                </span>
              </div>
              <div className="p-2 rounded bg-black/20 border border-white/5 flex flex-col justify-between">
                <span className="text-[8px] text-[#8e8e9f] uppercase tracking-wide font-mono">Thread performance</span>
                <span className={`text-[11px] font-bold font-mono flex items-center gap-1 ${stutterDetected ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                  {stutterDetected ? '⚠️ LAGGING' : '⚡ EXCELLENT'}
                </span>
              </div>
              <div className="p-2 rounded bg-black/20 border border-white/5 flex flex-col justify-between">
                <span className="text-[8px] text-[#8e8e9f] uppercase tracking-wide font-mono">Recorded log rows</span>
                <span className="text-[11px] text-blue-400 font-bold font-mono">
                  {logCount} rows
                </span>
              </div>
            </div>

            {/* Live Stats Table */}
            <div className="p-4 border-b border-white/5 bg-[#0f0f15]/30">
              <h4 className="text-[10px] font-bold tracking-wider text-slate-300 font-mono flex items-center gap-1 uppercase mb-2">
                <Cpu size={11} className="text-blue-500" /> Deck A & B System Parameters
              </h4>
              <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                {/* DECK A */}
                <div className="p-2 rounded bg-black/30 border border-blue-500/20 flex flex-col gap-1">
                  <div className="text-blue-400 font-black border-b border-white/5 pb-1 flex justify-between items-center">
                    <span>Deck A Status</span>
                    <span className={playingState.A ? "w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" : "w-1.5 h-1.5 rounded-full bg-slate-600"}></span>
                  </div>
                  <div className="flex justify-between mt-1"><span className="opacity-50">Track:</span> <span className="text-slate-300 max-w-[120px] truncate">{trackInfo.A.title || 'None'}</span></div>
                  <div className="flex justify-between"><span className="opacity-50">Playhead:</span> <span className="text-blue-400 font-bold">{audioEngine.getPosition('A').toFixed(2)}s</span></div>
                  <div className="flex justify-between"><span className="opacity-50">Pitch Rate:</span> <span className="text-slate-300">{playbackRates.A.toFixed(3)}x</span></div>
                  <div className="flex justify-between">
                    <span className="opacity-50">Banded EQ:</span> 
                    <span className="text-slate-400">{eqState.A.low.toFixed(0)}/{eqState.A.mid.toFixed(0)}/{eqState.A.high.toFixed(0)} dB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-50">LP/HP HPF:</span>
                    <span className="text-slate-400">{filterState.A === 0 ? 'BYPASS' : `${filterState.A > 0 ? '+' : ''}${filterState.A.toFixed(0)}Hz`}</span>
                  </div>
                </div>

                {/* DECK B */}
                <div className="p-2 rounded bg-black/30 border border-purple-500/20 flex flex-col gap-1">
                  <div className="text-purple-400 font-black border-b border-white/5 pb-1 flex justify-between items-center">
                    <span>Deck B Status</span>
                    <span className={playingState.B ? "w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" : "w-1.5 h-1.5 rounded-full bg-slate-600"}></span>
                  </div>
                  <div className="flex justify-between mt-1"><span className="opacity-50">Track:</span> <span className="text-slate-300 max-w-[120px] truncate">{trackInfo.B.title || 'None'}</span></div>
                  <div className="flex justify-between"><span className="opacity-50">Playhead:</span> <span className="text-purple-400 font-bold">{audioEngine.getPosition('B').toFixed(2)}s</span></div>
                  <div className="flex justify-between"><span className="opacity-50">Pitch Rate:</span> <span className="text-slate-300">{playbackRates.B.toFixed(3)}x</span></div>
                  <div className="flex justify-between">
                    <span className="opacity-50">Banded EQ:</span> 
                    <span className="text-slate-400">{eqState.B.low.toFixed(0)}/{eqState.B.mid.toFixed(0)}/{eqState.B.high.toFixed(0)} dB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-50">LP/HP HPF:</span>
                    <span className="text-slate-400">{filterState.B === 0 ? 'BYPASS' : `${filterState.B > 0 ? '+' : ''}${filterState.B.toFixed(0)}Hz`}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Logging Window */}
            <div className="flex-1 p-4 flex flex-col min-h-0 bg-black/60 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 font-mono flex items-center gap-1 uppercase">
                  <Clock size={11} /> Live Terminal Logging Event Log
                </span>
                {allLogsRef.current.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-copylogs"
                      onClick={copyLogs}
                      className="flex items-center gap-1 py-1 px-2 rounded bg-white/5 hover:bg-white/10 text-white text-[9px] font-mono border border-white/10 transition-colors"
                    >
                      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      {copied ? 'Copied' : 'Copy Log'}
                    </button>
                    <button
                      id="btn-downloadlogs"
                      onClick={downloadLogs}
                      className="flex items-center gap-1 py-1 px-2 rounded bg-white/5 hover:bg-white/10 text-white text-[9px] font-mono border border-white/10 transition-colors"
                    >
                      <Download size={10} />
                      Download (.txt)
                    </button>
                  </div>
                )}
              </div>

              {/* Log Board */}
              <div className="flex-1 bg-[#050508]/90 p-3 rounded border border-white/5 overflow-y-auto font-mono text-[9px] text-[#b3b3cb] leading-relaxed select-text flex flex-col gap-0.5">
                {visibleLogs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#5c5c70] h-full gap-2">
                    <Activity size={24} className="opacity-20 animate-pulse" />
                    <p className="max-w-xs leading-normal">
                      No logs currently captured.<br />
                      Click <strong className="text-indigo-400">"Start Logs"</strong> above to record clock timing, or click <strong className="text-red-400">"Flag Distortion Event"</strong> to initiate instantly as soon as you detect distortion!
                    </p>
                  </div>
                ) : (
                  visibleLogs.map((log, i) => {
                    let textClass = 'text-[#b3b3cb]';
                    if (log.includes('[ERROR]')) textClass = 'text-red-400 font-bold';
                    else if (log.includes('[WARN]')) textClass = 'text-amber-400 font-bold';
                    else if (log.includes('[EVENT]')) textClass = 'text-red-400 font-extrabold bg-red-950/20 border-l-2 border-red-500 pl-1.5 py-0.5 my-1';
                    else if (log.includes('[SUCCESS]')) textClass = 'text-emerald-400 font-semibold';
                    
                    return (
                      <div key={i} className={`whitespace-pre-wrap break-all ${textClass}`}>
                        {log}
                      </div>
                    );
                  })
                )}
                <div ref={terminalBottomRef} />
              </div>

              <div className="text-[8px] text-[#555566] text-right mt-1.5">
                Showing last 50 log events. Click "Copy Log" to fetch complete buffered log sequence.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
