import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { caseById, codexById, content, loadPack } from '../content'
import type { Category } from '../content/schema'
import { CATALOG_BENCHMARKS } from '../lib/catalog.generated'
import { navigate } from '../lib/router'
import { dronePaintColor, findDronePaint, MASTERY_LABEL, MASTERY_STAGES, rankFor, unlockedDronePaintOptions, useGame, type MasteryStage } from '../state/store'
import { orderCasesForHub, unitNumber, validCaseId } from '../state/startChoice'
import { useRuntime } from '../state/runtime'
import { resolveTier } from '../state/quality'
import GoldRushButton from '../ui/GoldRushButton'
import BedrockModes, { resolveBedrockReturnTarget, setLastBedrockMode } from '../ui/BedrockModes'
import ResidueAlert from '../ui/ResidueAlert'
import HelpLevelPicker from '../ui/HelpLevelPicker'
import { useReviewDue } from '../state/due'
import ReportCodePanel from '../ui/ReportCodePanel'
import { markerPressed, setMarkerPressed, subscribeMarkerPressed, type MarkerId } from '../three/scenes/hub/markerMotion'
import { caseStatus, hubBenchmarkGroups, unitTopic } from './hubList'
import { clearCodenameDecode, peekCodenameDecode } from '../ui/decode'
import { useDecode } from '../ui/useDecode'
import { useMotionMode } from '../ui/useMotionMode'
import foilBadge from '../assets/textures/agent-badge-foil.webp?url'
import { CASE_ART } from './hubArt'
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
  art,
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
  art?: string
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
      {art ? <img className="case-art" src={art} alt="" aria-hidden="true" decoding="async" loading="lazy" width={160} height={100} /> : null}
      {fx}
      <span className="case-code">{code}</span>{' '}
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

function updatePanelScrollCue(panel: HTMLElement) {
  panel.dataset.moreBelow = String(panel.scrollHeight - panel.clientHeight - panel.scrollTop > 8)
}

export default function HubScreen() {
  const profile = useGame((s) => s.profile)
  const mastery = useGame((s) => s.mastery)
  const codex = useGame((s) => s.codex)
  const progress = useGame((s) => s.progress)
  const paints = useGame((s) => s.paints)
  const activePaint = useGame((s) => s.activePaint)
  const setActivePaint = useGame((s) => s.setActivePaint)
  const cases = useGame((s) => s.cases)
  const lastCaseId = useGame((s) => s.lastCaseId)
  const due = useReviewDue()
  const [openGroups, setOpenGroups] = useState<Partial<Record<Category, boolean>>>({})
  const [startOpen] = useState(() => !phoneLike())
  const mode = useMotionMode()
  const codenameRef = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [decode] = useState(peekCodenameDecode)
  useEffect(() => {
    if (decode) clearCodenameDecode()
  }, [decode])
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const update = () => updatePanelScrollCue(panel)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(panel)
    for (const child of panel.children) observer.observe(child)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [profile])
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
  const currentCases = orderedCases.filter((c) => unitNumber(c.unitLabel) === 4)
  const otherCases = orderedCases.filter((c) => unitNumber(c.unitLabel) !== 4)
  const chosen = validCaseId(lastCaseId, content.cases.map((c) => c.id))
  const chosenCase = caseById(chosen) ?? content.cases[0]
  // Every benchmark a case teaches, plus any other benchmark the agent has answered, by reporting category.
  const groups = hubBenchmarkGroups(content.cases, Object.keys(progress), labelOf)
  const unlockedPaints = unlockedDronePaintOptions(paints)
  const activePaintDef = findDronePaint(activePaint)
  const selectedPaintId = activePaintDef && unlockedPaints.some((p) => p.id === activePaintDef.id) ? activePaintDef.id : null

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

      <aside
        ref={panelRef}
        className="panel brackets hub-panel"
        aria-label="Agent panel"
        style={{ width: HUB_PANEL_WIDTH }}
        onScroll={(e) => updatePanelScrollCue(e.currentTarget)}
      >
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

        <section
          className="drone-paint-picker"
          data-testid="drone-paint-picker"
          data-active-paint={selectedPaintId ?? 'default'}
          data-active-color={dronePaintColor(activePaint, paints)}
          aria-labelledby="drone-paint-h"
        >
          <h3 id="drone-paint-h" className="section-title">
            Drone paint
          </h3>
          {unlockedPaints.length === 0 ? (
            <p className="muted drone-paint-empty">
              Move any science skill up a stage on a mission to unlock drone paint colors.
            </p>
          ) : (
            <div className="drone-paint-list" role="group" aria-labelledby="drone-paint-h">
              {unlockedPaints.map((paint) => {
                const selected = selectedPaintId === paint.id
                return (
                  <button
                    key={paint.id}
                    type="button"
                    className={selected ? 'btn small drone-paint-swatch is-selected' : 'btn small drone-paint-swatch'}
                    data-testid={`drone-paint-${paint.id}`}
                    data-paint={paint.label}
                    data-paint-id={paint.id}
                    data-paint-color={paint.color}
                    data-selected={selected ? 'yes' : 'no'}
                    aria-pressed={selected}
                    onClick={() => setActivePaint(paint.label)}
                  >
                    <span className="drone-paint-chip" style={{ backgroundColor: paint.color }} aria-hidden="true" />
                    <span className="drone-paint-name">{paint.label}</span>
                    {selected ? (
                      <span className="drone-paint-marker" data-testid={`drone-paint-marker-${paint.id}`}>
                        <span aria-hidden="true">{'\u2714'}</span> Active
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </section>

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
            <span className="qp-kicker">Start case</span>
            <span className="qp-title">{chosenCase.unitLabel}</span>
          </button>
          <HelpLevelPicker />
          {([['current-unit', 'Your unit right now: Unit 4', currentCases], ['other-units', 'Other units', otherCases]] as const).map(([testId, title, list]) => (
          <div key={testId} data-testid={testId} className="case-group">
            <h4 className="case-group-title">{title}</h4>
            <div className="case-list case-grid">
              {list.map((c) => {
                const st = caseStatus(cases[c.id])
                return (
                  <div key={c.id} className="case-cell">
                    <CaseButton
                      id={c.id}
                      testId={`case-marker-${c.id}`}
                      className="case-btn amber"
                      art={CASE_ART[c.id]}
                      status={st.word.toLowerCase()}
                      to={`/case/${c.id}`}
                      code={unitTopic(c.unitLabel)}
                      sub={
                        <>
                          <span className="case-code">{c.unitLabel.split(':')[0]} {'\u00B7'} {c.codename} {'\u00B7'} Case {c.id}</span>{' '}
                          <span className={`case-status ${st.word.toLowerCase()}`} data-testid={`case-status-${c.id}`}>
                            <span aria-hidden="true">{st.word === 'Closed' ? '\u2714' : st.word === 'Open' ? '\u25CB' : '\u2605'}</span> {st.text}
                          </span>
                        </>
                      }
                    />
                    <details className="case-standards" data-testid={`case-standards-${c.id}`}>
                      <summary>Standards</summary>
                      <ul>
                        {c.benchmarks.map((code) => (
                          <li key={code}>
                            <span className="mono">{code}</span> {labelOf(code)}
                          </li>
                        ))}
                      </ul>
                    </details>
                    {c.id === '02-2' ? <BedrockModes caseId={c.id} /> : <GoldRushButton caseId={c.id} />}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
          <div className="case-list">
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
                    <span aria-hidden="true">{'\u25CF'}</span> <strong>Review due</strong> | earlier missions
                  </>
                ) : (
                  'Revisit clues from earlier missions'
                )
              }
            />
          </div>
        </section>

        <ReportCodePanel />

        <section aria-labelledby="mastery-h" className="mastery">
          <h3 id="mastery-h" className="section-title">
            Your science progress
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
      <div className="hub-scroll-fade" aria-hidden="true" />

      <details className="panel brackets codex-panel" data-testid="codex-panel">
        <summary>
          Science notebook <span className="muted" data-testid="codex-count">{codex.length} unlocked</span>
        </summary>
        {codex.length === 0 ? (
          <p className="muted">Your science notebook is waiting for its first clue! Solve questions and finish Field Labs to unlock entries here.</p>
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
