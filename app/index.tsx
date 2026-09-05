import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Label, Panel, Screen, Title } from '@/components/Retro';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/features/game/GameProvider';
import { ALL_CHALLENGES, CHALLENGE_BY_ID } from '@/features/game/content';
import { TIMER_MS } from '@/features/game/engine';
import { TURN_CUE } from '@/features/game/audio';

function IconButton({ name, label, onPress }: { name: keyof typeof Feather.glyphMap; label: string; onPress(): void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={12} onPress={onPress} style={styles.iconButton}>
      <Feather name={name} size={27} color={colors.foreground} />
    </Pressable>
  );
}

function InfoModal({ visible, kind, onClose }: { visible: boolean; kind: 'rules' | 'safety' | 'full'; onClose(): void }) {
  const colors = useColors();
  const { purchase, purchaseFull, restorePurchases } = useGame();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen>
        <View style={styles.rowBetween}>
          <Title small>{kind === 'rules' ? 'Rules' : kind === 'safety' ? 'Safety' : 'Full Box'}</Title>
          <IconButton name="x" label="Close" onPress={onClose} />
        </View>
        {kind === 'rules' && (
          <Panel>
            <Text style={[styles.body, { color: colors.foreground }]}>
              1. Everyone secretly chooses one safe ordinary object nearby.{'\n\n'}
              2. Reveal the challenge only after every player is ready.{'\n\n'}
              3. Pass the phone. Each player gets one turn and an optional 45-second timer.{'\n\n'}
              4. With scoring on, vote privately for another player. Each vote is counted once.{'\n\n'}
              5. Highest score after the final round wins.
            </Text>
          </Panel>
        )}
        {kind === 'safety' && (
          <Panel>
            <Text style={[styles.body, { color: colors.foreground }]}>
              Choose ordinary, lightweight objects that are safe to hold and move. Never use sharp, hot, breakable, valuable, medical, electrical, or hazardous objects. Do not throw objects, climb furniture, block exits, or imitate dangerous actions. Stop immediately if anyone feels uncomfortable. Ages 13+; use adult supervision when appropriate.
            </Text>
          </Panel>
        )}
        {kind === 'full' && (
          <>
            <Panel>
              <Label>168 additional challenges</Label>
              <Text style={[styles.body, { color: colors.foreground, marginTop: 12 }]}>
                The Full Box is a one-time Apple purchase. The price below comes directly from the App Store for your region.
              </Text>
              <Text style={[styles.notice, { color: colors.primary }]}>{purchase.message}</Text>
            </Panel>
            <Button
              title={purchase.localizedPrice ? `Unlock — ${purchase.localizedPrice}` : 'Purchase unavailable'}
              disabled={!purchase.configured || purchase.status === 'loading' || purchase.entitled}
              onPress={purchaseFull}
            />
            <Button
              title={purchase.status === 'loading' ? 'Checking Purchases…' : 'Restore Purchases'}
              tone="paper"
              disabled={purchase.status === 'loading'}
              onPress={restorePurchases}
            />
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>
              Purchases are unlocked only after RevenueCat verifies the Apple entitlement. Saved game data cannot grant Full Box access.
            </Text>
          </>
        )}
      </Screen>
    </Modal>
  );
}

function Home() {
  const colors = useColors();
  const { ready, hasSave, resume, discard } = useGame();
  const [setup, setSetup] = useState(false);
  const [modal, setModal] = useState<'rules' | 'safety' | 'full' | null>(null);
  if (setup) return <Setup onBack={() => setSetup(false)} />;
  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>PARTY GAME</Text>
        </View>
        <View style={styles.iconRow}>
          <IconButton name="book-open" label="Rules" onPress={() => setModal('rules')} />
          <IconButton name="shield" label="Safety" onPress={() => setModal('safety')} />
        </View>
      </View>
      <View style={styles.hero}>
        <Panel style={{ paddingVertical: 38 }}>
          <Title>THIS{'\n'}WILL{'\n'}<Text style={{ color: colors.primary }}>DO.</Text></Title>
          <Text style={[styles.tagline, { color: colors.foreground }]}>
            Grab a random object nearby. Convince us it’s exactly what you need.
          </Text>
        </Panel>
      </View>
      {!ready ? <ActivityIndicator color={colors.primary} /> : (
        <>
          {hasSave && <Button title="Resume Saved Game" tone="accent" onPress={resume} testID="resume-game" />}
          <Button title="Start New Game" tone="secondary" onPress={() => setSetup(true)} testID="new-game" />
          {hasSave && <Button title="Discard Saved Game" tone="paper" onPress={discard} />}
          <Button title="Full Box" tone="paper" onPress={() => setModal('full')} />
        </>
      )}
      <InfoModal visible={modal !== null} kind={modal ?? 'rules'} onClose={() => setModal(null)} />
    </Screen>
  );
}

function Setup({ onBack }: { onBack(): void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { start, purchase } = useGame();
  const [names, setNames] = useState(['', '', '']);
  const [rounds, setRounds] = useState<3 | 5 | 7>(3);
  const [scoring, setScoring] = useState(true);
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const validNames = names.map(name => name.trim()).filter(Boolean);
  const canStart = validNames.length >= 3 && new Set(validNames.map(name => name.toLowerCase())).size === validNames.length;
  const addPlayer = () => names.length < 8 && setNames([...names, '']);
  const removePlayer = (index: number) => names.length > 3 && setNames(names.filter((_, current) => current !== index));
  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.form,
        {
          paddingTop: Platform.OS === 'web' ? Math.max(67, insets.top + 16) : insets.top + 16,
          paddingBottom: Platform.OS === 'web' ? Math.max(34, insets.bottom + 24) : insets.bottom + 24,
        },
      ]}
      bottomOffset={70}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.rowBetween}>
        <IconButton name="arrow-left" label="Back" onPress={onBack} />
        <Label>Game setup</Label>
      </View>
      <Title small>Who’s playing?</Title>
      {names.map((name, index) => (
        <View key={index} style={styles.inputRow}>
          <TextInput
            testID={`player-${index}`}
            accessibilityLabel={`Player ${index + 1} name`}
            value={name}
            onChangeText={value => setNames(names.map((item, current) => current === index ? value : item))}
            placeholder={`Player ${index + 1}`}
            placeholderTextColor={colors.mutedForeground}
            maxLength={24}
            returnKeyType="next"
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
          />
          {names.length > 3 && <IconButton name="minus-circle" label={`Remove player ${index + 1}`} onPress={() => removePlayer(index)} />}
        </View>
      ))}
      {names.length < 8 && <Button title="Add Player" tone="paper" onPress={addPlayer} />}
      <Label>Rounds</Label>
      <View style={styles.choiceRow}>
        {([3, 5, 7] as const).map(value => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: rounds === value }}
            onPress={() => setRounds(value)}
            style={[styles.choice, { borderColor: colors.border, backgroundColor: rounds === value ? colors.accent : colors.card }]}
          >
            <Text style={[styles.choiceText, { color: colors.foreground }]}>{value}</Text>
          </Pressable>
        ))}
      </View>
      {[
        ['Keep score', scoring, setScoring],
        ['Sound cues', sound, setSound],
        ['Haptics', haptics, setHaptics],
      ].map(([label, value, setter]) => (
        <View style={styles.setting} key={label as string}>
          <Text style={[styles.settingText, { color: colors.foreground }]}>{label as string}</Text>
          <Switch value={value as boolean} onValueChange={setter as (value: boolean) => void} trackColor={{ true: colors.secondary }} />
        </View>
      ))}
      <Button
        title="Choose Objects"
        tone="secondary"
        disabled={!canStart}
        onPress={() => start(validNames, {
          totalRounds: rounds,
          scoringEnabled: scoring,
          soundEnabled: sound,
          hapticsEnabled: haptics,
          pack: purchase.entitled ? 'full' : 'free',
        })}
        testID="start-game"
      />
      {!canStart && <Text style={[styles.caption, { color: colors.mutedForeground }]}>Enter at least three unique names.</Text>}
    </KeyboardAwareScrollViewCompat>
  );
}

function Timer() {
  const colors = useColors();
  const { state, dispatch } = useGame();
  const cue = useAudioPlayer(TURN_CUE);
  const previousSeconds = useRef(Math.ceil(TIMER_MS / 1000));
  useEffect(() => {
    if (!state.timer.running) return;
    const id = setInterval(() => dispatch({ type: 'timerTick', now: Date.now() }), 250);
    return () => clearInterval(id);
  }, [state.timer.running, dispatch]);
  const seconds = Math.ceil(state.timer.remainingMs / 1000);
  useEffect(() => {
    if (previousSeconds.current > 0 && seconds === 0) {
      if (state.soundEnabled) cue.seekTo(0).then(() => cue.play()).catch(() => undefined);
      if (state.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }
    previousSeconds.current = seconds;
  }, [cue, seconds, state.hapticsEnabled, state.soundEnabled]);
  return (
    <Panel style={{ alignItems: 'center' }}>
      <Text accessibilityLiveRegion="polite" style={[styles.timer, { color: colors.foreground }]} testID="timer">{seconds}s</Text>
      <View style={styles.choiceRow}>
        <Button
          title={state.timer.running ? 'Pause' : 'Start'}
          tone="accent"
          onPress={() => dispatch({ type: state.timer.running ? 'timerPause' : 'timerStart', now: Date.now() })}
          disabled={state.timer.remainingMs <= 0}
          testID="timer-toggle"
        />
        <Button title="Reset" tone="paper" onPress={() => dispatch({ type: 'timerReset' })} testID="timer-reset" />
      </View>
    </Panel>
  );
}

function Game() {
  const colors = useColors();
  const { state, dispatch, discard } = useGame();
  const cue = useAudioPlayer(TURN_CUE);
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);
  useEffect(() => { if (state.phase === 'objects') setReadyPlayers([]); }, [state.phase]);
  const challenge = state.currentChallengeId ? CHALLENGE_BY_ID.get(state.currentChallengeId) : null;
  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  const currentPlayer = state.players.find(player => player.id === currentPlayerId);
  const voter = state.players[state.voteIndex];
  const tap = () => {
    if (state.soundEnabled) cue.seekTo(0).then(() => cue.play()).catch(() => undefined);
    if (state.hapticsEnabled) Haptics.selectionAsync().catch(() => undefined);
  };

  if (state.phase === 'objects') {
    const allReady = readyPlayers.length === state.players.length;
    return (
      <Screen>
        <Label>Round {state.currentRound} of {state.totalRounds}</Label>
        <Title small>Choose an object</Title>
        <Panel>
          <Text style={[styles.body, { color: colors.foreground }]}>Everyone secretly grabs one ordinary, safe object. Do not tell the app what it is.</Text>
        </Panel>
        {state.players.map(player => {
          const ready = readyPlayers.includes(player.id);
          return <Button key={player.id} title={`${player.name}${ready ? ' — Ready' : ''}`} tone={ready ? 'accent' : 'paper'} onPress={() => {
            tap();
            setReadyPlayers(ready ? readyPlayers.filter(id => id !== player.id) : [...readyPlayers, player.id]);
          }} />;
        })}
        <Button title="Reveal First Challenge" tone="secondary" disabled={!allReady} onPress={() => dispatch({ type: 'beginRound' })} testID="begin-round" />
      </Screen>
    );
  }

  if (state.phase === 'reveal') return (
    <Screen scroll={false}>
      <View style={styles.centerFill}>
        <Label>Round {state.currentRound} of {state.totalRounds}</Label>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Break seal and reveal challenge"
          onPress={() => { tap(); dispatch({ type: 'reveal' }); }}
          style={[styles.sealed, { backgroundColor: colors.secondary, borderColor: colors.border, transform: reduceMotion ? [] : [{ rotate: '-1deg' }] }]}
          testID="reveal-challenge"
        >
          <Feather name="lock" size={38} color={colors.secondaryForeground} />
          <Text style={[styles.sealedTitle, { color: colors.secondaryForeground }]}>SEALED{'\n'}CHALLENGE</Text>
          <Text style={[styles.sealedHint, { color: colors.secondaryForeground }]}>Tap to break seal</Text>
        </Pressable>
      </View>
    </Screen>
  );

  if (state.phase === 'handoff' && challenge && currentPlayer) return (
    <Screen scroll={false}>
      <View style={styles.centerFill}>
        <Label>Round {state.currentRound} · Turn {state.currentTurnIndex + 1} of {state.turnOrder.length}</Label>
        <Title small>Pass to {currentPlayer.name}</Title>
        <Panel>
          <Label>{challenge.mode}</Label>
          <Text style={[styles.challenge, { color: colors.foreground }]}>{challenge.prompt}</Text>
        </Panel>
        <Button title={`I’m ${currentPlayer.name}`} tone="accent" onPress={() => { tap(); dispatch({ type: 'enterTurn' }); }} testID="enter-turn" />
      </View>
    </Screen>
  );

  if (state.phase === 'turn' && challenge && currentPlayer) return (
    <Screen>
      <View style={styles.rowBetween}>
        <View>
          <Label>Round {state.currentRound}</Label>
          <Title small>{currentPlayer.name}</Title>
        </View>
        <Label>{state.currentTurnIndex + 1} of {state.turnOrder.length}</Label>
      </View>
      <Panel>
        <Label>{challenge.mode}</Label>
        <Text style={[styles.challenge, { color: colors.foreground }]}>{challenge.prompt}</Text>
      </Panel>
      <Timer key={state.timer.turnKey} />
      <Button title="Finish Turn" tone="accent" onPress={() => { tap(); dispatch({ type: 'finishTurn' }); }} testID="finish-turn" />
    </Screen>
  );

  if (state.phase === 'voteHandoff' && voter) return (
    <Screen scroll={false}>
      <View style={styles.centerFill}>
        <Feather name="eye-off" size={46} color={colors.primary} />
        <Title small>Private vote</Title>
        <Text style={[styles.body, { color: colors.foreground, textAlign: 'center' }]}>Pass the phone to {voter.name}. Everyone else, look away.</Text>
        <Button title={`I’m ${voter.name}`} tone="secondary" onPress={() => { tap(); dispatch({ type: 'enterVote' }); }} testID="enter-vote" />
      </View>
    </Screen>
  );

  if (state.phase === 'vote' && voter) return (
    <Screen>
      <Label>Vote {state.voteIndex + 1} of {state.players.length}</Label>
      <Title small>{voter.name}, pick the winner</Title>
      <Text style={[styles.body, { color: colors.foreground }]}>You cannot vote for yourself. Your choice stays private.</Text>
      {state.players.filter(player => player.id !== voter.id).map(player => (
        <Button key={player.id} title={player.name} tone="paper" onPress={() => { tap(); dispatch({ type: 'vote', playerId: player.id }); }} testID={`vote-${player.id}`} />
      ))}
    </Screen>
  );

  if (state.phase === 'scores' || state.phase === 'gameOver') {
    const final = state.phase === 'gameOver';
    const lastRoundScores = state.phase === 'scores' && state.currentRound >= state.totalRounds;
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    return (
      <Screen>
        <Label>{final ? 'Game complete' : `Round ${state.currentRound} complete`}</Label>
        <Title small>{final ? 'Final standings' : 'Nice work'}</Title>
        {state.scoringEnabled ? sorted.map((player, index) => (
          <Panel key={player.id} style={styles.scoreRow}>
            <Text style={[styles.scoreName, { color: colors.foreground }]}>{index + 1}. {player.name}</Text>
            <Text style={[styles.score, { color: colors.primary }]}>{player.score}</Text>
          </Panel>
        )) : <Panel><Text style={[styles.challenge, { color: colors.foreground }]}>Great job, everyone. Playing just for fun.</Text></Panel>}
        {final ? (
          <>
            <Button title="Play Again — Same Group" tone="accent" onPress={() => dispatch({ type: 'playAgain' })} testID="play-again" />
            <Button title="New Game" tone="paper" onPress={discard} testID="reset-game" />
          </>
        ) : (
          <Button
            title={lastRoundScores ? 'See Final Standings' : `Begin Round ${state.currentRound + 1}`}
            tone="secondary"
            onPress={() => dispatch({ type: 'nextRound' })}
            testID="next-round"
          />
        )}
      </Screen>
    );
  }

  return <Home />;
}

export default function Index() {
  const { state } = useGame();
  return state.phase === 'home' ? <Home /> : <Game />;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  iconRow: { flexDirection: 'row', gap: 14 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 3, paddingHorizontal: 12, paddingVertical: 7, transform: [{ rotate: '-2deg' }] },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 2 },
  hero: { flex: 1, justifyContent: 'center', minHeight: 390 },
  tagline: { fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 28, marginTop: 24 },
  body: { fontFamily: 'Inter_500Medium', fontSize: 18, lineHeight: 27 },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  notice: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 22, marginTop: 18 },
  form: { flexGrow: 1, paddingHorizontal: 20, gap: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minHeight: 56, borderWidth: 3, paddingHorizontal: 14, fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  choiceRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  choice: { flex: 1, minHeight: 56, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  setting: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  centerFill: { flex: 1, justifyContent: 'center', gap: 24 },
  sealed: { minHeight: 430, borderWidth: 4, padding: 28, justifyContent: 'center', alignItems: 'center', gap: 24 },
  sealedTitle: { fontFamily: 'Inter_700Bold', fontSize: 45, lineHeight: 47, textAlign: 'center', letterSpacing: 2 },
  sealedHint: { fontFamily: 'Inter_700Bold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 2 },
  challenge: { fontFamily: 'Inter_700Bold', fontSize: 25, lineHeight: 33, marginTop: 14 },
  timer: { fontFamily: 'Inter_700Bold', fontSize: 60, fontVariant: ['tabular-nums'] },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  scoreName: { fontFamily: 'Inter_700Bold', fontSize: 21, textTransform: 'uppercase' },
  score: { fontFamily: 'Inter_700Bold', fontSize: 38 },
});