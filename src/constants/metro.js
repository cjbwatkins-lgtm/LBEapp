// ─── METRONOME CONSTANTS ────────────────────────────────────────────────────
export const TIME_SIGS = [
  { n: 4, d: 4, label: "4/4" },
  { n: 3, d: 4, label: "3/4" },
  { n: 2, d: 4, label: "2/4" },
  { n: 5, d: 4, label: "5/4" },
  { n: 6, d: 8, label: "6/8" },
  { n: 7, d: 8, label: "7/8" },
  { n: 9, d: 8, label: "9/8" },
];

export const SUBDIV_OPTS = [
  { id: "none", label: "—", mult: 1 },
  { id: "8th",  label: "8th", mult: 2 },
  { id: "trip", label: "3", mult: 3 },
  { id: "16th", label: "16th", mult: 4 },
  { id: "quint", label: "5", mult: 5 },
  { id: "sext", label: "6", mult: 6 },
  { id: "sept", label: "7", mult: 7 },
  { id: "32nd", label: "32nd", mult: 8 },
];

export const ACCENT_CYCLE = ["all", "1only", "13", "24", "custom"];
export const ACCENT_LABELS = {
  all: "All Beats",
  "1only": "Beat 1",
  "13": "1 & 3",
  "24": "2 & 4",
  custom: "Custom",
  offbeat: "Off-beats",
};

export const CLICK_MODES = [
  { id: "all",     label: "All Beats" },
  { id: "1only",   label: "Beat 1" },
  { id: "13",      label: "1 & 3" },
  { id: "24",      label: "2 & 4" },
  { id: "offbeat", label: "Off-beats" },
  { id: "custom",  label: "Custom" },
];

// ─── CLAVE PATTERNS ─────────────────────────────────────────────────────────
// 4/4: 16 steps = 16th notes across 2 bars
export const CLAVE_44 = {
  son32:   [0, 3, 6, 10, 12],
  son23:   [2, 4, 8, 11, 14],
  rumba32: [0, 3, 7, 10, 12],
  rumba23: [2, 4, 8, 11, 15],
};
export const CLAVE_44_PULSE = [0, 4, 8, 12];
export const CLAVE_44_STEPS = 16;

// 6/8: 12 steps = 8th notes across 2 bars of 6/8
export const CLAVE_68 = {
  clave68: [0, 3, 6, 8, 10],
  bembe:   [0, 3, 5, 6, 8, 10],
};
export const CLAVE_68_PULSE = [0, 6];
export const CLAVE_68_STEPS = 12;
