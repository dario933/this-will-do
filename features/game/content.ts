export type GameMode = 'Pitch' | 'Perform' | 'Rescue' | 'Explain' | 'Invent' | 'Transform';

export interface Challenge {
  id: string;
  mode: GameMode;
  prompt: string;
  pack: 'free' | 'full';
}

export const FREE_CHALLENGES: Challenge[] = [
  { id: 'p1', mode: 'Pitch', prompt: 'Your object is the perfect weapon against a slow-moving zombie. Pitch it to the group.', pack: 'free' },
  { id: 'p2', mode: 'Pitch', prompt: "Your object is the missing piece to a millionaire's puzzle. Pitch its value.", pack: 'free' },
  { id: 'p3', mode: 'Pitch', prompt: 'Your object is the next big diet trend. Pitch the health benefits.', pack: 'free' },
  { id: 'pf1', mode: 'Perform', prompt: 'Demonstrate how your object operates a spacecraft console.', pack: 'free' },
  { id: 'pf2', mode: 'Perform', prompt: 'Use your object to conduct an orchestra of angry cats.', pack: 'free' },
  { id: 'pf3', mode: 'Perform', prompt: 'Perform a ceremonial dance centered entirely around your object.', pack: 'free' },
  { id: 'r1', mode: 'Rescue', prompt: 'You are sinking in quicksand. Use your object to escape.', pack: 'free' },
  { id: 'r2', mode: 'Rescue', prompt: 'Your parachute failed. How does your object save you?', pack: 'free' },
  { id: 'r3', mode: 'Rescue', prompt: 'You are locked in a freezer. Your object is the key to warmth.', pack: 'free' },
  { id: 'e1', mode: 'Explain', prompt: 'Explain how your object caused the fall of the Roman Empire.', pack: 'free' },
  { id: 'e2', mode: 'Explain', prompt: 'Explain why your object is the true source of gravity.', pack: 'free' },
  { id: 'e3', mode: 'Explain', prompt: 'Explain how your object is secretly monitoring our thoughts.', pack: 'free' },
  { id: 'i1', mode: 'Invent', prompt: "Your object is half of a revolutionary new appliance. What does it do?", pack: 'free' },
  { id: 'i2', mode: 'Invent', prompt: 'Market your object as a luxury skincare device.', pack: 'free' },
  { id: 'i3', mode: 'Invent', prompt: "Pitch your object as a child's toy that was banned in 1993.", pack: 'free' },
  { id: 't1', mode: 'Transform', prompt: 'Your object is now a musical instrument. Play us a song.', pack: 'free' },
  { id: 't2', mode: 'Transform', prompt: 'Your object is a magical artifact. Show us its curse.', pack: 'free' },
  { id: 't3', mode: 'Transform', prompt: 'Your object is an alien egg. Care for it as it hatches.', pack: 'free' },
];

const modes: GameMode[] = ['Pitch', 'Perform', 'Rescue', 'Explain', 'Invent', 'Transform'];
const situations = [
  'a rain-soaked neighborhood parade', 'a library after closing', 'a moon-base talent show',
  'a picnic invaded by determined pigeons', 'a town meeting about mysterious footprints',
  'a ferry with no captain', 'a museum of completely ordinary things', 'a campsite during a sock shortage',
  'a bakery run by nervous detectives', 'a silent disco in a power cut', 'a garden party for time travelers',
  'a school for overly dramatic magicians', 'a tiny island election', "a robot's first birthday",
  'a championship for useless skills', 'a weather station inside a cupboard', 'a wedding between two rival sandwiches',
  'a train that only travels sideways', 'a neighborhood emergency involving too much confetti',
  'a courtroom where the judge is a houseplant', 'an expedition to the back of the sofa',
  'a radio show broadcasting to one confused goat', 'a hotel for imaginary friends',
  'a midnight market that accepts only compliments', 'a submarine with a terrible interior designer',
  'a village preparing for the annual whisper contest', 'a detective agency specializing in missing teaspoons',
  'a spaceport delayed by an extremely polite alien',
] as const;

function prompt(mode: GameMode, scene: string) {
  if (mode === 'Pitch') return `Pitch your object as the one essential purchase for ${scene}.`;
  if (mode === 'Perform') return `Perform a live demonstration of how your object becomes the star of ${scene}.`;
  if (mode === 'Rescue') return `A harmless crisis unfolds at ${scene}. Explain and demonstrate how your object saves the day.`;
  if (mode === 'Explain') return `Give a completely confident expert explanation proving your object secretly caused ${scene}.`;
  if (mode === 'Invent') return `Invent a new device by combining your object's ordinary purpose with the needs of ${scene}.`;
  return `Transform your object into a character from ${scene} and act out its most important moment.`;
}

export const FULL_CHALLENGES: Challenge[] = situations.flatMap((scene, sceneIndex) =>
  modes.map((mode, modeIndex) => ({
    id: `full-${sceneIndex * modes.length + modeIndex + 1}`,
    mode,
    prompt: prompt(mode, scene),
    pack: 'full' as const,
  })),
);

export const ALL_CHALLENGES = [...FREE_CHALLENGES, ...FULL_CHALLENGES];
export const CHALLENGE_BY_ID = new Map(ALL_CHALLENGES.map(challenge => [challenge.id, challenge]));