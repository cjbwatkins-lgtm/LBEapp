// ─── MUSIC THEORY CONSTANTS ─────────────────────────────────────────────────
export const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
export const ENHARMONICS = {"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
export const enharmonic = (n) => ENHARMONICS[n] ? `${n}/${ENHARMONICS[n]}` : n;
export const INTERVALS = ["R","m2","M2","m3","M3","P4","TT","P5","m6","M6","m7","M7"];

export const FRETS = 17;
export const MARKERS = new Set([3,5,7,9,12,15]);

export const TUNINGS = {
  4: { label: "4-String", strings: ["E","A","D","G"], midi: [40,45,50,55] },
  5: { label: "5-String", strings: ["B","E","A","D","G"], midi: [35,40,45,50,55] },
  6: { label: "6-String", strings: ["B","E","A","D","G","C"], midi: [35,40,45,50,55,60] },
};

export const TEXTURES = [
  { id: "bassGuitar", name: "Bass Guitar", sub: "Electric bass tone" },
  { id: "organPad",   name: "Organ Pad",   sub: "Hammond drawbar keys" },
  { id: "rhodesEP",   name: "Rhodes EP",   sub: "Electric piano warmth" },
  { id: "deepEarth",  name: "Deep Earth",  sub: "Sub-heavy" },
  { id: "vintageWarmth", name: "Vintage Warmth", sub: "Analog synth pad" },
  { id: "silkBow",    name: "Silk Bow",    sub: "Bowed string sustain" },
  { id: "airyGlass",  name: "Singing Bowl", sub: "Resonant bell tones" },
  { id: "pureBreath",  name: "Pure Breath",  sub: "Beating sines" },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────
export const noteName = (m) => NOTES[((m % 12) + 12) % 12];
export const noteIdx = (n) => NOTES.indexOf(n);
export const intervalName = (m, r) => INTERVALS[((m % 12 - r % 12) % 12 + 12) % 12];
export const pad2 = (n) => String(n).padStart(2, "0");
export const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
