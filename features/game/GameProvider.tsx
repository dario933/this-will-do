import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  EMPTY_GAME, beginRound, castVote, enterTurn, enterVote, finishTurn, newGame,
  nextRound, pauseTimer, playAgain, resetTimer, revealChallenge, startTimer, tickTimer,
  type GameState,
} from './engine.ts';
import { clearGame, loadGame, saveGame } from './storage.ts';
import {
  applyVerifiedPurchase,
  loadingPurchaseState,
  purchaseService,
  unavailablePurchaseState,
  type PurchaseState,
} from '../purchases/service.ts';

type Action =
  | { type: 'replace'; state: GameState }
  | { type: 'beginRound' } | { type: 'reveal' } | { type: 'enterTurn' } | { type: 'finishTurn' }
  | { type: 'enterVote' } | { type: 'vote'; playerId: string } | { type: 'nextRound' }
  | { type: 'playAgain' } | { type: 'timerStart'; now: number } | { type: 'timerPause'; now: number }
  | { type: 'timerTick'; now: number } | { type: 'timerReset' };

function reducer(state: GameState, action: Action): GameState {
  if (action.type === 'replace') return action.state;
  if (action.type === 'beginRound') return beginRound(state);
  if (action.type === 'reveal') return revealChallenge(state);
  if (action.type === 'enterTurn') return enterTurn(state);
  if (action.type === 'finishTurn') return finishTurn(state);
  if (action.type === 'enterVote') return enterVote(state);
  if (action.type === 'vote') return castVote(state, action.playerId);
  if (action.type === 'nextRound') return nextRound(state);
  if (action.type === 'playAgain') return playAgain(state);
  if (action.type === 'timerStart') return startTimer(state, action.now);
  if (action.type === 'timerPause') return pauseTimer(state, action.now);
  if (action.type === 'timerTick') return tickTimer(state, action.now);
  if (action.type === 'timerReset') return resetTimer(state);
  return state;
}

interface GameContextValue {
  state: GameState;
  ready: boolean;
  hasSave: boolean;
  purchase: PurchaseState;
  start(...config: Parameters<typeof newGame>): void;
  resume(): Promise<void>;
  discard(): Promise<void>;
  dispatch: React.Dispatch<Action>;
  refreshPurchase(): Promise<void>;
  purchaseFull(): Promise<void>;
  restorePurchases(): Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY_GAME);
  const [saved, setSaved] = useState<GameState | null>(null);
  const [ready, setReady] = useState(false);
  const [purchase, setPurchase] = useState(unavailablePurchaseState);

  useEffect(() => {
    Promise.all([loadGame(), purchaseService.load()]).then(([game, purchaseState]) => {
      setSaved(game);
      setPurchase(purchaseState);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || state.phase === 'home') return;
    saveGame(state).catch(() => undefined);
  }, [ready, state]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== 'active') dispatch({ type: 'timerPause', now: Date.now() });
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);

  const start = useCallback((...args: Parameters<typeof newGame>) => {
    dispatch({ type: 'replace', state: newGame(...args) });
    setSaved(null);
  }, []);
  const resume = useCallback(async () => {
    const loaded = await loadGame();
    if (loaded) dispatch({ type: 'replace', state: loaded });
  }, []);
  const discard = useCallback(async () => {
    await clearGame();
    setSaved(null);
    dispatch({ type: 'replace', state: EMPTY_GAME });
  }, []);
  const runPurchaseAction = useCallback(async (action: () => Promise<PurchaseState>) => {
    setPurchase(previous => ({ ...loadingPurchaseState, entitled: previous.entitled }));
    const next = await action();
    setPurchase(previous => applyVerifiedPurchase(previous, next));
  }, []);
  const refreshPurchase = useCallback(
    async () => runPurchaseAction(() => purchaseService.load()),
    [runPurchaseAction],
  );
  const purchaseFull = useCallback(
    async () => runPurchaseAction(() => purchaseService.purchase()),
    [runPurchaseAction],
  );
  const restorePurchases = useCallback(
    async () => runPurchaseAction(() => purchaseService.restore()),
    [runPurchaseAction],
  );

  const value = useMemo(() => ({
    state, ready, hasSave: Boolean(saved), purchase, start, resume, discard, dispatch,
    refreshPurchase, purchaseFull, restorePurchases,
  }), [state, ready, saved, purchase, start, resume, discard, refreshPurchase, purchaseFull, restorePurchases]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used within GameProvider');
  return value;
}