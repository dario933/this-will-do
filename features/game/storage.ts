import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHALLENGE_BY_ID } from './content.ts';
import { EMPTY_GAME, pauseTimer, type GameState, type Phase } from './engine.ts';

const KEY = 'this-will-do-native-save-v1';
const phases: Phase[] = ['home', 'objects', 'reveal', 'handoff', 'turn', 'voteHandoff', 'vote', 'scores', 'gameOver'];

export function decodeSave(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GameState>;
    if (
      value.version !== 1 ||
      !value.phase || !phases.includes(value.phase) ||
      !Array.isArray(value.players) || value.players.length < 3 || value.players.length > 8 ||
      !value.players.every(player => player && typeof player.id === 'string' && typeof player.name === 'string' && typeof player.score === 'number') ||
      ![3, 5, 7].includes(value.totalRounds as number) ||
      typeof value.currentRound !== 'number' || value.currentRound < 1 || value.currentRound > (value.totalRounds ?? 0) ||
      typeof value.scoringEnabled !== 'boolean' || typeof value.soundEnabled !== 'boolean' || typeof value.hapticsEnabled !== 'boolean' ||
      (value.pack !== 'free' && value.pack !== 'full') ||
      !Array.isArray(value.deck) || !value.deck.every(id => typeof id === 'string' && CHALLENGE_BY_ID.has(id)) ||
      (value.currentChallengeId !== null && (typeof value.currentChallengeId !== 'string' || !CHALLENGE_BY_ID.has(value.currentChallengeId))) ||
      !Array.isArray(value.turnOrder) || !value.turnOrder.every(id => value.players!.some(player => player.id === id)) ||
      typeof value.currentTurnIndex !== 'number' || typeof value.voteIndex !== 'number' ||
      !value.votes || typeof value.votes !== 'object' ||
      !value.timer || typeof value.timer.remainingMs !== 'number' || value.timer.remainingMs < 0 || value.timer.remainingMs > 45_000 ||
      typeof value.timer.running !== 'boolean' ||
      (value.timer.deadlineMs !== null && typeof value.timer.deadlineMs !== 'number')
    ) return null;
    const state = value as GameState;
    return pauseTimer(state, Date.now());
  } catch {
    return null;
  }
}

export async function loadGame() {
  const raw = await AsyncStorage.getItem(KEY);
  const state = decodeSave(raw);
  if (!state && raw) await AsyncStorage.removeItem(KEY);
  return state;
}

export async function saveGame(state: GameState) {
  if (state === EMPTY_GAME || state.phase === 'home') return;
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export async function clearGame() {
  await AsyncStorage.removeItem(KEY);
}