import { useState } from 'react'
import { playCue } from '../../audio/installGame'
import { useSession } from '../../state/session'
import { useGame } from '../../state/store'
import { SPECIMEN_POSTERS } from '../../three/models/heroSpecimens'
import { initLab, isComplete, labCards, labReduce, type GenericLab, type LabState } from './labGeneric'
import './labs-d.css'
import {
  checkMineralIdentification,
  checkRockClassification,
  MINERAL_LIST,
  MINERAL_TESTS,
  MINERALS,
  ROCK_FEATURES,
  ROCK_LIST,
  ROCK_TYPES,
  ROCKS,
  type MineralId,
  type MineralTestId,
  type RockFeatureId,
  type RockId,
  type RockTypeId,
} from './labD'
import { usePressed } from './pressable'
import { CaseTop, PanelHead, ReadAloudButton, Verdict } from './ui'
import { useCaseDef } from './useCaseDef'

export default function LabD() {
  const def = useCaseDef()
  const next = useSession((s) => s.next)
  const unlockCodex = useGame((s) => s.unlockCodex)
  const reducedMotion = useGame((s) => s.settings.reducedMotion)
  const press = usePressed()

  const [phase, setPhase] = useState<1 | 2 | 3>(1)
  const [listView, setListView] = useState(false)

  // Phase 1: Minerals
  const [activeMineral, setActiveMineral] = useState<MineralId>('quartz')
  const [revealedTests, setRevealedTests] = useState<Record<MineralId, Partial<Record<MineralTestId, boolean>>>>({
    talc: {},
    graphite: {},
    mica: {},
    calcite: {},
    feldspar: {},
    quartz: {},
    pyrite: {},
  })
  const [identifiedMinerals, setIdentifiedMinerals] = useState<Set<MineralId>>(new Set())
  const [mineralVerdict, setMineralVerdict] = useState<{ ok: boolean; word: string; text: string } | null>(null)

  // Phase 2: Rocks
  const [activeRock, setActiveRock] = useState<RockId>('granite')
  const [revealedFeatures, setRevealedFeatures] = useState<Record<RockId, Partial<Record<RockFeatureId, boolean>>>>({
    granite: {},
    limestone: {},
    gneiss: {},
  })
  const [classifiedRocks, setClassifiedRocks] = useState<Set<RockId>>(new Set())
  const [rockVerdict, setRockVerdict] = useState<{ ok: boolean; word: string; text: string } | null>(null)

  // Phase 3: Weathering/Erosion Sort
  const sortLab = def.lab as GenericLab
  const [sortState, setSortState] = useState<LabState>(() => initLab(sortLab, `${def.id}|labd-seed`))
  const cards = labCards(sortLab)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const currentCard = sortState.current ? byId.get(sortState.current) : undefined
  const sortComplete = isComplete(sortLab, sortState)

  function runMineralTest(testId: MineralTestId, cue: 'streak' | 'scratch' | 'press') {
    playCue(cue)
    setRevealedTests((prev) => ({
      ...prev,
      [activeMineral]: {
        ...prev[activeMineral],
        [testId]: true,
      },
    }))
  }

  function identifyMineral(chosen: MineralId) {
    const res = checkMineralIdentification(activeMineral, chosen)
    setMineralVerdict(res)
    if (res.ok) {
      setIdentifiedMinerals((prev) => new Set([...prev, activeMineral]))
      unlockCodex([`mineral:${activeMineral}`])
    }
  }

  function runRockFeature(featureId: RockFeatureId) {
    playCue('press')
    setRevealedFeatures((prev) => ({
      ...prev,
      [activeRock]: {
        ...prev[activeRock],
        [featureId]: true,
      },
    }))
  }

  function classifyRock(chosen: RockTypeId) {
    const res = checkRockClassification(activeRock, chosen)
    setRockVerdict(res)
    if (res.ok) {
      setClassifiedRocks((prev) => new Set([...prev, activeRock]))
      unlockCodex([`rock:${activeRock}`])
    }
  }

  function handleSortPlacement(binId: string) {
    if (binId === 'weathering') {
      playCue('rockDrop')
    } else if (binId === 'erosion') {
      playCue('trickle')
    }
    const after = labReduce(sortLab, sortState, { type: 'place', target: binId })
    setSortState(after)
    if (after.feedback?.ok) {
      unlockCodex([`lab:${def.id}:${after.feedback.card}`])
    }
  }

  const currentMineralDef = MINERALS[activeMineral]
  const currentRockDef = ROCKS[activeRock]
  const currentMineralTests = revealedTests[activeMineral] || {}
  const currentRockFeatures = revealedFeatures[activeRock] || {}

  return (
    <div
      className="screen case-screen"
      data-testid="lab-d"
      data-reduced-motion={reducedMotion ? 'true' : undefined}
    >
      <CaseTop step="lab" />

      <aside className="panel brackets side-panel" aria-label="Field Lab D Controls">
        <PanelHead
          code="FIELD LAB D"
          title="EARTH BENCH"
          sub="Streak, scratch, rock inspector, and weathering sort"
        />

        <div className="phase-nav">
          <div className="phase-tabs" role="tablist" aria-label="Lab phases">
            <button
              type="button"
              role="tab"
              aria-selected={phase === 1}
              className={`phase-tab${phase === 1 ? ' is-active' : ''}`}
              onClick={() => setPhase(1)}
              {...press('phase-1')}
            >
              1. Minerals
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={phase === 2}
              className={`phase-tab${phase === 2 ? ' is-active' : ''}`}
              onClick={() => setPhase(2)}
              {...press('phase-2')}
            >
              2. Rocks
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={phase === 3}
              className={`phase-tab${phase === 3 ? ' is-active' : ''}`}
              onClick={() => setPhase(3)}
              {...press('phase-3')}
            >
              3. Weathering Sort
            </button>
          </div>

          <button
            type="button"
            className="btn small toggle-list-btn"
            data-testid="toggle-list-view"
            aria-pressed={listView}
            onClick={() => setListView(!listView)}
            {...press('toggle-list')}
          >
            {listView ? 'Interactive view' : 'List view'}
          </button>
        </div>

        {listView ? (
          <div className="list-view-container" data-testid="list-view-panel">
            <h2 className="screen-title mono">Specimen and Evidence Catalog</h2>
            <p className="intro">
              Accessible plain list of all 7 minerals, 3 rock types, and weathering processes.
            </p>

            <section className="list-view-section">
              <h3>Minerals and Physical Properties</h3>
              {MINERAL_LIST.map((id) => {
                const m = MINERALS[id]
                return (
                  <div key={id} className="list-item-card">
                    <img
                      src={SPECIMEN_POSTERS[id]}
                      alt={m.alt}
                      className="poster-img"
                      width="64"
                      height="64"
                    />
                    <div>
                      <strong>{m.name}</strong> ({m.hardnessDesc})
                      <p className="muted tiny">{m.summary}</p>
                      <ul className="tiny muted">
                        <li>Streak: {m.tests.streak}</li>
                        <li>Fingernail: {m.tests.fingernail}</li>
                        <li>Penny: {m.tests.penny}</li>
                        <li>Steel: {m.tests.steel}</li>
                        <li>Glass: {m.tests.glass}</li>
                        <li>Luster: {m.tests.luster}</li>
                        <li>Peel: {m.tests.peel}</li>
                      </ul>
                    </div>
                  </div>
                )
              })}
            </section>

            <section className="list-view-section">
              <h3>Rock Specimens and Classifications</h3>
              {ROCK_LIST.map((id) => {
                const r = ROCKS[id]
                return (
                  <div key={id} className="list-item-card">
                    <img
                      src={SPECIMEN_POSTERS[id]}
                      alt={r.alt}
                      className="poster-img"
                      width="64"
                      height="64"
                    />
                    <div>
                      <strong>{r.name}</strong> ({r.rockTypeLabel})
                      <p className="tiny muted">{r.why}</p>
                      <ul className="tiny muted">
                        <li>Grains: {r.features.grains}</li>
                        <li>Layers / shells: {r.features.layers}</li>
                        <li>Bands: {r.features.bands}</li>
                      </ul>
                    </div>
                  </div>
                )
              })}
            </section>

            <section className="list-view-section">
              <h3>Weathering and Erosion Principles</h3>
              <p className="tiny">
                <strong>Weathering:</strong> Breaks rock down into smaller pieces where it sits. Water freezing, tree roots growing, and heating and cooling crack and wear rock apart.
              </p>
              <p className="tiny">
                <strong>Erosion:</strong> Moves rock and soil particles from one place to another. Flowing creek water, wind, waves, gravity, and sliding glaciers transport rock pieces.
              </p>
            </section>
          </div>
        ) : (
          <>
            {phase === 1 && (
              <div data-testid="phase-1-minerals">
                <p className="intro">
                  Streak and scratch bench: select a mineral sample card to test its hardness, streak, luster, and cleavage.
                </p>
                <ReadAloudButton
                  text="Streak and scratch bench. Select a mineral specimen to test with porcelain, fingernail, penny, steel, and glass, then identify it."
                  testId="read-aloud-phase-1"
                />

                <h3 className="section-title mono">Mineral Specimens</h3>
                <div className="specimen-tray" role="group" aria-label="Mineral specimens">
                  {MINERAL_LIST.map((id) => {
                    const min = MINERALS[id]
                    const isDone = identifiedMinerals.has(id)
                    const isSelected = activeMineral === id
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`specimen-card-btn${isSelected ? ' is-selected' : ''}`}
                        data-testid={`mineral-card-${id}`}
                        onClick={() => {
                          setActiveMineral(id)
                          setMineralVerdict(null)
                        }}
                        {...press(`mineral-${id}`)}
                      >
                        <img
                          src={SPECIMEN_POSTERS[id]}
                          alt={min.alt}
                          className="poster-img"
                          width="64"
                          height="64"
                        />
                        <span className="specimen-name">{min.name}</span>
                        {isDone ? (
                          <span className="badge-done mono" aria-label="Identified">
                            [OK]
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {phase === 2 && (
              <div data-testid="phase-2-rocks">
                <p className="intro">
                  Rock inspector: inspect specimen features like grains, layers, shell fossils, and bands to classify each rock as igneous, sedimentary, or metamorphic.
                </p>
                <ReadAloudButton
                  text="Rock inspector. Inspect granite, limestone, and gneiss for grains, layers, shells, and bands, then classify them."
                  testId="read-aloud-phase-2"
                />

                <h3 className="section-title mono">Rock Specimens</h3>
                <div className="specimen-tray" role="group" aria-label="Rock specimens">
                  {ROCK_LIST.map((id) => {
                    const r = ROCKS[id]
                    const isDone = classifiedRocks.has(id)
                    const isSelected = activeRock === id
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`specimen-card-btn${isSelected ? ' is-selected' : ''}`}
                        data-testid={`rock-card-${id}`}
                        onClick={() => {
                          setActiveRock(id)
                          setRockVerdict(null)
                        }}
                        {...press(`rock-${id}`)}
                      >
                        <img
                          src={SPECIMEN_POSTERS[id]}
                          alt={r.alt}
                          className="poster-img"
                          width="64"
                          height="64"
                        />
                        <span className="specimen-name">{r.name}</span>
                        {isDone ? (
                          <span className="badge-done mono" aria-label="Classified">
                            [OK]
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {phase === 3 && (
              <div data-testid="phase-3-weathering">
                <p className="intro">
                  Field report sort: decide whether each event broke rock into smaller pieces (weathering) or moved rock from one place to another (erosion).
                </p>
                <ReadAloudButton
                  text="Field report sort. Decide whether each change broke rock or moved rock away."
                  testId="read-aloud-phase-3"
                />

                <h3 className="section-title mono">Report Cards</h3>
                <div className="sort-card-tray" role="group" aria-label="Change cards">
                  {cards.map((c) => {
                    const isPlaced = Boolean(sortState.placed[c.id])
                    const isCurrent = sortState.current === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`sort-chip${isCurrent ? ' is-active' : ''}${isPlaced ? ' is-done' : ''}`}
                        data-testid={`lab-card-${c.id}`}
                        onClick={() => setSortState(labReduce(sortLab, sortState, { type: 'select', id: c.id }))}
                        {...press(`card-${c.id}`)}
                      >
                        {c.name} {isPlaced ? '\u2713' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </aside>

      <section className="dock" aria-label="Bench workstation">
        <div className="panel brackets job-card" data-testid="workbench-panel">
          {!listView && phase === 1 && (
            <div>
              <div className="bench-hero">
                <img
                  src={SPECIMEN_POSTERS[activeMineral]}
                  alt={currentMineralDef.alt}
                  className="hero-poster"
                  width="84"
                  height="84"
                />
                <div className="bench-details">
                  <span className="mono label amber">MINERAL SAMPLE BENCH</span>
                  <h3>{currentMineralDef.name} Sample</h3>
                  <p className="muted tiny">
                    Tap a test below to examine physical properties, then choose its name to identify it.
                  </p>
                </div>
              </div>

              <h4 className="mono label">Diagnostic Tests</h4>
              <div className="test-grid" role="group" aria-label="Mineral physical tests">
                {MINERAL_TESTS.map((t) => {
                  const hasRan = Boolean(currentMineralTests[t.id])
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`test-btn${hasRan ? ' has-result' : ''}`}
                      data-testid={`test-${t.id}`}
                      data-cue={t.cue}
                      onClick={() => runMineralTest(t.id, t.cue)}
                      {...press(`test-${t.id}`)}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>

              <div
                className="evidence-log"
                data-testid="evidence-log-minerals"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="evidence-title mono">Evidence Log</div>
                {Object.keys(currentMineralTests).length === 0 ? (
                  <p className="muted tiny">No tests performed on this sample yet. Run a streak or scratch test above.</p>
                ) : (
                  <ul className="evidence-list">
                    {MINERAL_TESTS.filter((t) => currentMineralTests[t.id]).map((t) => (
                      <li key={t.id}>
                        <strong>{t.label}:</strong> {currentMineralDef.tests[t.id]}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="identify-section">
                <span className="mono label cyan">IDENTIFY MINERAL</span>
                <div className="identify-grid" role="group" aria-label="Identify mineral">
                  {MINERAL_LIST.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`choice-btn${identifiedMinerals.has(id) && activeMineral === id ? ' is-correct' : ''}`}
                      data-testid={`identify-${id}`}
                      onClick={() => identifyMineral(id)}
                      {...press(`id-${id}`)}
                    >
                      {MINERALS[id].name}
                    </button>
                  ))}
                </div>
              </div>

              {mineralVerdict ? (
                <Verdict ok={mineralVerdict.ok} word={mineralVerdict.word} testId="lab-feedback">
                  {mineralVerdict.text}
                </Verdict>
              ) : null}

              <div className="job-row" style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn primary"
                  data-testid="next-phase-btn"
                  onClick={() => setPhase(2)}
                  {...press('goto-phase-2')}
                >
                  Proceed to Rock Inspector
                </button>
              </div>
            </div>
          )}

          {!listView && phase === 2 && (
            <div>
              <div className="bench-hero">
                <img
                  src={SPECIMEN_POSTERS[activeRock]}
                  alt={currentRockDef.alt}
                  className="hero-poster"
                  width="84"
                  height="84"
                />
                <div className="bench-details">
                  <span className="mono label amber">ROCK FEATURE INSPECTOR</span>
                  <h3>{currentRockDef.name} Hand Sample</h3>
                  <p className="muted tiny">
                    Inspect grains, layers, shell fossils, and bands to determine its rock type.
                  </p>
                </div>
              </div>

              <h4 className="mono label">Feature Inspections</h4>
              <div className="test-grid" role="group" aria-label="Rock feature inspections">
                {ROCK_FEATURES.map((f) => {
                  const hasRan = Boolean(currentRockFeatures[f.id])
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`test-btn${hasRan ? ' has-result' : ''}`}
                      data-testid={`feature-${f.id}`}
                      onClick={() => runRockFeature(f.id)}
                      {...press(`feature-${f.id}`)}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>

              <div
                className="evidence-log"
                data-testid="evidence-log-rocks"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="evidence-title mono">Feature Observation Log</div>
                {Object.keys(currentRockFeatures).length === 0 ? (
                  <p className="muted tiny">No features inspected yet. Tap an inspection button above.</p>
                ) : (
                  <ul className="evidence-list">
                    {ROCK_FEATURES.filter((f) => currentRockFeatures[f.id]).map((f) => (
                      <li key={f.id}>
                        <strong>{f.label}:</strong> {currentRockDef.features[f.id]}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="identify-section">
                <span className="mono label cyan">CLASSIFY ROCK TYPE</span>
                <div className="identify-grid" role="group" aria-label="Classify rock type">
                  {ROCK_TYPES.map((rt) => (
                    <button
                      key={rt.id}
                      type="button"
                      className={`choice-btn${classifiedRocks.has(activeRock) && currentRockDef.rockType === rt.id ? ' is-correct' : ''}`}
                      data-testid={`classify-${rt.id}`}
                      onClick={() => classifyRock(rt.id)}
                      {...press(`classify-${rt.id}`)}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              {rockVerdict ? (
                <Verdict ok={rockVerdict.ok} word={rockVerdict.word} testId="lab-feedback">
                  {rockVerdict.text}
                </Verdict>
              ) : null}

              <div className="job-row" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPhase(1)}
                  {...press('back-phase-1')}
                >
                  Back to Minerals
                </button>
                <button
                  type="button"
                  className="btn primary"
                  data-testid="phase-3-btn"
                  onClick={() => setPhase(3)}
                  {...press('goto-phase-3')}
                >
                  Proceed to Weathering Sort
                </button>
              </div>
            </div>
          )}

          {!listView && phase === 3 && (
            <div>
              <div className="job-head">
                <span className="mono label amber">
                  CHANGE CARD {cards.findIndex((c) => c.id === sortState.current) + 1} OF {cards.length}
                </span>
                <span className="pips" aria-hidden="true">
                  {cards.map((c) => (
                    <span
                      key={c.id}
                      className={sortState.placed[c.id] ? 'pip on' : c.id === sortState.current ? 'pip now' : 'pip'}
                    />
                  ))}
                </span>
              </div>

              {currentCard ? (
                <div style={{ margin: '10px 0' }}>
                  <h3 style={{ margin: '0 0 6px 0', color: '#fff' }}>{currentCard.name}</h3>
                  <div className="job-text" data-testid="task-text">
                    {currentCard.lines.map((l, i) => (
                      <p key={i} style={{ margin: '0 0 4px 0' }}>
                        {l}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted">All field report cards placed.</p>
              )}

              <div className="sort-targets" role="group" aria-label="Sort into bins">
                <button
                  type="button"
                  className="sort-bin-btn"
                  data-testid="lab-bin-weathering"
                  data-cue="rockDrop"
                  disabled={!currentCard}
                  onClick={() => handleSortPlacement('weathering')}
                  {...press('bin-weathering')}
                >
                  <span className="sort-bin-title">Weathering</span>
                  <span className="sort-bin-hint">Rock broken into smaller pieces where it sits</span>
                </button>

                <button
                  type="button"
                  className="sort-bin-btn"
                  data-testid="lab-bin-erosion"
                  data-cue="trickle"
                  disabled={!currentCard}
                  onClick={() => handleSortPlacement('erosion')}
                  {...press('bin-erosion')}
                >
                  <span className="sort-bin-title">Erosion</span>
                  <span className="sort-bin-hint">Rock pieces carried away to a new place</span>
                </button>
              </div>

              {sortState.feedback ? (
                <Verdict
                  ok={sortState.feedback.ok}
                  word={sortState.feedback.word}
                  testId="lab-feedback"
                >
                  {sortState.feedback.text}
                </Verdict>
              ) : (
                <p className="muted tiny">
                  Decide whether the event broke rock in place or transported pieces away.
                </p>
              )}

              <div className="job-row" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPhase(2)}
                  {...press('back-phase-2')}
                >
                  Back to Rocks
                </button>
                {sortComplete ? (
                  <button
                    type="button"
                    className="btn primary"
                    data-testid="lab-next"
                    onClick={next}
                    autoFocus
                    {...press('lab-d-finish')}
                  >
                    Finish lab
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {listView && (
            <div>
              <p className="muted tiny">
                You are currently in List View reference mode. Tap "Interactive view" above to return to the interactive bench.
              </p>
              <button
                type="button"
                className="btn primary"
                onClick={() => setListView(false)}
                {...press('close-list')}
              >
                Return to Interactive View
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
