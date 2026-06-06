/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { Music, Upload, Info, Settings, Search, Disc3, Headphones, ChevronUp, ChevronDown, Maximize2, LayoutGrid, List, Activity, Heart, ListPlus, Trash2, Star, Save, Clock, Download, Plus, FileText, BookOpen, ExternalLink, HelpCircle, Database } from 'lucide-react';
import { audioEngine } from './lib/audioEngine';
import { indexedDbCache } from './lib/indexedDbCache';
import Deck from './components/Deck';
import Mixer from './components/Mixer';
import Waveform from './components/Waveform';
import Visualizer from './components/Visualizer';
import OpManualReader from './components/OpManualReader';
import AudioDebugger from './components/AudioDebugger';
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

interface SavedExternalLink {
  id: string;
  title: string;
  url: string;
  isFavorite?: boolean;
  addedAt: number;
}

interface SavedExternalList {
  name: string;
  links: SavedExternalLink[];
}

const DEFAULT_TRACKS = [
  { id: '1', name: 'Deep Techno', url: 'https://cdn.pixabay.com/audio/2024/02/09/audio_653925c48b.mp3' },
  { id: '2', name: 'Melodic House', url: 'https://cdn.pixabay.com/audio/2023/10/25/audio_249df9c4d4.mp3' },
  { id: '3', name: 'Minimal Bass', url: 'https://cdn.pixabay.com/audio/2023/09/18/audio_6a20803c62.mp3' },
];

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [playingState, setPlayingState] = useState({ A: false, B: false });
  const [draggingWaveform, setDraggingWaveform] = useState<{ A: boolean; B: boolean }>({ A: false, B: false });
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
  const [loadingState, setLoadingState] = useState({ A: false, B: false });
  const [syncActive, setSyncActive] = useState({ A: false, B: false });
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeLoadingUrlRef = useRef<{ A: string | null, B: string | null }>({ A: null, B: null });
  const wasPlayingBeforeScratch = useRef<Record<'A' | 'B', boolean>>({ A: false, B: false });
  const tapTimestamps = useRef<{ A: number[], B: number[] }>({ A: [], B: [] });
  
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
  
  const [activeLibraryTab, setActiveLibraryTab] = useState<'CRATES' | 'PLAYLIST' | 'FAVORITES' | 'HISTORY' | 'YOUTUBE' | 'SPOTIFY' | 'MANUAL' | 'OFFLINE_CRATE'>('FAVORITES');
  const [cachedTrackIds, setCachedTrackIds] = useState<string[]>([]);
  const [cachedTracksMeta, setCachedTracksMeta] = useState<{ id: string; name: string; size: number; type: string; addedAt: number }[]>([]);

  const refreshOfflineCrate = useCallback(async () => {
    try {
      const metaList = await indexedDbCache.getAllTracksMetadata();
      setCachedTracksMeta(metaList);
      setCachedTrackIds(metaList.map(m => m.id));
    } catch (e) {
      console.warn("Failed to refresh offline crate", e);
    }
  }, []);

  useEffect(() => {
    refreshOfflineCrate();
  }, [refreshOfflineCrate]);

  const [deckSources, setDeckSources] = useState<{ A: 'AUDIO' | 'EXTERNAL', B: 'AUDIO' | 'EXTERNAL' }>({ A: 'AUDIO', B: 'AUDIO' });
  const [externalUrls, setExternalUrls] = useState<{ A: string | null, B: string | null }>({ A: null, B: null });

  const [externalLists, setExternalLists] = useState<SavedExternalList[]>(() => {
    try {
      const saved = localStorage.getItem('dj_external_lists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to parse external lists", e);
    }
    return [
      {
        name: "Manual Submissions",
        links: []
      }
    ];
  });

  const [externalUrlInput, setExternalUrlInput] = useState('');
  const [externalTitleInput, setExternalTitleInput] = useState('');
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({ "Manual Submissions": true });

  const [trackInfo, setTrackInfo] = useState({
    A: { title: 'READY', url: null as string | null, id: null as string | null, artist: null as string | null, duration: 0 },
    B: { title: 'READY', url: null as string | null, id: null as string | null, artist: null as string | null, duration: 0 },
  });
  const [eqState, setEqState] = useState({
    A: { low: 0, mid: 0, high: 0 },
    B: { low: 0, mid: 0, high: 0 },
  });
  const [filterState, setFilterState] = useState({ A: 0, B: 0 });
  const [volumeState, setVolumeState] = useState({ A: 0.33, B: 0.33 });
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
  const [eqKillState, setEqKillState] = useState({
    A: { low: false, mid: false, high: false },
    B: { low: false, mid: false, high: false },
  });
  const [deckBaseBpm, setDeckBaseBpm] = useState({ A: 128, B: 128 });
  const [slipModeState, setSlipModeState] = useState({ A: false, B: false });
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

  const loadTrack = async (deck: 'A' | 'B', name: string, urlOrId: string | File, isAudius = false, config?: TrackConfig) => {
    // Reset sync lock state on track load
    setSyncActive(prev => ({ ...prev, [deck]: false }));

    let finalUrl = '';
    let trackingKey = '';
    let savedId = '';
    let isLocalFile = false;

    if (typeof urlOrId !== 'string') {
      // It's a binary file uploaded directly in the current browser session
      const file = urlOrId as File;
      trackingKey = file.name + '_' + file.size;
      const fileId = 'local_' + file.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + file.size;
      
      // Auto cache to IndexedDB asynchronously so it does not block loading latency
      indexedDbCache.saveTrack(fileId, file.name, file.size, file.type, file)
        .then(() => {
          refreshOfflineCrate();
        })
        .catch((err) => {
          console.warn("Auto-caching input file to IndexedDB failed:", err);
        });
      
      finalUrl = URL.createObjectURL(file);
      savedId = 'indexeddb:' + fileId;
      isLocalFile = true;
    } else {
      trackingKey = urlOrId;
      
      if (urlOrId.startsWith('indexeddb:')) {
        const fileId = urlOrId.substring('indexeddb:'.length);
        setIsSearching(true);
        try {
          const cachedBlob = await indexedDbCache.getTrack(fileId);
          if (cachedBlob) {
            finalUrl = URL.createObjectURL(cachedBlob);
            savedId = urlOrId;
            isLocalFile = true;
          } else {
            throw new Error("Local file data not found in browser database. It might have been deleted or storage has been cleared.");
          }
        } catch (e: any) {
          setIsSearching(false);
          console.error(e);
          setLoadingState(prev => ({ ...prev, [deck]: false }));
          setTrackInfo(prev => ({
            ...prev,
            [deck]: { ...prev[deck], title: `NOT FOUND: RE-DRAG MP3` }
          }));
          alert(`Could not load cached file: ${e.message || e}\n\nPlease drag and drop the original file onto Deck ${deck} to re-index it. This happens if browser storage was cleared.`);
          return;
        }
        setIsSearching(false);
      } else {
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
          // Set loading state to true for Youtube/Spotify so play button is greyed out/shows loading indicator!
          setLoadingState(prev => ({ ...prev, [deck]: true }));
          // Robust Fallback: automatically clear loading state for external streams after 2 seconds
          // so if the sandboxed iframe delays browser ready events, the user is not locked out of interface controls.
          setTimeout(() => {
            setLoadingState(prev => ({ ...prev, [deck]: false }));
          }, 2000);
          return;
        }

        // Regular or Audius URL
        savedId = urlOrId;
        finalUrl = urlOrId;
      }
    }

    setDeckSources(prev => ({ ...prev, [deck]: 'AUDIO' }));
    setExternalUrls(prev => ({ ...prev, [deck]: null }));

    // Stop physical playing immediately so no music is left in the queue/background
    audioEngine.stop(deck);
    activeLoadingUrlRef.current[deck] = trackingKey;

    if (!isStarted) await startAudio();
    
    // Stop playing and set loading state
    setPlayingState(prev => ({ ...prev, [deck]: false }));
    setTrackInfo(prev => ({
      ...prev,
      [deck]: { ...prev[deck], title: `LOADING: ${name.toUpperCase()}` }
    }));
    setLoadingState(prev => ({ ...prev, [deck]: true }));

    try {
      let resolvedStreamUrl = finalUrl;
      if (isAudius && !savedId.startsWith('indexeddb:')) {
        setIsSearching(true);
        resolvedStreamUrl = await getAudiusStreamUrl(finalUrl);
        setIsSearching(false);
      }
      
      // If a newer load request has been made on this deck, ignore this old load request
      if (activeLoadingUrlRef.current[deck] !== trackingKey) {
        return;
      }
      
      if (!resolvedStreamUrl) throw new Error("Could not resolve stream URL");

      await audioEngine.loadTrack(deck, resolvedStreamUrl);
      
      // Check again if the load request was cancelled or overridden during the await!
      if (activeLoadingUrlRef.current[deck] !== trackingKey) {
        return;
      }
      
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
        [deck]: { title: name, url: resolvedStreamUrl, id: savedId, artist: isAudius ? 'Audius' : (isLocalFile ? 'Local MP3' : 'Sample'), duration: computedDuration } 
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
        [deck]: { title: name, url: resolvedStreamUrl, id: savedId, artist: isAudius ? 'Audius' : (isLocalFile ? 'Local MP3' : 'Sample'), duration: computedDuration }
      }));

      // Add to history
      setHistory(prev => {
        const item = { id: savedId, title: name, artist: isAudius ? 'Audius' : (isLocalFile ? 'Local MP3' : 'Sample'), url: savedId, addedAt: Date.now() };
        // Keep last 50 tracks
        const newHistory = [item, ...prev.filter(t => t.id !== savedId)].slice(0, 50);
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

  const handleEjectDeck = (deck: 'A' | 'B') => {
    // Clear active loading tracking key so pending loads are rejected/ignored
    activeLoadingUrlRef.current[deck] = null;

    // 1. Reset source back to AUDIO
    setDeckSources(prev => ({ ...prev, [deck]: 'AUDIO' }));
    setExternalUrls(prev => ({ ...prev, [deck]: null }));
    
    // 2. Clear loading and playing state
    setLoadingState(prev => ({ ...prev, [deck]: false }));
    setPlayingState(prev => ({ ...prev, [deck]: false }));
    
    // 3. Stop the audio engine
    audioEngine.stop(deck);
    
    // 4. Reset trackInfo to clear buffering state
    setTrackInfo(prev => ({
      ...prev,
      [deck]: { title: 'READY', url: null, id: '', artist: 'None', duration: 0 }
    }));
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

  const movePlaylistItem = (index: number, direction: 'up' | 'down') => {
    setPlaylist(prev => {
      const nextList = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < nextList.length) {
        const temp = nextList[index];
        nextList[index] = nextList[targetIndex];
        nextList[targetIndex] = temp;
      }
      return nextList;
    });
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

  useEffect(() => {
    localStorage.setItem('dj_external_lists', JSON.stringify(externalLists));
  }, [externalLists]);

  const togglePlay = (deck: 'A' | 'B') => {
    if (!trackInfo[deck].url || loadingState[deck]) return;
    const targetPlay = !playingState[deck];
    if (deckSources[deck] === 'AUDIO') {
      audioEngine.setPlaybackState(deck, targetPlay);
    }
    setPlayingState(prev => ({ ...prev, [deck]: targetPlay }));
  };

  const handleEqChange = (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', val: number) => {
    setEqState(prev => ({
      ...prev,
      [deck]: { ...prev[deck], [band]: val }
    }));
    // Only set audio engine EQ if not killed
    if (!eqKillState[deck][band]) {
      audioEngine.setEQ(deck, band, val);
    }
  };

  const handleEqKillToggle = (deck: 'A' | 'B', band: 'low' | 'mid' | 'high') => {
    setEqKillState(prev => {
      const nextKill = !prev[deck][band];
      const targetVal = nextKill ? -40 : eqState[deck][band];
      audioEngine.setEQ(deck, band, targetVal);
      return {
        ...prev,
        [deck]: { ...prev[deck], [band]: nextKill }
      };
    });
  };

  const handleBpmTap = (deck: 'A' | 'B') => {
    const now = Date.now();
    const timestamps = tapTimestamps.current[deck];
    
    // Reset tap list if more than 2 seconds since last tap
    if (timestamps.length > 0 && now - timestamps[timestamps.length - 1] > 2000) {
      timestamps.length = 0;
    }
    
    timestamps.push(now);
    
    if (timestamps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }
      const avgInterval = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
      const bpm = 60000 / avgInterval;
      setDeckBaseBpm(prev => ({
        ...prev,
        [deck]: Math.round(bpm * 10) / 10
      }));
    } else {
      setDeckBaseBpm(prev => ({
        ...prev,
        [deck]: 128
      }));
    }
  };

  const handleSlipToggle = (deck: 'A' | 'B') => {
    const nextSlip = !slipModeState[deck];
    setSlipModeState(prev => ({ ...prev, [deck]: nextSlip }));
    audioEngine.setSlipMode(deck, nextSlip);
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

  const handleHotCue = (deck: 'A' | 'B', index: number, action?: 'TRIGGER' | 'CLEAR') => {
    const trackId = trackInfo[deck].id;
    if (!trackId || deckSources[deck] === 'EXTERNAL') return;

    const currentTime = audioEngine.getPosition(deck);
    
    setHotCues(prev => {
      const trackCues = [...(prev[trackId] || [])];
      
      if (action === 'CLEAR') {
        const nextCues = [...trackCues];
        nextCues[index] = undefined as any;
        return { ...prev, [trackId]: nextCues };
      }

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
    if (deckSources[deck] === 'EXTERNAL') return;
    const pos = audioEngine.getPosition(deck);
    setLoopState(prev => ({
      ...prev,
      [deck]: { ...prev[deck], in: pos, active: false }
    }));
  };

  const handleLoopOut = (deck: 'A' | 'B') => {
    if (deckSources[deck] === 'EXTERNAL') return;
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
    if (deckSources[deck] === 'EXTERNAL') return;
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
    const fadeVal = crossfade;
    
    if (xfaderCurve <= 0.3) {
      // 1. Linear Crossfader Curve
      cfFactor = deck === 'A' ? (1 - fadeVal) : fadeVal;
    } else if (xfaderCurve <= 0.7) {
      // 2. Constant Power / Equal Gain Curve
      cfFactor = deck === 'A' ? Math.cos(fadeVal * Math.PI / 2) : Math.sin(fadeVal * Math.PI / 2);
    } else {
      // 3. Scratch / Battle Cut Curve
      if (deck === 'A') {
        cfFactor = fadeVal < 0.9 ? 1.0 : Math.max(0, Math.min(1, (1 - fadeVal) * 10));
      } else {
        cfFactor = fadeVal > 0.1 ? 1.0 : Math.max(0, Math.min(1, fadeVal * 10));
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
    audioEngine.setVolume('A', 0.33);
    audioEngine.setVolume('B', 0.33);
    setVolumeState({ A: 0.33, B: 0.33 });

    // 4. Reset Pre-fade Gain state to 1.0
    audioEngine.setGain('A', 1.0);
    audioEngine.setGain('B', 1.0);
    setGainState({ A: 1, B: 1 });

    // 5. Reset Crossfader & Curve
    audioEngine.setCrossfade(0.5);
    audioEngine.setCrossfaderCurve(0.5);
    setCrossfade(0.5);
    setXfaderCurve(0.5);

    // 6. Reset EQ Kills
    setEqKillState({
      A: { low: false, mid: false, high: false },
      B: { low: false, mid: false, high: false },
    });
  };

  const handleRewind = (deck: 'A' | 'B') => {
    if (deckSources[deck] === 'EXTERNAL') return;
    try {
      audioEngine.seek(deck, 0);
    } catch (e) {
      console.error(`Rewind failed on deck ${deck}:`, e);
    }
  };

  const handleCuePress = (deck: 'A' | 'B') => {
    if (!trackInfo[deck].url || loadingState[deck] || deckSources[deck] === 'EXTERNAL') return;
    try {
      const isCurrentlyPlaying = playingState[deck];
      if (isCurrentlyPlaying) {
        audioEngine.setPlaybackState(deck, false);
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
        audioEngine.setPlaybackState(deck, true);
      }
    } catch (e) {
      console.error(`Cue press error on deck ${deck}:`, e);
    }
  };

  const handleCueRelease = (deck: 'A' | 'B') => {
    if (!trackInfo[deck].url || loadingState[deck] || deckSources[deck] === 'EXTERNAL') return;
    try {
      if (isCueActive[deck]) {
        setIsCueActive(prev => ({ ...prev, [deck]: false }));
        if (!playingState[deck]) {
          audioEngine.setPlaybackState(deck, false);
          audioEngine.seek(deck, cuePointsRef.current[deck]);
        }
      }
    } catch (e) {
      console.error(`Cue release error on deck ${deck}:`, e);
    }
  };

  const handleReverseToggle = (deck: 'A' | 'B') => {
    if (deckSources[deck] === 'EXTERNAL') return;
    try {
      const targetState = !reverseStates[deck];
      audioEngine.setReverse(deck, targetState);
      setReverseStates(prev => ({ ...prev, [deck]: targetState }));
    } catch (e) {
      console.error(`Reverse toggle error on deck ${deck}:`, e);
    }
  };

  const handleScratchDrag = (deck: 'A' | 'B', deltaSeconds: number) => {
    if (deckSources[deck] === 'EXTERNAL') return;
    try {
      audioEngine.scratchSeek(deck, deltaSeconds);
    } catch (e) {
      console.error(`Scratch drag error on deck ${deck}:`, e);
    }
  };

  const handleScratchStart = (deck: 'A' | 'B') => {
    if (deckSources[deck] === 'EXTERNAL') return;
    try {
      wasPlayingBeforeScratch.current[deck] = playingState[deck];
      if (playingState[deck]) {
        if (slipModeState[deck]) {
          audioEngine.startSlip(deck);
        }
        audioEngine.setPlaybackState(deck, false);
      }
    } catch (e) {
      console.error(`Scratch start error on deck ${deck}:`, e);
    }
  };

  const handleScratchEnd = (deck: 'A' | 'B') => {
    if (deckSources[deck] === 'EXTERNAL') return;
    try {
      // Restore normal playbackRate and reverse direction
      audioEngine.endScratch(deck, reverseStates[deck]);
      
      if (wasPlayingBeforeScratch.current[deck]) {
        if (slipModeState[deck]) {
          audioEngine.resolveSlip(deck);
        }
        audioEngine.setPlaybackState(deck, true);
      } else {
        audioEngine.setPlaybackState(deck, false);
      }
    } catch (e) {
      console.error(`Scratch end error on deck ${deck}:`, e);
    }
  };

  const handleSkip = (deck: 'A' | 'B', seconds: number) => {
    if (deckSources[deck] === 'EXTERNAL') return;
    try {
      const current = audioEngine.getPosition(deck);
      const player = audioEngine.getDeck(deck);
      if (player && player.buffer && player.buffer.loaded) {
        const duration = player.buffer.duration || 0;
        let target = current + seconds;
        if (target < 0) target = 0;
        if (target > duration) target = duration - 0.05;
        audioEngine.seek(deck, target);
      }
    } catch (e) {
      console.error(`Error skipping on deck ${deck}:`, e);
    }
  };

  const handleWaveformSeek = (deck: 'A' | 'B', time: number) => {
    if (deckSources[deck] === 'EXTERNAL') return;
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
    setSyncActive(prev => ({ ...prev, [deck]: false }));
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
    // Sync only functions if both decks have active track URLs
    if (!trackInfo.A.url || !trackInfo.B.url) return;
    const sourceRate = playbackRates[sourceDeck];
    
    audioEngine.setPlaybackRate(targetDeck, sourceRate);
    setPlaybackRates(prev => ({ ...prev, [targetDeck]: sourceRate }));
    setSyncActive({ A: true, B: true });
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
      if (rollState[deck]) {
        audioEngine.clearLoop(deck);
      }
      setRollState(prev => ({ ...prev, [deck]: null }));
      return;
    }

    const pos = audioEngine.getPosition(deck);
    const beatLen = 60 / baseBpm;
    const loopLen = beatLen * (division === '1/4' ? 0.25 : (division === '1/8' ? 0.125 : 0.0625));
    
    audioEngine.setLoop(deck, pos, pos + loopLen);
    audioEngine.seek(deck, pos);
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

  const getCleanTitleFromUrl = (url: string, provider: string): string => {
    try {
      const u = new URL(url);
      if (provider === 'YouTube') {
        const v = u.searchParams.get('v');
        if (v) return `YouTube Track [${v}]`;
        if (u.pathname && u.pathname !== '/') return `YouTube Track [${u.pathname.split('/').pop()}]`;
      } else if (provider === 'Spotify') {
        const match = u.pathname.match(/\/(track|playlist|album)\/([a-zA-Z0-9]+)/);
        if (match) return `Spotify ${match[1].toUpperCase()} [${match[2].substring(0, 6)}]`;
      }
    } catch (_) {}
    return `${provider} Stream`;
  };

  const handleLoadExternalLink = (deck: 'A' | 'B', url: string, customTitle?: string) => {
    if (!url) return;
    const type = url.includes('youtube') || url.includes('youtu.be') ? 'YouTube' : 'Spotify';
    const finalTitle = customTitle || externalTitleInput.trim() || getCleanTitleFromUrl(url, type);
    
    // Load track onto the deck
    loadTrack(deck, finalTitle, url);
    
    // Auto-save to 'Manual Submissions' if not already present in ANY of the lists
    const linkExists = externalLists.some(list => list.links.some(lnk => lnk.url.trim() === url.trim()));
    if (!linkExists) {
      const newLnk: SavedExternalLink = {
        id: 'ext-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: finalTitle,
        url: url.trim(),
        isFavorite: false,
        addedAt: Date.now()
      };
      
      setExternalLists(prev => {
        const next = [...prev];
        const manualIdx = next.findIndex(l => l.name === 'Manual Submissions');
        if (manualIdx !== -1) {
          next[manualIdx] = {
            ...next[manualIdx],
            links: [newLnk, ...next[manualIdx].links]
          };
        } else {
          next.unshift({
            name: 'Manual Submissions',
            links: [newLnk]
          });
        }
        return next;
      });
    }
    
    // Reset/clear custom input states
    setExternalUrlInput('');
    setExternalTitleInput('');
  };

  const handleAddNewExternalLinkOnly = () => {
    const url = externalUrlInput.trim();
    if (!url) return;
    const type = url.includes('youtube') || url.includes('youtu.be') ? 'YouTube' : 'Spotify';
    const finalTitle = externalTitleInput.trim() || getCleanTitleFromUrl(url, type);
    
    const newLnk: SavedExternalLink = {
      id: 'ext-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      title: finalTitle,
      url: url,
      isFavorite: false,
      addedAt: Date.now()
    };

    setExternalLists(prev => {
      const next = [...prev];
      const manualIdx = next.findIndex(l => l.name === 'Manual Submissions');
      if (manualIdx !== -1) {
        next[manualIdx] = {
          ...next[manualIdx],
          links: [newLnk, ...next[manualIdx].links]
        };
      } else {
        next.unshift({
          name: 'Manual Submissions',
          links: [newLnk]
        });
      }
      return next;
    });

    setExternalUrlInput('');
    setExternalTitleInput('');
  };

  const toggleExternalLinkFavorite = (listName: string, linkId: string) => {
    setExternalLists(prev => prev.map(lst => {
      if (lst.name !== listName) return lst;
      return {
        ...lst,
        links: lst.links.map(lnk => {
          if (lnk.id !== linkId) return lnk;
          return { ...lnk, isFavorite: !lnk.isFavorite };
        })
      };
    }));
  };

  const deleteExternalLink = (listName: string, linkId: string) => {
    setExternalLists(prev => prev.map(lst => {
      if (lst.name !== listName) return lst;
      return {
        ...lst,
        links: lst.links.filter(lnk => lnk.id !== linkId)
      };
    }));
  };

  const deleteExternalList = (listName: string) => {
    if (listName === 'Manual Submissions') {
      setExternalLists(prev => prev.map(lst => {
        if (lst.name !== 'Manual Submissions') return lst;
        return { ...lst, links: [] };
      }));
    } else {
      setExternalLists(prev => prev.filter(lst => lst.name !== listName));
    }
  };

  const clearAllExternalLists = () => {
    setExternalLists([
      {
        name: "Manual Submissions",
        links: []
      }
    ]);
  };

  const exportExternalLists = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(externalLists, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "dj_external_links_tracker.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importExternalListFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      const fileName = file.name;
      const cleanFileName = fileName.replace(/\.[^/.]+$/, "");
      
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          if (fileName.endsWith('.json')) {
            const parsed = JSON.parse(content);
            
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && 'name' in item && 'links' in item)) {
              setExternalLists(prev => {
                const next = [...prev];
                parsed.forEach(importedList => {
                  const existingIdx = next.findIndex(l => l.name === importedList.name);
                  if (existingIdx !== -1) {
                    const uniqueLinks = [...importedList.links];
                    next[existingIdx] = {
                      ...next[existingIdx],
                      links: [...uniqueLinks, ...next[existingIdx].links.filter(el => !uniqueLinks.some(ul => ul.url === el.url))]
                    };
                  } else {
                    next.push(importedList);
                  }
                });
                return next;
              });
            }
            else if (typeof parsed === 'object' && parsed !== null && 'links' in parsed) {
              const listName = parsed.name || cleanFileName;
              const linksList = Array.isArray(parsed.links) ? parsed.links : [];
              setExternalLists(prev => {
                const next = [...prev];
                const existingIdx = next.findIndex(l => l.name === listName);
                const processedLinks: SavedExternalLink[] = linksList.map((lnk: any, i: number) => ({
                  id: lnk.id || `lnk-${Date.now()}-${i}-${Math.random().toString(36).substring(2,5)}`,
                  title: lnk.title || getCleanTitleFromUrl(lnk.url || '', 'External'),
                  url: lnk.url || '',
                  isFavorite: !!lnk.isFavorite,
                  addedAt: lnk.addedAt || Date.now()
                })).filter((l: any) => l.url);

                if (existingIdx !== -1) {
                  next[existingIdx] = {
                    ...next[existingIdx],
                    links: [...processedLinks, ...next[existingIdx].links.filter(el => !processedLinks.some(pl => pl.url === el.url))]
                  };
                } else {
                  next.push({ name: listName, links: processedLinks });
                }
                return next;
              });
            }
            else if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && 'url' in item)) {
              setExternalLists(prev => {
                const next = [...prev];
                const existingIdx = next.findIndex(l => l.name === cleanFileName);
                const processedLinks: SavedExternalLink[] = parsed.map((lnk: any, i: number) => ({
                  id: lnk.id || `lnk-${Date.now()}-${i}`,
                  title: lnk.title || getCleanTitleFromUrl(lnk.url, 'External'),
                  url: lnk.url,
                  isFavorite: !!lnk.isFavorite,
                  addedAt: Date.now()
                }));

                if (existingIdx !== -1) {
                  next[existingIdx] = {
                    ...next[existingIdx],
                    links: [...processedLinks, ...next[existingIdx].links.filter(el => !processedLinks.some(pl => pl.url === el.url))]
                  };
                } else {
                  next.push({ name: cleanFileName, links: processedLinks });
                }
                return next;
              });
            }
            else if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
              setExternalLists(prev => {
                const next = [...prev];
                const existingIdx = next.findIndex(l => l.name === cleanFileName);
                const processedLinks: SavedExternalLink[] = parsed.map((url: string, i: number) => {
                  const type = url.includes('youtube') || url.includes('youtu.be') ? 'YouTube' : 'Spotify';
                  return {
                    id: `lnk-${Date.now()}-${i}`,
                    title: getCleanTitleFromUrl(url, type),
                    url,
                    isFavorite: false,
                    addedAt: Date.now()
                  };
                });

                if (existingIdx !== -1) {
                  next[existingIdx] = {
                    ...next[existingIdx],
                    links: [...processedLinks, ...next[existingIdx].links.filter(el => !processedLinks.some(pl => pl.url === el.url))]
                  };
                } else {
                  next.push({ name: cleanFileName, links: processedLinks });
                }
                return next;
              });
            }
          } else {
            const lines = content.split('\n');
            const processedLinks: SavedExternalLink[] = [];
            let currentLineIndex = 0;
            
            lines.forEach(line => {
              const trimmed = line.trim();
              if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                const type = trimmed.includes('youtube') || trimmed.includes('youtu.be') ? 'YouTube' : 'Spotify';
                processedLinks.push({
                  id: `lnk-${Date.now()}-${currentLineIndex++}`,
                  title: getCleanTitleFromUrl(trimmed, type),
                  url: trimmed,
                  isFavorite: false,
                  addedAt: Date.now()
                });
              }
            });

            if (processedLinks.length > 0) {
              setExternalLists(prev => {
                const next = [...prev];
                const existingIdx = next.findIndex(l => l.name === cleanFileName);
                if (existingIdx !== -1) {
                  next[existingIdx] = {
                    ...next[existingIdx],
                    links: [...processedLinks, ...next[existingIdx].links.filter(el => !processedLinks.some(pl => pl.url === el.url))]
                  };
                } else {
                  next.push({ name: cleanFileName, links: processedLinks });
                }
                return next;
              });
            }
          }
        } catch (err) {
          console.error("Failed to parse file", err);
          alert("Error importing list content. Ensure proper formatting.");
        }
      };
      
      reader.readAsText(file);
    });
    
    e.target.value = '';
  };

  const triggerSample = async (name: string) => {
    if (!isStarted) {
      await startAudio();
    }
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
          <div 
            key={deck} 
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingWaveform(prev => ({ ...prev, [deck]: true }));
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingWaveform(prev => ({ ...prev, [deck]: false }));
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingWaveform(prev => ({ ...prev, [deck]: false }));
              const file = e.dataTransfer.files?.[0];
              if (file) {
                loadTrack(deck, file.name, file);
              }
            }}
            className="relative h-full bg-[#0D0D12] overflow-hidden rounded border border-white/5 group"
          >
            {/* Visual drag overlay for waveform cards */}
            {draggingWaveform[deck] && (
              <div className={`absolute inset-0 z-50 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed p-2 text-center transition-all ${
                deck === 'A' 
                  ? 'bg-blue-950/80 border-blue-400 text-blue-300' 
                  : 'bg-purple-950/80 border-purple-400 text-purple-300'
              }`}>
                <Upload className="w-6 h-6 mb-1 animate-bounce" size={24} />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  DROP TO LOAD DECK {deck}
                </p>
              </div>
            )}

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
                sourceType={deckSources[deck]}
              />
            </div>
            
            <div className={`absolute top-2 left-3 z-20 text-[10px] font-black italic tracking-[0.1em] uppercase transition-all ${playingState[deck] ? (deck === 'A' ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]') : (trackInfo[deck].url ? 'text-white/80' : 'text-white/20')}`}>
              DECK {deck} // {trackInfo[deck].title || 'READY'}
            </div>
            
            {/* Small status badges */}
            <div className="absolute top-1 right-2 z-20 flex gap-2 items-center">
                {trackInfo[deck].url && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEjectDeck(deck);
                      }}
                      title={`Eject and reset Deck ${deck}`}
                      className="px-1.5 py-0.5 rounded bg-red-950/40 hover:bg-red-500 hover:text-white border border-red-500/20 text-[7.5px] font-black uppercase tracking-wider transition-all shadow-[0_2px_8px_rgba(239,68,68,0.2)] cursor-pointer"
                    >
                      EJECT
                    </button>
                )}
                {playingState[deck] && (
                    <div className="flex items-center gap-1">
                        <Activity size={8} className="text-green-500 animate-pulse" />
                        <span className="text-[7px] text-green-500/60 font-mono">LIVE</span>
                    </div>
                )}
            </div>

            {loadingState[deck] && deckSources[deck] !== 'EXTERNAL' && (
              <div className="absolute inset-0 z-30 bg-[#070709]/85 backdrop-blur-[3px] flex flex-col items-center justify-center border border-white/5">
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-5 h-5 border-2 border-t-transparent animate-spin rounded-full ${deck === 'A' ? 'border-blue-400' : 'border-purple-400'}`} />
                  <span className={`text-[8px] uppercase font-black tracking-widest font-mono select-none ${deck === 'A' ? 'text-blue-400' : 'text-purple-400'}`}>
                    ANALYZING & BUFFERING WAVEFORM...
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEjectDeck(deck);
                    }}
                    className="mt-1 px-2.5 py-1 rounded bg-red-950/50 hover:bg-red-500 hover:text-white border border-red-500/20 text-[7.5px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-[0_2px_8px_rgba(239,68,68,0.2)] active:scale-95"
                    title="Cancel loading and purge buffer"
                  >
                    CANCEL / PURGE
                  </button>
                </div>
              </div>
            )}
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

        <div className="h-full w-full hardware-surface grid md:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] px-2 md:px-4 py-1 md:py-2 gap-2 md:gap-4 relative">
          {/* Deck A */}
          <div className={`${viewMode === 'A' ? 'flex' : 'hidden'} md:flex h-full`}>
                <Deck 
                  id="A" 
                  trackUrl={trackInfo.A.url} 
                  trackTitle={trackInfo.A.title || 'READY'}
                  trackArtist={trackInfo.A.artist}
                  onFileDrop={(file) => loadTrack('A', file.name, file)}
                  isPlaying={playingState.A} 
                  isLoading={loadingState.A}
                  onPlayerReady={() => setLoadingState(prev => ({ ...prev, A: false }))}
                  onPlayerBuffer={() => setLoadingState(prev => ({ ...prev, A: true }))}
                  onPlayerPlay={() => setPlayingState(prev => ({ ...prev, A: true }))}
                  onPlayerPause={() => setPlayingState(prev => ({ ...prev, A: false }))}
                  onPlayPause={() => togglePlay('A')}
                  onSync={() => handleSync('A')}
                  isSynced={syncActive.A && playingState.A && playingState.B && !!trackInfo.A.url && !!trackInfo.B.url}
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
                  onHotCue={(i, act) => handleHotCue('A', i, act)}
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
                  onEject={() => handleEjectDeck('A')}
                  onSkip={(sec) => handleSkip('A', sec)}
                  baseBpm={deckBaseBpm.A}
                  onBpmTap={() => handleBpmTap('A')}
                  isSlipActive={slipModeState.A}
                  onSlipToggle={() => handleSlipToggle('A')}
                  isFavorite={favorites.some(f => f.id === trackInfo.A.id)}
                  onToggleFavorite={() => {
                    if (trackInfo.A.id) {
                      toggleFavorite({
                        id: trackInfo.A.id,
                        title: trackInfo.A.title || 'Unknown Title',
                        artist: trackInfo.A.artist || 'Local MP3',
                        url: trackInfo.A.url || ''
                      });
                    }
                  }}
                />
          </div>

          {/* Mixer */}
          <div className={`${viewMode === 'MIXER' ? 'flex' : 'hidden'} md:flex h-full`}>
            <Mixer 
              eqA={eqState.A}
              eqB={eqState.B}
              onEqChange={handleEqChange}
              eqKillA={eqKillState.A}
              eqKillB={eqKillState.B}
              onEqKillToggle={handleEqKillToggle}
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
                trackTitle={trackInfo.B.title || 'READY'}
                trackArtist={trackInfo.B.artist}
                onFileDrop={(file) => loadTrack('B', file.name, file)}
                isPlaying={playingState.B} 
                isLoading={loadingState.B}
                onPlayerReady={() => setLoadingState(prev => ({ ...prev, B: false }))}
                onPlayerBuffer={() => setLoadingState(prev => ({ ...prev, B: true }))}
                onPlayerPlay={() => setPlayingState(prev => ({ ...prev, B: true }))}
                onPlayerPause={() => setPlayingState(prev => ({ ...prev, B: false }))}
                onPlayPause={() => togglePlay('B')}
                onSync={() => handleSync('B')}
                isSynced={syncActive.B && playingState.A && playingState.B && !!trackInfo.A.url && !!trackInfo.B.url}
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
                onHotCue={(i, act) => handleHotCue('B', i, act)}
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
                onEject={() => handleEjectDeck('B')}
                onSkip={(sec) => handleSkip('B', sec)}
                baseBpm={deckBaseBpm.B}
                onBpmTap={() => handleBpmTap('B')}
                isSlipActive={slipModeState.B}
                onSlipToggle={() => handleSlipToggle('B')}
                isFavorite={favorites.some(f => f.id === trackInfo.B.id)}
                onToggleFavorite={() => {
                  if (trackInfo.B.id) {
                    toggleFavorite({
                      id: trackInfo.B.id,
                      title: trackInfo.B.title || 'Unknown Title',
                      artist: trackInfo.B.artist || 'Local MP3',
                      url: trackInfo.B.url || ''
                    });
                  }
                }}
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
              onClick={() => {
                setActiveLibraryTab('CRATES');
                setSearchQuery('');
                setAudiusTracks([]);
              }}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'CRATES' && !searchQuery ? 'text-blue-400 bg-blue-500/10 font-bold border border-blue-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <Disc3 size={12} /> CRATES / SYSTEM
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
            <div 
              onClick={() => setActiveLibraryTab('MANUAL')}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'MANUAL' ? 'text-indigo-400 bg-indigo-500/10 font-bold border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.15)]' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <BookOpen size={12} /> Manual/Ref
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

            <div 
              onClick={() => setActiveLibraryTab('OFFLINE_CRATE')}
              className={`text-[11px] px-3 py-2 rounded cursor-pointer transition-all flex items-center gap-2 ${activeLibraryTab === 'OFFLINE_CRATE' ? 'text-teal-400 bg-teal-500/10 font-bold border border-teal-500/20 shadow-[0_0_10px_rgba(20,184,166,0.15)]' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                <Database size={12} /> OFFLINE CRATE ({cachedTrackIds.length})
            </div>
            
            <div className="h-[1px] bg-white/5 my-2" />
            
            {['System Samples', 'Audius Hits', 'House Classics', 'Deep Techno'].map((crate) => {
                const isActive = crate === 'System Samples' 
                  ? (searchQuery === '' && activeLibraryTab === 'CRATES')
                  : (searchQuery === crate && activeLibraryTab === 'CRATES');
                return (
                  <div 
                    key={crate} 
                    onClick={() => {
                      setActiveLibraryTab('CRATES');
                      if (crate === 'System Samples') {
                        setSearchQuery('');
                        setAudiusTracks([]);
                      } else {
                        setSearchQuery(crate);
                        handleSearch(crate);
                      }
                    }}
                    className={`text-[10px] px-3 py-1.5 rounded cursor-pointer transition-all uppercase tracking-tighter flex items-center justify-between group ${isActive ? 'text-blue-400 bg-blue-500/10 font-bold border-r-2 border-blue-500' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}>
                      <span>- {crate}</span>
                      {isActive && <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]" />}
                  </div>
                );
            })}
          </div>
          <label className="mt-auto px-3 py-2 border border-dashed border-white/10 rounded text-[9px] font-mono text-center opacity-40 hover:opacity-100 cursor-pointer transition-all">
            LOAD FILE (DECK A)
            <input type="file" className="hidden" accept="audio/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadTrack('A', file.name, file);
            }} />
          </label>
        </div>

        <div className="overflow-hidden flex flex-col gap-3 h-full min-h-0">
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
                                        <button 
                                          disabled={idx === 0} 
                                          onClick={() => movePlaylistItem(idx, 'up')} 
                                          className="p-1.5 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer" 
                                          title="Move Up"
                                        >
                                          <ChevronUp size={12} />
                                        </button>
                                        <button 
                                          disabled={idx === playlist.length - 1} 
                                          onClick={() => movePlaylistItem(idx, 'down')} 
                                          className="p-1.5 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer" 
                                          title="Move Down"
                                        >
                                          <ChevronDown size={12} />
                                        </button>
                                        <div className="w-[1px] bg-white/10 mx-0.5" />
                                        <button onClick={() => removeFromPlaylist(track.id)} className="p-1.5 rounded bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors cursor-pointer" title="Remove from Playlist"><Trash2 size={12} /></button>
                                        <button onClick={() => toggleFavorite(track)} className={`p-1.5 rounded transition-colors cursor-pointer ${favorites.find(f => f.id === track.id) ? 'bg-rose-500/20 text-rose-500' : 'bg-white/5 text-white/40 hover:bg-white/10'}`} title="Toggle Favorite"><Heart size={12} fill={favorites.find(f => f.id === track.id) ? 'currentColor' : 'none'} /></button>
                                        <div className="w-[1px] bg-white/10 mx-0.5" />
                                        <button onClick={() => loadTrack('A', track.title, track.id, track.isAudius, track.config)} className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold hover:bg-blue-600/40 cursor-pointer">LOAD A</button>
                                        <button onClick={() => loadTrack('B', track.title, track.id, track.isAudius, track.config)} className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold hover:bg-purple-600/40 cursor-pointer">LOAD B</button>
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

            {activeLibraryTab === 'OFFLINE_CRATE' && (
                <div className="space-y-4 w-full">
                    {/* Offline Import Area */}
                    <div className="p-4 rounded-lg bg-teal-500/[0.02] border border-teal-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-left">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400">Offline Crate Storage</h4>
                            <p className="text-[10px] text-white/40 leading-relaxed max-w-xl">
                                Import and cache custom audio files (MP3, WAV, FLAC, OGG, etc.) directly in your browser's persistent IndexedDB cache database. These tracks remain available offline.
                            </p>
                        </div>
                        <div className="flex-shrink-0">
                            <input 
                              type="file" 
                              id="offline-crate-upload-input" 
                              accept="audio/*" 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const fileId = 'local_' + file.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + file.size;
                                  try {
                                    await indexedDbCache.saveTrack(fileId, file.name, file.size, file.type, file);
                                    await refreshOfflineCrate();
                                  } catch (err: any) {
                                    alert("Failed to cache audio file: " + err.message);
                                  }
                                }
                              }} 
                              className="hidden"
                            />
                            <button
                              onClick={() => document.getElementById('offline-crate-upload-input')?.click()}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] rounded bg-teal-500/15 border border-teal-500/30 text-teal-400 hover:bg-teal-500/25 active:scale-95 transition-all font-bold cursor-pointer font-sans"
                            >
                              <Plus size={11} /> ADD TRACK TO CRATE
                            </button>
                        </div>
                    </div>

                    {/* Offline Tracks list */}
                    <table className="w-full text-left border-separate border-spacing-y-1">
                        <thead>
                            <tr className="text-[9px] uppercase tracking-widest text-white/20">
                                <th className="px-3 pb-2 font-black">Track Name</th>
                                <th className="px-3 pb-2 font-black">Size</th>
                                <th className="px-3 pb-2 font-black">Actions / Load</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px]">
                            {cachedTracksMeta.length > 0 ? cachedTracksMeta.map((track) => {
                                const trackFullId = 'indexeddb:' + track.id;
                                const isFav = favorites.some(f => f.id === trackFullId);
                                const isInPlaylist = playlist.some(p => p.id === trackFullId);
                                return (
                                    <tr key={track.id} className="group bg-white/[0.01] hover:bg-white/[0.03] transition-all text-white/70">
                                        <td className="px-3 py-2 font-medium truncate max-w-[280px]" title={track.name}>
                                          {track.name}
                                        </td>
                                        <td className="px-3 py-2 text-white/40 font-mono text-[10px]">
                                          {(track.size / (1024 * 1024)).toFixed(1)} MB
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex gap-1.5 items-center">
                                                {/* Favorite Button */}
                                                <button 
                                                  onClick={() => toggleFavorite({ 
                                                    id: trackFullId, 
                                                    title: track.name, 
                                                    artist: 'Local MP3', 
                                                    url: trackFullId 
                                                  })} 
                                                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                                                    isFav ? 'bg-rose-500/20 text-rose-500' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                                  }`}
                                                  title="Toggle Favorite"
                                                >
                                                  <Heart size={12} fill={isFav ? 'currentColor' : 'none'} />
                                                </button>

                                                {/* Add to Playlist Button */}
                                                <button 
                                                  onClick={() => addToPlaylist({ 
                                                    id: trackFullId, 
                                                    title: track.name, 
                                                    artist: 'Local MP3', 
                                                    url: trackFullId 
                                                  })} 
                                                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                                                    isInPlaylist ? 'bg-purple-500/20 text-purple-500' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                                  }`}
                                                  title="Add to Playlist"
                                                >
                                                  <ListPlus size={12} />
                                                </button>

                                                {/* Delete Button */}
                                                <button 
                                                  onClick={async () => {
                                                    if (window.confirm(`Delete ${track.name} from offline cache?`)) {
                                                      try {
                                                        await indexedDbCache.deleteTrack(track.id);
                                                        await refreshOfflineCrate();
                                                      } catch (err: any) {
                                                        alert("Failed to delete track: " + err.message);
                                                      }
                                                    }
                                                  }} 
                                                  className="p-1.5 rounded bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
                                                  title="Delete from cache"
                                                >
                                                  <Trash2 size={12} />
                                                </button>

                                                <div className="w-[1px] bg-white/10 mx-1" />

                                                {/* Load Deck A */}
                                                <button 
                                                  onClick={() => loadTrack('A', track.name, trackFullId)} 
                                                  className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold hover:bg-blue-600/40 active:scale-95 transition-all cursor-pointer"
                                                  title="Load to Deck A"
                                                >
                                                  {loadingState.A && trackInfo.A.id === trackFullId ? '...' : 'LOAD A'}
                                                </button>

                                                {/* Load Deck B */}
                                                <button 
                                                  onClick={() => loadTrack('B', track.name, trackFullId)} 
                                                  className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold hover:bg-purple-600/40 active:scale-95 transition-all cursor-pointer"
                                                  title="Load to Deck B"
                                                >
                                                  {loadingState.B && trackInfo.B.id === trackFullId ? '...' : 'LOAD B'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center text-white/20 italic font-mono text-[10px]">
                                        No tracks stored in your offline crate. Click "ADD TRACK TO CRATE" above to save music for offline sessions.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
                                                onClick={() => loadTrack('A', track.title, track.id, true)} 
                                                className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold transition-all hover:bg-blue-600/40"
                                            >
                                                {loadingState.A && trackInfo.A.id === track.id ? '...' : 'A'}
                                            </button>
                                            <button 
                                                onClick={() => loadTrack('B', track.title, track.id, true)} 
                                                className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold transition-all hover:bg-purple-600/40"
                                            >
                                                {loadingState.B && trackInfo.B.id === track.id ? '...' : 'B'}
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

            {activeLibraryTab === 'MANUAL' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <OpManualReader />
              </div>
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
                  
                  <div className="w-full flex gap-2 flex-col sm:flex-row">
                    <input 
                      type="text" 
                      value={externalUrlInput}
                      onChange={(e) => setExternalUrlInput(e.target.value)}
                      placeholder={`Enter ${activeLibraryTab} URL (e.g. https://...)...`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] focus:outline-none focus:border-cyan-500 transition-all font-mono text-white/90"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleLoadExternalLink('A', externalUrlInput);
                        }
                      }}
                    />
                    <input 
                      type="text" 
                      value={externalTitleInput}
                      onChange={(e) => setExternalTitleInput(e.target.value)}
                      placeholder="Custom Title / Name (optional)..."
                      className="w-full sm:w-1/3 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] focus:outline-none focus:border-cyan-500 transition-all text-white/90"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                     <button 
                       onClick={() => handleLoadExternalLink('A', externalUrlInput)}
                       disabled={!externalUrlInput}
                       className="px-4 py-2 rounded bg-blue-600/20 border border-blue-500/40 text-blue-400 text-[10px] font-bold uppercase hover:bg-blue-600/40 disabled:opacity-40 disabled:hover:bg-blue-600/20 transition-all cursor-pointer font-sans"
                     >
                       Load Deck A
                     </button>
                     <button 
                       onClick={() => handleLoadExternalLink('B', externalUrlInput)}
                       disabled={!externalUrlInput}
                       className="px-4 py-2 rounded bg-purple-600/20 border border-purple-500/40 text-purple-400 text-[10px] font-bold uppercase hover:bg-purple-600/40 disabled:opacity-40 disabled:hover:bg-purple-600/20 transition-all cursor-pointer font-sans"
                     >
                       Load Deck B
                     </button>
                     <button 
                       onClick={handleAddNewExternalLinkOnly}
                       disabled={!externalUrlInput}
                       className="col-span-2 px-4 py-1.5 rounded bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase hover:bg-emerald-600/20 disabled:opacity-40 disabled:hover:bg-emerald-600/10 transition-all flex items-center justify-center gap-1 cursor-pointer font-sans"
                     >
                       <Plus size={11} /> Save Track to Tracker Only
                     </button>
                  </div>

                  {/* WORK IN PROGRESS NOTICE */}
                  <div className="mt-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/30 w-full max-w-xl text-left">
                     <div className="flex items-center gap-2 text-amber-500 text-[10px] font-black tracking-widest uppercase mb-1.5">
                        <Activity size={12} className="text-amber-500 animate-pulse" /> [ WORK IN PROGRESS ]
                     </div>
                     <h5 className="text-[10px] text-amber-400/90 font-bold leading-snug mb-1">
                        Active Stream Integration Dev Phase
                     </h5>
                     <p className="text-[9px] text-zinc-400 leading-relaxed">
                        While track loading and animated waveforms are mapped, live audio playback for {activeLibraryTab === 'YOUTUBE' ? 'YouTube' : 'Spotify'} streams within sandbox iframe containers is currently a work in progress. We are working diligently to routing-link these outputs for future updates!
                     </p>
                  </div>

                  <div className="mt-2 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20 w-full max-w-xl">
                     <div className="flex items-center gap-2 text-orange-400 text-[9px] font-bold uppercase mb-1">
                        <Info size={12} /> External Source Disclaimer
                     </div>
                     <p className="text-[9px] text-orange-400/60 leading-relaxed italic text-left">
                        Standard browser-based DJ effects like **Scratching, Pitch-Shifting, and EQ Isolators** are disabled for {activeLibraryTab} streams. These tracks will play at original speed and fidelity. {activeLibraryTab === 'YOUTUBE' ? 'Premium accounts bypass ads natively.' : 'Spotify requires active session in browser.'}
                     </p>
                  </div>

                  {/* External Lists Tracker */}
                  <div className="w-full mt-6 text-left border-t border-white/10 pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <ListPlus size={16} className="text-zinc-400" />
                        <h4 className="text-[11px] font-bold tracking-wider uppercase text-zinc-300">Saved Links Tracker ({externalLists.reduce((acc, curr) => acc + curr.links.length, 0)})</h4>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <input 
                          type="file" 
                          id="import-external-file" 
                          accept=".json,.txt" 
                          onChange={importExternalListFile} 
                          className="hidden" 
                          multiple
                        />
                        <button
                          onClick={() => document.getElementById('import-external-file')?.click()}
                          className="flex items-center gap-1 px-2.5 py-1 text-[9px] rounded bg-zinc-800 hover:bg-zinc-700 font-bold uppercase text-zinc-300 transition-all border border-zinc-700 cursor-pointer font-sans"
                          title="Import local file list (.json, .txt)"
                        >
                          <Upload size={10} /> Import
                        </button>
                        <button
                          onClick={exportExternalLists}
                          className="flex items-center gap-1 px-2.5 py-1 text-[9px] rounded bg-zinc-800 hover:bg-zinc-700 font-bold uppercase text-zinc-300 transition-all border border-zinc-700 cursor-pointer font-sans"
                          title="Download list backup (.json)"
                        >
                          <Download size={10} /> Export
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Are you sure you want to clear all track lists?")) {
                              clearAllExternalLists();
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[9px] rounded bg-red-950/40 hover:bg-red-900/40 font-bold uppercase text-red-500 transition-all border border-red-500/20 cursor-pointer font-sans"
                          title="Clear all track lists"
                        >
                          <Trash2 size={10} /> Clear All
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 w-full">
                      {externalLists.map((list) => {
                        const isExpanded = expandedLists[list.name] !== false;
                        return (
                          <div key={list.name} className="bg-white/[0.01] border border-white/5 rounded-lg overflow-hidden w-full">
                            {/* Group Header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5">
                              <button 
                                onClick={() => setExpandedLists(prev => ({ ...prev, [list.name]: !isExpanded }))}
                                className="flex items-center gap-2 hover:text-white text-zinc-300 transition-all cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                                <span className="font-mono text-[10px] font-bold">{list.name}</span>
                                <span className="text-[9px] text-zinc-500 bg-black/30 px-1.5 py-0.5 rounded font-bold font-mono">
                                  {list.links.length}
                                </span>
                              </button>

                              <button 
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to clear "${list.name}"?`)) {
                                    deleteExternalList(list.name);
                                  }
                                }}
                                className="p-1 text-zinc-500 hover:text-red-400 rounded hover:bg-white/5 transition-all cursor-pointer"
                                title={`Delete ${list.name}`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            {/* Group Links Table */}
                            {isExpanded && (
                              <div className="p-1 divide-y divide-white/5 font-sans">
                                {list.links.length > 0 ? (
                                  list.links.map((link) => {
                                    const isFav = !!link.isFavorite;
                                    const isYT = link.url.includes('youtube') || link.url.includes('youtu.be');
                                    return (
                                      <div key={link.id} className="flex gap-2 items-center justify-between p-2 hover:bg-white/[0.02] transition-all group rounded border border-transparent">
                                        <div className="flex-1 min-w-0 text-left">
                                          <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isYT ? 'bg-red-500' : 'bg-green-500'}`} />
                                            <span className="text-[10px] font-semibold text-zinc-200 truncate block">
                                              {link.title}
                                            </span>
                                          </div>
                                          <span className="text-[8px] text-zinc-500 font-mono block truncate max-w-[280px]">
                                            {link.url}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          {/* Load direct A */}
                                          <button
                                            onClick={() => handleLoadExternalLink('A', link.url, link.title)}
                                            className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-blue-600/10 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 active:scale-95 transition-all uppercase cursor-pointer"
                                            title="Load to Deck A"
                                          >
                                            Deck A
                                          </button>
                                          {/* Load direct B */}
                                          <button
                                            onClick={() => handleLoadExternalLink('B', link.url, link.title)}
                                            className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-purple-600/10 hover:bg-purple-600/30 text-purple-400 border border-purple-500/20 active:scale-95 transition-all uppercase cursor-pointer"
                                            title="Load to Deck B"
                                          >
                                            Deck B
                                          </button>
                                          {/* Place into link field */}
                                          <button
                                            onClick={() => {
                                              setExternalUrlInput(link.url);
                                              setExternalTitleInput(link.title);
                                            }}
                                            className="p-1 px-1.5 text-[8px] font-semibold text-zinc-400 bg-zinc-850 hover:bg-zinc-700 hover:text-white rounded transition-all font-mono cursor-pointer"
                                            title="Fill edit fields above"
                                          >
                                            Paste
                                          </button>
                                          {/* Favorite */}
                                          <button 
                                            onClick={() => toggleExternalLinkFavorite(list.name, link.id)}
                                            className="p-1 hover:bg-white/5 rounded transition-all cursor-pointer hover:text-red-400 text-zinc-650"
                                          >
                                            <Heart size={11} className={isFav ? "text-red-500 fill-red-500" : "currentColor"} />
                                          </button>
                                          {/* Delete link */}
                                          <button 
                                            onClick={() => deleteExternalLink(list.name, link.id)}
                                            className="p-1 hover:bg-white/5 rounded hover:text-red-400 text-zinc-500 transition-all cursor-pointer"
                                            title="Delete track"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="py-4 text-center text-[9px] text-zinc-600 italic">
                                    No tracks in this list. Submit links above or import files.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
              </div>
            )}
        </div>
      </footer>
      <AudioDebugger 
        playbackRates={playbackRates}
        playingState={playingState}
        fxState={fxState}
        eqState={eqState}
        trackInfo={trackInfo}
        filterState={filterState}
      />
    </div>
  );
}
