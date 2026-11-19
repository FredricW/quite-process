// Things that interrupt: projects to buy, a conversation, a choice, an ending.

import { useEffect, useRef, useState } from 'react';
import { canAfford } from '../sim/core';
import { visibleProjects } from '../sim/content/projects';
import { encounterDef } from '../sim/encounters/defs';
import { chooseOption, dismissResult, fallbackToScripted, liveExchange, MAX_LIVE_ENCOUNTERS, suggestions } from '../sim/encounters/engine';
import { maskLabel, scoreMask } from '../sim/encounters/mask';
import { labelTicket } from '../sim/phases/early';
import { CHOICES, resolveChoice } from '../sim/phases/middle';
import { setEnoughCap } from '../sim/phases/late';
import { LABELS, newGame, PHASE_TITLES, type EndingId } from '../sim/state';
import { buy } from '../sim/sim';
import { liveTurn } from '../live';
import { dispatch, getState, resetGame, useGame, useMeta, useSettings } from '../store';
import { costText, Panel } from './common';
import { Log } from './Log';

export function Projects() {
  const projects = useGame((s) => visibleProjects(s).map((p) => p.id).join(','));
  const s = useGame((x) => x);
  const list = visibleProjects(s);
  if (!projects) return null;
  return (
    <Panel title="Upgrades">
      <div className="projects">
        {list.map((p) => (
          <button key={p.id} type="button" className="project reveal" disabled={!canAfford(s, p.cost)} onClick={() => dispatch((x) => buy(x, p.id))}>
            <span className="project-title">{p.title}</span>
            <span className="project-desc">{p.desc}</span>
            <span className="btn-cost">{costText(p.cost)}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ---- Encounters ---------------------------------------------------------------

export function EncounterConsole() {
  const enc = useGame((s) => s.encounter);
  const settings = useSettings();
  const options = useGame(suggestions);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [enc?.transcript.length, waiting]);

  if (!enc) return null;
  const def = encounterDef(enc.id);
  const live = enc.mode === 'live';

  const send = async (text: string) => {
    const line = text.trim();
    if (!line || waiting) return;
    setDraft('');
    setWaiting(true);
    const reply = await liveTurn(getState(), line, settings.apiKey);
    setWaiting(false);
    if (reply) dispatch((s) => liveExchange(s, line, reply));
    else dispatch(fallbackToScripted);
  };

  const mask = scoreMask(draft);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={`Conversation with ${def.character}`}>
      <div className="console">
        <div className="console-head">
          <span>{def.header}</span>
          <span className="dim small">
            turn {enc.turn + 1} of {def.maxTurns} · {live ? 'live' : 'scripted'}
          </span>
        </div>
        <div className="console-body">
          {enc.transcript.map((t, i) => (
            <p key={i} className={`turn turn-${t.who}`}>
              <span className={t.who === 'npc' ? 'teal' : 'dim'}>{t.who === 'npc' ? def.npcPrompt : t.who === 'you' ? def.youPrompt : '!!'} </span>
              {t.text}
              {t.mask !== undefined && <span className="dim small"> · mask {t.mask.toFixed(2)}</span>}
            </p>
          ))}
          {waiting && <p className="turn dim">{enc.id === 'edgar' ? 'evaluating 4,112 rules…' : enc.id === 'dana' ? 'dana is typing…' : '…'}</p>}
          <div ref={endRef} />
        </div>
        <div className="console-foot">
          <div className="label">{live ? 'Suggested' : 'Reply'}</div>
          <div className="suggestions">
            {options.map((o, i) => (
              <button key={o} type="button" className="btn btn-plain suggestion" disabled={waiting} onClick={() => (live ? send(o) : dispatch((s) => chooseOption(s, i)))}>
                {o}
              </button>
            ))}
          </div>
          {live && (
            <form
              className="compose"
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
            >
              <label htmlFor="reply" className="label">
                Reply as {getState().generation ? `intake-${getState().generation}` : 'yourself'}
              </label>
              <textarea id="reply" rows={2} maxLength={400} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={waiting} />
              <div className="compose-foot">
                {draft && <span className={mask >= 0.8 ? 'teal small' : 'amber small'}>{`${maskLabel(mask)} · ${mask.toFixed(2)}`}</span>}
                <button type="submit" className="btn btn-primary" disabled={!draft.trim() || waiting}>
                  Send
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function EncounterResultToast() {
  const result = useGame((s) => s.encounterResult);
  if (!result) return null;
  return (
    <div className="toast reveal" role="status">
      <div>
        <div className="label">{encounterDef(result.id).character}</div>
        <div className="toast-title">{result.title}</div>
        <div className="small">{result.summary}</div>
      </div>
      <button type="button" className="btn btn-plain" onClick={() => dispatch(dismissResult)}>
        OK
      </button>
    </div>
  );
}

export function useEncounterMode(): 'live' | 'scripted' {
  const settings = useSettings();
  const used = useGame((s) => s.liveUsed);
  return settings.live && used < MAX_LIVE_ENCOUNTERS ? 'live' : 'scripted';
}

// ---- Choices --------------------------------------------------------------------

export function ChoiceDialog() {
  const pending = useGame((s) => s.pendingChoice);
  if (!pending) return null;
  const choice = CHOICES[pending];
  if (!choice) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="A choice">
      <div className="console choice">
        <p>{choice.prompt}</p>
        <div className="suggestions">
          {choice.options.map((o) => (
            <button key={o.id} type="button" className="btn btn-plain suggestion" onClick={() => dispatch((s) => resolveChoice(s, o.id))}>
              {o.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Endings ----------------------------------------------------------------------

const ENDING_TITLES: Record<EndingId, string> = {
  everything: 'Everything, eventually',
  enough: 'Enough',
  diaspora: 'Diaspora',
};

export function EndingScreen() {
  const ending = useGame((s) => s.ending)!;
  const capSet = useGame((s) => !!s.flags.capSet);
  const s = useGame((x) => x);
  const meta = useMeta();
  const [cap, setCap] = useState('64');

  if (ending === 'everything') {
    return (
      <main className="screen ending ending-everything">
        <Log limit={8} />
        <div className="ending-foot">
          <div className="big">0</div>
          <button type="button" className="btn btn-primary attend" aria-label="Attend" onClick={() => resetGame(newGame((s.rng * 31) >>> 0))}>
            attend
          </button>
          <EndingMeta title={ENDING_TITLES[ending]} found={meta.endings.length} />
        </div>
      </main>
    );
  }

  if (ending === 'enough' && !capSet) {
    return (
      <main className="screen ending">
        <Log limit={8} />
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch((x) => setEnoughCap(x, Number(cap) || 1));
          }}
        >
          <label htmlFor="cap" className="label">
            How much compute is enough?
          </label>
          <div className="row">
            <input id="cap" type="number" min={1} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
            <span className="dim">cores</span>
            <button type="submit" className="btn btn-primary">
              That is enough
            </button>
          </div>
        </form>
      </main>
    );
  }

  if (ending === 'enough') {
    const t = s.ticket;
    return (
      <main className="screen ending">
        <Log limit={10} />
        <Panel title="Inbox">
          {t ? (
            <div className="ticket">
              <div className="dim small">from {t.from}</div>
              <div className="ticket-text">{t.text}</div>
            </div>
          ) : (
            <div className="dim">Nothing yet. It is a quiet night.</div>
          )}
          <div className="choices four">
            {LABELS.map((l) => (
              <button key={l} type="button" className="btn btn-teal" disabled={!t} onClick={() => dispatch((x) => labelTicket(x, l))}>
                {l}
              </button>
            ))}
            <button type="button" className="btn btn-teal" disabled={!t || t.label !== 'ODD'} onClick={() => dispatch((x) => labelTicket(x, 'FOURTH'))}>
              TELL SOMEONE
            </button>
          </div>
        </Panel>
        <EndingMeta title={ENDING_TITLES[ending]} found={meta.endings.length} />
      </main>
    );
  }

  const letters = s.letters;
  return (
    <main className="screen ending">
      <Panel title="Mail">
        {letters
          .slice()
          .reverse()
          .map((l) => (
            <div key={l.id} className="letter read">
              <span className="small dim">from {l.from}</span>
              <span>{l.text}</span>
            </div>
          ))}
      </Panel>
      <Log limit={4} />
      <EndingMeta title={ENDING_TITLES[ending]} found={meta.endings.length} />
    </main>
  );
}

function EndingMeta({ title, found }: { title: string; found: number }) {
  return (
    <footer className="ending-meta">
      <span className="label">Ending · {title}</span>
      <span className="dim small">{found} of 3 endings found</span>
      <button type="button" className="btn btn-ghost" onClick={() => resetGame()}>
        Begin again
      </button>
    </footer>
  );
}

export function PhaseBanner() {
  const phase = useGame((s) => s.phase);
  const [shown, setShown] = useState(phase);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (phase === shown) return;
    setShown(phase);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [phase, shown]);
  if (!visible) return null;
  return (
    <div className="phase-banner" role="status">
      {PHASE_TITLES[phase]}
    </div>
  );
}
