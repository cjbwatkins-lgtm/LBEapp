// ─── DUAL PALETTE ───────────────────────────────────────────────────────────
export const DARK = {
  bg1: "#08090d", bg2: "#0d0f16", bg3: "#13161f", panel: "#1a1e2e",
  line: "#232840", line2: "#2d3352", dim: "#3d4466", muted: "#5a6180",
  sub: "#8b92a8", text: "#b8bdd0",
  accent: "#e8a838", accentDim: "#c4882a", accentGlow: "#f0c050", accentMuted: "#a07828",
  warm: "#d4781c",
  cool: "#4a90d4", coolDeep: "#2a5a8a",
  alert: "#c44040", alertSoft: "#8a3030",
  ok: "#38a868",
  mode: "dark",
};

export const LIGHT = {
  bg1: "#D9D3C8", bg2: "#D1CBBF", bg3: "#C9C1B4", panel: "#C9C1B4",
  line: "#AFA596", line2: "#A49A8A", dim: "#7A746A", muted: "#5A554C",
  sub: "#4A4540", text: "#262422",
  accent: "#8E553A", accentDim: "#7A4A33", accentGlow: "#A06848", accentMuted: "#6A4030",
  warm: "#8E553A",
  cool: "#5A6278", coolDeep: "#444A5E",
  alert: "#8A4040", alertSoft: "#6A4848",
  ok: "#4A7A52",
  mode: "light",
};

// ─── FOCUS TIMER MODES ──────────────────────────────────────────────────────
export const FOCUS_MODES = [
  { id: "micro",    label: "Micro",    work: 15, brk: 3 },
  { id: "standard", label: "Standard", work: 25, brk: 5 },
  { id: "deep",     label: "Deep",     work: 50, brk: 10 },
  { id: "extended", label: "Extended", work: 90, brk: 20 },
];
