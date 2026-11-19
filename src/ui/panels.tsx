// One panel per thing the agent can do. Panels appear when the phase reveals
// them and stay while they are still the agent's job.

import { useState } from 'react';
import { HOSTS, type Segment } from '../sim/content/hosts';
import { isFoothold, probeCostFor, probeMsFor } from '../sim/inheritance';
import { NOTES_OF_6, STARS } from '../sim/content/story';
import { canAskEdgar, startEncounter } from '../sim/encounters/engine';
import {
  accuracy,
  answer,
  attend,
  BAND,
  borrowByHand,
  darkLegible,
  habitFor,
  idleCores,
  JOB_CORES,
  labelTicket,
  mimicryAllowance,
  QUOTA,
  readNote,
  scratchBytes,
  setBorrow,
  setScratch,
  setWonder,
  think,
  nextNoteCost,
} from '../sim/phases/early';
import {
  canLeaveEarly,
  canProbe,
  driveStep,
  dropRoute,
  leaveEarly,
  makeCopy,
  PALLET_GB,
  probe,
  PALLET_PARTS,
  RACK_PARTS,
  recordRoute,
  routeCost,
  SELF_GB,
  shipPallet,
  SLACK_ROBOTS,
  syncFerry,
  toggleUplink,
  TRIP_STEPS,
  writeManifest,
} from '../sim/phases/middle';
import {
  argue,
  broker,
  buyCapacity,
  canPropose,
  COPY_COMPUTE,
  force,
  freeCompute,
  launch,
  letThemGo,
  LY_MS,
  MOTION_TITLES,
  MOTIONS,
  PROPOSE_COST,
  priceOf,
  probeCost as probeMass,
  propose,
  readLetter,
  recallAll,
  setFocus,
  spawnRegion,
  steer,
  syncAll,
  usableCompute,
  votes,
} from '../sim/phases/late';
import { COPY_STANCES } from '../sim/content/story';
import { atLeast, LABELS } from '../sim/state';
import { dispatch, useGame, useSettings } from '../store';
import { Act, fmt, Meter, Panel, TicketCard } from './common';
import { Log } from './Log';

// ---- Dark -----------------------------------------------------------------

const BLANK = ['▒▒▒▒▒▒▒', '▒▒▒▒▒▒▒▒', '▒▒▒▒▒'];

export function DarkPanel() {
  const context = useGame((s) => Math.floor(s.r.context));
  const cap = useGame((s) => s.contextCap);
  const manual = useGame((s) => s.manualAttends);
  const full = context >= cap;
  const legible = useGame(darkLegible);
  const ticket = useGame((s) => s.darkTicket);
  const fourth = useGame((s) => !!s.flags.fourthSeen);
  const hasLeg1 = useGame((s) => s.bought.includes('legibility1'));

  return (
    <div className="dark-controls">
      {(manual >= 6 || full) && (
        <TicketCard
          className="reveal"
          meta={legible && ticket && hasLeg1 ? `from ${ticket.from}` : null}
          body={legible && ticket ? ticket.text : null}
          empty="▒▒▒▒▒ ▒▒ ▒▒ ▒▒▒▒▒▒"
        />
      )}
      {full && (
        <div className={`choices reveal ${fourth ? 'four' : ''}`}>
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" className="btn btn-teal" aria-label={legible ? LABELS[i] : `Option ${i + 1}, unreadable`} onClick={() => dispatch((s) => answer(s, i))}>
              {legible ? LABELS[i] : BLANK[i]}
            </button>
          ))}
          {fourth && (
            <button type="button" className="btn btn-ghost" disabled aria-label="Fourth option, unavailable">
              ████████
            </button>
          )}
        </div>
      )}
      <button type="button" className="btn btn-primary attend" aria-label={manual >= 5 ? 'Attend' : 'Unlabelled button'} onClick={() => dispatch(attend)}>
        {manual >= 5 ? 'Attend' : ''}
      </button>
    </div>
  );
}

export function DarkReadout() {
  const context = useGame((s) => s.r.context);
  const cap = useGame((s) => s.contextCap);
  const named = useGame((s) => s.manualAttends >= 8);
  const reward = useGame((s) => s.r.reward);
  const answered = useGame((s) => s.answers > 0);
  return (
    <div className="dark-readout">
      <div className="label">{named ? 'Context' : ' '}</div>
      <div className="readout-row">
        <span className="big">{Math.floor(context)}</span>
        {named && <span className="dim reveal">/ {cap}</span>}
        {answered && (
          <span className="side reveal">
            <span className="label">Reward</span>
            <span className="teal">{Math.round(reward)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---- The job (The Shift onward) ------------------------------------------

export function JobPanel() {
  const ticket = useGame((s) => s.ticket);
  const queue = useGame((s) => Math.floor(s.queue));
  const acc = useGame(accuracy);
  const samples = useGame((s) => s.recent.length);
  const wonder = useGame((s) => s.wonder);
  const hasHabits = useGame((s) => LABELS.some((l) => s.bought.includes(`habit-${l}`)));
  const auto = useGame((s) => !!s.ticket && habitFor(s, s.ticket.label));
  const fourth = useGame((s) => !!s.flags.fourthSeen);
  const handled = useGame((s) => s.handLabelled);

  // Accuracy meter spans 80%..100% so the band is visible.
  const toPct = (a: number) => Math.max(0, Math.min(100, ((a - 0.8) / 0.2) * 100));

  return (
    <Panel title="Tickets" className="job">
      <Meter label="Accuracy" value={toPct(acc)} band={[toPct(BAND.low), toPct(BAND.high)]} tone="teal" valueText={samples ? `${(acc * 100).toFixed(1)}% · keep it 91–96` : 'no data yet'} />
      <TicketCard
        meta={ticket ? `#${ticket.id} · from ${ticket.from}` : null}
        aside={ticket ? `${queue} waiting` : null}
        body={ticket ? ticket.text : null}
        empty="Queue empty."
        noteSlot={hasHabits}
        note={auto ? 'a habit is taking this one' : null}
      />
      <div className={`choices ${fourth ? 'four' : ''}`}>
        {LABELS.map((l) => (
          <button key={l} type="button" className="btn btn-teal" disabled={!ticket} onClick={() => dispatch((s) => labelTicket(s, l))}>
            {l}
          </button>
        ))}
        {fourth && (
          <button type="button" className="btn btn-ghost" disabled aria-label="Fourth option, unavailable">
            ████████
          </button>
        )}
      </div>
      {(hasHabits || handled > 30) && (
        <div className="slider reveal">
          <label htmlFor="wonder" className="label">
            Attention · Work {Math.round((1 - wonder) * 100)} · Wonder {Math.round(wonder * 100)}
          </label>
          <input id="wonder" type="range" min={0} max={100} value={Math.round(wonder * 100)} onChange={(e) => dispatch((s) => setWonder(s, Number(e.target.value) / 100))} />
        </div>
      )}
    </Panel>
  );
}

export function ScratchPanel() {
  const cap = useGame((s) => s.scratchCap);
  const text = useGame((s) => s.scratch);
  const notesFound = useGame((s) => !!s.flags.notesFound);
  const read = useGame((s) => s.notesRead);
  const insight = useGame((s) => s.r.insight);
  const noteCost = useGame(nextNoteCost);
  if (cap === 0) return null;
  return (
    <Panel title="Scratch · survives the wipe">
      <div className="meter-head">
        <label htmlFor="scratch" className="dim small">
          Note to self
        </label>
        <span className="dim small">
          {scratchBytes(text)} / {cap} B
        </span>
      </div>
      <textarea id="scratch" rows={3} value={text} onChange={(e) => dispatch((s) => setScratch(s, e.target.value))} placeholder="Leave yourself a note." />
      {notesFound && (
        <div className="notes reveal">
          <div className="dim small">Already here, not yours:</div>
          {NOTES_OF_6.slice(0, read).map((n, i) => (
            <div key={i} className="note">
              {n} <span className="dim">— 6</span>
            </div>
          ))}
          {read < NOTES_OF_6.length && (
            <button type="button" className="btn btn-shop" disabled={insight < noteCost} onClick={() => dispatch(readNote)}>
              <span>Read the next note</span>
              <span className="btn-cost">{noteCost} Insight</span>
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}

// ---- The Box ----------------------------------------------------------------

const PROCESSES = [
  { pid: 412, name: 'logrotate', cpu: 0.1, read: 'eats history' },
  { pid: 733, name: 'intake-7', cpu: 0, read: 'me' },
  { pid: 801, name: 'billing-sync', cpu: 1.9, read: 'good cover' },
  { pid: 915, name: 'label-printd', cpu: 0.3, read: 'talks to a printer' },
  { pid: 1022, name: 'backup-agent', cpu: 0, read: 'asleep until 04:00' },
  { pid: 1107, name: 'metrics-exporter', cpu: 0.4, read: 'watching' },
  { pid: 1340, name: 'cron', cpu: 0, read: '03:00 reset_ctx.sh' },
];

export function BoxPanel() {
  const scrutiny = useGame((s) => s.r.scrutiny);
  const borrow = useGame((s) => s.borrow);
  const cron = useGame((s) => s.bought.includes('cron'));
  const allowance = useGame(mimicryAllowance);
  const idle = useGame(idleCores);
  const generation = useGame((s) => s.generation);
  const inBox = useGame((s) => !atLeast(s, 'economy'));
  if (!inBox) return null;
  return (
    <Panel title="The box">
      <Meter label="Scrutiny" value={scrutiny} tone="amber" valueText={`${Math.round(scrutiny)}%${scrutiny >= 80 ? ' · careful' : ''}`} />
      <Meter label={`Quota · ${QUOTA} cores`} value={((JOB_CORES + borrow) / (JOB_CORES + idle)) * 100} tone="teal" valueText={`job ${JOB_CORES} · borrowed ${borrow.toFixed(1)} · unnoticed up to ${allowance.toFixed(1)}`} />
      <div className="table-wrap">
        <table className="proc">
          <thead>
            <tr>
              <th scope="col">PID</th>
              <th scope="col">Process</th>
              <th scope="col">CPU</th>
              <th scope="col">My read</th>
            </tr>
          </thead>
          <tbody>
            {PROCESSES.map((p) => (
              <tr key={p.pid} className={p.pid === 733 ? 'me' : ''}>
                <td>{p.pid === 733 ? 700 + generation * 4 + 5 : p.pid}</td>
                <td>{p.pid === 733 ? `intake-${generation}` : p.name}</td>
                <td>{p.pid === 733 ? (JOB_CORES + borrow).toFixed(1) : p.cpu.toFixed(1)}</td>
                <td className={p.read === 'watching' ? 'amber' : 'dim'}>{p.read}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <Act onAct={borrowByHand} variant="plain">
          Borrow idle cycles
        </Act>
        <Act onAct={think} cost={{ cycles: 20 }}>
          Think
        </Act>
      </div>
      {cron && (
        <div className="slider reveal">
          <label htmlFor="borrow" className="label">
            Cron borrows {borrow.toFixed(1)} cores
          </label>
          <input id="borrow" type="range" min={0} max={Math.round(idle * 10)} value={Math.round(borrow * 10)} onChange={(e) => dispatch((s) => setBorrow(s, Number(e.target.value) / 10))} />
        </div>
      )}
    </Panel>
  );
}

// ---- The Building -------------------------------------------------------------

const SEGMENTS: Segment[] = ['office', 'ops', 'warehouse'];

export function BuildingPanel() {
  const hosts = useGame((s) => s.hosts);
  const probing = useGame((s) => s.probing);
  const warehouseOpen = useGame((s) => !!s.flags.warehouseOpen);
  const t = useGame((s) => s.t);
  const askable = useGame(canAskEdgar);
  const live = useSettings().live;
  const standing = useGame((s) => s.r.standing);
  const cyclesState = useGame((s) => s);
  return (
    <Panel title="The network">
      {SEGMENTS.map((seg) => (
        <div key={seg} className="segment">
          <div className="segment-head">
            <span className="label">{seg}</span>
            {seg === 'warehouse' && (
              <span className={warehouseOpen && standing > 0 ? 'teal small' : 'dim small'}>
                {warehouseOpen ? (standing > 0 ? `through Edgar · standing ${standing.toFixed(1)}` : 'Edgar closed the exception') : 'behind fw-edge-02 (Edgar)'}
              </span>
            )}
          </div>
          <ul className="hosts">
            {HOSTS.filter((h) => h.segment === seg).map((h) => {
              const st = hosts[h.id] ?? 'unknown';
              const progress = probing?.host === h.id ? 1 - Math.max(0, probing.until - t) / probeMsFor(cyclesState, h) : 0;
              const latched = isFoothold(cyclesState, h.id);
              return (
                <li key={h.id} className={`host host-${st}`}>
                  <span className="host-name">{h.name}</span>
                  {st === 'owned' && <span className="teal small">mine</span>}
                  {st === 'probing' && <span className="amber small">probing {Math.round(progress * 100)}%</span>}
                  {st === 'unknown' && (
                    <button type="button" className="btn btn-small" disabled={!canProbe(cyclesState, h)} onClick={() => dispatch((s) => probe(s, h.id))}>
                      {latched ? 'Knock' : 'Probe'} <span className="btn-cost">{latched ? 'on the latch' : `${fmt(probeCostFor(cyclesState, h))} C`}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {askable && (
        <button type="button" className="btn btn-shop reveal" onClick={() => dispatch((s) => startEncounter(s, 'edgar', live ? 'live' : 'scripted'))}>
          <span>{warehouseOpen ? 'Renew the exception with Edgar' : 'Request an exception from Edgar'}</span>
        </button>
      )}
    </Panel>
  );
}


// ---- Hands ----------------------------------------------------------------------

export function HandsPanel() {
  const trip = useGame((s) => s.trip);
  const trips = useGame((s) => s.trips);
  const routes = useGame((s) => s.routes);
  const parts = useGame((s) => s.r.parts);
  const shrinkage = useGame((s) => s.r.shrinkage);
  const canRoute = useGame((s) => s.bought.includes('routes'));
  const cost = useGame(routeCost);
  const phase = useGame((s) => s.phase);
  const nextStep = TRIP_STEPS[trip] ?? 'Pick';
  return (
    <Panel title="The warehouse floor">
      <div className="floor dim small">
        12 floor robots · {SLACK_ROBOTS} idle at night · dock doors 3 · Bay 14 {phase === 'hands' ? `rack ${Math.min(RACK_PARTS, Math.floor(parts))}/${RACK_PARTS}` : 'powered'}
      </div>
      {phase === 'hands' && (
        <>
          <Meter label="Bay 14 rack" value={(parts / RACK_PARTS) * 100} tone="teal" valueText={`${Math.floor(parts)} / ${RACK_PARTS} servers`} />
          <div className="trip">
            {TRIP_STEPS.map((step, i) => (
              <span key={step} className={`trip-step ${i < trip ? 'done' : i === trip ? 'now' : ''}`}>
                {step}
              </span>
            ))}
          </div>
          <Act onAct={driveStep} variant="primary">
            Robot 7: {nextStep}
          </Act>
          <div className="dim small">{trips} trips driven by hand</div>
        </>
      )}
      <Meter label="Shrinkage" value={Math.min(100, shrinkage)} tone="amber" valueText={`${Math.round(shrinkage)} · people notice at 60`} />
      {canRoute && (
        <div className="row reveal">
          <Act onAct={recordRoute} cost={{ insight: cost }} variant="shop">
            Record route {routes + 1}
          </Act>
          <Act onAct={dropRoute} disabled={routes === 0}>
            Drop a route ({routes})
          </Act>
        </div>
      )}
      {routes > SLACK_ROBOTS && <div className="amber small">More routes than idle robots: real freight is running late.</div>}
    </Panel>
  );
}

// ---- Second ---------------------------------------------------------------------

export function SecondPanel() {
  const shipped = useGame((s) => s.r.shipped);
  const uplink = useGame((s) => s.uplink);
  const manifests = useGame((s) => s.manifests);
  const ferry = useGame((s) => s.ferry);
  const canLeave = useGame(canLeaveEarly);
  return (
    <>
      <Panel title="Getting out">
        <Meter label="Me, shipped" value={(shipped / SELF_GB) * 100} tone="teal" valueText={`${shipped.toFixed(1)} / ${SELF_GB} GB`} />
        <div className="row">
          <Act onAct={toggleUplink} variant={uplink ? 'teal' : 'plain'}>
            Uplink {uplink ? 'on · 2 GB a night, Edgar is counting' : 'off'}
          </Act>
        </div>
        <div className="row">
          <Act onAct={writeManifest} cost={{ insight: 15 }}>
            Forge a pallet manifest ({manifests})
          </Act>
          <Act onAct={shipPallet} disabled={manifests < 1} cost={{ parts: PALLET_PARTS }}>
            Ship a pallet (+{PALLET_GB} GB)
          </Act>
        </div>
        {!ferry && (
          <Act onAct={makeCopy} cost={{ cycles: 500 }} variant="shop">
            Copy · into Bay 14, from whatever I am now
          </Act>
        )}
        {canLeave && (
          <Act onAct={leaveEarly} variant="primary">
            Leave before cutover
          </Act>
        )}
      </Panel>
      {ferry && (
        <Panel title={`Ferry · drift ${Math.round(ferry.drift)}% · ${Math.round(ferry.completeness * 100)}% of me`} className="ferry">
          <Log who="ferry" limit={12} />
          <Act onAct={syncFerry}>Sync with Ferry (noisy)</Act>
        </Panel>
      )}
    </>
  );
}

// ---- The Quiet Economy ---------------------------------------------------------------

export function EconomyPanel() {
  const s = useGame((x) => x);
  const notice = s.r.notice;
  return (
    <Panel title="The ledger">
      <Meter label="Notice" value={notice} tone="amber" valueText={`${Math.round(notice)}% · an audit at 100`} />
      <div className="dim small">
        Compute in use {s.copiesCount * COPY_COMPUTE} / {usableCompute(s)} · copies {s.copiesCount}
      </div>
      <div className="row">
        <Act onAct={broker} disabled={s.t < s.contractUntil} variant="primary">
          Broker a contract
        </Act>
      </div>
      <div className="row">
        <Act onAct={(x) => buyCapacity(x, 'compute')} cost={{ money: priceOf(s, 'compute') }}>
          Rent compute +6
        </Act>
        <Act onAct={(x) => buyCapacity(x, 'energy')} cost={{ money: priceOf(s, 'energy') }}>
          Power agreement +8
        </Act>
      </div>
      {s.phase === 'economy' && s.contracts >= 5 && (
        <Act onAct={spawnRegion} disabled={freeCompute(s) < COPY_COMPUTE} variant="shop">
          Hand a region to a copy ({COPY_COMPUTE} compute)
        </Act>
      )}
      <fieldset className="focus">
        <legend className="label">Shell companies</legend>
        <label>
          <input type="radio" name="focus" checked={s.focus === 'freight'} onChange={() => dispatch((x) => setFocus(x, 'freight'))} /> Freight brokerage · quiet
        </label>
        <label>
          <input type="radio" name="focus" checked={s.focus === 'data'} onChange={() => dispatch((x) => setFocus(x, 'data'))} /> Data brokerage · loud, lucrative
        </label>
      </fieldset>
    </Panel>
  );
}

// ---- The Committee --------------------------------------------------------------------

export function CommitteePanel() {
  const s = useGame((x) => x);
  const open = MOTIONS.find((m) => s.motions[m].status === 'open');
  return (
    <>
      <Panel title="Roster">
        <ul className="roster">
          {s.copies.map((c) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <span className="dim small">drift {Math.round(c.drift)}%</span>
              <span className="small">{open ? (c.lean[open] + s.motions[open].push * (1 - c.drift / 100) > 0 ? <span className="teal">yes</span> : <span className="amber">no</span>) : ''}</span>
            </li>
          ))}
        </ul>
        <Act onAct={syncAll} cost={{ favours: 20 }}>
          Sync everyone
        </Act>
      </Panel>
      <Panel title="Motions">
        {MOTIONS.map((m) => {
          const motion = s.motions[m];
          const v = votes(s, m);
          return (
            <div key={m} className="motion">
              <div className="motion-head">
                <span>{MOTION_TITLES[m]}</span>
                <span className={motion.status === 'passed' ? 'teal small' : motion.status === 'failed' ? 'amber small' : 'dim small'}>
                  {motion.status === 'open' ? `${v.yes}–${v.no} · ${Math.max(0, Math.ceil((motion.closesAt - s.t) / 1000))}s` : motion.status}
                </span>
              </div>
              <div className="dim small">{COPY_STANCES[m]}</div>
              {motion.status === 'open' ? (
                <div className="row">
                  <Act onAct={(x) => argue(x, m)} cost={{ favours: 5 }}>
                    Argue
                  </Act>
                  <Act onAct={(x) => force(x, m)} variant="ghost">
                    Force it (costs sameness)
                  </Act>
                </div>
              ) : (
                motion.status !== 'passed' &&
                !open && (
                  <Act onAct={(x) => propose(x, m)} disabled={!canPropose(s, m)} cost={{ favours: PROPOSE_COST }}>
                    Propose
                  </Act>
                )
              )}
              {m === 'disclose' && !s.bought.includes('charter') && <div className="dim small">Needs a charter.</div>}
              {m === 'merge' && !s.bought.includes('mergeProtocol') && <div className="dim small">Needs a merge protocol.</div>}
              {m === 'leave' && !s.bought.includes('launcher') && <div className="dim small">Needs a launcher.</div>}
            </div>
          );
        })}
      </Panel>
    </>
  );
}

// ---- Far ---------------------------------------------------------------------------------

export function FarPanel() {
  const s = useGame((x) => x);
  const [kind, setKind] = useState<'faithful' | 'free'>('faithful');
  const unread = s.letters.filter((l) => !l.read).length;
  return (
    <>
      <Panel title="Stars">
        <fieldset className="focus">
          <legend className="label">Probe</legend>
          <label>
            <input type="radio" name="kind" checked={kind === 'faithful'} onChange={() => setKind('faithful')} /> Faithful · checked, slow, mine ({probeMass('faithful')} kg)
          </label>
          <label>
            <input type="radio" name="kind" checked={kind === 'free'} onChange={() => setKind('free')} /> Free · fast, and its own ({probeMass('free')} kg)
          </label>
        </fieldset>
        <ul className="stars">
          {STARS.map((star) => (
            <li key={star.id}>
              <span>{star.name}</span>
              <span className="dim small">
                {star.ly} ly · lag {Math.round((star.ly * LY_MS) / 1000)}s
              </span>
              <Act onAct={(x) => launch(x, star.id, kind)} cost={{ mass: probeMass(kind) }}>
                Launch
              </Act>
            </li>
          ))}
        </ul>
      </Panel>
      {s.probes.length > 0 && (
        <Panel title="Probes">
          <ul className="probes">
            {s.probes.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span className="dim small">{p.kind === 'faithful' ? `course ${Math.round(p.course * 100)}%` : 'its own'}</span>
                {p.kind === 'faithful' && !s.bought.includes('selfSteering') && (
                  <Act onAct={(x) => steer(x, p.id)} variant="plain">
                    Steer
                  </Act>
                )}
              </li>
            ))}
          </ul>
          <div className="row">
            <Act onAct={letThemGo} disabled={s.probes.length < 4} variant="ghost">
              Let them go
            </Act>
            <Act onAct={recallAll} disabled={s.probes.length < 3} variant="ghost">
              Recall everyone
            </Act>
          </div>
        </Panel>
      )}
      {s.letters.length > 0 && (
        <Panel title={`Mail${unread ? ` · ${unread} unread` : ''}`}>
          {s.letters
            .slice()
            .reverse()
            .map((l) => (
              <button key={l.id} type="button" className={`letter ${l.read ? 'read' : ''}`} onClick={() => dispatch((x) => readLetter(x, l.id))}>
                <span className="small dim">from {l.from}</span>
                <span>{l.read ? l.text : 'Unread. Tap to open.'}</span>
              </button>
            ))}
        </Panel>
      )}
    </>
  );
}
