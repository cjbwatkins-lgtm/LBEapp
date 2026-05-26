// ─── DUAL PALETTE ───────────────────────────────────────────────────────────
export const DARK = {
  bg: "#080e1a",
  bg1: "#080e1a", bg2: "#0b1220", bg3: "#0f1828", panel: "#131e33",
  line: "#1c2840", line2: "#253354", dim: "#36486a", muted: "#4e6488",
  sub: "#7890aa", text: "#b2c0d2", txt: "#b2c0d2",
  accent: "#d4a020", accentDim: "#b08418", accentGlow: "#f0c840", accentMuted: "#806018",
  warm: "#c87020",
  cool: "#3a80c8", coolDeep: "#1a508a",
  alert: "#c04040", alertSoft: "#803030",
  ok: "#2ea868",
  warn: "#d4a020",
  err: "#c04040",
  mode: "dark",
};

export const LIGHT = {
  bg: "#D9D3C8",
  bg1: "#D9D3C8", bg2: "#D1CBBF", bg3: "#C9C1B4", panel: "#C9C1B4",
  line: "#AFA596", line2: "#A49A8A", dim: "#7A746A", muted: "#5A554C",
  sub: "#4A4540", text: "#262422", txt: "#262422",
  accent: "#8E553A", accentDim: "#7A4A33", accentGlow: "#A06848", accentMuted: "#6A4030",
  warm: "#8E553A",
  cool: "#5A6278", coolDeep: "#444A5E",
  alert: "#8A4040", alertSoft: "#6A4848",
  ok: "#4A7A52",
  warn: "#8E553A",
  err: "#8A4040",
  mode: "light",
};

export const FOCUS_MODES = [
  { id: "micro",    label: "Micro",    work: 15, brk: 3 },
  { id: "standard", label: "Standard", work: 25, brk: 5 },
  { id: "deep",     label: "Deep",     work: 50, brk: 10 },
  { id: "extended", label: "Extended", work: 90, brk: 20 },
  { id: "custom",   label: "Custom",   work: 20, brk: 5 },
];
