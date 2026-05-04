import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Engine } from './engine/Engine.js';
import {
  NOTES, ENHARMONICS, enharmonic, TEXTURES, noteName, noteIdx, intervalName, pad2,
  TIME_SIGS, SUBDIV_OPTS, ACCENT_CYCLE, ACCENT_LABELS, CLICK_MODES,
  CLAVE_44, CLAVE_44_PULSE, CLAVE_44_STEPS, CLAVE_68, CLAVE_68_PULSE, CLAVE_68_STEPS,
  FOCUS_MODES, DARK, LIGHT,
} from './constants';
import {
  useDragOverlay, dbStart, dbEnd, dbSetMove, dbSetUp,
  useMetronome, useTapTempo, useFocusTimer, useWakeLock, useResponsive,
} from './hooks';
import { Pill, PtrSlider, HSlider, BPMKnob, ToneKnob, SL, FocusRing, Board } from './components';

export default function App() {
  // ============================================================================
  // STATE
  // ============================================================================

  const { isMobile } = useResponsive();
  const wakeLock = useWakeLock();

  const [theme, setTheme] = useState("dark");
  const T = theme === "dark" ? DARK : LIGHT;

  const eng = useRef(null);
  const [ready, setReady] = useState(false);

  // Fretboard
  const [strings, setStrings] = useState(4);
  const [lit, setLit] = useState(null);

  // Drone
  const [droneOn, setDroneOn] = useState(false);
  const [drRoot, setDrRoot] = useState("E");
  const [drOct, setDrOct] = useState(2);
  const [drTex, setDrTex] = useState("bassGuitar");
  const [drHarm, setDrHarm] = useState([]);
  const [drMode, setDrMode] = useState("harmony");
  const [customNotes, setCustomNotes] = useState([]);

  // Metronome
  const [metOn, setMetOn] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [timeSig, setTimeSig] = useState({ n: 4, d: 4, label: "4/4" });
  const [subdiv, setSubdiv] = useState("none");
  const [clickMode, setClickMode] = useState("all");
  const [customAccents, setCustomAccents] = useState([true, false, false, false]);
  const [beatEmphasis, setBeatEmphasis] = useState(() => new Array(4).fill(0));
  const [gapBars, setGapBars] = useState(0);
  const [gapSilent, setGapSilent] = useState(0);
  const [gapCustom, setGapCustom] = useState(false);
  const [rampMode, setRampMode] = useState("off");
  const [rampEnd, setRampEnd] = useState(140);
  const [rampBars, setRampBars] = useState(32);
  const [countIn, setCountIn] = useState(false);

  // Clave
  const [claveMode, setClaveMode] = useState(false);
  const [claveFeel, setClaveFeel] = useState("44");
  const [claveType, setClaveType] = useState("son");
  const [claveDir, setClaveDir] = useState("32");
  const [clave68Pat, setClave68Pat] = useState("clave68");
  const [clavePulse, setClavePulse] = useState(false);
  const [claveCountIn, setClaveCountIn] = useState(false);

  // Mix
  const [volMaster, setVolMaster] = useState(0.75);
  const [volDrone, setVolDrone] = useState(0.55);
  const [volMet, setVolMet] = useState(0.50);

  // Noise
  const [noiseOn, setNoiseOn] = useState(false);
  const [noiseLevel, setNoiseLevel] = useState(0.25);
  const [noiseTone, setNoiseTone] = useState(0);

  // UI
  const [panelOrder] = useState(["fretboard", "drone", "metro", "mixer"]);
  const [view, setView] = useState("lab");
  const [globalPause, setGlobalPause] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [customWork, setCustomWork] = useState(20);
  const [customBreak, setCustomBreak] = useState(5);
  const [sunline, setSunline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // ============================================================================
  // REFS
  // ============================================================================

  const mounted = useRef(false);
  const metroBeatRef = useRef(0);
  const metroBarRef = useRef(0);
  const metroStatusRef = useRef(null);
  const droneOnRef = useRef(false);
  const metOnRef = useRef(false);
  const noiseOnRef = useRef(false);
  const metConfigRef = useRef(null);
  const prevPhaseRef = useRef(null);
  const prePause = useRef({ droneOn: false, metOn: false, noiseOn: false });
  const pauseStartRef = useRef(null);

  // Slider drag overlay
  const { ref: dbOverlayRef, onPointerMove: dbPointerMove, onPointerUp: dbPointerUp, onPointerCancel: dbPointerCancel } = useDragOverlay();

  const focusTimer = useFocusTimer();
  const metro = useMetronome(eng, ready);

  // ============================================================================
  // DERIVED
  // ============================================================================

  const rootMidi = useMemo(() => {
    const idx = NOTES.indexOf(drRoot);
    return idx >= 0 ? (drOct + 1) * 12 + idx : 40;
  }, [drRoot, drOct]);

  // ============================================================================
  // BOOT
  // ============================================================================

  const boot = useCallback(async () => {
    if (mounted.current) return;
    mounted.current = true;
    try {
      const engine = new Engine();
      await engine.init();
      eng.current = engine;
      setReady(true);
    } catch (e) {
      console.error("Engine init failed:", e);
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  // ============================================================================
  // VOLUME
  // ============================================================================

  useEffect(() => { if (eng.current) eng.current.setMasterVolume(volMaster); }, [volMaster]);
  useEffect(() => { if (eng.current) eng.current.setDroneVolume(volDrone); }, [volDrone]);
  useEffect(() => { if (eng.current) eng.current.setMetVolume(volMet); }, [volMet]);

  // ============================================================================
  // NOISE
  // ============================================================================

  useEffect(() => {
    noiseOnRef.current = noiseOn;
    if (!eng.current) return;
    if (noiseOn) eng.current.startNoise(noiseLevel, noiseTone);
    else eng.current.stopNoise();
  }, [noiseOn, noiseLevel, noiseTone]);

  // ============================================================================
  // DRONE
  // ============================================================================

  useEffect(() => {
    droneOnRef.current = droneOn;
    if (!eng.current) return;
    if (droneOn) {
      const notes = drMode === "custom" ? customNotes : drHarm;
      eng.current.startDroneNotes(drRoot, drOct, drTex, notes);
    } else {
      eng.current.stopDrone();
    }
  }, [droneOn, drRoot, drOct, drTex, drHarm, drMode, customNotes]);

  // ============================================================================
  // METRONOME
  // ============================================================================

  useEffect(() => {
    const config = {
      bpm, timeSig, subdiv, clickMode, customAccents, beatEmphasis,
      gapBars, gapSilent, gapCustom, rampMode, rampEnd, rampBars, countIn,
      claveMode, claveFeel, claveType, claveDir, clave68Pat, clavePulse, claveCountIn,
    };
    metConfigRef.current = config;
    if (metOn) metro.update(config);
  }, [bpm, timeSig, subdiv, clickMode, customAccents, beatEmphasis, gapBars, gapSilent, gapCustom, rampMode, rampEnd, rampBars, countIn, claveFeel, claveType, claveDir, clave68Pat, clavePulse, claveCountIn]);

  // Restart on metOn change or claveMode toggle (different scheduler code path)
  useEffect(() => {
    metOnRef.current = metOn;
    const config = metConfigRef.current;
    if (metOn && config) metro.start(config);
    else metro.stop();
  }, [metOn, claveMode]);

  useEffect(() => {
    metro.cbRef.current = (vis) => {
      metroBeatRef.current = vis.beat;
      metroBarRef.current = vis.bar;
      metroStatusRef.current = {
        status: rampMode !== "off" && vis.currentBpm ? `${vis.currentBpm} BPM` : "",
      };
    };
  }, [rampMode]);

  // ============================================================================
  // GLOBAL PAUSE
  // ============================================================================

  useEffect(() => {
    if (!eng.current) return;
    if (globalPause) {
      prePause.current = { droneOn: droneOnRef.current, metOn: metOnRef.current, noiseOn: noiseOnRef.current };
      eng.current.pauseAll();
      pauseStartRef.current = Date.now();
    } else {
      eng.current.resumeAll();
    }
  }, [globalPause]);

  // ============================================================================
  // FOCUS TIMER BREAK PAUSE/RESUME
  // ============================================================================

  useEffect(() => {
    if (focusTimer.phase === "break") {
      prePause.current = { droneOn: droneOnRef.current, metOn: metOnRef.current, noiseOn: noiseOnRef.current };
      if (droneOnRef.current) setDroneOn(false);
      if (metOnRef.current) setMetOn(false);
      if (noiseOnRef.current) setNoiseOn(false);
    } else if (prevPhaseRef.current === "break" && focusTimer.phase === "work") {
      if (prePause.current.droneOn) setDroneOn(true);
      if (prePause.current.metOn) setMetOn(true);
      if (prePause.current.noiseOn) setNoiseOn(true);
    }
    prevPhaseRef.current = focusTimer.phase;
  }, [focusTimer.phase]);

  // ============================================================================
  // VISIBILITY & WAKE LOCK
  // ============================================================================

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) { if (eng.current?.ctx?.state === 'running') eng.current.ctx.suspend(); }
      else { if (eng.current?.ctx?.state === 'suspended') eng.current.ctx.resume(); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (droneOn || metOn || noiseOn) wakeLock.request();
    else wakeLock.release();
  }, [droneOn, metOn, noiseOn]);

  // ============================================================================
  // PWA UPDATE
  // ============================================================================

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw?.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) setUpdateAvailable(true);
          });
        });
      });
    }
  }, []);

  // ============================================================================
  // TIME SIG → ACCENT LENGTH
  // ============================================================================

  useEffect(() => {
    const n = timeSig.n;
    if (customAccents.length !== n) {
      const a = new Array(n).fill(false); a[0] = true;
      setCustomAccents(a);
      setBeatEmphasis(new Array(n).fill(0));
    }
  }, [timeSig.n, customAccents.length]);

  // ============================================================================
  // THEME
  // ============================================================================

  const switchTheme = useCallback(() => {
    setSunline(true);
    setTimeout(() => {
      setTheme(t => t === "dark" ? "light" : "dark");
      setTimeout(() => setSunline(false), 150);
    }, 150);
  }, []);

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  const onFretClick = useCallback((midi) => {
    if (!eng.current) return;
    eng.current.playNote(midi, 1.8);
    setLit(midi);
    setTimeout(() => setLit(null), 600);
  }, []);

  const toggleH = useCallback((i) => {
    setDrHarm(prev => {
      const arr = [...prev];
      const idx = NOTES.indexOf(prev[i]);
      arr[i] = idx >= 0 ? NOTES[(idx + 1) % NOTES.length] : NOTES[0];
      return arr;
    });
  }, []);

  const toggleMet = useCallback(() => setMetOn(prev => !prev), []);

  const allOff = useCallback(() => {
    setDroneOn(false);
    setMetOn(false);
    setNoiseOn(false);
    focusTimer.pause();
    setGlobalPause(false);
  }, [focusTimer]);

  const pauseAll = useCallback(() => setGlobalPause(true), []);

  const resumePractice = useCallback(() => setGlobalPause(false), []);

  // ============================================================================
  // PANEL WRAPPER
  // ============================================================================

  const PanelWrap = ({ id, children, title }) => (
    <div style={{
      flex: 1, minWidth: isMobile ? "100%" : "auto",
      padding: 14, background: T.bg2,
      border: `1px solid ${T.txt}18`, borderRadius: 10,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.txt + "a0", letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</span>
      {children}
    </div>
  );

  // ============================================================================
  // PANEL: FRETBOARD
  // ============================================================================

  const renderFretboard = () => (
    <PanelWrap id="fretboard" title="Fretboard">
      <div style={{ display: "flex", gap: 4 }}>
        {[4, 5, 6].map(n => (
          <button key={n} onClick={() => setStrings(n)} style={{
            padding: "4px 10px",
            background: strings === n ? T.ok : T.txt + "18",
            color: strings === n ? T.bg : T.txt,
            border: "none", borderRadius: 4, cursor: "pointer",
            fontSize: 10, fontWeight: strings === n ? 700 : 400,
          }}>{n}str</button>
        ))}
      </div>
      <Board
        count={strings}
        lit={lit}
        rootMidi={rootMidi}
        onFretClick={onFretClick}
        T={T}
        isMobile={isMobile}
        droningKeys={[]}
        customMode={false}
        droneActive={droneOn}
      />
    </PanelWrap>
  );

  // ============================================================================
  // PANEL: DRONE
  // ============================================================================

  const renderDrone = () => (
    <PanelWrap id="drone" title="Drone">
      <div style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Root</label>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {NOTES.map(n => (
              <button key={n} onClick={() => setDrRoot(n)} style={{
                padding: "4px 7px",
                background: drRoot === n ? T.accent + "30" : T.txt + "12",
                color: drRoot === n ? T.accentGlow : T.txt,
                border: `1px solid ${drRoot === n ? T.accent + "60" : "transparent"}`,
                borderRadius: 4, cursor: "pointer",
                fontSize: 10, fontWeight: drRoot === n ? 700 : 400,
              }}>{n}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Oct</label>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4].map(o => (
              <button key={o} onClick={() => setDrOct(o)} style={{
                padding: "4px 9px",
                background: drOct === o ? T.ok : T.txt + "18",
                color: drOct === o ? T.bg : T.txt,
                border: "none", borderRadius: 4, cursor: "pointer",
                fontSize: 10, fontWeight: drOct === o ? 700 : 400,
              }}>{o}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Texture</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TEXTURES.map(tex => (
            <button key={tex.id} onClick={() => setDrTex(tex.id)} style={{
              padding: "4px 8px",
              background: drTex === tex.id ? T.ok : T.txt + "18",
              color: drTex === tex.id ? T.bg : T.txt,
              border: "none", borderRadius: 4, cursor: "pointer",
              fontSize: 9, fontWeight: drTex === tex.id ? 700 : 400,
            }}>{tex.name}</button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Mode</label>
        <div style={{ display: "flex", gap: 4 }}>
          {["harmony", "custom"].map(m => (
            <button key={m} onClick={() => setDrMode(m)} style={{
              padding: "4px 12px",
              background: drMode === m ? T.ok : T.txt + "18",
              color: drMode === m ? T.bg : T.txt,
              border: "none", borderRadius: 4, cursor: "pointer",
              fontSize: 10, fontWeight: drMode === m ? 700 : 400, textTransform: "capitalize",
            }}>{m}</button>
          ))}
        </div>
      </div>

      {drMode === "harmony" && (
        <div>
          <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Harmonies</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[0, 1, 2, 3].map(i => (
              <button key={i} onClick={() => toggleH(i)} style={{
                padding: "4px 10px",
                background: drHarm[i] ? T.accent + "20" : T.txt + "12",
                color: drHarm[i] ? T.accentGlow : T.muted,
                border: `1px solid ${drHarm[i] ? T.accent + "40" : T.txt + "20"}`,
                borderRadius: 4, cursor: "pointer", fontSize: 10, minWidth: 36,
              }}>{drHarm[i] || "—"}</button>
            ))}
          </div>
        </div>
      )}

      {drMode === "custom" && (
        <div>
          <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Notes</label>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {NOTES.map(n => (
              <button key={n} onClick={() => setCustomNotes(prev =>
                prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
              )} style={{
                padding: "4px 7px",
                background: customNotes.includes(n) ? T.ok : T.txt + "12",
                color: customNotes.includes(n) ? T.bg : T.txt,
                border: "none", borderRadius: 4, cursor: "pointer",
                fontSize: 10, fontWeight: customNotes.includes(n) ? 700 : 400,
              }}>{n}</button>
            ))}
          </div>
        </div>
      )}

      <Pill active={droneOn} onClick={() => setDroneOn(!droneOn)} T={T}>Drone</Pill>
    </PanelWrap>
  );

  // ============================================================================
  // PANEL: METRONOME
  // ============================================================================

  const renderMetro = () => (
    <PanelWrap id="metro" title="Metronome">
      <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row", alignItems: "flex-start" }}>
        <div>
          <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>BPM</label>
          <BPMKnob value={bpm} min={20} max={320} onChange={setBpm} T={T} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Time Sig</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {TIME_SIGS.map(ts => (
              <button key={ts.label} onClick={() => setTimeSig(ts)} style={{
                padding: "5px 9px",
                background: timeSig.label === ts.label ? T.ok : T.txt + "18",
                color: timeSig.label === ts.label ? T.bg : T.txt,
                border: "none", borderRadius: 4, cursor: "pointer",
                fontSize: 10, fontWeight: timeSig.label === ts.label ? 700 : 400,
              }}>{ts.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Subdivision</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {SUBDIV_OPTS.map(opt => (
            <button key={opt.id} onClick={() => setSubdiv(opt.id)} style={{
              padding: "4px 8px",
              background: subdiv === opt.id ? T.ok : T.txt + "18",
              color: subdiv === opt.id ? T.bg : T.txt,
              border: "none", borderRadius: 4, cursor: "pointer",
              fontSize: 9, fontWeight: subdiv === opt.id ? 700 : 400,
            }}>{opt.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Click Mode</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CLICK_MODES.map(cm => (
            <button key={cm.id} onClick={() => setClickMode(cm.id)} style={{
              padding: "4px 8px",
              background: clickMode === cm.id ? T.ok : T.txt + "18",
              color: clickMode === cm.id ? T.bg : T.txt,
              border: "none", borderRadius: 4, cursor: "pointer",
              fontSize: 9, fontWeight: clickMode === cm.id ? 700 : 400,
            }}>{cm.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Accents</label>
        <div style={{ display: "flex", gap: 4 }}>
          {customAccents.map((acc, i) => (
            <button key={i} onClick={() => setCustomAccents(prev => { const a=[...prev]; a[i]=!a[i]; return a; })} style={{
              padding: "4px 8px", minWidth: 30,
              background: acc ? T.ok : T.txt + "18",
              color: acc ? T.bg : T.txt,
              border: "none", borderRadius: 4, cursor: "pointer",
              fontSize: 10, fontWeight: acc ? 700 : 400,
            }}>{i + 1}</button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gap Bars: {gapBars}</label>
        <HSlider value={gapBars} min={0} max={16} onChange={setGapBars} T={T} />
      </div>

      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gap Silent: {gapSilent}</label>
        <HSlider value={gapSilent} min={0} max={16} onChange={setGapSilent} T={T} />
      </div>

      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 6, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ramp</label>
        <div style={{ display: "flex", gap: 4 }}>
          {["off", "linear", "expo"].map(m => (
            <button key={m} onClick={() => setRampMode(m)} style={{
              padding: "4px 8px",
              background: rampMode === m ? T.ok : T.txt + "18",
              color: rampMode === m ? T.bg : T.txt,
              border: "none", borderRadius: 4, cursor: "pointer",
              fontSize: 9, fontWeight: rampMode === m ? 700 : 400,
            }}>{m}</button>
          ))}
        </div>
      </div>

      {rampMode !== "off" && (
        <>
          <div>
            <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>End BPM: {rampEnd}</label>
            <HSlider value={rampEnd} min={30} max={300} onChange={setRampEnd} T={T} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ramp Bars: {rampBars}</label>
            <HSlider value={rampBars} min={1} max={64} onChange={setRampBars} T={T} />
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => setCountIn(!countIn)} style={{
          padding: "5px 10px",
          background: countIn ? T.ok : T.txt + "18",
          color: countIn ? T.bg : T.txt,
          border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
          fontWeight: countIn ? 700 : 400,
        }}>Count In</button>
      </div>

      <div style={{ paddingTop: 10, borderTop: `1px solid ${T.txt}15` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 9, color: T.txt + "70", letterSpacing: "0.08em", textTransform: "uppercase" }}>Clave</label>
          <button onClick={() => setClaveMode(!claveMode)} style={{
            padding: "3px 8px",
            background: claveMode ? T.ok : T.txt + "18",
            color: claveMode ? T.bg : T.txt,
            border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
            fontWeight: claveMode ? 700 : 400,
          }}>{claveMode ? "On" : "Off"}</button>
        </div>

        {claveMode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {["44", "68"].map(f => (
                <button key={f} onClick={() => setClaveFeel(f)} style={{
                  padding: "4px 8px",
                  background: claveFeel === f ? T.ok : T.txt + "18",
                  color: claveFeel === f ? T.bg : T.txt,
                  border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
                  fontWeight: claveFeel === f ? 700 : 400,
                }}>{f}</button>
              ))}
            </div>
            {claveFeel === "44" && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {["son", "rumba"].map(t => (
                  <button key={t} onClick={() => setClaveType(t)} style={{
                    padding: "4px 8px",
                    background: claveType === t ? T.ok : T.txt + "18",
                    color: claveType === t ? T.bg : T.txt,
                    border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
                    fontWeight: claveType === t ? 700 : 400,
                  }}>{t}</button>
                ))}
                {["32", "23"].map(d => (
                  <button key={d} onClick={() => setClaveDir(d)} style={{
                    padding: "4px 8px",
                    background: claveDir === d ? T.ok : T.txt + "18",
                    color: claveDir === d ? T.bg : T.txt,
                    border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
                    fontWeight: claveDir === d ? 700 : 400,
                  }}>{d}</button>
                ))}
              </div>
            )}
            {claveFeel === "68" && (
              <div style={{ display: "flex", gap: 4 }}>
                {["clave68", "bembe"].map(p => (
                  <button key={p} onClick={() => setClave68Pat(p)} style={{
                    padding: "4px 8px",
                    background: clave68Pat === p ? T.ok : T.txt + "18",
                    color: clave68Pat === p ? T.bg : T.txt,
                    border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
                    fontWeight: clave68Pat === p ? 700 : 400,
                  }}>{p}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setClavePulse(!clavePulse)} style={{
                padding: "4px 8px",
                background: clavePulse ? T.ok : T.txt + "18",
                color: clavePulse ? T.bg : T.txt,
                border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
                fontWeight: clavePulse ? 700 : 400,
              }}>Pulse</button>
              <button onClick={() => setClaveCountIn(!claveCountIn)} style={{
                padding: "4px 8px",
                background: claveCountIn ? T.ok : T.txt + "18",
                color: claveCountIn ? T.bg : T.txt,
                border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
                fontWeight: claveCountIn ? 700 : 400,
              }}>Count In</button>
            </div>
          </div>
        )}
      </div>

      <Pill active={metOn} onClick={toggleMet} T={T}>Metronome</Pill>
    </PanelWrap>
  );

  // ============================================================================
  // PANEL: MIXER
  // ============================================================================

  const renderMixer = () => (
    <PanelWrap id="mixer" title="Mixer">
      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Master {Math.round(volMaster * 100)}%</label>
        <HSlider value={volMaster} min={0} max={1} onChange={setVolMaster} T={T} />
      </div>
      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Drone {Math.round(volDrone * 100)}%</label>
        <HSlider value={volDrone} min={0} max={1} onChange={setVolDrone} T={T} />
      </div>
      <div>
        <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Metronome {Math.round(volMet * 100)}%</label>
        <HSlider value={volMet} min={0} max={1} onChange={setVolMet} T={T} />
      </div>

      <div style={{ paddingTop: 10, borderTop: `1px solid ${T.txt}15` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 9, color: T.txt + "70", letterSpacing: "0.08em", textTransform: "uppercase" }}>Noise</label>
          <button onClick={() => setNoiseOn(!noiseOn)} style={{
            padding: "3px 8px",
            background: noiseOn ? T.ok : T.txt + "18",
            color: noiseOn ? T.bg : T.txt,
            border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9,
            fontWeight: noiseOn ? 700 : 400,
          }}>{noiseOn ? "On" : "Off"}</button>
        </div>
        {noiseOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Level {Math.round(noiseLevel * 100)}%</label>
              <HSlider value={noiseLevel} min={0} max={1} onChange={setNoiseLevel} T={T} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Tone</label>
              <ToneKnob value={noiseTone} onChange={setNoiseTone} T={T} />
            </div>
          </div>
        )}
      </div>
    </PanelWrap>
  );

  // ============================================================================
  // VIEW: FOCUS
  // ============================================================================

  const renderFocusView = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 24, overflow: "auto" }}>
      <FocusRing
        progress={focusTimer.progress}
        phase={focusTimer.phase}
        T={T}
        secsLeft={focusTimer.secsLeft}
        isPaused={focusTimer.isPaused}
        justStarted={false}
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {FOCUS_MODES.map(mode => (
          <button key={mode.id} onClick={() => focusTimer.selectMode(mode)} style={{
            padding: "7px 14px",
            background: focusTimer.mode?.id === mode.id ? T.ok : T.txt + "18",
            color: focusTimer.mode?.id === mode.id ? T.bg : T.txt,
            border: "none", borderRadius: 6, cursor: "pointer",
            fontSize: 11, fontWeight: focusTimer.mode?.id === mode.id ? 700 : 400,
          }}>{mode.label}</button>
        ))}
      </div>

      {focusTimer.mode?.id === "custom" && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ minWidth: 140 }}>
            <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Work (min): {customWork}</label>
            <HSlider value={customWork} min={1} max={90} onChange={setCustomWork} T={T} />
          </div>
          <div style={{ minWidth: 140 }}>
            <label style={{ fontSize: 9, color: T.txt + "70", marginBottom: 4, display: "block", letterSpacing: "0.08em", textTransform: "uppercase" }}>Break (min): {customBreak}</label>
            <HSlider value={customBreak} min={1} max={30} onChange={setCustomBreak} T={T} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {focusTimer.phase === "idle" ? (
          <button onClick={() => {
            if (focusTimer.mode?.id === "custom") focusTimer.setCustomTime(customWork, customBreak);
            focusTimer.start();
          }} style={{
            padding: "11px 22px", background: T.ok, color: T.bg,
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}>Start</button>
        ) : (
          <button onClick={() => focusTimer.pause()} style={{
            padding: "11px 22px", background: T.warn, color: T.bg,
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}>Stop</button>
        )}

        {confirmReset ? (
          <>
            <button onClick={() => { focusTimer.reset(); setConfirmReset(false); }} style={{
              padding: "11px 22px", background: T.err, color: T.bg,
              border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}>Confirm</button>
            <button onClick={() => setConfirmReset(false)} style={{
              padding: "11px 22px", background: T.txt + "18", color: T.txt,
              border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13,
            }}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{
            padding: "11px 22px", background: T.txt + "18", color: T.txt,
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13,
          }}>Reset</button>
        )}
      </div>

      {focusTimer.phase === "break" && (
        <div style={{ textAlign: "center", color: T.ok, fontSize: 14, fontWeight: 600 }}>Take a break!</div>
      )}

      {showHelp && (
        <div style={{
          maxWidth: 360, padding: 16,
          background: T.bg2, border: `1px solid ${T.txt}18`,
          borderRadius: 8, fontSize: 12, color: T.txt + "c0", lineHeight: 1.7,
        }}>
          Focus Mode manages work/break intervals. Audio pauses during breaks and resumes automatically.
          <br /><br />
          Micro 15/3 · Standard 25/5 · Deep 50/10 · Extended 90/20 · Custom
        </div>
      )}

      <button onClick={() => setShowHelp(!showHelp)} style={{
        padding: "5px 12px", background: T.txt + "18", color: T.txt + "a0",
        border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11,
      }}>{showHelp ? "Hide Help" : "?"}</button>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  const isActive = droneOn || metOn || noiseOn;
  const isRunning = focusTimer.phase !== "idle";

  const panelContent = {
    fretboard: renderFretboard(),
    drone: renderDrone(),
    metro: renderMetro(),
    mixer: renderMixer(),
  };

  return (
    <div data-theme={theme} style={{
      width: "100vw", height: "100vh",
      display: "flex", flexDirection: "column",
      background: T.bg, color: T.txt,
      fontFamily: "system-ui, sans-serif", overflow: "hidden",
    }}>
      {/* Slider drag overlay */}
      <div
        ref={dbOverlayRef}
        style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 999 }}
        onPointerMove={dbPointerMove}
        onPointerUp={dbPointerUp}
        onPointerCancel={dbPointerCancel}
      />

      {/* PWA update */}
      {updateAvailable && (
        <div style={{
          background: T.ok + "15", borderBottom: `1px solid ${T.ok}30`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "6px 16px",
        }}>
          <span style={{ fontSize: 10, color: T.ok }}>New version available</span>
          <button onClick={() => window.location.reload()} style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 9, fontWeight: 700,
            background: T.ok + "20", border: `1px solid ${T.ok}50`, color: T.ok, cursor: "pointer",
          }}>Update</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", background: T.bg2, borderBottom: `1px solid ${T.txt}15`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: T.txt, textTransform: "uppercase" }}>LBE-APP-2</span>
        <button onClick={switchTheme} style={{
          width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
          background: T.txt + "18", border: "none", borderRadius: 4, cursor: "pointer", color: T.txt,
          opacity: sunline ? 0.4 : 1, transition: "opacity 200ms", fontSize: 14,
        }}>{theme === "dark" ? "☀" : "☾"}</button>
      </div>

      {/* Global pause overlay */}
      {globalPause && (
        <div style={{
          position: "absolute", inset: 0, background: T.bg + "cc",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 500, flexDirection: "column", gap: 16,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.2em", color: T.ok }}>PAUSED</div>
          <button onClick={resumePractice} style={{
            padding: "10px 22px", background: T.ok, color: T.bg,
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}>Resume</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        display: "flex", gap: 6, padding: "6px 16px",
        background: T.bg2, borderBottom: `1px solid ${T.txt}15`,
        flexShrink: 0, flexWrap: "wrap", alignItems: "center",
      }}>
        {["lab", "focus"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "5px 12px",
            background: view === v ? T.ok : T.txt + "18",
            color: view === v ? T.bg : T.txt,
            border: "none", borderRadius: 4, cursor: "pointer",
            fontSize: 10, fontWeight: view === v ? 700 : 400, textTransform: "capitalize",
          }}>{v}</button>
        ))}

        <div style={{ flex: 1 }} />

        <button onClick={pauseAll} disabled={!isActive} style={{
          padding: "5px 12px",
          background: isActive ? T.warn : T.txt + "12",
          color: T.bg, border: "none", borderRadius: 4,
          cursor: isActive ? "pointer" : "not-allowed",
          fontSize: 10, fontWeight: 700, opacity: isActive ? 1 : 0.4,
        }}>Pause</button>

        <button onClick={allOff} disabled={!isActive && !isRunning} style={{
          padding: "5px 12px",
          background: isActive || isRunning ? T.err : T.txt + "12",
          color: T.bg, border: "none", borderRadius: 4,
          cursor: isActive || isRunning ? "pointer" : "not-allowed",
          fontSize: 10, fontWeight: 700, opacity: isActive || isRunning ? 1 : 0.4,
        }}>All Off</button>
      </div>

      {/* Break banner */}
      {focusTimer.phase === "break" && (
        <div style={{
          padding: "8px 16px",
          background: T.ok + "18", borderBottom: `1px solid ${T.ok}35`,
          color: T.ok, fontSize: 11, fontWeight: 600, textAlign: "center", flexShrink: 0,
          letterSpacing: "0.06em",
        }}>
          Break Time — Audio paused until work resumes
        </div>
      )}

      {/* Main content */}
      {view === "focus" ? renderFocusView() : (
        <div style={{
          flex: 1, display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 10, padding: 10, overflow: "auto",
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}>
          {panelOrder.map(id => (
            <div key={id} style={{ flex: isMobile ? "0 0 100%" : 1, display: "flex" }}>
              {panelContent[id]}
            </div>
          ))}
        </div>
      )}

      {/* Status strip */}
      {view === "lab" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "5px 16px", background: T.bg2, borderTop: `1px solid ${T.txt}12`,
          fontSize: 9, color: T.txt + "70", flexShrink: 0, letterSpacing: "0.04em",
        }}>
          <div>
            {metOn && (
              <span>
                Bar {metroBarRef.current} · Beat {metroBeatRef.current + 1}
                {metroStatusRef.current?.status ? ` · ${metroStatusRef.current.status}` : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {droneOn && <span style={{ color: T.ok }}>● Drone</span>}
            {metOn && <span style={{ color: T.warn }}>● Metro</span>}
            {noiseOn && <span style={{ color: T.muted }}>● Noise</span>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2px 16px", background: T.bg2, borderTop: `1px solid ${T.txt}0a`,
        fontSize: 8, color: T.txt + "40", flexShrink: 0, letterSpacing: "0.1em",
      }}>
        LIVE BASS ESSENTIALS
      </div>
    </div>
  );
}
