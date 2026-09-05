import assert from 'node:assert/strict';
import test from 'node:test';
import { FULL_CHALLENGES, FREE_CHALLENGES } from './content.ts';
import {
  beginRound, castVote, EMPTY_GAME, enterTurn, enterVote, finishTurn, newGame, nextRound,
  pauseTimer, playAgain, resetTimer, revealChallenge, startTimer, tickTimer, type GameState,
} from './engine.ts';
import { decodeSave } from './storage.ts';
import { applyVerifiedPurchase, unavailablePurchaseState, type PurchaseState } from '../purchases/state.ts';

const inOrder = <T>(items: T[]) => [...items];
const config = { totalRounds: 3 as const, scoringEnabled: true, soundEnabled: false, hapticsEnabled: false, pack: 'free' as const };

function finishAllTurns(state: GameState) {
  if (state.phase === 'reveal') state = revealChallenge(state);
  for (let index = 0; index < state.players.length; index += 1) {
    state = enterTurn(state);
    assert.equal(state.timer.remainingMs, 45_000);
    assert.equal(state.timer.running, false);
    state = finishTurn(state);
  }
  return state;
}

function voteCycle(state: GameState) {
  for (let index = 0; index < state.players.length; index += 1) {
    state = enterVote(state);
    state = castVote(state, state.players[(index + 1) % state.players.length]!.id);
  }
  return state;
}

test('full three-round scored game resets round state and scores each vote once', () => {
  let state = beginRound(newGame(['Ada', 'Bea', 'Cal'], config, inOrder), inOrder);
  const challenges: string[] = [];
  for (let round = 1; round <= 3; round += 1) {
    challenges.push(state.currentChallengeId!);
    assert.equal(state.currentTurnIndex, 0);
    assert.deepEqual(state.votes, {});
    state = finishAllTurns(state);
    assert.equal(state.phase, 'voteHandoff');
    state = voteCycle(state);
    assert.deepEqual(state.players.map(player => player.score), [round, round, round]);
    const snapshot = JSON.stringify(state.players);
    state = castVote(state, state.players[1]!.id);
    assert.equal(JSON.stringify(state.players), snapshot);
    state = nextRound(state, inOrder);
  }
  assert.equal(new Set(challenges).size, 3);
  assert.equal(state.phase, 'gameOver');
});

test('scoring-off game gives every player one turn and finishes normally', () => {
  let state = beginRound(newGame(['Ada', 'Bea', 'Cal'], { ...config, scoringEnabled: false }, inOrder), inOrder);
  for (let round = 1; round <= 3; round += 1) {
    state = finishAllTurns(state);
    assert.equal(state.phase, 'scores');
    assert.deepEqual(state.players.map(player => player.score), [0, 0, 0]);
    state = nextRound(state, inOrder);
  }
  assert.equal(state.phase, 'gameOver');
});

test('vote restrictions reject self, duplicate and out-of-phase votes', () => {
  let state = beginRound(newGame(['Ada', 'Bea', 'Cal'], config, inOrder), inOrder);
  state = finishAllTurns(state);
  state = enterVote(state);
  const voter = state.players[0]!;
  assert.equal(castVote(state, voter.id), state);
  const voted = castVote(state, state.players[1]!.id);
  assert.equal(castVote(voted, state.players[2]!.id), voted);
  assert.equal(castVote(EMPTY_GAME, 'p1'), EMPTY_GAME);
});

test('new player timers start stopped at 45 seconds and backgrounding pauses safely', () => {
  let state = beginRound(newGame(['Ada', 'Bea', 'Cal'], config, inOrder), inOrder);
  state = revealChallenge(state);
  state = enterTurn(state);
  state = startTimer(state, 1_000);
  state = tickTimer(state, 3_000);
  assert.equal(state.timer.remainingMs, 43_000);
  state = pauseTimer(state, 4_000);
  assert.equal(state.timer.remainingMs, 42_000);
  assert.equal(state.timer.running, false);
  state = finishTurn(state);
  state = enterTurn(state);
  assert.equal(state.timer.remainingMs, 45_000);
  assert.equal(state.timer.running, false);
  assert.notEqual(state.timer.turnKey, '');
  state = startTimer(state, 10_000);
  state = pauseTimer(state, 12_000);
  state = pauseTimer(state, 15_000);
  assert.equal(state.timer.remainingMs, 43_000);
  state = resetTimer(state);
  assert.equal(state.timer.remainingMs, 45_000);
});

test('same-group replay and new game clear scores, votes, turns and challenge', () => {
  let state = beginRound(newGame(['Ada', 'Bea', 'Cal'], config, inOrder), inOrder);
  state = voteCycle(finishAllTurns(state));
  const replay = playAgain(state, inOrder);
  assert.deepEqual(replay.players.map(player => player.score), [0, 0, 0]);
  assert.deepEqual(replay.votes, {});
  assert.deepEqual(replay.turnOrder, []);
  assert.equal(replay.currentChallengeId, null);
  assert.equal(replay.phase, 'objects');
  const fresh = newGame(['Dee', 'Eli', 'Flo'], config, inOrder);
  assert.deepEqual(fresh.votes, {});
  assert.equal(fresh.currentTurnIndex, 0);
});

test('save restoration accepts valid state, pauses running timer, and rejects corruption or old versions', () => {
  let state = enterTurn(beginRound(newGame(['Ada', 'Bea', 'Cal'], config, inOrder), inOrder));
  state = startTimer(state, Date.now() + 10_000);
  const restored = decodeSave(JSON.stringify(state));
  assert.ok(restored);
  if (!restored) throw new Error('Expected a valid restored game');
  assert.equal(restored.timer.running, false);
  assert.equal(decodeSave('{broken'), null);
  assert.equal(decodeSave(JSON.stringify({ ...state, version: 0 })), null);
  assert.equal(decodeSave(JSON.stringify({ ...state, players: [] })), null);
});

test('challenge packs contain 18 free and 168 unique premium challenges', () => {
  assert.equal(FREE_CHALLENGES.length, 18);
  assert.equal(FULL_CHALLENGES.length, 168);
  assert.equal(new Set(FULL_CHALLENGES.map(challenge => challenge.id)).size, 168);
  assert.equal(new Set(FULL_CHALLENGES.map(challenge => challenge.prompt)).size, 168);
});

test('unavailable, cancelled, denied and unverified restore results cannot unlock premium', () => {
  const cases: PurchaseState[] = [
    unavailablePurchaseState,
    { configured: true, entitled: false, localizedPrice: '$5.00', status: 'cancelled', message: 'Cancelled' },
    { configured: true, entitled: false, localizedPrice: '$5.00', status: 'denied', message: 'Denied' },
    { configured: true, entitled: false, localizedPrice: '$5.00', status: 'restored', message: 'Nothing restored' },
  ];
  for (const result of cases) assert.equal(applyVerifiedPurchase(unavailablePurchaseState, result).entitled, false);
});