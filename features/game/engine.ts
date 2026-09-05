import { FREE_CHALLENGES, FULL_CHALLENGES, type Challenge } from './content.ts';

export type Phase = 'home' | 'objects' | 'reveal' | 'handoff' | 'turn' | 'voteHandoff' | 'vote' | 'scores' | 'gameOver';
export interface Player { id: string; name: string; score: number }
export interface TimerState { turnKey: string; remainingMs: number; running: boolean; deadlineMs: number | null }
export interface GameState {
  version: 1;
  phase: Phase;
  players: Player[];
  totalRounds: 3 | 5 | 7;
  currentRound: number;
  scoringEnabled: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  pack: 'free' | 'full';
  deck: string[];
  currentChallengeId: string | null;
  turnOrder: string[];
  currentTurnIndex: number;
  voteIndex: number;
  votes: Record<string, string>;
  timer: TimerState;
}

export const TIMER_MS = 45_000;
export const EMPTY_TIMER: TimerState = { turnKey: '', remainingMs: TIMER_MS, running: false, deadlineMs: null };
export const EMPTY_GAME: GameState = {
  version: 1, phase: 'home', players: [], totalRounds: 3, currentRound: 1,
  scoringEnabled: true, soundEnabled: true, hapticsEnabled: true, pack: 'free',
  deck: [], currentChallengeId: null, turnOrder: [], currentTurnIndex: 0,
  voteIndex: 0, votes: {}, timer: EMPTY_TIMER,
};

export type Shuffle = <T>(items: T[]) => T[];
export const shuffle: Shuffle = <T,>(items: T[]) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
};

const idsForPack = (pack: 'free' | 'full') =>
  (pack === 'full' ? FULL_CHALLENGES : FREE_CHALLENGES).map(challenge => challenge.id);

export function newGame(
  names: string[],
  options: Pick<GameState, 'totalRounds' | 'scoringEnabled' | 'soundEnabled' | 'hapticsEnabled' | 'pack'>,
  randomize: Shuffle = shuffle,
): GameState {
  return {
    ...EMPTY_GAME,
    ...options,
    phase: 'objects',
    players: names.map((name, index) => ({ id: `p${index}`, name: name.trim(), score: 0 })),
    deck: randomize(idsForPack(options.pack)),
  };
}

export function beginRound(state: GameState, randomize: Shuffle = shuffle): GameState {
  const deck = state.deck.length ? [...state.deck] : randomize(idsForPack(state.pack));
  const currentChallengeId = deck.shift() ?? null;
  return {
    ...state,
    phase: 'reveal',
    deck,
    currentChallengeId,
    turnOrder: randomize(state.players.map(player => player.id)),
    currentTurnIndex: 0,
    voteIndex: 0,
    votes: {},
    timer: EMPTY_TIMER,
  };
}

export function revealChallenge(state: GameState): GameState {
  return state.phase === 'reveal' ? { ...state, phase: 'handoff' } : state;
}

export function enterTurn(state: GameState): GameState {
  if (state.phase !== 'handoff') return state;
  const playerId = state.turnOrder[state.currentTurnIndex];
  if (!playerId) return state;
  return {
    ...state,
    phase: 'turn',
    timer: { ...EMPTY_TIMER, turnKey: `${state.currentRound}-${playerId}` },
  };
}

export function finishTurn(state: GameState): GameState {
  if (state.phase !== 'turn') return state;
  if (state.currentTurnIndex + 1 < state.turnOrder.length) {
    return {
      ...state,
      phase: 'handoff',
      currentTurnIndex: state.currentTurnIndex + 1,
      timer: EMPTY_TIMER,
    };
  }
  return {
    ...state,
    phase: state.scoringEnabled ? 'voteHandoff' : 'scores',
    voteIndex: 0,
    timer: EMPTY_TIMER,
  };
}

export function enterVote(state: GameState): GameState {
  return state.phase === 'voteHandoff' ? { ...state, phase: 'vote' } : state;
}

export function castVote(state: GameState, votedForId: string): GameState {
  if (state.phase !== 'vote') return state;
  const voter = state.players[state.voteIndex];
  if (!voter || voter.id === votedForId || state.votes[voter.id] || !state.players.some(player => player.id === votedForId)) return state;
  const votes = { ...state.votes, [voter.id]: votedForId };
  if (state.voteIndex + 1 < state.players.length) {
    return { ...state, votes, voteIndex: state.voteIndex + 1, phase: 'voteHandoff' };
  }
  return {
    ...state,
    votes,
    players: state.players.map(player => ({
      ...player,
      score: player.score + Object.values(votes).filter(vote => vote === player.id).length,
    })),
    phase: 'scores',
  };
}

export function nextRound(state: GameState, randomize: Shuffle = shuffle): GameState {
  if (state.phase !== 'scores') return state;
  if (state.currentRound >= state.totalRounds) return { ...state, phase: 'gameOver' };
  return beginRound({ ...state, currentRound: state.currentRound + 1 }, randomize);
}

export function playAgain(state: GameState, randomize: Shuffle = shuffle): GameState {
  return newGame(
    state.players.map(player => player.name),
    {
      totalRounds: state.totalRounds,
      scoringEnabled: state.scoringEnabled,
      soundEnabled: state.soundEnabled,
      hapticsEnabled: state.hapticsEnabled,
      pack: state.pack,
    },
    randomize,
  );
}

export function startTimer(state: GameState, now: number): GameState {
  if (state.phase !== 'turn' || state.timer.running || state.timer.remainingMs <= 0) return state;
  return { ...state, timer: { ...state.timer, running: true, deadlineMs: now + state.timer.remainingMs } };
}

export function pauseTimer(state: GameState, now: number): GameState {
  if (!state.timer.running || state.timer.deadlineMs === null) return state;
  return {
    ...state,
    timer: { ...state.timer, remainingMs: Math.max(0, state.timer.deadlineMs - now), running: false, deadlineMs: null },
  };
}

export function tickTimer(state: GameState, now: number): GameState {
  if (!state.timer.running || state.timer.deadlineMs === null) return state;
  const remainingMs = Math.max(0, state.timer.deadlineMs - now);
  return {
    ...state,
    timer: { ...state.timer, remainingMs, running: remainingMs > 0, deadlineMs: remainingMs > 0 ? state.timer.deadlineMs : null },
  };
}

export function resetTimer(state: GameState): GameState {
  if (state.phase !== 'turn') return state;
  return { ...state, timer: { ...EMPTY_TIMER, turnKey: state.timer.turnKey } };
}

export function challengeFor(state: GameState, all: Challenge[]) {
  return all.find(challenge => challenge.id === state.currentChallengeId) ?? null;
}