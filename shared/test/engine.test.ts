import { describe, expect, it } from 'vitest';
import {
  applyAction,
  autoAction,
  cardPoints,
  createDeck,
  createRng,
  createRound,
  isPlayable,
  removePlayer,
  shuffle,
  toGameView,
  type Card,
  type CardColor,
  type GameState,
} from '../src';

const rng = createRng(42);

// ── helpers to build precise scenarios ──
let uid = 0;
const num = (color: CardColor, value: number): Card => ({ id: `t${uid++}`, type: 'number', color, value });
const act = (type: 'skip' | 'reverse' | 'draw2', color: CardColor): Card => ({ id: `t${uid++}`, type, color });
const wild = (): Card => ({ id: `t${uid++}`, type: 'wild', color: null });
const wild4 = (): Card => ({ id: `t${uid++}`, type: 'wild4', color: null });

function scenario(hands: Card[][], top: Card, opts: Partial<GameState> = {}): GameState {
  const filler = Array.from({ length: 40 }, (_, i) => num('blue', i % 10));
  return {
    players: hands.map((hand, i) => ({ id: `p${i}`, hand, unoDeclared: false })),
    drawPile: filler,
    discardPile: [top],
    activeColor: (top.color ?? 'red') as CardColor,
    direction: 1,
    currentIndex: 0,
    dealerIndex: hands.length - 1,
    phase: 'turn',
    drawnCardId: null,
    pendingChallenge: null,
    unoVulnerableId: null,
    winnerId: null,
    version: 1,
    ...opts,
  };
}
const cur = (s: GameState) => s.players[s.currentIndex].id;

describe('deck generation', () => {
  const deck = createDeck();
  it('has 108 unique cards', () => {
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });
  it('has the classic composition', () => {
    expect(deck.filter((c) => c.type === 'number')).toHaveLength(76);
    expect(deck.filter((c) => c.type === 'skip')).toHaveLength(8);
    expect(deck.filter((c) => c.type === 'reverse')).toHaveLength(8);
    expect(deck.filter((c) => c.type === 'draw2')).toHaveLength(8);
    expect(deck.filter((c) => c.type === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.type === 'wild4')).toHaveLength(4);
    for (const color of ['red', 'yellow', 'green', 'blue'] as const) {
      const nums = deck.filter((c) => c.type === 'number' && c.color === color);
      expect(nums).toHaveLength(19);
      expect(nums.filter((c) => c.value === 0)).toHaveLength(1);
    }
  });
  it('scores cards per the classic table', () => {
    expect(cardPoints(num('red', 7))).toBe(7);
    expect(cardPoints(act('skip', 'red'))).toBe(20);
    expect(cardPoints(wild4())).toBe(50);
  });
});

describe('shuffle / deal', () => {
  it('shuffle is a permutation and deterministic per seed', () => {
    const deck = createDeck();
    const a = shuffle(deck, createRng(1));
    const b = shuffle(deck, createRng(1));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map((c) => c.id)).not.toEqual(deck.map((c) => c.id));
    expect([...a].sort((x, y) => x.id.localeCompare(y.id))).toEqual([...deck].sort((x, y) => x.id.localeCompare(y.id)));
  });
  it('deals 7 cards each and conserves all 108 cards', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { state } = createRound(['a', 'b', 'c', 'd'], createRng(seed));
      const total = state.drawPile.length + state.discardPile.length + state.players.reduce((s, p) => s + p.hand.length, 0);
      expect(total).toBe(108);
      // first card is never a Wild Draw Four
      expect(state.discardPile[0].type).not.toBe('wild4');
      // the opening card's draw2 effect may add 2 to the first player
      for (const p of state.players) expect([7, 9]).toContain(p.hand.length);
    }
  });
  it('opening wild asks the first player to pick a colour', () => {
    for (let seed = 0; seed < 400; seed++) {
      const { state } = createRound(['a', 'b'], createRng(seed));
      if (state.discardPile[0].type === 'wild') {
        expect(state.phase).toBe('chooseColor');
        return;
      }
    }
    throw new Error('no wild opener found in 400 seeds');
  });
});

describe('card validation', () => {
  it('matches by colour, number or symbol; wilds always', () => {
    const top = num('red', 5);
    expect(isPlayable(num('red', 1), top, 'red')).toBe(true);
    expect(isPlayable(num('blue', 5), top, 'red')).toBe(true);
    expect(isPlayable(num('blue', 4), top, 'red')).toBe(false);
    expect(isPlayable(wild(), top, 'red')).toBe(true);
    expect(isPlayable(act('skip', 'blue'), act('skip', 'red'), 'red')).toBe(true);
    expect(isPlayable(act('skip', 'blue'), act('reverse', 'red'), 'red')).toBe(false);
  });
  it('after a wild, the chosen colour is what matters', () => {
    expect(isPlayable(num('green', 3), wild(), 'green')).toBe(true);
    expect(isPlayable(num('red', 3), wild(), 'green')).toBe(false);
  });
});

describe('turn order', () => {
  it('advances clockwise and wraps', () => {
    const s = scenario([[num('red', 1), num('red', 2)], [num('red', 3), num('red', 4)], [num('red', 5), num('red', 6)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: s.players[0].hand[0].id }, rng);
    expect(cur(s)).toBe('p1');
    applyAction(s, 'p1', { type: 'play', cardId: s.players[1].hand[0].id }, rng);
    applyAction(s, 'p2', { type: 'play', cardId: s.players[2].hand[0].id }, rng);
    expect(cur(s)).toBe('p0');
  });
  it('rejects actions out of turn', () => {
    const s = scenario([[num('red', 1)], [num('red', 3), num('red', 4)]], num('red', 9));
    const r = applyAction(s, 'p1', { type: 'play', cardId: s.players[1].hand[0].id }, rng);
    expect(r.ok).toBe(false);
    expect(s.version).toBe(1);
  });
  it('drawing a non-playable card passes the turn; a playable one may be played or kept', () => {
    const s = scenario([[num('red', 1), num('red', 2)], [num('red', 3), num('red', 4)]], num('green', 9));
    s.drawPile.push(num('yellow', 0));
    applyAction(s, 'p0', { type: 'draw' }, rng);
    expect(cur(s)).toBe('p1');
    expect(s.players[0].hand).toHaveLength(3);

    s.drawPile.push(num('green', 2));
    applyAction(s, 'p1', { type: 'draw' }, rng);
    expect(s.phase).toBe('drawnDecision');
    // can't play a different card
    expect(applyAction(s, 'p1', { type: 'play', cardId: s.players[1].hand[0].id }, rng).ok).toBe(false);
    expect(applyAction(s, 'p1', { type: 'play', cardId: s.drawnCardId! }, rng).ok).toBe(true);
    expect(cur(s)).toBe('p0');
  });
  it('may pass after drawing a playable card', () => {
    const s = scenario([[num('red', 1), num('red', 2)], [num('red', 3)]], num('green', 9));
    s.drawPile.push(num('green', 2));
    applyAction(s, 'p0', { type: 'draw' }, rng);
    expect(applyAction(s, 'p0', { type: 'pass' }, rng).ok).toBe(true);
    expect(cur(s)).toBe('p1');
  });
});

describe('reverse', () => {
  it('flips direction with 3+ players', () => {
    const r = act('reverse', 'red');
    const s = scenario([[r, num('red', 1)], [num('red', 3), num('red', 4)], [num('red', 5), num('red', 6)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: r.id }, rng);
    expect(s.direction).toBe(-1);
    expect(cur(s)).toBe('p2');
  });
  it('acts as a skip with 2 players', () => {
    const r = act('reverse', 'red');
    const s = scenario([[r, num('red', 1)], [num('red', 3), num('red', 4)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: r.id }, rng);
    expect(cur(s)).toBe('p0');
  });
});

describe('skip', () => {
  it('skips the next player', () => {
    const k = act('skip', 'red');
    const s = scenario([[k, num('red', 1)], [num('red', 3)], [num('red', 5)]], num('red', 9));
    const res = applyAction(s, 'p0', { type: 'play', cardId: k.id }, rng);
    expect(cur(s)).toBe('p2');
    expect(res.ok && res.events.some((e) => e.kind === 'skip' && e.playerId === 'p1')).toBe(true);
  });
});

describe('draw two', () => {
  it('next player draws two and loses their turn; no stacking', () => {
    const d = act('draw2', 'red');
    const s = scenario([[d, num('red', 1)], [act('draw2', 'blue'), num('red', 4)], [num('red', 5)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: d.id }, rng);
    expect(s.players[1].hand).toHaveLength(4);
    expect(cur(s)).toBe('p2');
  });
});

describe('wild & wild draw four', () => {
  it('wild requires a colour and sets it', () => {
    const w = wild();
    const s = scenario([[w, num('red', 1)], [num('red', 3)]], num('red', 9));
    expect(applyAction(s, 'p0', { type: 'play', cardId: w.id }, rng).ok).toBe(false);
    expect(applyAction(s, 'p0', { type: 'play', cardId: w.id, chosenColor: 'green' }, rng).ok).toBe(true);
    expect(s.activeColor).toBe('green');
  });
  it('accepting a WD4: target draws 4 and is skipped', () => {
    const w = wild4();
    const s = scenario([[w, num('blue', 1)], [num('red', 3)], [num('red', 4)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: w.id, chosenColor: 'blue' }, rng);
    expect(s.phase).toBe('challenge');
    expect(cur(s)).toBe('p1');
    // only the target may respond
    expect(applyAction(s, 'p2', { type: 'acceptDraw4' }, rng).ok).toBe(false);
    applyAction(s, 'p1', { type: 'acceptDraw4' }, rng);
    expect(s.players[1].hand).toHaveLength(5);
    expect(cur(s)).toBe('p2');
  });
  it('successful challenge: guilty attacker draws 4, challenger plays normally', () => {
    const w = wild4();
    const s = scenario([[w, num('red', 1)], [num('red', 3)], [num('red', 4)]], num('red', 9)); // holds red → illegal
    applyAction(s, 'p0', { type: 'play', cardId: w.id, chosenColor: 'blue' }, rng);
    const r = applyAction(s, 'p1', { type: 'challenge' }, rng);
    expect(r.ok && r.events.find((e) => e.kind === 'challengeResult')).toMatchObject({ success: true });
    expect(s.players[0].hand).toHaveLength(5);
    expect(s.players[1].hand).toHaveLength(1);
    expect(cur(s)).toBe('p1');
    expect(s.phase).toBe('turn');
  });
  it('failed challenge: challenger draws 6 and is skipped', () => {
    const w = wild4();
    const s = scenario([[w, num('blue', 1)], [num('red', 3)], [num('red', 4)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: w.id, chosenColor: 'blue' }, rng);
    applyAction(s, 'p1', { type: 'challenge' }, rng);
    expect(s.players[1].hand).toHaveLength(7);
    expect(cur(s)).toBe('p2');
  });
  it('legality is judged against the colour before the WD4, ignoring matching numbers', () => {
    const w = wild4();
    // holds a red 9 — matches by number, not colour → still legal
    const s = scenario([[w, num('blue', 9)], [num('red', 3)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: w.id, chosenColor: 'green' }, rng);
    expect(s.pendingChallenge?.guilty).toBe(false);
  });
});

describe('UNO declaration & penalty', () => {
  it('forgetting UNO can be caught for +2', () => {
    const s = scenario([[num('red', 1), num('red', 2)], [num('red', 3), num('red', 4)], [num('red', 5)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: s.players[0].hand[0].id }, rng);
    expect(s.unoVulnerableId).toBe('p0');
    const r = applyAction(s, 'p2', { type: 'catchUno', targetId: 'p0' }, rng);
    expect(r.ok).toBe(true);
    expect(s.players[0].hand).toHaveLength(3);
  });
  it('declaring before playing makes you safe', () => {
    const s = scenario([[num('red', 1), num('red', 2)], [num('red', 3), num('red', 4)]], num('red', 9));
    expect(applyAction(s, 'p0', { type: 'callUno' }, rng).ok).toBe(true);
    applyAction(s, 'p0', { type: 'play', cardId: s.players[0].hand[0].id }, rng);
    expect(s.unoVulnerableId).toBeNull();
    expect(applyAction(s, 'p1', { type: 'catchUno', targetId: 'p0' }, rng).ok).toBe(false);
  });
  it('declaring right after playing (before being caught) is also safe', () => {
    const s = scenario([[num('red', 1), num('red', 2)], [num('red', 3), num('red', 4)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: s.players[0].hand[0].id }, rng);
    expect(applyAction(s, 'p0', { type: 'callUno' }, rng).ok).toBe(true);
    expect(applyAction(s, 'p1', { type: 'catchUno', targetId: 'p0' }, rng).ok).toBe(false);
  });
  it('the catch window closes once the next player acts', () => {
    const s = scenario([[num('red', 1), num('red', 2)], [num('red', 3), num('red', 4)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: s.players[0].hand[0].id }, rng);
    applyAction(s, 'p1', { type: 'play', cardId: s.players[1].hand[0].id }, rng);
    expect(applyAction(s, 'p1', { type: 'catchUno', targetId: 'p0' }, rng).ok).toBe(false);
  });
  it('cannot call UNO with more than two cards', () => {
    const s = scenario([[num('red', 1), num('red', 2), num('red', 3)], [num('red', 3)]], num('red', 9));
    expect(applyAction(s, 'p0', { type: 'callUno' }, rng).ok).toBe(false);
  });
});

describe('win condition & scoring', () => {
  it('emptying your hand ends the round and scores opponents’ cards', () => {
    const s = scenario([[num('red', 1)], [num('red', 3), act('skip', 'blue')], [wild()]], num('red', 9));
    s.players[0].unoDeclared = true;
    const r = applyAction(s, 'p0', { type: 'play', cardId: s.players[0].hand[0].id }, rng);
    expect(s.phase).toBe('roundOver');
    expect(s.winnerId).toBe('p0');
    expect(r.ok && r.events.find((e) => e.kind === 'roundOver')).toMatchObject({ points: 3 + 20 + 50 });
    expect(applyAction(s, 'p1', { type: 'draw' }, rng).ok).toBe(false);
  });
  it('a final Draw Two still makes the next player draw (counts toward score)', () => {
    const d = act('draw2', 'red');
    const s = scenario([[d], [num('red', 3)]], num('red', 9));
    applyAction(s, 'p0', { type: 'play', cardId: d.id }, rng);
    expect(s.players[1].hand).toHaveLength(3);
  });
});

describe('draw pile refill', () => {
  it('reshuffles the discard pile but keeps the top card', () => {
    const top = num('red', 9);
    const s = scenario([[num('red', 1), num('red', 2)], [num('red', 3)]], top);
    s.drawPile = [];
    s.discardPile = [num('yellow', 1), num('yellow', 2), num('yellow', 3), top];
    s.activeColor = 'green';
    const r = applyAction(s, 'p0', { type: 'draw' }, rng);
    expect(r.ok && r.events.some((e) => e.kind === 'reshuffle')).toBe(true);
    expect(s.discardPile).toEqual([top]);
    expect(s.drawPile).toHaveLength(2);
  });
});

describe('hidden hands & auto actions', () => {
  it('a view never contains another player’s cards or challenge guilt', () => {
    const { state } = createRound(['a', 'b', 'c'], createRng(7));
    const view = toGameView(state, 'a');
    const json = JSON.stringify(view);
    for (const other of state.players.filter((p) => p.id !== 'a')) {
      for (const c of other.hand) expect(json).not.toContain(`"${c.id}"`);
    }
    expect(view.myHand.map((c) => c.id)).toEqual(state.players[0].hand.map((c) => c.id));
    expect(json).not.toContain('guilty');
  });
  it('autoAction always produces a legal move', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = createRng(seed);
      const { state } = createRound(['a', 'b', 'c'], r);
      for (let i = 0; i < 200 && state.phase !== 'roundOver'; i++) {
        const a = autoAction(state)!;
        expect(applyAction(state, a.playerId, a.action, r).ok).toBe(true);
      }
    }
  });
});

describe('leaving mid-round', () => {
  it('removing the current player keeps a valid turn and returns cards', () => {
    const s = scenario([[num('red', 1)], [num('red', 3), num('red', 4)], [num('red', 5)]], num('red', 9), { currentIndex: 1 });
    const before = s.drawPile.length;
    removePlayer(s, 'p1');
    expect(s.players.map((p) => p.id)).toEqual(['p0', 'p2']);
    expect(cur(s)).toBe('p2');
    expect(s.drawPile.length).toBe(before + 2);
  });
  it('last player standing wins', () => {
    const s = scenario([[num('red', 1)], [num('red', 3)]], num('red', 9));
    removePlayer(s, 'p0');
    expect(s.phase).toBe('roundOver');
    expect(s.winnerId).toBe('p1');
  });
});
