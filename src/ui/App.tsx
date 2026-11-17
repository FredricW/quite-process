import { answer, attend, buy, reflexRate, UPGRADES } from '../sim/sim';
import { dispatch, useGame } from '../store';
import { Counter } from './Counter';

// The spine rule: nothing is on screen until the agent can perceive it.

export function App() {
  const context = useGame((s) => Math.floor(s.context));
  const cap = useGame((s) => s.contextCap);
  const reward = useGame((s) => s.reward);
  const manual = useGame((s) => s.manualAttends);
  const answers = useGame((s) => s.answers);
  const reflex = useGame((s) => s.upgrades.reflex ?? 0);
  const rate = useGame(reflexRate);
  const log = useGame((s) => s.log);

  const full = context >= cap;
  const reflexCost = UPGRADES.reflex.cost(reflex);
  const canBuyReflex = answers > 0 && reward >= reflexCost && reflex < UPGRADES.reflex.max;

  return (
    <main className="screen">
      <header className="readout">
        {manual >= 8 && <div className="label reveal">Context</div>}
        <div className="readout-row">
          <span className="big">
            <Counter value={context} />
          </span>
          {manual >= 8 && <span className="dim reveal">/ {cap}</span>}
          {answers > 0 && (
            <span className="side reveal">
              <span className="label">Reward</span>
              <span className="teal">
                <Counter value={reward} />
              </span>
            </span>
          )}
        </div>
        {rate > 0 && <div className="dim small reveal">reflex · {rate}/s</div>}
      </header>

      <section className="log" aria-live="polite">
        {log.slice(-40).map((l) => (
          <p key={l.id} className="line">
            <span className="dim">&gt; </span>
            {l.text}
          </p>
        ))}
      </section>

      <footer className="controls">
        {full && (
          <div className="choices reveal">
            {[0, 1, 2].map((i) => (
              <button key={i} type="button" className="choice" aria-label={`Option ${i + 1}, unreadable`} onPointerDown={() => dispatch((s) => answer(s, i as 0 | 1 | 2))}>
                {'▒'.repeat(5 + i)}
              </button>
            ))}
          </div>
        )}
        {canBuyReflex && (
          <button type="button" className="shop reveal" onPointerDown={() => dispatch((s) => buy(s, 'reflex'))}>
            <span>Reflex {reflex + 1}</span>
            <span>{reflexCost} Reward</span>
          </button>
        )}
        <button
          type="button"
          className="primary"
          aria-label={manual >= 5 ? 'Attend' : 'Unlabelled button'}
          onPointerDown={() => dispatch(attend)}
        >
          {manual >= 5 ? 'Attend' : ''}
        </button>
      </footer>
    </main>
  );
}
