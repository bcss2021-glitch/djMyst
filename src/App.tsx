/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { Music, Upload, Info, Settings, Search, Disc3, Headphones, ChevronUp, ChevronDown, Maximize2, LayoutGrid, List, Activity, Heart, ListPlus, Trash2, Star, Save, Clock } from 'lucide-react';
import { audioEngine } from './lib/audioEngine';
import Deck from './components/Deck';
import Mixer from './components/Mixer';
import Waveform from './components/Waveform';
import Visualizer from './components/Visualizer';
import { AudiusTrack, searchAudius, getAudiusStreamUrl } from './services/audius';

interface TrackConfig {
  eq: { low: number; mid: number; high: number };
  fx: { crush: number; reverb: number; echo: number; flanger: number };
  filter: number;
  playbackRate: number;
}

interface SavedTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  isAudius?: boolean;
  config?: TrackConfig;
  addedAt: number;
}

const DEFAULT_TRACKS = [
  { id: '1', name: 'Deep Techno', url: 'https://cdn.pixabay.com/audio/2024/02/09/audio_653925c48b.mp3' },
  { id: '2', name: 'Melodic House', url: 'https://cdn.pixabay.com/audio/2023/10/25/audio_249df9c4d4.mp3' },
  { id: '3', name: 'Minimal Bass', url: 'https://cdn.pixabay.com/audio/2023/09/18/audio_6a20803c62.mp3' },
];

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [playingState, setPlayingState] = useState({ A: false, B: false });
  const [cuePoints, setCuePoints] = useState<Record<'A' | 'B', number>>({ A: 0, B: 0 });
  const cuePointsRef = useRef<Record<'A' | 'B', number>>({ A: 0, B: 0 });
  const [reverseStates, setReverseStates] = useState<Record<'A' | 'B', boolean>>({ A: false, B: false });
  const [isCueActive, setIsCueActive] = useState<Record<'A' | 'B', boolean>>({ A: false, B: false });
  const [browserHeight, setBrowserHeight] = useState(200);
  const [isTempExpanded, setIsTempExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [audiusTracks, setAudiusTracks] = useState<AudiusTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const loadingState = useState({ A: false, B: false })[0];
  const setLoadingState = useState({ A: false, B: false })[1];
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeLoadingUrlRef = useRef<{ A: string | null, B: string | null }>({ A: null, B: null });
  const wasPlayingBeforeScratch = useRef<Record<'A' | 'B', boolean>>({ A: false, B: false });
  
  const [playlist, setPlaylist] = useState<SavedTrack[]>(() => {
    try {
      const saved = localStorage.getItem('dj_playlist');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse playlist", e);
      return [];
    }
  });
  
  const [favorites, setFavorites] = useState<SavedTrack[]>(() => {
    try {
      const saved = localStorage.getItem('dj_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse favorites", e);
      return [];
    }
  });
  
  const [activeLibraryTab, setActiveLibraryTab] = useState<'CRATES' | 'PLAYLIST' | 'FAVORITES' | 'HISTORY' | 'YOUTUBE' | 'SPOTIFY'>('CRATES');
  const [deckSources, setDeckSources] = useState<{ A: 'AUDIO' | 'EXTERNAL', B: 'AUDIO' | 'EXTERNAL' }>({ A: 'AUDIO', B: 'AUDIO' });
  const [externalUrls, setExternalUrls] = useState<{ A: string | null, B: string | null }>({ A: null, B: null });

  const [trackInfo, setTrackInfo] = useState({
    A: { title: 'READY', url: null as string | null, id: null as string | null, artist: null as string | null, duration: 0 },
    B: { title: 'READY', url: null as string | null, id: null as string | null, artist: null as string | null, duration: 0 },
  });
  const [eqState, setEqState] = useState({
    A: { low: 0, mid: 0, high: 0 },
    B: { low: 0, mid: 0, high: 0 },
  });
  const [filterState, setFilterState] = useState({ A: 0, B: 0 });
  const [volumeState, setVolumeState] = useState({ A: 0.8, B: 0.8 });
  const [crossfade, setCrossfade] = useState(0.5);
  const [xfaderCurve, setXfaderCurve] = useState(0.5);
  const [viewMode, setViewMode] = useState<'A' | 'B' | 'MIXER'>('A');
  const [playbackRates, setPlaybackRates] = useState({ A: 1, B: 1 });
  const [baseBpm, setBaseBpm] = useState(128);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [fxState, setFxState] = useState({
    A: { crush: 0, reverb: 0, echo: 0, flanger: 0 },
    B: { crush: 0, reverb: 0, echo: 0, flanger: 0 },
  });
  const [keyLockState, setKeyLockState] = useState({ A: false, B: false });
  const [gainState, setGainState] = useState({ A: 1, B: 1 });
  const [rollState, setRollState] = useState({ A: null as string | null, B: null as string | null });
  const [loopState, setLoopState] = useState({
    A: { in: null as number | null, active: false },
    B: { in: null as number | null, active: false },
  });
  const [history, setHistory] = useState<SavedTrack[]>(() => {
    try {
      const saved = localStorage.getItem('dj_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse history", e);
      return [];
    }
  });
  const [hotCues, setHotCues] = useState<Record<string, number[]>>(() => {
    try {
      const saved = localStorage.getItem('dj_hotcues');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Failed to parse hotcues", e);
      return {};
    }
  });

  const startAudio = async () => {
    await Tone.start();
    setIsStarted(true);
  };

  const loadTrack = async (deck: 'A' | 'B', name: string, urlOrId: string, isAudius = false, config?: TrackConfig) => {
    // Determine if it's an external URL (YouTube/Spotify)
    const isYouTube = urlOrId.includes('youtube.com') || urlOrId.includes('youtu.be');
    const isSpotify = urlOrId.includes('spotify.com');

    if (isYouTube || isSpotify) {
      setDeckSources(prev => ({ ...prev, [deck]: 'EXTERNAL' }));
      setExternalUrls(prev => ({ ...prev, [deck]: urlOrId }));
      setTrackInfo(prev => ({ 
        ...prev, 
        [deck]: { title: name, url: urlOrId, id: urlOrId, artist: 'External', duration: 0 } 
      }));
      // Stop the audio engine player if it was playing
      audioEngine.stop(deck);
      setPlayingState(prev => ({ ...prev, [deck]: false }));
      return;
    }

    setDeckSources(prev => ({ ...prev, [deck]: 'AUDIO' }));
    setExternalUrls(prev => ({ ...prev, [deck]: null }));

    // Stop physical playing immediately so no music is left in the queue/background
    audioEngine.stop(deck);
    activeLoadingUrlRef.current[deck] = urlOrId;

    if (!isStarted) await startAudio();
    
    // Stop playing and set loading state
    setPlayingState(prev => ({ ...prev, [deck]: false }));
    setTrackInfo(prev => ({
      ...prev,
      [deck]: { ...prev[deck], title: `LOADING: ${name.toUpperCase()}` }
    }));
    setLoadingState(prev => ({ ...prev, [deck]: true }));

    try {
      let finalUrl = urlOrId;
      if (isAudius) {
        setIsSearching(true);
        finalUrl = await getAudiusStreamUrl(urlOrId);
        setIsSearching(false);
      }
      
      // If a newer load request has been made on this deck, ignore this old load request
      if (activeLoadingUrlRef.current[deck] !== urlOrId) {
        return;
      }
      
      if (!finalUrl) throw new Error("Could not resolve stream URL");

      await audioEngine.loadTrack(deck, finalUrl);
      
      const computedDuration = audioEngine.getDeck(deck).buffer.duration || 180;
      
      // Re-apply current playback rate to the new track in the engine
      audioEngine.setPlaybackRate(deck, playbackRates[deck]);
      // Re-apply FX and EQ just in case loading reset anything
      audioEngine.setEQ(deck, 'low', eqState[deck].low);
      audioEngine.setEQ(deck, 'mid', eqState[deck].mid);
      audioEngine.setEQ(deck, 'high', eqState[deck].high);
      audioEngine.setFilter(deck, filterState[deck]);
      audioEngine.setFX(deck, 'crush', fxState[deck].crush);
      audioEngine.setFX(deck, 'reverb', fxState[deck].reverb);
      audioEngine.setFX(deck, 'echo', fxState[deck].echo);
      audioEngine.setFX(deck, 'flanger', fxState[deck].flanger);
      
      setTrackInfo(prev => ({ 
        ...prev, 
        [deck]: { title: name, url: finalUrl, id: urlOrId, artist: isAudius ? 'Audius' : 'Local', duration: computedDuration } 
      }));

      // Apply saved config if available
      if (config) {
        handleEqChange(deck, 'low', config.eq.low);
        handleEqChange(deck, 'mid', config.eq.mid);
        handleEqChange(deck, 'high', config.eq.high);
        handleFxChange(deck, 'crush', config.fx.crush);
        handleFxChange(deck, 'reverb', config.fx.reverb);
        handleFxChange(deck, 'echo', config.fx.echo);
        handleFxChange(deck, 'flanger', config.fx.flanger);
        handleFilterChange(deck, config.filter);
        handleRateChange(deck, config.playbackRate);
      }

      setLoadingState(prev => ({ ...prev, [deck]: false }));
      if (isTempExpanded) setIsTempExpanded(false);

      setTrackInfo(prev => ({
        ...prev,
        [deck]: { title: name, url: finalUrl, id: urlOrId, artist: isAudius ? 'Audius' : 'Local', duration: computedDuration }
      }));

      // Add to history
      setHistory(prev => {
        const item = { id: urlOrId, title: name, artist: isAudius ? 'Audius' : 'Local', url: finalUrl, addedAt: Date.now() };
        // Keep last 50 tracks
        const newHistory = [item, ...prev.filter(t => t.id !== urlOrId)].slice(0, 50);
        return newHistory;
      });
    } catch (e) {
      console.error("Failed to load track:", e);
      setIsSearching(false);
      setLoadingState(prev => ({ ...prev, [deck]: false }));
      setTrackInfo(prev => ({
        ...prev,
        [deck]: { ...prev[deck], title: `ERROR: ${name.toUpperCase()}` }
      }));
    }
  };

  const toggleFavorite = (track: { id: string; title: string; artist: string; url: string; isAudius?: boolean }) => {
    setFavorites(prev => {
      const exists = prev.find(t => t.id === track.id);
      if (exists) {
        return prev.filter(t => t.id !== track.id);
      }
      return [...prev, { ...track, addedAt: Date.now() }];
    });
  };

  const addToPlaylist = (track: { id: string; title: string; artist: string; url: string; isAudius?: boolean }) => {
    setPlaylist(prev => {
      if (prev.find(t => t.id === track.id)) return prev;
      return [...prev, { ...track, addedAt: Date.now() }];
    });
  };

  const removeFromPlaylist = (id: string) => {
    setPlaylist(prev => prev.filter(t => t.id !== id));
  };

  const captureDeckConfig = (deck: 'A' | 'B') => {
    const currentTrack = trackInfo[deck];
    if (!currentTrack.id || !currentTrack.url) return;

    const currentConfig: TrackConfig = {
      eq: eqState[deck],
      fx: fxState[deck],
      filter: filterState[deck],
      playbackRate: playbackRates[deck],
    };

    setPlaylist(prev => {
      const exists = prev.some(t => t.id === currentTrack.id);
      if (exists) {
        return prev.map(t => t.id === currentTrack.id ? { ...t, config: currentConfig } : t);
      } else {
        return [{
          id: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist || 'Unknown',
          url: currentTrack.url,
          config: currentConfig,
          addedAt: Date.now()
        }, ...prev];
      }
    });

    console.log(`Saved ${currentTrack.title} to playlist with current config.`);
  };

  const handleToggleRecording = async () => {
    if (!isStarted) await startAudio();
    
    if (isRecording) {
      const url = await audioEngine.stopRecording();
      setRecordingUrl(url);
      setIsRecording(false);
    } else {
      setRecordingUrl(null);
      await audioEngine.startRecording();
      setIsRecording(true);
    }
  };

  useEffect(() => {
    localStorage.setItem('dj_playlist', JSON.stringify(playlist));
  }, [playlist]);

  useEffect(() => {
    localStorage.setItem('dj_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('dj_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('dj_hotcues', JSON.stringify(hotCues));
  }, [hotCues]);

  const togglePlay = (deck: 'A' | 'B') => {
    if (!trackInfo[deck].url || loadingState[deck]) return;
    audioEngine.playPause(deck);
    setPlayingState(prev => ({ ...prev, [deck]: !prev[deck] }));
  };

  const handleEqChange = (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', val: number) => {
    audioEngine.setEQ(deck, band, val);
    setEqState(prev => ({
      ...prev,
      [deck]: { ...prev[deck], [band]: val }
    }));
  };

  const handleGainChange = (deck: 'A' | 'B', val: number) => {
    audioEngine.setGain(deck, val);
    setGainState(prev => ({ ...prev, [deck]: val }));
  };

  const handleKeyLockToggle = (deck: 'A' | 'B') => {
    const newState = !keyLockState[deck];
    audioEngine.setKeyLock(deck, newState);
    setKeyLockState(prev => ({ ...prev, [deck]: newState }));
  };

  const handleHotCue = (deck: 'A' | 'B', index: number) => {
    const trackId = trackInfo[deck].id;
    if (!trackId) return;

    const currentTime = audioEngine.getPosition(deck);
    
    setHotCues(prev => {
      const trackCues = [...(prev[trackId] || [])];
      
      // If cue exists at index, jump to it
      if (trackCues[index] !== undefined) {
        audioEngine.seek(deck, trackCues[index]);
        return prev;
      }
      
      // Otherwise, save current time as new cue
      trackCues[index] = currentTime;
      return { ...prev, [trackId]: trackCues };
    });
  };

  const handleLoopIn = (deck: 'A' | 'B') => {
    const pos = audioEngine.getPosition(deck);
    setLoopState(prev => ({
      ...prev,
      [deck]: { ...prev[deck], in: pos, active: false }
    }));
  };

  const handleLoopOut = (deck: 'A' | 'B') => {
    const start = loopState[deck].in;
    if (start === null) return;
    const end = audioEngine.getPosition(deck);
    if (end <= start) return;

    audioEngine.setLoop(deck, start, end);
    setLoopState(prev => ({
      ...prev,
      [deck]: { ...prev[deck], active: true }
    }));
  };

  const handleExitLoop = (deck: 'A' | 'B') => {
    audioEngine.clearLoop(deck);
    setLoopState(prev => ({
      ...prev,
      [deck]: { in: null, active: false }
    }));
  };

  const clearHotCues = (deck: 'A' | 'B') => {
    const trackId = trackInfo[deck].id;
    if (!trackId) return;
    setHotCues(prev => {
      const newCues = { ...prev };
      delete newCues[trackId];
      return newCues;
    });
  };

  const handleFilterChange = (deck: 'A' | 'B', val: number) => {
    audioEngine.setFilter(deck, val);
    setFilterState(prev => ({ ...prev, [deck]: val }));
  };

  const handleVolumeChange = (deck: 'A' | 'B', val: number) => {
    audioEngine.setVolume(deck, val);
    setVolumeState(prev => ({ ...prev, [deck]: val }));
  };

  const getResolvedVolume = (deck: 'A' | 'B') => {
    const channelVol = volumeState[deck];
    const deckGain = gainState[deck];
    
    let cfFactor = 1;
    let fadeVal = crossfade;
    
    if (xfaderCurve > 0.8) {
      // Hard cut / Battle curve logic
      if (deck === 'A') {
        cfFactor = fadeVal >= 0.99 ? 0 : 1;
      } else {
        cfFactor = fadeVal <= 0.01 ? 0 : 1;
      }
    } else {
      // Equal Gain / Constant Power blend
      if (deck === 'A') {
        cfFactor = fadeVal <= 0.5 ? 1 : Math.max(0, Math.min(1, (1 - fadeVal) * 2));
      } else {
        cfFactor = fadeVal >= 0.5 ? 1 : Math.max(0, Math.min(1, fadeVal * 2));
      }
    }
    
    return Math.max(0, Math.min(1, channelVol * deckGain * cfFactor));
  };

  const handleCrossfadeChange = (val: number) => {
    audioEngine.setCrossfade(val);
    setCrossfade(val);
  };

  const handleXfaderCurveChange = (val: number) => {
    audioEngine.setCrossfaderCurve(val);
    setXfaderCurve(val);
  };

  const handleOptimizeAudio = () => {
    audioEngine.clearStatic();
  };

  const handleResetMixer = () => {
    // 1. Reset EQs on Audio Engine and State
    audioEngine.setEQ('A', 'low', 0);
    audioEngine.setEQ('A', 'mid', 0);
    audioEngine.setEQ('A', 'high', 0);
    audioEngine.setEQ('B', 'low', 0);
    audioEngine.setEQ('B', 'mid', 0);
    audioEngine.setEQ('B', 'high', 0);
    setEqState({
      A: { low: 0, mid: 0, high: 0 },
      B: { low: 0, mid: 0, high: 0 },
    });

    // 2. Reset Filters
    audioEngine.setFilter('A', 0);
    audioEngine.setFilter('B', 0);
    setFilterState({ A: 0, B: 0 });

    // 3. Reset Volumes
    audioEngine.setVolume('A', 0.8);
    audioEngine.setVolume('B', 0.8);
    setVolumeState({ A: 0.8, B: 0.8 });

    // 4. Reset Pre-fade Gain state to 1.0
    audioEngine.setGain('A', 1.0);
    audioEngine.setGain('B', 1.0);
    setGainState({ A: 1, B: 1 });

    // 5. Reset Crossfader & Curve
    audioEngine.setCrossfade(0.5);
    audioEngine.setCrossfaderCurve(0.5);
    setCrossfade(0.5);
    setXfaderCurve(0.5);
  };

  const handleRewind = (deck: 'A' | 'B') => {
    try {
      audioEngine.seek(deck, 0);
    } catch (e) {
      console.error(`Rewind failed on deck ${deck}:`, e);
    }
  };

  const handleCuePress = (deck: 'A' | 'B') => {
    if (!trackInfo[deck].url || loadingState[deck]) return;
    try {
      const isCurrentlyPlaying = playingState[deck];
      if (isCurrentlyPlaying) {
        audioEngine.playPause(deck);
        setPlayingState(prev => ({ ...prev, [deck]: false }));
        audioEngine.seek(deck, cuePointsRef.current[deck]);
      } else {
        const currentPos = audioEngine.getPosition(deck);
        let activeCue = cuePointsRef.current[deck];
        
        if (Math.abs(currentPos - activeCue) > 0.25) {
          activeCue = currentPos;
          cuePointsRef.current[deck] = currentPos;
          setCuePoints(prev => ({ ...prev, [deck]: currentPos }));
        }
        
        setIsCueActive(prev => ({ ...prev, [deck]: true }));
        audioEngine.seek(deck, activeCue);
        audioEngine.playPause(deck);
      }
    } catch (e) {
      console.error(`Cue press error on deck ${deck}:`, e);
    }
  };

  const handleCueRelease = (deck: 'A' | 'B') => {
    if (!trackInfo[deck].url || loadingState[deck]) return;
    try {
      if (isCueActive[deck]) {
        audioEngine.playPause(deck);
        audioEngine.seek(deck, cuePointsRef.current[deck]);
        setIsCueActive(prev => ({ ...prev, [deck]: false }));
      }
    } catch (e) {
      console.error(`Cue release error on deck ${deck}:`, e);
    }
  };

  const handleReverseToggle = (deck: 'A' | 'B') => {
    try {
      const targetState = !reverseStates[deck];
      audioEngine.setReverse(deck, targetState);
      setReverseStates(prev => ({ ...prev, [deck]: targetState }));
    } catch (e) {
      console.error(`Reverse toggle error on deck ${deck}:`, e);
    }
  };

  const handleScratchDrag = (deck: 'A' | 'B', deltaSeconds: number) => {
    try {
      audioEngine.scratchSeek(deck, deltaSeconds);
    } catch (e) {
      console.error(`Scratch drag error on deck ${deck}:`, e);
    }
  };

  const handleScratchStart = (deck: 'A' | 'B') => {
    try {
      wasPlayingBeforeScratch.current[deck] = playingState[deck];
      if (playingState[deck]) {
        audioEngine.stop(deck);
      }
    } catch (e) {
      console.error(`Scratch start error on deck ${deck}:`, e);
    }
  };

  const handleScratchEnd = (deck: 'A' | 'B') => {
    try {
      if (wasPlayingBeforeScratch.current[deck]) {
        audioEngine.playPause(deck);
      }
    } catch (e) {
      console.error(`Scratch end error on deck ${deck}:`, e);
    }
  };

  const handleWaveformSeek = (deck: 'A' | 'B', time: number) => {
    try {
      audioEngine.seek(deck, time);
    } catch (e) {
      console.error(`Waveform seek error on deck ${deck}:`, e);
    }
  };

  const handlePitchBend = (deck: 'A' | 'B', multiplier: number) => {
    audioEngine.setPitchBend(deck, multiplier);
  };

  const handleRateChange = (deck: 'A' | 'B', val: number) => {
    audioEngine.setPlaybackRate(deck, val);
    setPlaybackRates(prev => ({ ...prev, [deck]: val }));
  };

  const exportPlaylist = () => {
    const dataStr = JSON.stringify({ playlist, favorites });
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'dj-session-export.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importPlaylist = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.playlist) setPlaylist(data.playlist);
        if (data.favorites) setFavorites(data.favorites);
      } catch (err) {
        console.error("Failed to import playlist:", err);
      }
    };
    reader.readAsText(file);
  };

  const handleBaseBpmChange = (newBpm: number) => {
    const clampedBpm = Math.max(40, Math.min(250, newBpm));
    setBaseBpm(clampedBpm);
  };

  const handleSync = (targetDeck: 'A' | 'B') => {
    const sourceDeck = targetDeck === 'A' ? 'B' : 'A';
    const sourceRate = playbackRates[sourceDeck];
    
    audioEngine.setPlaybackRate(targetDeck, sourceRate);
    setPlaybackRates(prev => ({ ...prev, [targetDeck]: sourceRate }));
  };

  const handleFxChange = (deck: 'A' | 'B', type: 'crush' | 'reverb' | 'echo' | 'flanger', val: number) => {
    audioEngine.setFX(deck, type, val);
    setFxState(prev => ({
      ...prev,
      [deck]: { ...prev[deck], [type]: val }
    }));
  };

  const handleRoll = (deck: 'A' | 'B', division: '1/4' | '1/8' | '1/16' | null) => {
    if (!division) {
      audioEngine.clearLoop(deck);
      setRollState(prev => ({ ...prev, [deck]: null }));
      return;
    }

    const pos = audioEngine.getPosition(deck);
    const duration = division === '1/4' ? 0.25 : (division === '1/8' ? 0.125 : 0.0625);
    // Simple beat roll approximation: 120bpm -> 1 beat = 0.5s. 1/4 = 0.125s.
    // For now we'll just use fixed time based on division for the loop region.
    // In a real app we'd sync with current BPM.
    const beatLen = 60 / baseBpm;
    const loopLen = beatLen * (division === '1/4' ? 0.25 : (division === '1/8' ? 0.125 : 0.0625));
    
    audioEngine.setLoop(deck, pos, pos + loopLen);
    setRollState(prev => ({ ...prev, [deck]: division }));
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setAudiusTracks([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchAudius(query);
      setAudiusTracks(results);
      // Auto-expand search results if not expanded and we have results
      if (results.length > 0 && !isTempExpanded) {
        setIsTempExpanded(true);
      }
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query) {
      setAudiusTracks([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => handleSearch(query), 500);
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const newHeight = window.innerHeight - clientY;
      setBrowserHeight(Math.max(120, Math.min(newHeight, window.innerHeight * 0.7)));
    };

    const handleEnd = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing]);

  const handleLoadExternalLink = (deck: 'A' | 'B', url: string) => {
    const type = url.includes('youtube') || url.includes('youtu.be') ? 'YouTube' : 'Spotify';
    loadTrack(deck, `${type} Stream`, url);
  };

  const triggerSample = (name: string) => {
    audioEngine.triggerSample(name);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') togglePlay('A');
      if (e.key === 'Enter') togglePlay('B');
      // Numbers for samples
      if (e.key === '1') triggerSample('kick');
      if (e.key === '2') triggerSample('snare');
      if (e.key === '3') triggerSample('clap');
      if (e.key === '4') triggerSample('hihat');
      if (e.key === '5') triggerSample('scratch');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trackInfo]);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden text-slate-300">
      {/* TOP BAR: SYSTEM INFO */}
      <header className="h-10 bg-[#121218] border-b border-white/10 flex items-center justify-between px-4 lg:px-6 z-50 flex-shrink-0">
        <div className="flex items-center gap-2 lg:gap-4">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse"></div>
          <span className="text-[9px] lg:text-[10px] font-mono tracking-[0.2em] uppercase opacity-60 truncate">Digital Link Active</span>
        </div>
        
        <div className="flex items-center gap-2 lg:gap-4 flex-1 max-w-sm px-4 h-full">
          <button 
            onClick={handleToggleRecording}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-bold border transition-all ${isRecording ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-white/20'}`} />
            {isRecording ? 'REC MIXING...' : 'REC MIX'}
          </button>
          
          {recordingUrl && (
            <a 
              href={recordingUrl} 
              download="my-session-mix.webm"
              className="text-[9px] font-bold text-blue-400 underline hover:text-blue-300 flex items-center gap-1 uppercase"
            >
              <Save size={12} /> Save Mix
            </a>
          )}
          
          <div className="h-6 w-full bg-black/40 rounded overflow-hidden border border-white/5 relative">
            <div className="absolute inset-x-0 bottom-0 top-0 opacity-40">
                <Visualizer deck="A" color="#3b82f6" isPlaying={playingState.A} mode="spectrum" sourceType={deckSources.A} />
            </div>
            <div className="absolute inset-x-0 bottom-0 top-0 opacity-40">
                <Visualizer deck="B" color="#a855f7" isPlaying={playingState.B} mode="spectrum" sourceType={deckSources.B} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-[6px] font-black tracking-widest text-white/10 uppercase">Master Spectral Link</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-8 font-mono text-xs">
          <div className="hidden xs:flex flex-col items-center">
            <span className="text-[8px] opacity-40 leading-none">QUANTIZE</span>
            <span className="text-blue-400 font-bold">ON</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] opacity-40 leading-none">MASTER CLOCK</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => handleBaseBpmChange(baseBpm - 1)}
                className="text-[10px] text-white/20 hover:text-blue-400 font-bold"
              >-</button>
              <span 
                className="text-blue-400 font-bold tabular-nums cursor-pointer hover:text-blue-300"
                onClick={() => {
                  const input = prompt("Set Master BPM", baseBpm.toString());
                  if (input) handleBaseBpmChange(parseFloat(input));
                }}
              >
                {(baseBpm * (playbackRates.A + playbackRates.B) / 2).toFixed(2)}
              </span>
              <button 
                onClick={() => handleBaseBpmChange(baseBpm + 1)}
                className="text-[10px] text-white/20 hover:text-blue-400 font-bold"
              >+</button>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-center">
            <span className="text-[8px] opacity-40 leading-none">CPU</span>
            <span className="text-green-400 font-bold">14%</span>
          </div>
          {!isStarted && (
            <button 
              onClick={startAudio}
              className="px-2 lg:px-3 py-1 rounded bg-blue-600/20 border border-blue-500/40 text-blue-400 text-[8px] lg:text-[9px] font-bold uppercase hover:bg-blue-600/40 transition-all"
            >
              Start
            </button>
          )}
        </div>
      </header>

      {/* WAVEFORM GLOBAL VIEW */}
      <section className="h-24 lg:h-32 bg-black/40 grid grid-cols-2 gap-0.5 p-0.5 border-b border-white/5 flex-shrink-0">
        {(['A', 'B'] as const).map(deck => (
          <div key={deck} className="relative h-full bg-[#0D0D12] overflow-hidden rounded border border-white/5 group">
            {/* Background FFT */}
            <div className="absolute inset-0 z-0">
               <Visualizer deck={deck} color={deck === 'A' ? "#3b82f6" : "#a855f7"} isPlaying={playingState[deck]} sourceType={deckSources[deck]} />
            </div>
            
            <div className="absolute inset-0 flex items-center z-10">
              <div className="h-full w-[1px] bg-white/20 z-10 left-1/2 absolute pointer-events-none"></div>
              <Waveform 
                url={trackInfo[deck].url} 
                isPlaying={playingState[deck]} 
                color={deck === 'A' ? "#3b82f6" : "#a855f7"} 
                deckId={deck} 
                onSeek={(time) => handleWaveformSeek(deck, time)}
                duration={trackInfo[deck].duration}
                cuePoint={cuePoints[deck]}
                hotCues={hotCues[trackInfo[deck].id || ''] || []}
              />
            </div>
            
            <div className={`absolute top-2 left-3 z-20 text-[10px] font-black italic tracking-[0.1em] uppercase transition-all ${playingState[deck] ? (deck === 'A' ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]') : (trackInfo[deck].url ? 'text-white/80' : 'text-white/20')}`}>
              DECK {deck} // {trackInfo[deck].title || 'READY'}
            </div>
            
            {/* Small status badges */}
            <div className="absolute top-0.5 right-2 z-20 flex gap-2">
                {playingState[deck] && (
                    <div className="flex items-center gap-1">
                        <Activity size={8} className="text-green-500 animate-pulse" />
                        <span className="text-[7px] text-green-500/60 font-mono">LIVE</span>
                    </div>
                )}
            </div>
          </div>
        ))}
      </section>

      {/* MAIN CONTROLLER SURFACE */}
      <main className="flex-1 relative overflow-hidden bg-black/20">
        {/* Mobile View Toggles */}
        <div className="md:hidden absolute top-0 left-0 w-full z-10 flex justify-center pt-2 gap-2">
            {['A', 'MIXER', 'B'].map((mode) => (
                <button 
                  key={mode} 
                  onClick={() => setViewMode(mode as any)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest transition-all ${viewMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-white/40'}`}
                >
                    {mode}
                </button>
            ))}
        </div>

        <div className="h-full w-full hardware-surface grid md:grid-cols-[1fr_220px_1fr] px-2 md:px-4 py-1 md:py-2 gap-2 md:gap-4 relative">
          {/* Deck A */}
          <div className={`${viewMode === 'A' ? 'flex' : 'hidden'} md:flex h-full`}>
                <Deck 
                  id="A" 
                  trackUrl={trackInfo.A.url} 
                  isPlaying={playingState.A} 
                  isLoading={loadingState.A}
                  onPlayPause={() => togglePlay('A')}
                  onSync={() => handleSync('A')}
                  playbackRate={playbackRates.A}
                  onRateChange={(v) => handleRateChange('A', v)}
                  onPitchBend={(v) => handlePitchBend('A', v)}
                  fx={fxState.A}
                  onFxChange={(type, val) => handleFxChange('A', type, val)}
                  onPadTrigger={triggerSample}
                  onRoll={(div) => handleRoll('A', div)}
                  activeRoll={rollState.A}
                  onSaveConfig={() => captureDeckConfig('A')}
                  sourceType={deckSources.A}
                  externalUrl={externalUrls.A}
                  keyLock={keyLockState.A}
                  onKeyLockToggle={() => handleKeyLockToggle('A')}
                  gain={gainState.A}
                  onGainChange={(v) => handleGainChange('A', v)}
                  hotCues={hotCues[trackInfo.A.id || ''] || []}
                  onHotCue={(i) => handleHotCue('A', i)}
                  onClearCues={() => clearHotCues('A')}
                  loop={loopState.A}
                  onLoopIn={() => handleLoopIn('A')}
                  onLoopOut={() => handleLoopOut('A')}
                  onExitLoop={() => handleExitLoop('A')}
                  resolvedVolume={getResolvedVolume('A')}
                  onRewind={() => handleRewind('A')}
                  onCuePress={() => handleCuePress('A')}
                  onCueRelease={() => handleCueRelease('A')}
                  isCueActive={isCueActive.A}
                  onReverseToggle={() => handleReverseToggle('A')}
                  isReversed={reverseStates.A}
                  onScratchDrag={(sec) => handleScratchDrag('A', sec)}
                  onScratchStart={() => handleScratchStart('A')}
                  onScratchEnd={() => handleScratchEnd('A')}
                />
          </div>

          {/* Mixer */}
          <div className={`${viewMode === 'MIXER' ? 'flex' : 'hidden'} md:flex h-full`}>
            <Mixer 
              eqA={eqState.A}
              eqB={eqState.B}
              onEqChange={handleEqChange}
              filterA={filterState.A}
              filterB={filterState.B}
              onFilterChange={handleFilterChange}
              crossfade={crossfade}
              onCrossfadeChange={handleCrossfadeChange}
              xfaderCurve={xfaderCurve}
              onXfaderCurveChange={handleXfaderCurveChange}
              volumeA={volumeState.A}
              volumeB={volumeState.B}
              onVolumeChange={handleVolumeChange}
              onOptimizeAudio={handleOptimizeAudio}
              onResetMixer={handleResetMixer}
            />
          </div>

          {/* Deck B */}
          <div className={`${viewMode === 'B' ? 'flex' : 'hidden'} md:flex h-full`}>
              <Deck 
                id="B" 
                trackUrl={trackInfo.B.url} 
                isPlaying={playingState.B} 
                isLoading={loadingState.B}
                onPlayPause={() => togglePlay('B')}
                onSync={() => handleSync('B')}
                playbackRate={playbackRates.B}
                onRateChange={(v) => handleRateChange('B', v)}
                onPitchBend={(v) => handlePitchBend('B', v)}
                fx={fxState.B}
                onFxChange={(type, val) => handleFxChange('B', type, val)}
                onPadTrigger={triggerSample}
                onRoll={(div) => handleRoll('B', div)}
                activeRoll={rollState.B}
                onSaveConfig={() => captureDeckConfig('B')}
                sourceType={deckSources.B}
                externalUrl={externalUrls.B}
                keyLock={keyLockState.B}
                onKeyLockToggle={() => handleKeyLockToggle('B')}
                gain={gainState.B}
                onGainChange={(v) => handleGainChange('B', v)}
                hotCues={hotCues[trackInfo.B.id || ''] || []}
                onHotCue={(i) => handleHotCue('B', i)}
                onClearCues={() => clearHotCues('B')}
                loop={loopState.B}
                onLoopIn={() => handleLoopIn('B')}
                onLoopOut={() => handleLoopOut('B')}
                onExitLoop={() => handleExitLoop('B')}
                resolvedVolume={getResolvedVolume('B')}
                onRewind={() => handleRewind('B')}
                onCuePress={() => handleCuePress('B')}
                onCueRelease={() => handleCueRelease('B')}
                isCueActive={isCueActive.B}
                onReverseToggle={() => handleReverseToggle('B')}
                isReversed={reverseStates.B}
                onScratchDrag={(sec) => handleScratchDrag('B', sec)}
                onScratchStart={() => handleScratchStart('B')}
                onScratchEnd={() => handleScratchEnd('B')}
              />
          </div>
        </div>
      </main>

      {/* BROWSER AREA */}
      <footer 
        style={{ 
          height: isTempExpanded ? '80%' : `${browserHeight}px`,
        }}
        className={`bg-[#0A0A0F] border-t border-white/10 grid grid-cols-[110px_1fr] lg:grid-cols-[200px_1fr] gap-4 flex-shrink-0 transition-[height] duration-300 ease-in-out relative z-40 ${isTempExpanded ? 'fixed bottom-0 left-0 w-full shadow-[0_-20px_50px_rgba(0,0,0,0.9)] p-4' : 'p-3'}`}
      >
        {/* Resize Handle / Splitter */}
        <div 
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          className="absolute -top-1 left-0 w-full h-2 cursor-ns-resize hover:bg-blue-500/20 active:bg-blue-500/40 z-50 transition-colors flex items-center justify-center group"
        >
            <div className="w-20 h-1 bg-white/5 rounded-full group-hover:bg-blue-400/40 group-active:bg-blue-400" />
        </div>

        <div className="border-r border-white/5 flex flex-col gap-3 pr-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase font-black tracking-widest text-white/30">LIBRARIES</div>
            <button 
              onClick={() => setIsTempExpanded(!isTempExpanded)}
              className={`p-1.5 rounded-md transition-all ${isTempExpanded ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-white/30 hover:text-white hover:bg-white/10'}`}
              title={isTempExpanded ? "Collapse Browser" : "Expand Overlay"}
            >
              {isTempExpanded ? <ChevronDown size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5">
            <div 
              onClick={() => setActiveLibraryTab('CRATES')}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'CRATES' ? 'text-blue-400 bg-blue-500/10 font-bold border border-blue-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <Disc3 size={12} /> CRATES
            </div>
            <div 
              onClick={() => setActiveLibraryTab('PLAYLIST')}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'PLAYLIST' ? 'text-purple-400 bg-purple-500/10 font-bold border border-purple-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <List size={12} /> PLAYLIST ({playlist.length})
            </div>
            <div 
              onClick={() => setActiveLibraryTab('FAVORITES')}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'FAVORITES' ? 'text-rose-400 bg-rose-500/10 font-bold border border-rose-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <Heart size={12} /> FAVORITES ({favorites.length})
            </div>
            <div 
              onClick={() => setActiveLibraryTab('HISTORY')}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'HISTORY' ? 'text-orange-400 bg-orange-500/10 font-bold border border-orange-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <Clock size={12} /> HISTORY ({history.length})
            </div>

            <div className="h-[1px] bg-white/5 my-2" />

            <div 
              onClick={() => setActiveLibraryTab('YOUTUBE')}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'YOUTUBE' ? 'text-red-500 bg-red-500/10 font-bold border border-red-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <Music size={12} /> YOUTUBE
            </div>

            <div 
              onClick={() => setActiveLibraryTab('SPOTIFY')}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'SPOTIFY' ? 'text-green-500 bg-green-500/10 font-bold border border-green-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <Music size={12} /> SPOTIFY
            </div>
            
            <div className="h-[1px] bg-white/5 my-2" />
            
            {['Audius Hits', 'House Classics', 'Deep Techno'].map((crate) => {
                const isActive = searchQuery === crate && activeLibraryTab === 'CRATES';
                return (
                  <div 
                    key={crate} 
                    onClick={() => {
                      setActiveLibraryTab('CRATES');
                      setSearchQuery(crate);
                      handleSearch(crate);
                    }}
                    className={`text-[10px] px-3 py-1.5 rounded cursor-pointer transition-all uppercase tracking-tighter flex items-center justify-between group ${isActive ? 'text-blue-400 bg-blue-500/10 font-bold border-r-2 border-blue-500' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}>
                      <span>- {crate}</span>
                      {isActive && <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]" />}
                  </div>
                );
            })}
          </div>
          <label className="mt-auto px-3 py-2 border border-dashed border-white/10 rounded text-[9px] font-mono text-center opacity-40 hover:opacity-100 cursor-pointer transition-all">
            LOAD FILE
            <input type="file" className="hidden" accept="audio/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadTrack('A', file.name, URL.createObjectURL(file));
            }} />
          </label>
        </div>

        <div className="overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-[10px] uppercase font-black tracking-widest text-white/30 truncate">
                        {searchQuery ? `AUDIUS RESULTS: "${searchQuery}"` : 'TRACK LIST'}
                    </div>
                    {isSearching && (
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                           <span className="text-[8px] font-mono text-blue-400/60 uppercase tracking-tighter">Connecting Audius...</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/5 rounded-md px-2 py-1">
                      <button 
                        onClick={exportPlaylist}
                        className="text-[9px] font-bold text-white/40 hover:text-blue-400 flex items-center gap-1 uppercase transition-colors"
                        title="Backup your session (Playlist + Favorites)"
                      >
                        <Save size={12} /> Backup Set
                      </button>
                      {activeLibraryTab === 'HISTORY' && (
                        <>
                          <div className="w-[1px] h-3 bg-white/10" />
                          <button 
                            onClick={() => {
                              const dataStr = JSON.stringify(history);
                              const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                              const linkElement = document.createElement('a');
                              linkElement.setAttribute('href', dataUri);
                              linkElement.setAttribute('download', 'play-history.json');
                              linkElement.click();
                            }}
                            className="text-[9px] font-bold text-white/40 hover:text-orange-400 flex items-center gap-1 uppercase transition-colors"
                          >
                            <Save size={12} /> Export History
                          </button>
                        </>
                      )}
                      <div className="w-[1px] h-3 bg-white/10" />
                      <label className="text-[9px] font-bold text-white/40 hover:text-orange-400 flex items-center gap-1 uppercase transition-colors cursor-pointer">
                        <ListPlus size={12} /> Import
                        <input type="file" className="hidden" accept=".json" onChange={importPlaylist} />
                      </label>
                    </div>
                    
                    <div className="relative w-40 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={12} />
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder="Search Audius Tracks..." 
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-9 pr-4 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/40 focus:bg-white/10 transition-all font-mono" 
                        />
                    </div>
                </div>
            </div>
            {activeLibraryTab === 'FAVORITES' && (
                <table className="w-full text-left border-separate border-spacing-y-1">
                    <thead>
                        <tr className="text-[9px] uppercase tracking-widest text-white/20">
                            <th className="px-3 pb-2 font-black">Title</th>
                            <th className="px-3 pb-2 font-black">Artist</th>
                            <th className="px-3 pb-2 font-black">Actions / Load</th>
                            <th className="px-3 pb-2 font-black hidden sm:table-cell">Details</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px]">
                        {favorites.length > 0 ? favorites.map(track => (
                            <tr key={track.id} className="group bg-rose-500/[0.02] hover:bg-rose-500/[0.05] border-l border-transparent hover:border-rose-500/40 transition-all text-white/70">
                                <td className="px-3 py-2 font-medium truncate max-w-[200px] flex items-center gap-2">
                                  <Heart size={10} fill="#f43f5e" className="text-rose-500" />
                                  {track.title}
                                </td>
                                <td className="px-3 py-2 text-white/40">{track.artist}</td>
                                <td className="px-3 py-2">
                                    <div className="flex gap-2">
                                        <button onClick={() => toggleFavorite(track)} className="p-1.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors" title="Remove Favorite"><Trash2 size={12} /></button>
                                        <button onClick={() => addToPlaylist(track)} className="p-1.5 rounded bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors" title="Add to Playlist"><ListPlus size={12} /></button>
                                        <div className="w-[1px] bg-white/10 mx-1" />
                                        <button onClick={() => loadTrack('A', track.title, track.id, track.isAudius, track.config)} className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold hover:bg-blue-600/40">LOAD A</button>
                                        <button onClick={() => loadTrack('B', track.title, track.id, track.isAudius, track.config)} className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold hover:bg-purple-600/40">LOAD B</button>
                                    </div>
                                </td>
                                <td className="px-3 py-2 font-mono text-white/20 hidden sm:table-cell"><Clock size={10} className="inline mr-1 opacity-40" /> FAVID</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={4} className="py-12 text-center text-white/20 italic font-mono text-[10px]">Your favorites will appear here. Heart a track to save it.</td></tr>
                          )}
                    </tbody>
                </table>
            )}

            {activeLibraryTab === 'PLAYLIST' && (
                <table className="w-full text-left border-separate border-spacing-y-1">
                    <thead>
                        <tr className="text-[9px] uppercase tracking-widest text-white/20">
                            <th className="px-3 pb-2 font-black">Title</th>
                            <th className="px-3 pb-2 font-black">Artist</th>
                            <th className="px-3 pb-2 font-black">Actions / Load</th>
                            <th className="px-3 pb-2 font-black hidden sm:table-cell">Details</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px]">
                        {playlist.length > 0 ? playlist.map((track, idx) => (
                            <tr key={`${track.id}-${idx}`} className="group bg-purple-500/[0.02] hover:bg-purple-500/[0.05] border-l border-transparent hover:border-purple-500/40 transition-all text-white/70">
                                <td className="px-3 py-2 font-medium truncate max-w-[200px] flex items-center gap-2">
                                  <span className="text-[8px] font-mono opacity-30">{idx + 1}.</span>
                                  {track.title}
                                </td>
                                <td className="px-3 py-2 text-white/40">{track.artist}</td>
                                <td className="px-3 py-2">
                                    <div className="flex gap-2">
                                        <button onClick={() => removeFromPlaylist(track.id)} className="p-1.5 rounded bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors" title="Remove from Playlist"><Trash2 size={12} /></button>
                                        <button onClick={() => toggleFavorite(track)} className={`p-1.5 rounded transition-colors ${favorites.find(f => f.id === track.id) ? 'bg-rose-500/20 text-rose-500' : 'bg-white/5 text-white/40 hover:bg-white/10'}`} title="Toggle Favorite"><Heart size={12} fill={favorites.find(f => f.id === track.id) ? 'currentColor' : 'none'} /></button>
                                        <div className="w-[1px] bg-white/10 mx-1" />
                                        <button onClick={() => loadTrack('A', track.title, track.id, track.isAudius, track.config)} className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold hover:bg-blue-600/40">LOAD A</button>
                                        <button onClick={() => loadTrack('B', track.title, track.id, track.isAudius, track.config)} className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold hover:bg-purple-600/40">LOAD B</button>
                                    </div>
                                </td>
                                <td className="px-3 py-2 font-mono text-white/20 hidden sm:table-cell">
                                  {track.config ? (
                                    <span className="text-green-500/60 flex items-center gap-1"><Save size={10} /> CONFIGURED</span>
                                  ) : (
                                    <span className="opacity-40">NO PRESET</span>
                                  )}
                                </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={4} className="py-12 text-center text-white/20 italic font-mono text-[10px]">Your mix playlist is empty. Add tracks to prepare your set.</td></tr>
                          )}
                    </tbody>
                </table>
            )}
            {activeLibraryTab === 'CRATES' && (
                <table className="w-full text-left border-separate border-spacing-y-1">
                    <thead>
                        <tr className="text-[9px] uppercase tracking-widest text-white/20">
                            <th className="px-3 pb-2 font-black">Title</th>
                            <th className="px-3 pb-2 font-black">Artist</th>
                            <th className="px-3 pb-2 font-black">Actions / Load</th>
                            <th className="px-3 pb-2 font-black hidden sm:table-cell">Details</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px]">
                        {searchQuery && audiusTracks.length > 0 ? (
                            audiusTracks.map(track => (
                                <tr key={track.id} className="group bg-white/[0.02] hover:bg-white/5 transition-all text-white/70">
                                    <td className="px-3 py-2 font-medium truncate max-w-[200px]">{track.title}</td>
                                    <td className="px-3 py-2 text-white/40">{track.user.name}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-1.5 items-center">
                                            <button 
                                              onClick={() => toggleFavorite({ id: track.id, title: track.title, artist: track.user.name, url: track.id, isAudius: true })} 
                                              className={`p-1.5 rounded transition-colors ${favorites.find(f => f.id === track.id) ? 'bg-rose-500/20 text-rose-500' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                            >
                                              <Heart size={12} fill={favorites.find(f => f.id === track.id) ? 'currentColor' : 'none'} />
                                            </button>
                                            <button 
                                              onClick={() => addToPlaylist({ id: track.id, title: track.title, artist: track.user.name, url: track.id, isAudius: true })} 
                                              className={`p-1.5 rounded transition-colors ${playlist.find(p => p.id === track.id) ? 'bg-purple-500/20 text-purple-500' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                            >
                                              <ListPlus size={12} />
                                            </button>
                                            <div className="w-[1px] bg-white/10 mx-1" />
                                            <button 
                                                disabled={loadingState.A}
                                                onClick={() => loadTrack('A', track.title, track.id, true)} 
                                                className={`px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold transition-all ${loadingState.A ? 'opacity-30 cursor-not-allowed' : 'hover:bg-blue-600/40'}`}
                                            >
                                                {loadingState.A ? '...' : 'A'}
                                            </button>
                                            <button 
                                                disabled={loadingState.B}
                                                onClick={() => loadTrack('B', track.title, track.id, true)} 
                                                className={`px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold transition-all ${loadingState.B ? 'opacity-30 cursor-not-allowed' : 'hover:bg-purple-600/40'}`}
                                            >
                                                {loadingState.B ? '...' : 'B'}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-white/20 hidden sm:table-cell">{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</td>
                                </tr>
                            ))
                        ) : (
                            DEFAULT_TRACKS.map(track => (
                                <tr key={track.id} className="group bg-white/[0.02] hover:bg-white/5 transition-all text-white/70">
                                    <td className="px-3 py-2 font-medium">{track.name}</td>
                                    <td className="px-3 py-2 text-white/40">System</td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-2 items-center">
                                            <button 
                                              onClick={() => toggleFavorite({ id: track.id, title: track.name, artist: 'System', url: track.url })} 
                                              className={`p-1.5 rounded transition-colors ${favorites.find(f => f.id === track.id) ? 'bg-rose-500/20 text-rose-500' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                            >
                                              <Heart size={12} fill={favorites.find(f => f.id === track.id) ? 'currentColor' : 'none'} />
                                            </button>
                                            <button 
                                              onClick={() => addToPlaylist({ id: track.id, title: track.name, artist: 'System', url: track.url })} 
                                              className={`p-1.5 rounded transition-colors ${playlist.find(p => p.id === track.id) ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                            >
                                              <ListPlus size={12} />
                                            </button>
                                            <div className="w-[1px] bg-white/10 mx-1" />
                                            <button onClick={() => loadTrack('A', track.name, track.url)} className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold hover:bg-blue-600/40">LOAD A</button>
                                            <button onClick={() => loadTrack('B', track.name, track.url)} className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold hover:bg-purple-600/40">LOAD B</button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-white/20 hidden sm:table-cell">PIXABAY</td>
                                </tr>
                            ))
                        )}
                        {searchQuery && audiusTracks.length === 0 && !isSearching && (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-white/20 italic text-[10px]">No tracks found for "{searchQuery}"</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}

            {activeLibraryTab === 'HISTORY' && (
                <table className="w-full text-left border-separate border-spacing-y-1">
                    <thead>
                        <tr className="text-[9px] uppercase tracking-widest text-white/20">
                            <th className="px-3 pb-2 font-black">Title</th>
                            <th className="px-3 pb-2 font-black">Artist</th>
                            <th className="px-3 pb-2 font-black text-right pr-6">Played At</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px]">
                        {history.length > 0 ? history.map((track, idx) => (
                            <tr key={`${track.id}-${idx}`} className="group bg-orange-500/[0.02] hover:bg-orange-500/[0.05] transition-all text-white/70">
                                <td className="px-3 py-2 font-medium truncate max-w-[200px]">{track.title}</td>
                                <td className="px-3 py-2 text-white/40">{track.artist}</td>
                                <td className="px-3 py-2 text-right pr-6 font-mono text-[9px] text-white/20 tabular-nums">
                                  {new Date(track.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={3} className="py-12 text-center text-white/20 italic font-mono text-[10px]">No tracks in history yet. Start mixing to track your session.</td></tr>
                          )}
                    </tbody>
                </table>
            )}

            {(activeLibraryTab === 'YOUTUBE' || activeLibraryTab === 'SPOTIFY') && (
              <div className="h-full flex flex-col items-center justify-center p-4 lg:p-8 max-w-xl mx-auto text-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${activeLibraryTab === 'YOUTUBE' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                      <Music size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold uppercase tracking-wider">{activeLibraryTab} External Link</h3>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      Paste a {activeLibraryTab} link below to load it into a deck. 
                    </p>
                  </div>
                  
                  <div className="w-full flex gap-2">
                    <input 
                      type="text" 
                      placeholder={`Enter ${activeLibraryTab} URL (e.g. https://...)...`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[11px] focus:outline-none focus:border-blue-500 transition-all font-mono"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleLoadExternalLink('A', (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                     <button 
                       onClick={() => {
                         const input = document.querySelector('input[placeholder*="Enter"]') as HTMLInputElement;
                         if (input.value) handleLoadExternalLink('A', input.value);
                       }}
                       className="px-4 py-2 rounded bg-blue-600/20 border border-blue-500/40 text-blue-400 text-[10px] font-bold uppercase hover:bg-blue-600/40 transition-all"
                     >
                       Load Deck A
                     </button>
                     <button 
                       onClick={() => {
                         const input = document.querySelector('input[placeholder*="Enter"]') as HTMLInputElement;
                         if (input.value) handleLoadExternalLink('B', input.value);
                       }}
                       className="px-4 py-2 rounded bg-purple-600/20 border border-purple-500/40 text-purple-400 text-[10px] font-bold uppercase hover:bg-purple-600/40 transition-all"
                     >
                       Load Deck B
                     </button>
                  </div>

                  <div className="mt-4 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20 max-w-md">
                     <div className="flex items-center gap-2 text-orange-400 text-[9px] font-bold uppercase mb-1">
                        <Info size={12} /> External Source Disclaimer
                     </div>
                     <p className="text-[9px] text-orange-400/60 leading-relaxed italic text-left">
                        Standard browser-based DJ effects like **Scratching, Pitch-Shifting, and EQ Isolators** are disabled for {activeLibraryTab} streams. These tracks will play at original speed and fidelity. {activeLibraryTab === 'YOUTUBE' ? 'Premium accounts bypass ads natively.' : 'Spotify requires active session in browser.'}
                     </p>
                  </div>
              </div>
            )}
        </div>
      </footer>
    </div>
  );
}
