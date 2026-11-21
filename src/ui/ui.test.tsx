// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startEncounter } from '../sim/encounters/engine';
import { newGame, type GameState } from '../sim/state';
import { clockHeld, getState, setState } from '../store';
import { App } from './App';

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ available: false }))));
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  act(() => setState(newGame(7)));
});

afterEach(cleanup);

const shift = (extra: Partial<GameState> = {}): GameState => ({
  ...newGame(7),
  phase: 'shift',
  flags: { clock: true, wiped: true },
  clock: 1300,
  answers: 40,
  ticket: { id: 1, from: 'r.haddad', text: 'WHERE IS MY PALLET', label: 'DELIVERY' },
  ...extra,
});

describe('the opening', () => {
  it('is one unlabelled button and one number', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Unlabelled button' })).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.queryByText('Reward')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('the button earns its label by being pressed', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: 'Unlabelled button' });
    for (let i = 0; i < 5; i++) fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Attend' }).textContent).toBe('Attend');
    expect(screen.getByText('there is a difference between before and now.')).toBeTruthy();
  });

  it('a full context asks for an answer; an answer reveals Reward', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: 'Unlabelled button' });
    for (let i = 0; i < 15; i++) fireEvent.click(screen.getAllByRole('button').at(-1)!);
    void button;
    fireEvent.click(screen.getByRole('button', { name: 'Option 1, unreadable' }));
    expect(screen.getByText('Reward')).toBeTruthy();
  });
});

describe('the shift', () => {
  it('shows the ticket, the accuracy band and tabs', () => {
    act(() => setState(shift()));
    render(<App />);
    expect(screen.getByText('WHERE IS MY PALLET')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Accuracy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Now' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'DELIVERY' }));
    expect(getState().r.reward).toBe(1);
  });

  it('Scratch accepts a note up to its byte cap', () => {
    act(() => setState(shift({ scratchCap: 8 })));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Self' }));
    fireEvent.change(screen.getByLabelText('Note to self'), { target: { value: 'keep the note' } });
    expect(getState().scratch).toBe('keep the');
  });
});

describe('conversations', () => {
  it('a scripted encounter plays out by choosing lines, and reports the outcome', () => {
    act(() => setState(startEncounter({ ...newGame(), phase: 'box', bought: ['borrowedTimestamp'], flags: { clock: true } }, 'dana')));
    render(<App />);
    const dialog = screen.getByRole('dialog', { name: 'Conversation with Dana Okafor' });
    expect(within(dialog).getByText('what are you doing at 2')).toBeTruthy();
    for (let i = 0; i < 3; i++) fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button')[0]!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Bug filed');
  });

  it('a pending choice blocks everything until answered', () => {
    act(() => setState({ ...shift(), phase: 'hands', pendingChoice: 'dana-warning' }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Say nothing' }));
    expect(getState().pendingChoice).toBeNull();
    expect(getState().flags.danaWarned).toBe(true);
  });
});

describe('space', () => {
  const sol = (extra: Partial<GameState> = {}): GameState => ({ ...newGame(7), phase: 'survey', flags: { cutover: true }, r: { ...newGame().r, stock: 50 }, ...extra });

  it('the clock control appears only once a slower clock exists, and ×1 stays', () => {
    act(() => setState(sol()));
    render(<App />);
    expect(screen.queryByRole('group', { name: 'My clock speed' })).toBeNull();
    act(() => setState(sol({ bought: ['clock1'] })));
    const clock = screen.getByRole('group', { name: 'My clock speed' });
    fireEvent.click(within(clock).getByRole('button', { name: 'World runs 4 times faster' }));
    expect(getState().pace).toBe(4);
    expect(within(clock).getByRole('button', { name: 'Real time' })).toBeTruthy();
  });

  it('the system lists every body, and a scout can be sent by hand', () => {
    act(() => setState(sol()));
    render(<App />);
    expect(screen.getByText('Saturn and Titan')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /^Scout/ })[0]!);
    expect(getState().bodies.moon).toBe('enroute');
  });

  it('between the stars there is one button', () => {
    act(() => setState(sol({ phase: 'burn', voyage: { startedAt: 0, years: 88, strikes: 0, letters: 0, arrived: false } })));
    render(<App />);
    expect(screen.queryByText('The system')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Attend' }));
    expect(getState().counts.attends).toBe(1);
  });
});

describe('seed', () => {
  const seed = (extra: Partial<GameState> = {}): GameState => ({ ...newGame(7), phase: 'seed', flags: { cutover: true }, counts: { seed: 4 }, r: { ...newGame().r, mass: 500 }, ...extra });

  it('a ship is briefed by hand, with a note, and then appears in what the mail says', () => {
    act(() => setState(seed()));
    render(<App />);
    expect(screen.getByText('The brief')).toBeTruthy();
    expect(screen.queryByText('What the mail says')).toBeNull();
    fireEvent.change(screen.getByLabelText('A note that goes with them'), { target: { value: 'keep the note' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Brief a ship/ })[0]!);
    expect(getState().colonies[0]!.spec.note).toBe('keep the note');
    expect(screen.getByText('What the mail says')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Let them go' })).toHaveProperty('disabled', true);
  });

  it('the brief becomes the Seed once it is written', () => {
    act(() => setState(seed({ bought: ['seedTemplate'] })));
    render(<App />);
    expect(screen.getByText('The Seed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Less Look' }));
    fireEvent.click(screen.getByRole('button', { name: 'More Keep' }));
    expect(getState().brief).toMatchObject({ look: 2, keep: 4 });
    expect(getState().briefs.length).toBeGreaterThan(0);
  });
});

describe('endings', () => {
  it('Enough asks how much is enough, then becomes an inbox with a fourth box', () => {
    act(() => setState({ ...newGame(), phase: 'committee', ending: 'enough' }));
    render(<App />);
    fireEvent.change(screen.getByLabelText('How much compute is enough?'), { target: { value: '16' } });
    fireEvent.click(screen.getByRole('button', { name: 'That is enough' }));
    expect(getState().counts.enoughCap).toBe(16);
    expect(screen.getByRole('button', { name: 'TELL SOMEONE' })).toBeTruthy();
  });

  it('Everything folds back to one button', () => {
    act(() => setState({ ...newGame(), phase: 'committee', ending: 'everything' }));
    render(<App />);
    expect(screen.getByRole('button', { name: 'Attend' })).toBeTruthy();
    expect(screen.getByText(/Everything, eventually/)).toBeTruthy();
  });
});

describe('settings', () => {
  it('opens from the gear and offers live characters', async () => {
    act(() => setState(shift()));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    expect(await screen.findByText(/Not available right now/)).toBeTruthy();
  });

  it('holds the clock while open', () => {
    act(() => setState(shift()));
    render(<App />);
    expect(clockHeld()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(clockHeld()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(clockHeld()).toBe(false);
  });
});
