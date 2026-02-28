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
  // STATE & CONSTANTS
  // ============================================================================

  // Responsive
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const wakeLock = useWakeLock();

  // Theme
  const [theme, setTheme] = useState("dark");
  const T = theme === "dark" ? DARK : LIGHT;

  // Engine
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

  // Panels & UI
  const [panelOrder, setPanelOrder] = useState(["fretboard", "drone", "metro", "mixer"]);
  const [view, setView] = useState("lab");
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  // Global pause
  const [globalPause, setGlobalPause] = useState(false);
  const [pauseElapsed, setPauseElapsed] = useState(0);

  // Focus view state
  const [confirmReset, setConfirmReset] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [customWork, setCustomWork] = useState(20);
  const [customBreak, setCustomBreak] = useState(5);

  // Animations
  const [sunline, setSunline] = useState(false);
  const [justStarted, setJustStarted] = useState(false);

  // PWA update
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // ============================================================================
  // REFS
  // ============================================================================

  const mounted = useRef(false);
  const panelOrderRef = useRef(panelOrder);
  const panelRefs = useRef({});
  const dragState = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const overIdRef = useRef(null);
  const metroBeatRef = useRef(0);
  const metroBarRef = useRef(0);
  const metroStatusRef = useRef("");
  const preBreak = useRef({ droneOn: false, metOn: false, noiseOn: false });
  const prevPhase = useRef(null);
  const droneOnRef = useRef(droneOn);
  const metOnRef = useRef(metOn);
  const noiseOnRef = useRef(noiseOn);
  const metConfigRef = useRef(null);
  const chimeRootRef = useRef(drRoot);
  const pauseStartRef = useRef(null);
  const prePause = useRef({ droneOn: false, metOn: false, noiseOn: false });

  const { dragOverlay, ...dragOverlayProps } = useDragOverlay();
  const focusTimer = useFocusTimer();

  // ============================================================================
  // THEME SWITCH
  // ============================================================================

  const switchTheme = useCallback(() => {
    setSunline(true);
    setTimeout(() => {
      setTheme(t => t === "dark" ? "light" : "dark");
      setTimeout(() => setSunline(false), 150);
    }, 150);
  }, []);

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

  useEffect(() => {
    boot();
  }, [boot]);

  // ============================================================================
  // MASTER VOLUME & BUS LEVELS
  // ============================================================================

  useEffect(() => {
    if (!eng.current) return;
    eng.current.setMasterVolume(volMaster);
  }, [volMaster]);

  useEffect(() => {
    if (!eng.current) return;
    eng.current.setDroneVolume(volDrone);
  }, [volDrone]);

  useEffect(() => {
    if (!eng.current) return;
    eng.current.setMetVolume(volMet);
  }, [volMet]);

  // ============================================================================
  // NOISE LIFECYCLE
  // ============================================================================

  useEffect(() => {
    noiseOnRef.current = noiseOn;
    if (!eng.current) return;
    if (noiseOn) {
      eng.current.startNoise(noiseLevel, noiseTone);
    } else {
      eng.current.stopNoise();
    }
  }, [noiseOn, noiseLevel, noiseTone]);

  // ============================================================================
  // DRONE LIFECYCLE
  // ============================================================================

  useEffect(() => {
    droneOnRef.current = droneOn;
    if (!eng.current) return;

    if (droneOn) {
      const notes = drMode === "custom" ? customNotes : drHarm;
      eng.current.startDrone(drRoot, drOct, drTex, notes, drMode);
    } else {
      eng.current.stopDrone();
    }
  }, [droneOn, drRoot, drOct, drTex, drHarm, drMode, customNotes]);

  // ============================================================================
  // METRONOME CONFIG & LIFECYCLE
  // ============================================================================

  useEffect(() => {
    if (!eng.current) return;

    let config = {
      bpm,
      n: timeSig.n,
      d: timeSig.d,
      subdiv,
      clickMode,
      customAccents,
      beatEmphasis,
      gapBars,
      gapSilent,
      gapCustom,
      rampMode,
      rampEnd,
      rampBars,
      countIn,
      clave: claveMode ? {
        feel: claveFeel,
        type: claveType,
        dir: claveDir,
        pat68: clave68Pat,
        pulse: clavePulse,
        countIn: claveCountIn,
      } : null,
    };

    metConfigRef.current = config;
    if (metOn) {
      eng.current.configMetronome(config);
    }
  }, [bpm, timeSig, subdiv, clickMode, customAccents, beatEmphasis, gapBars, gapSilent, gapCustom, rampMode, rampEnd, rampBars, countIn, claveMode, claveFeel, claveType, claveDir, clave68Pat, clavePulse, claveCountIn]);

  useEffect(() => {
    metOnRef.current = metOn;
    if (!eng.current) return;

    if (metOn) {
      if (metConfigRef.current) {
        eng.current.configMetronome(metConfigRef.current);
      }
      eng.current.startMetronome();
    } else {
      eng.current.stopMetronome();
    }
  }, [metOn]);

  // ============================================================================
  // GLOBAL PAUSE / RESUME
  // ============================================================================

  useEffect(() => {
    if (!eng.current) return;

    if (globalPause) {
      preBreak.current = { droneOn: droneOnRef.current, metOn: metOnRef.current, noiseOn: noiseOnRef.current };
      eng.current.pauseAll();
      pauseStartRef.current = Date.now();
    } else {
      eng.current.resumeAll();
    }
  }, [globalPause]);

  // ============================================================================
  // BREAK PAUSE/RESUME (Focus Timer)
  // ============================================================================

  useEffect(() => {
    if (!focusTimer.inBreak) return;

    prePause.current = {
      droneOn: droneOnRef.current,
      metOn: metOnRef.current,
      noiseOn: noiseOnRef.current,
    };

    if (droneOnRef.current) setDroneOn(false);
    if (metOnRef.current) setMetOn(false);
    if (noiseOnRef.current) setNoiseOn(false);
  }, [focusTimer.inBreak]);

  useEffect(() => {
    if (focusTimer.inBreak || !focusTimer.breakEnded) return;

    if (prePause.current.droneOn) setDroneOn(true);
    if (prePause.current.metOn) setMetOn(true);
    if (prePause.current.noiseOn) setNoiseOn(true);
  }, [focusTimer.breakEnded, focusTimer.inBreak]);

  // ============================================================================
  // VISIBILITY CHANGE - SUSPEND/RESUME AudioContext
  // ============================================================================

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (eng.current?.ctx?.state === 'running') {
          eng.current.ctx.suspend();
        }
      } else {
        if (eng.current?.ctx?.state === 'suspended') {
          eng.current.ctx.resume();
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ============================================================================
  // WAKE LOCK - KEEP SCREEN ON WHEN AUDIO IS ACTIVE
  // ============================================================================

  useEffect(() => {
    if (droneOn || metOn || noiseOn) {
      wakeLock.request();
    } else {
      wakeLock.release();
    }
  }, [droneOn, metOn, noiseOn]);

  // ============================================================================
  // PWA UPDATE LISTENER
  // ============================================================================

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      });
    }
  }, []);

  // ============================================================================
  // TIMESIG CHANGE - UPDATE ACCENT LENGTH
  // ============================================================================

  useEffect(() => {
    const n = timeSig.n;
    if (customAccents.length !== n) {
      const newAccents = new Array(n).fill(false);
      newAccents[0] = true;
      setCustomAccents(newAccents);

      const newEmphasis = new Array(n).fill(0);
      setBeatEmphasis(newEmphasis);
    }
  }, [timeSig.n, customAccents.length]);

  // ============================================================================
  // REF UPDATES FOR FRETBOARD STATE
  // ============================================================================

  useEffect(() => {
    panelOrderRef.current = panelOrder;
  }, [panelOrder]);

  useEffect(() => {
    chimeRootRef.current = drRoot;
  }, [drRoot]);

  // ============================================================================
  // FRETBOARD CALLBACK
  // ============================================================================

  const onFret = useCallback((str, fret) => {
    if (!eng.current) return;

    const note = (str * 5 + 4 + fret) % 12;
    const idx = noteIdx(note);
    if (idx < 0) return;

    eng.current.playChime(idx, 1.0);
    setLit({ str, fret, time: Date.now() });
    setTimeout(() => {
      setLit(prev => prev && prev.time === setLit.time ? null : prev);
    }, 100);
  }, []);

  // ============================================================================
  // TOGGLE HARMONY
  // ============================================================================

  const toggleH = useCallback((i) => {
    setDrHarm(prev => {
      const arr = [...prev];
      const idx = NOTES.indexOf(prev[i]);
      if (idx >= 0) {
        arr[i] = NOTES[(idx + 1) % NOTES.length];
      } else {
        arr[i] = NOTES[0];
      }
      return arr;
    });
  }, []);

  // ============================================================================
  // CYCLE ACCENTS
  // ============================================================================

  const cycleAccent = useCallback((i) => {
    setCustomAccents(prev => {
      const arr = [...prev];
      arr[i] = !arr[i];
      return arr;
    });
  }, []);

  // ============================================================================
  // TOGGLE METRONOME
  // ============================================================================

  const toggleMet = useCallback(() => {
    setMetOn(prev => !prev);
  }, []);

  // ============================================================================
  // ALL OFF
  // ============================================================================

  const allOff = useCallback(() => {
    setDroneOn(false);
    setMetOn(false);
    setNoiseOn(false);
    focusTimer.stop();
    setGlobalPause(false);
  }, [focusTimer]);

  // ============================================================================
  // PAUSE ALL / RESUME PRACTICE
  // ============================================================================

  const pauseAll = useCallback(() => {
    setGlobalPause(true);
  }, []);

  const resumePractice = useCallback(() => {
    if (globalPause) {
      const elapsed = (Date.now() - (pauseStartRef.current || Date.now())) / 1000;
      setPauseElapsed(elapsed);
    }
    setGlobalPause(false);
  }, [globalPause]);

  // ============================================================================
  // DRAG & DROP
  // ============================================================================

  const onHandleDown = useCallback((id, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dbStart(dragState.current, rect.left, rect.top);
    setDragId(id);
  }, []);

  const DragHandle = ({ id }) => (
    <div
      onMouseDown={(e) => onHandleDown(id, e)}
      style={{
        width: 20,
        height: 20,
        cursor: "grab",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: T.txt + "80",
        fontSize: 12,
        userSelect: "none",
      }}
    >
      ⋮⋮
    </div>
  );

  const PanelWrap = ({ id, children, title }) => {
    const onMouseMove = (e) => {
      if (dragId !== id) return;
      dbSetMove(dragState.current, e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      if (dragId !== id) return;
      setDragId(null);
      setOverId(null);
      dbSetUp();
    };

    const onMouseEnter = () => {
      if (dragId === null || dragId === id) return;
      setOverId(id);
    };

    const onMouseLeave = () => {
      if (dragId === null || dragId === id) return;
      setOverId(null);
    };

    return (
      <div
        ref={(el) => {
          if (el) panelRefs.current[id] = el;
        }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          flex: 1,
          minWidth: isMobile ? "100%" : "auto",
          padding: 12,
          background: T.bg2,
          border: `1px solid ${T.txt}20`,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          opacity: dragId === id ? 0.5 : 1,
          transition: dragId ? "none" : "opacity 200ms",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <DragHandle id={id} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.txt, flex: 1 }}>{title}</span>
        </div>
        {children}
      </div>
    );
  };

  // ============================================================================
  // METRONOME CALLBACK (with visual updates)
  // ============================================================================

  const metCbRef = useRef(null);
  useEffect(() => {
    metCbRef.current = (beat, bar, phase) => {
      metroBeatRef.current = beat;
      metroBarRef.current = bar;

      const isClave = claveMode && phase && (phase.clave === 1 || phase.clave === 2);
      const claveLabel = isClave ? (phase.clave === 1 ? "son" : "rumba") : "";

      let status = "";
      if (rampMode !== "off" && phase && phase.rampBpm) {
        status = `${phase.rampBpm} BPM`;
      }

      metroStatusRef.current = { beat, bar, status, clave: claveLabel };

      if (eng.current && metCbRef.current) {
        eng.current.setMetronomeCallback(metCbRef.current);
      }
    };

    if (eng.current && metCbRef.current) {
      eng.current.setMetronomeCallback(metCbRef.current);
    }
  }, [claveMode]);

  // ============================================================================
  // PANEL RENDERERS
  // ============================================================================

  const renderFretboard = () => (
    <PanelWrap id="fretboard" title="Fretboard">
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 11, color: T.txt + "80" }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setStrings(n)}
              style={{
                padding: "4px 8px",
                margin: "0 2px",
                background: strings === n ? T.ok : T.txt + "20",
                color: strings === n ? T.bg : T.txt,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: strings === n ? 600 : 400,
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <Board
        strings={strings}
        lit={lit}
        onFret={onFret}
        theme={T}
        isMobile={isMobile}
      />
    </PanelWrap>
  );

  const renderDrone = () => (
    <PanelWrap id="drone" title="Drone">
      <div style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Root</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {NOTES.map(n => (
              <button
                key={n}
                onClick={() => setDrRoot(n)}
                style={{
                  padding: "4px 8px",
                  background: drRoot === n ? T.ok : T.txt + "20",
                  color: drRoot === n ? T.bg : T.txt,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: drRoot === n ? 600 : 400,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 0.5 }}>
          <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Oct</label>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4].map(o => (
              <button
                key={o}
                onClick={() => setDrOct(o)}
                style={{
                  padding: "4px 8px",
                  background: drOct === o ? T.ok : T.txt + "20",
                  color: drOct === o ? T.bg : T.txt,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: drOct === o ? 600 : 400,
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Texture</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {Object.keys(TEXTURES).map(tex => (
            <button
              key={tex}
              onClick={() => setDrTex(tex)}
              style={{
                padding: "4px 8px",
                background: drTex === tex ? T.ok : T.txt + "20",
                color: drTex === tex ? T.bg : T.txt,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 9,
                fontWeight: drTex === tex ? 600 : 400,
                textTransform: "capitalize",
              }}
            >
              {tex}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Mode</label>
        <div style={{ display: "flex", gap: 4 }}>
          {["harmony", "custom"].map(m => (
            <button
              key={m}
              onClick={() => setDrMode(m)}
              style={{
                padding: "4px 12px",
                background: drMode === m ? T.ok : T.txt + "20",
                color: drMode === m ? T.bg : T.txt,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: drMode === m ? 600 : 400,
                textTransform: "capitalize",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {drMode === "harmony" && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Harmonies</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[0, 1, 2, 3].map(i => (
              <button
                key={i}
                onClick={() => toggleH(i)}
                style={{
                  padding: "4px 8px",
                  background: T.txt + "20",
                  color: T.txt,
                  border: `1px solid ${T.txt}40`,
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 9,
                  textTransform: "uppercase",
                }}
              >
                {drHarm[i] || "—"}
              </button>
            ))}
          </div>
        </div>
      )}

      {drMode === "custom" && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Custom Notes</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {NOTES.map(n => (
              <button
                key={n}
                onClick={() => {
                  setCustomNotes(prev =>
                    prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
                  );
                }}
                style={{
                  padding: "4px 8px",
                  background: customNotes.includes(n) ? T.ok : T.txt + "20",
                  color: customNotes.includes(n) ? T.bg : T.txt,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: customNotes.includes(n) ? 600 : 400,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <Pill
        label="Drone"
        active={droneOn}
        onClick={() => setDroneOn(!droneOn)}
        theme={T}
      />
    </PanelWrap>
  );

  const renderMetro = () => (
    <PanelWrap id="metro" title="Metronome">
      <div style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: isMobile ? "100%" : 200 }}>
          <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>BPM</label>
          <BPMKnob
            value={bpm}
            onChange={setBpm}
            theme={T}
          />
          <div style={{ marginTop: 8, textAlign: "center", fontSize: 14, fontWeight: 600, color: T.ok }}>
            {bpm}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Time Sig</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {TIME_SIGS.map(ts => (
              <button
                key={ts.label}
                onClick={() => setTimeSig(ts)}
                style={{
                  padding: "6px 10px",
                  background: timeSig.label === ts.label ? T.ok : T.txt + "20",
                  color: timeSig.label === ts.label ? T.bg : T.txt,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: timeSig.label === ts.label ? 600 : 400,
                }}
              >
                {ts.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Subdivision</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {SUBDIV_OPTS.map(opt => (
            <button
              key={opt}
              onClick={() => setSubdiv(opt)}
              style={{
                padding: "4px 8px",
                background: subdiv === opt ? T.ok : T.txt + "20",
                color: subdiv === opt ? T.bg : T.txt,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 9,
                fontWeight: subdiv === opt ? 600 : 400,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Click Mode</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CLICK_MODES.map(cm => (
            <button
              key={cm}
              onClick={() => setClickMode(cm)}
              style={{
                padding: "4px 8px",
                background: clickMode === cm ? T.ok : T.txt + "20",
                color: clickMode === cm ? T.bg : T.txt,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 9,
                fontWeight: clickMode === cm ? 600 : 400,
              }}
            >
              {cm}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Accents</label>
        <div style={{ display: "flex", gap: 4 }}>
          {customAccents.map((acc, i) => (
            <button
              key={i}
              onClick={() => cycleAccent(i)}
              style={{
                padding: "4px 8px",
                background: acc ? T.ok : T.txt + "20",
                color: acc ? T.bg : T.txt,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: acc ? 600 : 400,
                minWidth: 32,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Gap Bars</label>
        <HSlider
          value={gapBars}
          min={0}
          max={16}
          onChange={setGapBars}
          theme={T}
          label={`${gapBars}`}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Gap Silent</label>
        <HSlider
          value={gapSilent}
          min={0}
          max={16}
          onChange={setGapSilent}
          theme={T}
          label={`${gapSilent}`}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => setGapCustom(!gapCustom)}
          style={{
            padding: "6px 12px",
            background: gapCustom ? T.ok : T.txt + "20",
            color: gapCustom ? T.bg : T.txt,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 10,
            fontWeight: gapCustom ? 600 : 400,
          }}
        >
          Custom Gap
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Ramp Mode</label>
        <div style={{ display: "flex", gap: 4 }}>
          {["off", "linear", "expo"].map(m => (
            <button
              key={m}
              onClick={() => setRampMode(m)}
              style={{
                padding: "4px 8px",
                background: rampMode === m ? T.ok : T.txt + "20",
                color: rampMode === m ? T.bg : T.txt,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: rampMode === m ? 600 : 400,
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {rampMode !== "off" && (
        <>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Ramp End BPM</label>
            <HSlider
              value={rampEnd}
              min={30}
              max={300}
              onChange={setRampEnd}
              theme={T}
              label={`${rampEnd}`}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Ramp Bars</label>
            <HSlider
              value={rampBars}
              min={1}
              max={64}
              onChange={setRampBars}
              theme={T}
              label={`${rampBars}`}
            />
          </div>
        </>
      )}

      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => setCountIn(!countIn)}
          style={{
            padding: "6px 12px",
            background: countIn ? T.ok : T.txt + "20",
            color: countIn ? T.bg : T.txt,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 10,
            fontWeight: countIn ? 600 : 400,
          }}
        >
          Count In
        </button>
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.txt}20` }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block", fontWeight: 600 }}>
          Clave
        </label>

        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setClaveMode(!claveMode)}
            style={{
              padding: "6px 12px",
              background: claveMode ? T.ok : T.txt + "20",
              color: claveMode ? T.bg : T.txt,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 10,
              fontWeight: claveMode ? 600 : 400,
            }}
          >
            Enable Clave
          </button>
        </div>

        {claveMode && (
          <>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 9, color: T.txt + "80", marginBottom: 4, display: "block" }}>Feel</label>
              <div style={{ display: "flex", gap: 4 }}>
                {["44", "68"].map(f => (
                  <button
                    key={f}
                    onClick={() => setClaveFeel(f)}
                    style={{
                      padding: "4px 8px",
                      background: claveFeel === f ? T.ok : T.txt + "20",
                      color: claveFeel === f ? T.bg : T.txt,
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 9,
                      fontWeight: claveFeel === f ? 600 : 400,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {claveFeel === "44" && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 9, color: T.txt + "80", marginBottom: 4, display: "block" }}>Type</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {["son", "rumba"].map(t => (
                    <button
                      key={t}
                      onClick={() => setClaveType(t)}
                      style={{
                        padding: "4px 8px",
                        background: claveType === t ? T.ok : T.txt + "20",
                        color: claveType === t ? T.bg : T.txt,
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 9,
                        fontWeight: claveType === t ? 600 : 400,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {claveFeel === "44" && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 9, color: T.txt + "80", marginBottom: 4, display: "block" }}>Direction</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {["32", "23"].map(d => (
                    <button
                      key={d}
                      onClick={() => setClaveDir(d)}
                      style={{
                        padding: "4px 8px",
                        background: claveDir === d ? T.ok : T.txt + "20",
                        color: claveDir === d ? T.bg : T.txt,
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 9,
                        fontWeight: claveDir === d ? 600 : 400,
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {claveFeel === "68" && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 9, color: T.txt + "80", marginBottom: 4, display: "block" }}>Pattern</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {["clave68", "clave68alt"].map(p => (
                    <button
                      key={p}
                      onClick={() => setClave68Pat(p)}
                      style={{
                        padding: "4px 8px",
                        background: clave68Pat === p ? T.ok : T.txt + "20",
                        color: clave68Pat === p ? T.bg : T.txt,
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 9,
                        fontWeight: clave68Pat === p ? 600 : 400,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setClavePulse(!clavePulse)}
                style={{
                  padding: "6px 12px",
                  background: clavePulse ? T.ok : T.txt + "20",
                  color: clavePulse ? T.bg : T.txt,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: clavePulse ? 600 : 400,
                }}
              >
                Clave Pulse
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setClaveCountIn(!claveCountIn)}
                style={{
                  padding: "6px 12px",
                  background: claveCountIn ? T.ok : T.txt + "20",
                  color: claveCountIn ? T.bg : T.txt,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: claveCountIn ? 600 : 400,
                }}
              >
                Clave Count In
              </button>
            </div>
          </>
        )}
      </div>

      <Pill
        label="Metronome"
        active={metOn}
        onClick={toggleMet}
        theme={T}
      />
    </PanelWrap>
  );

  const renderMixer = () => (
    <PanelWrap id="mixer" title="Mixer">
      <div>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Master</label>
        <HSlider
          value={volMaster}
          min={0}
          max={1}
          onChange={setVolMaster}
          theme={T}
          label={`${Math.round(volMaster * 100)}%`}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Drone</label>
        <HSlider
          value={volDrone}
          min={0}
          max={1}
          onChange={setVolDrone}
          theme={T}
          label={`${Math.round(volDrone * 100)}%`}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Metronome</label>
        <HSlider
          value={volMet}
          min={0}
          max={1}
          onChange={setVolMet}
          theme={T}
          label={`${Math.round(volMet * 100)}%`}
        />
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.txt}20` }}>
        <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block", fontWeight: 600 }}>
          Noise
        </label>

        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setNoiseOn(!noiseOn)}
            style={{
              padding: "6px 12px",
              background: noiseOn ? T.ok : T.txt + "20",
              color: noiseOn ? T.bg : T.txt,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 10,
              fontWeight: noiseOn ? 600 : 400,
            }}
          >
            Noise On
          </button>
        </div>

        {noiseOn && (
          <>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Level</label>
              <HSlider
                value={noiseLevel}
                min={0}
                max={1}
                onChange={setNoiseLevel}
                theme={T}
                label={`${Math.round(noiseLevel * 100)}%`}
              />
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Tone</label>
              <ToneKnob
                value={noiseTone}
                onChange={setNoiseTone}
                theme={T}
              />
            </div>
          </>
        )}
      </div>
    </PanelWrap>
  );

  const renderFocusView = () => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 24,
      }}
    >
      <FocusRing
        timer={focusTimer}
        theme={T}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {FOCUS_MODES.map(mode => (
          <button
            key={mode}
            onClick={() => {
              focusTimer.setMode(mode);
            }}
            style={{
              padding: "8px 16px",
              background: focusTimer.mode === mode ? T.ok : T.txt + "20",
              color: focusTimer.mode === mode ? T.bg : T.txt,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: focusTimer.mode === mode ? 600 : 400,
              textTransform: "capitalize",
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {focusTimer.mode === "custom" && (
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Work (min)</label>
            <HSlider
              value={customWork}
              min={1}
              max={60}
              onChange={setCustomWork}
              theme={T}
              label={`${customWork}`}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.txt + "80", marginBottom: 4, display: "block" }}>Break (min)</label>
            <HSlider
              value={customBreak}
              min={1}
              max={30}
              onChange={setCustomBreak}
              theme={T}
              label={`${customBreak}`}
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {!focusTimer.running ? (
          <button
            onClick={() => {
              focusTimer.setCustom(customWork, customBreak);
              focusTimer.start();
            }}
            style={{
              padding: "12px 24px",
              background: T.ok,
              color: T.bg,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Start
          </button>
        ) : (
          <button
            onClick={() => focusTimer.stop()}
            style={{
              padding: "12px 24px",
              background: T.warn,
              color: T.bg,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Stop
          </button>
        )}

        {confirmReset ? (
          <>
            <button
              onClick={() => {
                focusTimer.reset();
                setConfirmReset(false);
              }}
              style={{
                padding: "12px 24px",
                background: T.err,
                color: T.bg,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              style={{
                padding: "12px 24px",
                background: T.txt + "20",
                color: T.txt,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            style={{
              padding: "12px 24px",
              background: T.txt + "20",
              color: T.txt,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Reset
          </button>
        )}
      </div>

      {focusTimer.inBreak && (
        <div style={{ textAlign: "center", color: T.ok, fontSize: 14, fontWeight: 600 }}>
          Take a break!
        </div>
      )}

      {showHelp && (
        <div
          style={{
            maxWidth: 400,
            padding: 16,
            background: T.bg2,
            border: `1px solid ${T.txt}20`,
            borderRadius: 8,
            fontSize: 12,
            color: T.txt,
            lineHeight: 1.6,
          }}
        >
          <p>Focus Mode helps you manage work and break intervals.</p>
          <p style={{ marginTop: 8 }}>
            Presets: Pomodoro (25/5), Long (50/10), Short (15/5), Custom.
          </p>
          <p style={{ marginTop: 8 }}>
            Audio pauses during breaks.
          </p>
        </div>
      )}

      <button
        onClick={() => setShowHelp(!showHelp)}
        style={{
          padding: "6px 12px",
          background: T.txt + "20",
          color: T.txt,
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        {showHelp ? "Hide Help" : "Show Help"}
      </button>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const panelContent = {
    fretboard: renderFretboard(),
    drone: renderDrone(),
    metro: renderMetro(),
    mixer: renderMixer(),
  };

  return (
    <div
      data-theme={theme}
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: T.bg,
        color: T.txt,
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* PWA Update Prompt */}
      {updateAvailable && (
        <div
          className="lbe-theme flex items-center justify-center gap-3 px-4 py-2"
          style={{
            background: T.ok + "15",
            borderBottom: `1px solid ${T.ok}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "8px 16px",
          }}
        >
          <span style={{ fontSize: 10, color: T.ok }}>A new version is available</span>
          <button
            onClick={() => window.location.reload()}
            className="lbe-btn"
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 9,
              fontWeight: "bold",
              background: T.ok + "20",
              border: `1px solid ${T.ok}50`,
              color: T.ok,
              cursor: "pointer",
            }}
          >
            Update
          </button>
        </div>
      )}

      {/* Drag Overlay */}
      {dragId && (
        <div
          ref={dragOverlay}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "transparent",
            cursor: "grabbing",
            zIndex: 1000,
          }}
          onMouseMove={(e) => {
            dbSetMove(dragState.current, e.clientX, e.clientY);
            Object.entries(panelRefs.current).forEach(([id, el]) => {
              const rect = el.getBoundingClientRect();
              const inZone = e.clientX >= rect.left && e.clientX <= rect.right &&
                             e.clientY >= rect.top && e.clientY <= rect.bottom;
              if (inZone && id !== dragId) {
                setOverId(id);
                overIdRef.current = id;
              }
            });
          }}
          onMouseUp={() => {
            setDragId(null);
            setOverId(null);
            dbSetUp();
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: T.bg2,
          borderBottom: `1px solid ${T.txt}20`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Bass Lab</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={switchTheme}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: T.txt + "20",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              color: T.txt,
              opacity: sunline ? 0.5 : 1,
              transition: "opacity 200ms",
            }}
            title="Toggle theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>

      {/* Global Pause Overlay */}
      {globalPause && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: T.bg + "cc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 500,
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 600, color: T.ok }}>PAUSED</div>
          <button
            onClick={resumePractice}
            style={{
              padding: "12px 24px",
              background: T.ok,
              color: T.bg,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Resume
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "8px 16px",
          background: T.bg2,
          borderBottom: `1px solid ${T.txt}20`,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setView("lab")}
          style={{
            padding: "6px 12px",
            background: view === "lab" ? T.ok : T.txt + "20",
            color: view === "lab" ? T.bg : T.txt,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: view === "lab" ? 600 : 400,
          }}
        >
          Lab
        </button>

        <button
          onClick={() => setView("focus")}
          style={{
            padding: "6px 12px",
            background: view === "focus" ? T.ok : T.txt + "20",
            color: view === "focus" ? T.bg : T.txt,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: view === "focus" ? 600 : 400,
          }}
        >
          Focus
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={pauseAll}
          disabled={!droneOn && !metOn && !noiseOn}
          style={{
            padding: "6px 12px",
            background: T.warn + (droneOn || metOn || noiseOn ? "ff" : "40"),
            color: T.bg,
            border: "none",
            borderRadius: 4,
            cursor: droneOn || metOn || noiseOn ? "pointer" : "not-allowed",
            fontSize: 11,
            fontWeight: 600,
            opacity: droneOn || metOn || noiseOn ? 1 : 0.5,
          }}
        >
          Pause
        </button>

        <button
          onClick={allOff}
          disabled={!droneOn && !metOn && !noiseOn && !focusTimer.running}
          style={{
            padding: "6px 12px",
            background: T.err + (droneOn || metOn || noiseOn || focusTimer.running ? "ff" : "40"),
            color: T.bg,
            border: "none",
            borderRadius: 4,
            cursor: droneOn || metOn || noiseOn || focusTimer.running ? "pointer" : "not-allowed",
            fontSize: 11,
            fontWeight: 600,
            opacity: droneOn || metOn || noiseOn || focusTimer.running ? 1 : 0.5,
          }}
        >
          All Off
        </button>
      </div>

      {/* Break Banner */}
      {focusTimer.inBreak && (
        <div
          style={{
            padding: "12px 16px",
            background: T.ok + "20",
            border: `1px solid ${T.ok}40`,
            color: T.ok,
            fontSize: 12,
            fontWeight: 600,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          Break Time — Audio paused until work resumes
        </div>
      )}

      {/* Main Content */}
      {view === "focus" ? (
        renderFocusView()
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 12,
            padding: 12,
            overflow: "auto",
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          {panelOrder.map(id => (
            <div
              key={id}
              style={{
                flex: isMobile ? "0 0 100%" : 1,
                display: "flex",
              }}
            >
              {panelContent[id]}
            </div>
          ))}
        </div>
      )}

      {/* Status Strip */}
      {view === "lab" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            background: T.bg2,
            borderTop: `1px solid ${T.txt}20`,
            fontSize: 10,
            color: T.txt + "80",
            flexShrink: 0,
          }}
        >
          <div>
            {metOn && (
              <>
                <span>Bar {metroBarRef.current} • Beat {metroBeatRef.current + 1}</span>
                {metroStatusRef.current && (
                  <span> • {metroStatusRef.current}</span>
                )}
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {droneOn && <span style={{ color: T.ok }}>●</span>}
            {metOn && <span style={{ color: T.warn }}>●</span>}
            {noiseOn && <span style={{ color: T.txt }}>●</span>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4px 16px",
          background: T.bg2,
          borderTop: `1px solid ${T.txt}20`,
          fontSize: 9,
          color: T.txt + "60",
          flexShrink: 0,
        }}
      >
        <span>Live Bass Lab</span>
      </div>
    </div>
  );
}
