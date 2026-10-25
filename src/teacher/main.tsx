import { StrictMode, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { decodeAll, dayToISO, type DecodedBatch } from '../lib/reportCode'
import { analyze, benchmarkLabel, scaleColor, toCsv, type Analysis } from './analysis'
import { makeSampleCodes } from './sample'
import './teacher.css'

// Teacher HQ entry. Must never import three, R3F, or anything from src/three or the game screens.
// Shares only pure modules: reportCode, the generated catalog, and codename helpers.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const EMPTY: DecodedBatch = { reports: [], rejected: [] }

function Heatmap({ a }: { a: Analysis }) {
  const multi = a.classTags.length > 1
  return (
    <div className="heat-scroll">
      <table className="heatmap" data-testid="heatmap" aria-label="Percent correct by benchmark and agent">
        <thead>
          {multi ? (
            <tr>
              <th scope="col" className="corner">
                Class
              </th>
              {a.agents.map((c) => (
                <th key={c.key} scope="col" className="mono tag">
                  {c.classTag}
                </th>
              ))}
            </tr>
          ) : null}
          <tr>
            <th scope="col" className="corner">
              Benchmark / Agent
            </th>
            {a.agents.map((c) => (
              <th key={c.key} scope="col" className="mono agent-h">
                {c.agent}
              </th>
            ))}
            <th scope="col" className="mono avg-h">
              Class
            </th>
          </tr>
        </thead>
        <tbody>
          {a.benchmarks.map((b) => {
            const all = a.byBenchmark.get(b.id)
            return (
              <tr key={b.id}>
                <th scope="row" className="bench-h">
                  <span className="mono">{b.id}</span>
                  <span className="muted">{b.label}</span>
                </th>
                {a.agents.map((c) => {
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
                  const col = scaleColor(pct)
                  return (
                    <td
                      key={c.key}
                      className="val mono"
                      style={{ background: col.bg, color: col.fg }}
                      data-testid={`cell-${b.id}-${c.agent}`}
                      title={`Agent ${c.agent}: ${cell.correct} of ${cell.attempts} correct (${pct}%), stage ${cell.stage}`}
                    >
                      {pct}
                    </td>
                  )
                })}
                <td className="val mono avg" style={all?.pct != null ? { background: scaleColor(all.pct).bg, color: scaleColor(all.pct).fg } : undefined}>
                  {all?.pct ?? '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="legend" aria-label="Color scale legend">
        <span className="mono tiny">% correct</span>
        {[0, 25, 50, 75, 100].map((p) => {
          const c = scaleColor(p)
          return (
            <span key={p} className="swatch mono" style={{ background: c.bg, color: c.fg }}>
              {p}
            </span>
          )
        })}
        <span className="muted tiny">Each cell shows the number. A dash means not attempted.</span>
      </div>
    </div>
  )
}

function Results({ a, csv }: { a: Analysis; csv: () => void }) {
  return (
    <>
      <section className="card" aria-labelledby="h-heat">
        <div className="card-head">
          <h2 id="h-heat">Benchmark by agent</h2>
          <span className="muted">
            {plural(a.agents.length, 'agent')}, {plural(a.benchmarks.length, 'benchmark')}
          </span>
        </div>
        <Heatmap a={a} />
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
                  <div className="fill" style={{ width: `${c.pct ?? 0}%`, background: c.pct === null ? undefined : scaleColor(Math.max(c.pct, 35)).bg }} />
                </div>
                <span className="muted tiny">{c.attempts ? `${c.correct} of ${plural(c.attempts, 'answer')} correct, ${plural(c.agents, 'agent')}` : 'No answers yet in this category'}</span>
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
        )}
      </section>

      <div className="actions no-print">
        <button type="button" className="btn primary" data-testid="download-csv" onClick={csv}>
          Download CSV
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          Print
        </button>
      </div>
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
      <header>
        <span className="mono label">ANOMALY // TEACHER HQ</span>
        <h1>Teacher HQ</h1>
        <p className="muted">Class results from student report codes. Everything is decoded in this browser. Nothing is uploaded.</p>
      </header>

      <section className="card no-print" aria-labelledby="h-in">
        <h2 id="h-in">Class results</h2>
        <label htmlFor="paste" className="muted">
          Paste report codes, one per line, or any text that contains them (for example a Canvas export).
        </label>
        <textarea
          id="paste"
          data-testid="teacher-paste"
          value={text}
          rows={6}
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

      {n ? <Results a={analysis} csv={downloadCsv} /> : null}

      <section className="card help no-print" data-testid="canvas-help">
        <h2>How to use with Canvas</h2>
        <ol>
          <li>Make a Canvas assignment with a Text Entry submission. Tell students to paste their report code.</li>
          <li>After a shift, students open the Results screen, tap Copy, and paste the code into the assignment.</li>
          <li>
            Collect the submissions. Either copy the text from SpeedGrader or the submissions page and paste it above, or download the submissions
            and drop the files here. Menus differ between Canvas versions.
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
