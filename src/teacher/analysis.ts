// Teacher HQ analysis. Pure functions over decoded report codes. No three, no game state.
import { CATALOG_BENCHMARKS, CATALOG_ITEMS } from "../lib/catalog.generated";
import { dayToISO, type ReportData, type StageName } from "../lib/reportCode";

export const CATEGORIES = [
  "Nature of Science",
  "Earth and Space",
  "Physical",
  "Life",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Reporting category from the benchmark id: SC.5.N.* Nature of Science, E Earth and Space, P Physical, L Life. */
export function categoryOf(benchmarkId: string): Category {
  switch (benchmarkId.split(".")[2]) {
    case "N":
      return "Nature of Science";
    case "E":
      return "Earth and Space";
    case "P":
      return "Physical";
    default:
      return "Life";
  }
}

export const benchmarkLabel = (id: string): string =>
  CATALOG_BENCHMARKS.find((b) => b.id === id)?.label ?? id;

export interface Cell {
  attempts: number;
  correct: number;
  stage: StageName;
}

export interface AgentColumn {
  key: string;
  agent: number;
  classHash: number;
  /** Short class tag from the class hash, since the class code itself is never in a code. */
  classTag: string;
  day: number;
  cells: Map<string, Cell>;
}

export interface Pct {
  attempts: number;
  correct: number;
  /** Whole percent, or null when there is no attempt. */
  pct: number | null;
}

export interface Analysis {
  agents: AgentColumn[];
  /** Benchmarks with at least one attempt, in catalog order. */
  benchmarks: { id: string; label: string; category: Category }[];
  byBenchmark: Map<string, Pct & { agents: number }>;
  categories: (Pct & { name: Category; agents: number })[];
  weakest: {
    id: string;
    label: string;
    attempts: number;
    correct: number;
    pct: number;
    agents: number;
  }[];
  missed: {
    id: string;
    stem: string;
    benchmark: string;
    missed: number;
    total: number;
  }[];
  classTags: string[];
}

const pctOf = (correct: number, attempts: number): number | null =>
  attempts > 0 ? Math.round((correct / attempts) * 100) : null;

export const classTag = (hash: number): string =>
  hash.toString(16).toUpperCase().padStart(4, "0");

export function analyze(reports: ReportData[]): Analysis {
  const agents: AgentColumn[] = reports
    .map((r) => ({
      key: `${r.classHash}:${r.agent}`,
      agent: r.agent,
      classHash: r.classHash,
      classTag: classTag(r.classHash),
      day: r.day,
      cells: new Map(
        r.benchmarks
          .filter((b) => b.attempts > 0)
          .map((b) => [
            b.id,
            { attempts: b.attempts, correct: b.correct, stage: b.stage },
          ]),
      ),
    }))
    .sort((a, b) => a.classHash - b.classHash || a.agent - b.agent);

  const byBenchmark = new Map<string, Pct & { agents: number }>();
  for (const a of agents) {
    for (const [id, c] of a.cells) {
      const cur = byBenchmark.get(id) ?? {
        attempts: 0,
        correct: 0,
        pct: null,
        agents: 0,
      };
      cur.attempts += c.attempts;
      cur.correct += c.correct;
      cur.agents += 1;
      byBenchmark.set(id, cur);
    }
  }
  for (const v of byBenchmark.values()) v.pct = pctOf(v.correct, v.attempts);

  const benchmarks = CATALOG_BENCHMARKS.filter((b) =>
    byBenchmark.has(b.id),
  ).map((b) => ({ id: b.id, label: b.label, category: categoryOf(b.id) }));

  const categories = CATEGORIES.map((name) => {
    let attempts = 0;
    let correct = 0;
    const who = new Set<string>();
    for (const a of agents) {
      for (const [id, c] of a.cells) {
        if (categoryOf(id) !== name) continue;
        attempts += c.attempts;
        correct += c.correct;
        who.add(a.key);
      }
    }
    return {
      name,
      attempts,
      correct,
      pct: pctOf(correct, attempts),
      agents: who.size,
    };
  });

  const weakest = benchmarks
    .map((b) => ({ id: b.id, label: b.label, ...byBenchmark.get(b.id)! }))
    .map((b) => ({
      id: b.id,
      label: b.label,
      attempts: b.attempts,
      correct: b.correct,
      pct: b.pct ?? 0,
      agents: b.agents,
    }))
    .sort((a, b) => a.pct - b.pct || b.attempts - a.attempts)
    .slice(0, 5);

  const item = new Map<string, { missed: number; total: number }>();
  for (const r of reports) {
    for (const x of r.recent) {
      const cur = item.get(x.itemId) ?? { missed: 0, total: 0 };
      cur.total += 1;
      if (!x.correct) cur.missed += 1;
      item.set(x.itemId, cur);
    }
  }
  const missed = [...item.entries()]
    .filter(([, v]) => v.missed > 0)
    .map(([id, v]) => {
      const c = CATALOG_ITEMS.find((i) => i.id === id);
      return { id, stem: c?.stem ?? "", benchmark: c?.benchmark ?? "", ...v };
    })
    .sort(
      (a, b) =>
        b.missed - a.missed ||
        b.missed / b.total - a.missed / a.total ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 8);

  return {
    agents,
    benchmarks,
    byBenchmark,
    categories,
    weakest,
    missed,
    classTags: [...new Set(agents.map((a) => a.classTag))],
  };
}

// ---------- color scale ----------

/** Viridis-like sequential ramp: dark purple (0) to a soft mint (100). Calmer than full yellow, still safe for the common color vision types. */
const RAMP: readonly [number, number, number][] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 144, 141],
  [74, 182, 124],
  [172, 223, 156],
];

export function scaleColor(pct: number): { bg: string; fg: string } {
  const t = Math.max(0, Math.min(1, pct / 100)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  const f = t - i;
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f));
  // Text is whichever of white and navy has the higher WCAG contrast on this cell.
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  // Near black, not the panel navy: navy and white leave a gap around mid luminance where neither reaches 4.5:1.
  const NAVY_LUM = 0.0015; // #02050a
  const onWhite = 1.05 / (lum + 0.05);
  const onNavy = (lum + 0.05) / (NAVY_LUM + 0.05);
  return {
    bg: `rgb(${c[0]}, ${c[1]}, ${c[2]})`,
    fg: onNavy >= onWhite ? "#02050a" : "#ffffff",
  };
}

// ---------- CSV ----------

export function toCsv(a: Analysis): string {
  const rows = [
    "class,agent,benchmark,category,attempts,correct,percent,stage,date",
  ];
  for (const col of a.agents) {
    for (const b of a.benchmarks) {
      const c = col.cells.get(b.id);
      if (!c) continue;
      rows.push(
        [
          col.classTag,
          col.agent,
          b.id,
          `"${b.category}"`,
          c.attempts,
          c.correct,
          pctOf(c.correct, c.attempts) ?? "",
          c.stage,
          dayToISO(col.day),
        ].join(","),
      );
    }
  }
  return rows.join("\n") + "\n";
}

// ---------- mastery levels, summary, sorting, gradebook export ----------

export type LevelKey = "reteach" | "developing" | "secure";

export interface Level {
  key: LevelKey;
  label: string;
  /** Marker shown next to the number so color is never the only signal. */
  glyph: string;
  bg: string;
  fg: string;
  /** Inclusive lower bound in whole percent. */
  min: number;
}

/** Three calm levels. Every bg and fg pair is at least 4.5:1 (checked in the test). */
export const LEVELS: readonly Level[] = [
  {
    key: "reteach",
    label: "Reteach",
    glyph: "\u25BC",
    bg: "#8a3a16",
    fg: "#ffffff",
    min: 0,
  },
  {
    key: "developing",
    label: "Developing",
    glyph: "\u25A0",
    bg: "#3f4f7a",
    fg: "#ffffff",
    min: 60,
  },
  {
    key: "secure",
    label: "Secure",
    glyph: "\u25B2",
    bg: "#0f766e",
    fg: "#ffffff",
    min: 80,
  },
];

/** A benchmark is flagged for reteach when the class percent is under this. */
export const RETEACH_BELOW = LEVELS[1].min;

export function masteryLevel(pct: number): Level {
  let out = LEVELS[0];
  for (const l of LEVELS) if (pct >= l.min) out = l;
  return out;
}

export function relLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * lin((n >> 16) & 255) +
    0.7152 * lin((n >> 8) & 255) +
    0.0722 * lin(n & 255)
  );
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** One agent's overall percent across every benchmark attempted, or null. */
export function agentPct(col: AgentColumn): number | null {
  let attempts = 0;
  let correct = 0;
  for (const c of col.cells.values()) {
    attempts += c.attempts;
    correct += c.correct;
  }
  return pctOf(correct, attempts);
}

export interface Summary {
  students: number;
  /** Overall percent correct across all answers, or null with no data. */
  average: number | null;
  /** Benchmark ids whose class percent is under RETEACH_BELOW, lowest first. */
  reteach: string[];
}

export function summarize(a: Analysis): Summary {
  let attempts = 0;
  let correct = 0;
  for (const v of a.byBenchmark.values()) {
    attempts += v.attempts;
    correct += v.correct;
  }
  const reteach = [...a.byBenchmark.entries()]
    .filter(([, v]) => v.pct !== null && v.pct < RETEACH_BELOW)
    .sort(
      (x, y) => (x[1].pct ?? 0) - (y[1].pct ?? 0) || x[0].localeCompare(y[0]),
    )
    .map(([id]) => id);
  return {
    students: a.agents.length,
    average: pctOf(correct, attempts),
    reteach,
  };
}

export type BenchmarkSort = "catalog" | "low" | "high";
export type AgentSort = "agent" | "low" | "high";

/** Stable sort, nulls last. Does not mutate the input. */
export function sortBenchmarks(
  a: Analysis,
  mode: BenchmarkSort,
): Analysis["benchmarks"] {
  if (mode === "catalog") return a.benchmarks;
  const dir = mode === "low" ? 1 : -1;
  const v = (id: string) => a.byBenchmark.get(id)?.pct ?? null;
  return [...a.benchmarks].sort((x, y) => {
    const px = v(x.id);
    const py = v(y.id);
    if (px === null || py === null) return px === py ? 0 : px === null ? 1 : -1;
    return dir * (px - py);
  });
}

export function sortAgents(a: Analysis, mode: AgentSort): AgentColumn[] {
  if (mode === "agent") return a.agents;
  const dir = mode === "low" ? 1 : -1;
  return [...a.agents].sort((x, y) => {
    const px = agentPct(x);
    const py = agentPct(y);
    if (px === null || py === null) return px === py ? 0 : px === null ? 1 : -1;
    return dir * (px - py);
  });
}

const cellText = (v: string | number, sep: string): string => {
  const s = String(v);
  return s.includes(sep) || /["\n\r]/.test(s)
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

/**
 * Gradebook matrix: one row per agent, one column per benchmark (percent, blank if not attempted).
 * Uses the benchmark and agent order it is given so it matches what the teacher sees on screen.
 */
export function toGradebook(
  a: Analysis,
  sep: "\t" | ",",
  benchmarks = a.benchmarks,
  agents = a.agents,
): string {
  const multi = a.classTags.length > 1;
  const head = [
    ...(multi ? ["Class"] : []),
    "Agent",
    "Average",
    ...benchmarks.map((b) => b.id),
  ];
  const lines = [head.map((h) => cellText(h, sep)).join(sep)];
  for (const col of agents) {
    const row = [
      ...(multi ? [col.classTag] : []),
      col.agent,
      agentPct(col) ?? "",
      ...benchmarks.map((b) => {
        const c = col.cells.get(b.id);
        return c ? (pctOf(c.correct, c.attempts) ?? "") : "";
      }),
    ];
    lines.push(row.map((v) => cellText(v, sep)).join(sep));
  }
  const classRow = [
    ...(multi ? [""] : []),
    "Class",
    summarize(a).average ?? "",
    ...benchmarks.map((b) => a.byBenchmark.get(b.id)?.pct ?? ""),
  ];
  lines.push(classRow.map((v) => cellText(v, sep)).join(sep));
  return lines.join("\n") + "\n";
}
