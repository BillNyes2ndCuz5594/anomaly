import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { caseById, codexById, content, loadPack } from '../content'
import type { Category } from '../content/schema'
import { CATALOG_BENCHMARKS } from '../lib/catalog.generated'
import { navigate } from '../lib/router'
import { MASTERY_LABEL, MASTERY_STAGES, rankFor, useGame, type MasteryStage } from '../state/store'
import { orderCasesForHub, validCaseId } from '../state/startChoice'
import { useRuntime } from '../state/runtime'
import { resolveTier } from '../state/quality'
import GoldRushButton from '../ui/GoldRushButton'
import BedrockModes, { resolveBedrockReturnTarget, setLastBedrockMode } from '../ui/BedrockModes'
import ResidueAlert from '../ui/ResidueAlert'
import { useReviewDue } from '../state/due'
import ReportCodePanel from '../ui/ReportCodePanel'
import { markerPressed, setMarkerPressed, subscribeMarkerPressed, type MarkerId } from '../three/scenes/hub/markerMotion'
import { caseStatus, hubBenchmarkGroups } from './hubList'
import { clearCodenameDecode, peekCodenameDecode } from '../ui/decode'
import { useDecode } from '../ui/useDecode'
import { useMotionMode } from '../ui/useMotionMode'
import foilBadge from '../assets/textures/agent-badge-foil.webp?url'
import './title-hub.css'

import { HUB_PANEL_WIDTH } from './hubLayout'

/** Four pips (Rookie to Ace). Filled square plus the stage word, never color alone. */
function Pips({ stage }: { stage: MasteryStage }) {
  const level = MASTERY_STAGES.indexOf(stage)
  return (
    <span className="pips" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= level ? 'pip on' : 'pip'} />
      ))}
    </span>
  )
}

function CaseButton({
  id,
  testId,
  className,
  due,
  status,
  to,
  code,
  sub,
  fx,
}: {
  id: MarkerId
  testId: string
  className: string
  due?: 'yes' | 'no'
  status?: string
  to: string
  code: string
  sub: ReactNode
  fx?: ReactNode
}) {
  const setFocused = useRuntime((s) => s.setFocusedMarker)
  const pressed = useSyncExternalStore(subscribeMarkerPressed, () => markerPressed(id), () => false)
  return (
    <button
      type="button"
      className={className}
      data-testid={testId}
      data-pressed={pressed ? 'yes' : 'no'}
      data-due={due}
      data-status={status}
      onClick={async () => {
        if (caseById(id)) await loadPack(id)
        if (resolveTier(useGame.getState().settings.quality, useRuntime.getState().autoTier) !== 'low') {
          const def = caseById(id)
          if (def) void import('../three/models/heroSpecimens').then((m) => m.prefetchCaseHeroes(def, content.items.filter((item) => def.benchmarks.includes(item.benchmark)))).catch(() => {})
        }
        navigate(to)
      }}
      onFocus={() => { setFocused(id); if (caseById(id)) void loadPack(id).catch(() => {}) }}
      onBlur={() => setFocused(null)}
      onMouseEnter={() => { setFocused(id); if (caseById(id)) void loadPack(id).catch(() => {}) }}
      onMouseLeave={() => setFocused(null)}
      onPointerDown={() => setMarkerPressed(id, true)}
      onPointerUp={() => setMarkerPressed(id, false)}
      onPointerCancel={() => setMarkerPressed(id, false)}
      onPointerLeave={() => setMarkerPressed(id, false)}
    >
      {fx}
      <span className="case-code">{code}</span>
      <span className="case-sub">{sub}</span>
    </button>
  )
}

const LABEL_OF = new Map(CATALOG_BENCHMARKS.map((b) => [b.id, b.label]))
const labelOf = (id: string) => LABEL_OF.get(id) ?? id

/** Phones start with the mastery groups closed so the sheet stays short; desktops start with them open. */
function phoneLike(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(max-width: 600px), (max-height: 500px)').matches
}

export default function HubScreen() {
  const profile = useGame((s) => s.profile)
  const mastery = useGame((s) => s.mastery)
  const codex = useGame((s) => s.codex)
  const progress = useGame((s) => s.progress)
  const cases = useGame((s) => s.cases)
  const lastCaseId = useGame((s) => s.lastCaseId)
  const due = useReviewDue()
  const [openGroups, setOpenGroups] = useState<Partial<Record<Category, boolean>>>({})
  const [startOpen] = useState(() => !phoneLike())
  const mode = useMotionMode()
  const codenameRef = useRef<HTMLHeadingElement>(null)
  const [decode] = useState(peekCodenameDecode)
  useEffect(() => {
    if (decode) clearCodenameDecode()
  }, [decode])
  useEffect(() => {
    let cancelled = false
    let frameId = 0
    let retryTimer = 0
    const attemptFocus = (remaining: number) => {
      if (cancelled) return
      const host = document.querySelector<HTMLElement>('.screen-host')
      if (host?.inert) {
        if (remaining > 0) {
          retryTimer = window.setTimeout(() => {
            frameId = requestAnimationFrame(() => attemptFocus(remaining - 1))
          }, 30)
        }
        return
      }
      const target = resolveBedrockReturnTarget()
      if (!target) return
      target.scrollIntoView?.({ block: 'nearest' })
      target.focus?.()
      if (document.activeElement === target) {
        setLastBedrockMode(null)
      } else if (remaining > 0) {
        retryTimer = window.setTimeout(() => {
          frameId = requestAnimationFrame(() => attemptFocus(remaining - 1))
        }, 30)
      }
    }
    frameId = requestAnimationFrame(() => attemptFocus(15))
    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
      window.clearTimeout(retryTimer)
    }
  }, [])
  useDecode(codenameRef, profile?.codename ?? '', decode, mode)
  if (!profile) return null
  const orderedCases = orderCasesForHub(content.cases)
  const chosen = validCaseId(lastCaseId, content.cases.map((c) => c.id))
  const chosenCase = caseById(chosen) ?? content.cases[0]
  // Every benchmark a case teaches, plus any other benchmark the agent has answered, by reporting category.
  const groups = hubBenchmarkGroups(content.cases, Object.keys(progress), labelOf)

  return (
    <div className="screen hub-screen" data-testid="hub">
      <div className="topbar">
        <div className="row">
          <button type="button" className="btn small ghost" onClick={() => navigate('/')}>
            Title
          </button>
          <button type="button" className="btn small ghost" data-testid="open-settings" onClick={() => navigate('/settings')}>
            Settings
          </button>
        </div>
        <span className="label">AGENT HUB</span>
      </div>

      <aside className="panel brackets hub-panel" aria-label="Agent panel" style={{ width: HUB_PANEL_WIDTH }}>
        <header className="agent-head">
          <img className="agent-foil" src={foilBadge} alt="" aria-hidden="true" decoding="async" />
          <span className="label">Field agent</span>
          <h2 className="codename" data-testid="codename" ref={codenameRef} data-decode={decode ? mode : undefined}>
            {profile.codename}
          </h2>
          <p className="agent-meta">
            <span>
              Rank: <strong data-testid="rank">{rankFor(mastery)}</strong>
            </span>
            {profile.classCode ? <span className="tag">Class {profile.classCode}</span> : null}
          </p>
        </header>

        <section aria-labelledby="dispatch-h">
          <h3 id="dispatch-h" className="section-title">
            Pick a mission
          </h3>
          <button
            type="button"
            data-testid="hub-quick-play"
            className="btn primary big hub-quick-play"
            onClick={async () => {
              await loadPack(chosen)
              navigate(`/case/${chosen}`)
            }}
          >
            <span className="qp-kicker">{lastCaseId === chosen ? 'Keep going' : 'Today in class'}</span>
            <span className="qp-title">{chosenCase.unitLabel}</span>
          </button>
          <div className="case-list">
            {orderedCases.map((c) => {
              const st = caseStatus(cases[c.id])
              return (
                <Fragment key={c.id}>
                <CaseButton
                  id={c.id}
                  testId={`case-marker-${c.id}`}
                  className="case-btn amber"
                  status={st.word.toLowerCase()}
                  to={`/case/${c.id}`}
                  code={`CASE ${c.id} ${c.codename}`}
                  sub={
                    <>
                      {c.unitLabel}
                      <span className={`case-status ${st.word.toLowerCase()}`} data-testid={`case-status-${c.id}`}>
                        <span aria-hidden="true">{st.word === 'Closed' ? '\u2714' : st.word === 'Open' ? '\u25CB' : '\u2605'}</span> {st.text}
                      </span>
                    </>
                  }
                />
                {c.id === '02-2' ? <BedrockModes caseId={c.id} /> : <GoldRushButton caseId={c.id} />}
                </Fragment>
              )
            })}
            <CaseButton
              id="cold"
              testId="cold-marker"
              className="case-btn cyan"
              due={due ? 'yes' : 'no'}
              fx={due ? <ResidueAlert /> : undefined}
              to="/cold/cold-1"
              code="COLD CASE RESIDUE"
              sub={
                due ? (
                  <>
                    <span aria-hidden="true">{'\u25CF'}</span> <strong>Review due</strong> | earlier units
                  </>
                ) : (
                  'Review of earlier units'
                )
              }
            />
          </div>
        </section>

        <ReportCodePanel />

        <section aria-labelledby="mastery-h" className="mastery">
          <h3 id="mastery-h" className="section-title">
            Benchmark mastery
          </h3>
          <div className="mastery-groups" data-testid="mastery-list">
            {groups.map((g) => {
              const seen = g.benchmarks.filter((b) => (mastery[b.id] ?? 'unseen') !== 'unseen').length
              return (
                <details
                  key={g.category}
                  className="mastery-group"
                  data-testid={`mastery-group-${g.category}`}
                  open={openGroups[g.category] ?? startOpen}
                  onToggle={(e) => {
                    const open = (e.currentTarget as HTMLDetailsElement).open
                    setOpenGroups((s) => (s[g.category] === open ? s : { ...s, [g.category]: open }))
                  }}
                >
                  <summary>
                    <span className="mastery-group-name">{g.label}</span>
                    <span className="muted mastery-group-count">
                      {seen} of {g.benchmarks.length} started
                    </span>
                  </summary>
                  <ul className="mastery-list">
                    {g.benchmarks.map((b) => {
                      const stage = mastery[b.id] ?? 'unseen'
                      return (
                        <li key={b.id}>
                          <span className="mono bench-id">{b.id}</span>
                          <span className="bench-label">{b.label}</span>
                          <span className="bench-stage">
                            <Pips stage={stage} />
                            <span>{MASTERY_LABEL[stage]}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )
            })}
          </div>
        </section>

      </aside>

      <details className="panel brackets codex-panel" data-testid="codex-panel">
        <summary>
          CODEX <span className="muted" data-testid="codex-count">{codex.length} unlocked</span>
        </summary>
        {codex.length === 0 ? (
          <p className="muted">Nothing logged yet. Correct answers and finished labs add entries.</p>
        ) : (
          <ul className="codex-list">
            {codex.map((id) => {
              const e = codexById.get(id)
              return e ? (
                <li key={id} data-testid={`codex-${id}`}>
                  <strong>{e.title}</strong>
                  <span>{e.line}</span>
                </li>
              ) : null
            })}
          </ul>
        )}
      </details>

    </div>
  )
}
