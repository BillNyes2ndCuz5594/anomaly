import { StrictMode, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { decodeAll, dayToISO, type DecodedBatch } from '../lib/reportCode'
import {
  agentPct,
  analyze,
  benchmarkLabel,
  LEVELS,
  masteryLevel,
  RETEACH_BELOW,
  sortAgents,
  sortBenchmarks,
  summarize,
  toCsv,
  toGradebook,
  type AgentSort,
  type Analysis,
  type BenchmarkSort,
} from './analysis'
import { makeSampleCodes } from './sample'
import { installTeacherAudio } from '../audio/installTeacher'
import './teacher.css'

installTeacherAudio()

// Teacher HQ entry. Must never import three, R3F, or anything from src/three or the game screens.
// Shares only pure modules: reportCode, the generated catalog, and codename helpers.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Text size and line spacing chosen in the game apply here too (same browser storage, read only).
function applySavedSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('anomaly.v1') ?? 'null')
    const st = raw?.state?.settings
    const scale = { 0: 1, 1: 1.15, 2: 1.3 } as Record<number, number>
    const lh = { 0: 1.5, 1: 1.75, 2: 2 } as Record<number, number>
    if (st && scale[st.textSize]) document.documentElement.style.fontSize = `${16 * scale[st.textSize]}px`
    if (st && lh[st.lineSpacing]) document.body.style.lineHeight = String(lh[st.lineSpacing])
  } catch {
    /* no saved settings, keep defaults */
  }
}
applySavedSettings()

const EMPTY: DecodedBatch = { reports: [], rejected: [] }

function Mark({ pct }: { pct: number }) {
  const l = masteryLevel(pct)
  return (
    <>
      <span>{pct}</span>
      <span className="band" aria-hidden="true">
        {l.glyph}
      </span>
      <span className="sr-only">{`, ${l.label.toLowerCase()}`}</span>
    </>
  )
}

function Legend() {
  return (
    <div className="legend" aria-label="Mastery legend" data-testid="band-legend">
      <span className="muted tiny">Percent correct</span>
      {LEVELS.map((l, i) => (
        <span key={l.key} className="swatch" style={{ background: l.bg, color: l.fg }}>
          <span aria-hidden="true">{l.glyph}</span> {l.label}{' '}
          <span className="range">
            {i === 0 ? `under ${LEVELS[1].min}` : i === LEVELS.length - 1 ? `${l.min} and up` : `${l.min} to ${LEVELS[i + 1].min - 1}`}
          </span>
        </span>
      ))}
      <span className="muted tiny">A dash means not attempted.</span>
    </div>
  )
}

const levelStyle = (pct: number | null | undefined) => {
  if (pct == null) return undefined
  const l = masteryLevel(pct)
  return { background: l.bg, color: l.fg }
}

function Heatmap({ a, benchmarks, agents, reteach }: { a: Analysis; benchmarks: Analysis['benchmarks']; agents: Analysis['agents']; reteach: Set<string> }) {
  const multi = a.classTags.length > 1
  const classAvg = summarize(a).average
  return (
    <div className="heat-scroll" tabIndex={0} role="region" aria-label="Benchmark by agent table, scrolls in this box">
      <table className="heatmap" data-testid="heatmap" aria-label="Percent correct by benchmark and agent">
        <thead>
          {multi ? (
            <tr>
              <th scope="col" className="corner c1">
                Class
              </th>
              <th scope="col" className="c2" />
              {agents.map((c) => (
                <th key={c.key} scope="col" className="mono tag">
                  {c.classTag}
                </th>
              ))}
            </tr>
          ) : null}
          <tr>
            <th scope="col" className="corner c1">
              Benchmark
            </th>
            <th scope="col" className="avg-h c2">
              Class
            </th>
            {agents.map((c) => (
              <th key={c.key} scope="col" className="agent-h" title={`Agent ${c.agent}`}>
                {c.agent}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {benchmarks.map((b) => {
            const all = a.byBenchmark.get(b.id)
            const flag = reteach.has(b.id)
            return (
              <tr key={b.id} className={flag ? 'flag' : undefined} data-testid={flag ? 'row-reteach' : undefined}>
                <th scope="row" className="bench-h c1">
                  <span className="bid">
                    <span className="mono">{b.id}</span>
                    {flag ? <span className="pill">Reteach</span> : null}
                  </span>
                  <span className="muted">{b.label}</span>
                </th>
                <td
                  className="val avg c2"
                  style={levelStyle(all?.pct)}
                  title={all ? `Class: ${all.correct} of ${all.attempts} correct, ${plural(all.agents, 'agent')}` : undefined}
                >
                  {all?.pct != null ? <Mark pct={all.pct} /> : '-'}
                </td>
                {agents.map((c) => {
                  const cell = c.cells.get(b.id)
                  if (!cell) {
                    return (
                      <td key={c.key} className="empty" data-testid={`cell-${b.id}-${c.agent}`} title="Not attempted">
                        <span aria-hidden="true">-</span>
                        <span className="sr-only">Not attempted</span>
                      </td>
                    )
                  }
                  const pct = Math.round((cell.correct / cell.attempts) * 100)
                  return (
                    <td
                      key={c.key}
                      className="val"
                      style={levelStyle(pct)}
                      data-testid={`cell-${b.id}-${c.agent}`}
                      title={`Agent ${c.agent}: ${cell.correct} of ${cell.attempts} correct (${pct}%), stage ${cell.stage}`}
                    >
                      <Mark pct={pct} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="bench-h c1">
              <span className="muted">Agent average</span>
            </th>
            <td className="avg c2" style={levelStyle(classAvg)}>
              {classAvg === null ? '-' : <Mark pct={classAvg} />}
            </td>
            {agents.map((c) => {
              const p = agentPct(c)
              return (
                <td key={c.key} className="val" style={levelStyle(p)}>
                  {p === null ? '-' : <Mark pct={p} />}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Stat({ label, value, note, testid }: { label: string; value: string; note: string; testid: string }) {
  return (
    <div className="stat" data-testid={testid}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="muted tiny">{note}</span>
    </div>
  )
}

function Results({ a, csv }: { a: Analysis; csv: () => void }) {
  const [bSort, setBSort] = useState<BenchmarkSort>('catalog')
  const [aSort, setASort] = useState<AgentSort>('agent')
  const [only, setOnly] = useState(false)
  const [copied, setCopied] = useState('')
  const sum = useMemo(() => summarize(a), [a])
  const reteach = useMemo(() => new Set(sum.reteach), [sum])
  const agents = useMemo(() => sortAgents(a, aSort), [a, aSort])
  const benchmarks = useMemo(() => {
    const all = sortBenchmarks(a, bSort)
    return only ? all.filter((b) => reteach.has(b.id)) : all
  }, [a, bSort, only, reteach])

  async function copy(sep: '\t' | ',', name: string) {
    const text = toGradebook(a, sep, benchmarks, agents)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const t = document.createElement('textarea')
      t.value = text
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setCopied(`Copied ${name} for ${plural(agents.length, 'agent')}.`)
    setTimeout(() => setCopied(''), 3000)
  }

  return (
    <>
      <div className="summary" data-testid="summary" role="group" aria-label="Class summary">
        <Stat testid="stat-students" label="Students" value={String(sum.students)} note="report codes decoded" />
        <Stat
          testid="stat-average"
          label="Average mastery"
          value={sum.average === null ? '-' : `${sum.average}% ${masteryLevel(sum.average).glyph}`}
          note={sum.average === null ? 'no answers yet' : `${masteryLevel(sum.average).label} level, all answers`}
        />
        <Stat
          testid="stat-reteach"
          label="Need reteach"
          value={`${sum.reteach.length} of ${a.benchmarks.length}`}
          note={`benchmarks under ${RETEACH_BELOW}% for the class`}
        />
      </div>

      <section className="card" aria-labelledby="h-heat">
        <div className="card-head">
          <div>
            <h2 id="h-heat">Benchmark by agent</h2>
            <span className="muted tiny">
              {plural(a.agents.length, 'agent')}, {plural(a.benchmarks.length, 'benchmark')}. Rows tagged Reteach are under {RETEACH_BELOW}% for the class.
            </span>
          </div>
          <div className="toolbar no-print">
            <label className="field">
              <span className="tiny muted">Sort benchmarks</span>
              <select data-testid="sort-benchmarks" value={bSort} onChange={(e) => setBSort(e.target.value as BenchmarkSort)}>
                <option value="catalog">Standard order</option>
                <option value="low">Lowest score first</option>
                <option value="high">Highest score first</option>
              </select>
            </label>
            <label className="field">
              <span className="tiny muted">Sort agents</span>
              <select data-testid="sort-agents" value={aSort} onChange={(e) => setASort(e.target.value as AgentSort)}>
                <option value="agent">Agent number</option>
                <option value="low">Lowest average first</option>
                <option value="high">Highest average first</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" data-testid="only-reteach" checked={only} onChange={(e) => setOnly(e.target.checked)} />
              <span>Reteach rows only</span>
            </label>
          </div>
        </div>
        {benchmarks.length ? (
          <Heatmap a={a} benchmarks={benchmarks} agents={agents} reteach={reteach} />
        ) : (
          <p className="muted">No benchmark is under {RETEACH_BELOW}% for this class.</p>
        )}
        <Legend />
        <div className="actions no-print">
          <button type="button" className="btn" data-testid="copy-tsv" onClick={() => void copy('\t', 'TSV')}>
            Copy for gradebook (TSV)
          </button>
          <button type="button" className="btn" data-testid="copy-csv" onClick={() => void copy(',', 'CSV')}>
            Copy as CSV
          </button>
          <button type="button" className="btn" data-testid="download-csv" onClick={csv}>
            Download CSV
          </button>
          <button type="button" className="btn" data-testid="print" onClick={() => window.print()}>
            Print
          </button>
          <span className="status" role="status" data-testid="copy-status">
            {copied}
          </span>
        </div>
      </section>

      <div className="two">
        <section className="card" aria-labelledby="h-cat" data-testid="categories">
          <h2 id="h-cat">Reporting categories</h2>
          <ul className="bars">
            {a.categories.map((c) => (
              <li key={c.name} data-testid={`cat-${c.name}`}>
                <div className="bar-head">
                  <span>{c.name}</span>
                  <span className="mono">{c.pct === null ? 'No data' : `${c.pct}%`}</span>
                </div>
                <div className="track" role="img" aria-label={c.pct === null ? `${c.name}: no data` : `${c.name}: ${c.pct} percent correct`}>
                  <div
                    className="fill"
                    style={{
                      width: `${c.pct ?? 0}%`,
                      background: c.pct === null ? undefined : masteryLevel(c.pct).bg,
                    }}
                  />
                </div>
                <span className="muted tiny">
                  {c.attempts ? `${c.correct} of ${plural(c.attempts, 'answer')} correct, ${plural(c.agents, 'agent')}` : 'No answers yet in this category'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="h-weak" data-testid="weakest">
          <h2 id="h-weak">Weakest 5 benchmarks</h2>
          <ol className="list">
            {a.weakest.map((w) => (
              <li key={w.id}>
                <span className="mono big-num">{w.pct}%</span>
                <span>
                  <strong className="mono">{w.id}</strong> {w.label}
                  <span className="muted tiny block">
                    {w.correct} of {plural(w.attempts, 'answer')} correct, {plural(w.agents, 'agent')}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card" aria-labelledby="h-miss" data-testid="most-missed">
        <h2 id="h-miss">Most missed items</h2>
        <p className="muted tiny">From each agent's last 20 answers. Item id, short stem, and how many answers missed it.</p>
        {a.missed.length === 0 ? (
          <p className="muted">No missed items in these codes.</p>
        ) : (
          <div className="table-wrap">
            <table className="plain">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Stem</th>
                  <th scope="col">Benchmark</th>
                  <th scope="col">Missed</th>
                </tr>
              </thead>
              <tbody>
                {a.missed.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.id}</td>
                    <td>{m.stem}</td>
                    <td className="mono tiny" title={benchmarkLabel(m.benchmark)}>
                      {m.benchmark}
                    </td>
                    <td className="mono">
                      {m.missed} of {m.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function TeacherApp() {
  const [text, setText] = useState('')
  const [batch, setBatch] = useState<DecodedBatch>(EMPTY)
  const [decoded, setDecoded] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const analysis = useMemo(() => analyze(batch.reports), [batch])

  function decode(source: string) {
    setBatch(decodeAll(source))
    setDecoded(true)
  }

  async function readFiles(files: FileList | File[]) {
    const parts: string[] = []
    for (const f of Array.from(files)) parts.push(await f.text())
    const next = (text.trim() ? text.trimEnd() + '\n' : '') + parts.join('\n')
    setText(next)
    decode(next)
  }

  function loadSample() {
    const next = makeSampleCodes().join('\n')
    setText(next)
    decode(next)
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(analysis)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'anomaly-class-results.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const n = batch.reports.length
  const latest = n ? Math.max(...batch.reports.map((r) => r.day)) : 0

  return (
    <main className="teacher" data-testid="teacher-hq">
      <header className="top">
        <div>
          <span className="mono label">ANOMALY // TEACHER HQ</span>
          <h1>Teacher HQ</h1>
          <p className="muted">Class results by Florida benchmark, decoded from student report codes.</p>
        </div>
        <p className="privacy tiny" data-testid="privacy-note">
          <span aria-hidden="true">{'\u25CF'} </span>Decoded in this browser. Nothing is uploaded. No names.
        </p>
      </header>

      <section className="card no-print" aria-labelledby="h-in">
        <h2 id="h-in">Add report codes</h2>
        <label htmlFor="paste" className="muted">
          Paste report codes, one per line, or any text that contains them, such as a Canvas export.
        </label>
        <div className="input-grid">
          <textarea
            id="paste"
            data-testid="teacher-paste"
            value={text}
            rows={n ? 3 : 6}
            spellCheck={false}
            placeholder="ABCD-EFGH-JKMN-..."
            onChange={(e) => setText(e.target.value)}
          />
          <div
            className={drag ? 'drop on' : 'drop'}
            data-testid="teacher-drop"
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              if (e.dataTransfer.files.length) void readFiles(e.dataTransfer.files)
            }}
          >
            <span>Drop CSV, TXT or HTML files here, or</span>
            <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
              Choose files
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".csv,.txt,.html,.htm,text/*"
              data-testid="teacher-file"
              className="sr-only"
              aria-label="Choose CSV or text files"
              onChange={(e) => {
                if (e.target.files?.length) void readFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn primary" data-testid="teacher-decode" onClick={() => decode(text)}>
            Decode
          </button>
          <button type="button" className="btn" data-testid="load-sample" onClick={loadSample}>
            Load sample class
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setText('')
              setBatch(EMPTY)
              setDecoded(false)
            }}
          >
            Clear
          </button>
        </div>
        <p className="status" role="status" data-testid="teacher-status">
          {decoded
            ? n
              ? `${n} ${n === 1 ? 'agent' : 'agents'} decoded, newest code from ${dayToISO(latest)}.${batch.rejected.length ? ` ${batch.rejected.length} ${batch.rejected.length === 1 ? 'code was' : 'codes were'} skipped.` : ''}`
              : batch.rejected.length
                ? 'No valid codes found.'
                : 'No codes found. Paste codes or drop a file first.'
            : ''}
        </p>
        {batch.rejected.length ? (
          <ul className="rejects" data-testid="teacher-rejected">
            {batch.rejected.slice(0, 5).map((r) => (
              <li key={r.token}>
                <span aria-hidden="true">{'\u2716'} </span>
                <span className="mono">{r.token.slice(0, 19)}...</span> {r.error}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {n ? (
        <Results a={analysis} csv={downloadCsv} />
      ) : (
        <section className="card empty-state no-print" data-testid="empty-state">
          <h2>No class loaded yet</h2>
          <p className="muted">Paste codes above and press Decode, or load the sample class to see how the table works.</p>
        </section>
      )}

      <section className="card help no-print" data-testid="canvas-help">
        <h2>How to use with Canvas</h2>
        <ol>
          <li>Make a Canvas assignment with a Text Entry submission. Tell students to paste their report code.</li>
          <li>After a shift, students open the Results screen, tap Copy, and paste the code into the assignment.</li>
          <li>
            Collect the submissions. Either copy the text from SpeedGrader or the submissions page and paste it above, or download the submissions and drop the
            files here. Menus differ between Canvas versions.
          </li>
          <li>Press Decode. Extra words, names of columns, and blank lines are ignored. If a student pasted a code with a typo, it is listed as skipped.</li>
        </ol>
        <p className="muted tiny">Codes hold an agent number and progress only. They never hold a name.</p>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TeacherApp />
  </StrictMode>,
)
