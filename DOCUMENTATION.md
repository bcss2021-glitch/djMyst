# DJ Studio Technical Documentation

## 🎛 Overview
A full-featured, browser-based DJ application built with React, Tone.js, and Tailwind CSS. Supports real-time streaming from Audius and local file mixing.

## 🧪 Test Plan (Features to Verify)

### 1. Transport & Playback
- [ ] **Deck Loading**: Load a track from Audius search and verify the waveform renders.
- [ ] **Playback**: Test Play/Pause on both decks simultaneously.
- [ ] **Pitch/Tempo**: Move the tempo faders; verify speed changes and "MT" (Master Tempo/Key Lock) keeps the pitch stable when enabled.
- [ ] **Sync**: Load two tracks with different speeds, hit "SYNC" on Deck B to match Deck A.

### 2. Mixer & Audio Quality
- [ ] **Gain Staging**: Adjust the Gain knob on each deck; verify levels reach the master visualizer.
- [ ] **EQ Isolation**: Turn down "Low" and verify bass frequencies are removed.
- [ ] **Filter Sweep**: Test the central Filter knob for Low-pass (left) and High-pass (right) effects.
- [ ] **Crossfader**: Move the crossfader fully left/right and verify isolation between channels A and B.

### 3. Performance FX (New)
- [ ] **FX Panel**: Click the double-chevron on a deck to open the Specialized FX engine.
- [ ] **FX Chain**: Enable Echo and Phaser; verify the wet/dry mix changes.
- [ ] **Beat Rolls**: Hold down 1/4, 1/8, or 1/16 buttons while a track is playing; verify the audio repeats in a loop until released.
- [ ] **Hot Cues**: Play a track, click "1" in the Hot Points area to set a cue, then click it later to jump back instantly.
- [ ] **Manual Loop**: Click "IN" then "OUT" to create a loop; verify it stays in sync.

### 4. Library & Persistence
- [ ] **Config Save**: Set a specific EQ/FX state, click "Save FX Preset to Track" in the FX engine, and reload the track to verify settings are remembered.
- [ ] **History**: Check the "HISTORY" tab in the library after playing a few tracks.
- [ ] **Export/Import**: Export your settings to a JSON file via the Settings menu, refresh the page, and import it back.

---

## 📝 TODO / Future Roadmap

- [ ] **BPM Autodetect**: Implement real-time BPM estimation for local tracks to improve SYNC precision.
- [ ] **Quantize**: Snap Hot Cues and Loops to the nearest beat boundary.
- [ ] **Key Shift**: Separate "Key Lock" from manual "Key Shift" (changing the musical key without changing tempo).
- [ ] **Recording Improvements**: Add a "Save to WAV" feature for recorded sessions.
- [ ] **Waveform Zoom**: Add pinch-to-zoom or scroll-to-zoom on the track waveform.
- [ ] **Crate Management**: Allow users to create custom folders (Crates) to organize tracks locally.
- [ ] **Touch Optimization**: Improve slider and knob sensitivity for iPad/Mobile DJing.
