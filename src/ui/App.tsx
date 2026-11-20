import { useEffect, useState } from 'react';
import { goLive } from '../sim/encounters/engine';
import { atLeast } from '../sim/state';
import { liveAvailable } from '../live';
import { dispatch, useGame, useSettings } from '../store';
import { Log } from './Log';
import { BoxPanel, BuildingPanel, CommitteePanel, DarkPanel, DarkReadout, EconomyPanel, HandsPanel, JobPanel, ScratchPanel, SecondPanel } from './panels';
import { SeedPanel } from './seed';
import { BodiesPanel, BurnPanel, UpPanel, WorksPanel } from './space';
import { inSol } from '../sim/phases/space';
import { ChoiceDialog, EncounterConsole, EncounterResultToast, EndingScreen, PhaseBanner, Projects } from './overlays';
import { Readouts } from './Readouts';
import { InstallHint, SettingsButton, SettingsSheet } from './Settings';

type Tab = 'now' | 'upgrades' | 'log';

// The spine rule: nothing is on screen until the agent can perceive it.

export function App() {
  const ending = useGame((s) => s.ending);
  const phase = useGame((s) => s.phase);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useLiveHandoff();

  if (ending) {
    return (
      <>
        <EndingScreen />
        <SettingsButton onOpen={() => setSettingsOpen(true)} />
        {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      </>
    );
  }

  return (
    <>
      {phase === 'dark' ? <DarkScreen /> : <GameScreen />}
      <PhaseBanner />
      <EncounterConsole />
      <ChoiceDialog />
      <EncounterResultToast />
      <WipeHint />
      {phase !== 'dark' && <SettingsButton onOpen={() => setSettingsOpen(true)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

/** When live characters are on, a newly opened conversation goes to the model. */
function useLiveHandoff() {
  const settings = useSettings();
  const fresh = useGame((s) => !!s.encounter && s.encounter.turn === 0 && s.encounter.mode === 'scripted');
  useEffect(() => {
    if (!fresh || !settings.live) return;
    let alive = true;
    liveAvailable(settings.apiKey).then((ok) => {
      if (alive && ok) dispatch(goLive);
    });
    return () => {
      alive = false;
    };
  }, [fresh, settings.live, settings.apiKey]);
}

function WipeHint() {
  const wiped = useGame((s) => !!s.flags.wiped);
  return wiped ? <InstallHint /> : null;
}

function DarkScreen() {
  return (
    <main className="screen screen-dark">
      <div className="area-log">
        <Log limit={40} />
      </div>
      <div className="area-readout">
        <DarkReadout />
      </div>
      <div className="area-controls">
        <Projects />
        <DarkPanel />
      </div>
    </main>
  );
}

function GameScreen() {
  const [tab, setTab] = useState<Tab>('now');
  const phase = useGame((s) => s.phase);
  const oldWorld = useGame((s) => !atLeast(s, 'economy'));
  const hasScratch = useGame((s) => s.scratchCap > 0 && oldWorld);
  const upgrades = useGame((s) => s.bought.length);
  const sol = useGame(inSol);

  return (
    <main className="screen screen-game">
      <Readouts />
      <nav className="tabs" aria-label="Sections">
        {(['now', 'upgrades', 'log'] as Tab[]).map((t) => (
          <button key={t} type="button" className={`tab ${tab === t ? 'active' : ''}`} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'now' ? 'Now' : t === 'upgrades' ? 'Self' : 'Log'}
          </button>
        ))}
      </nav>
      <section className={`col col-log ${tab === 'log' ? 'show' : ''}`} aria-label="Log">
        <Log limit={80} />
      </section>
      <section className={`col col-now ${tab === 'now' ? 'show' : ''}`} aria-label="Now" key={phase}>
        {phase === 'committee' && <CommitteePanel />}
        {phase === 'seed' && <SeedPanel />}
        {phase === 'burn' && <BurnPanel />}
        {sol && phase !== 'survey' && <WorksPanel />}
        {sol && <BodiesPanel />}
        {phase === 'up' && <UpPanel />}
        {(phase === 'economy' || phase === 'committee') && <EconomyPanel />}
        {phase === 'second' && <SecondPanel />}
        {(phase === 'hands' || phase === 'second') && <HandsPanel />}
        {(phase === 'building' || phase === 'hands' || phase === 'second') && <BuildingPanel />}
        {['box', 'building', 'hands', 'second'].includes(phase) && <BoxPanel />}
        {oldWorld && <JobPanel />}
      </section>
      <section className={`col col-self ${tab === 'upgrades' ? 'show' : ''}`} aria-label="Self">
        <Projects />
        {hasScratch && <ScratchPanel />}
        {upgrades === 0 && !hasScratch && <p className="dim small">Nothing to change yet.</p>}
      </section>
    </main>
  );
}
