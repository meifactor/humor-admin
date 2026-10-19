// Humor styles users can pick for the AI's captions.
export const VIBES = [
  {
    id: "genz",
    emoji: "🤪",
    label: "Unhinged Gen-Z",
    description: "Chronically online, chaotic, lowercase energy",
    color: "#EE352E",
    instructions:
      "Write like a chronically online Gen-Z student: chaotic, absurd, ironic, internet slang where it fits, lowercase is fine.",
  },
  {
    id: "dad",
    emoji: "👴",
    label: "Dad joke",
    description: "Wholesome puns your dad would be proud of",
    color: "#FCCC0A",
    instructions:
      "Write groan-worthy dad jokes: wholesome puns and wordplay about what's in the photo, the kind a proud dad would say.",
  },
  {
    id: "newyorker",
    emoji: "🗽",
    label: "Jaded New Yorker",
    description: "Seen it all, unimpressed, very NYC",
    color: "#00933C",
    instructions:
      "Write like a jaded lifelong New Yorker who has seen it all: deadpan, unimpressed, full of NYC references (the subway, rent, bodegas, tourists).",
  },
  {
    id: "core",
    emoji: "📚",
    label: "Core Curriculum nerd",
    description: "Lit Hum, CC and Butler Library references",
    color: "#0039A6",
    instructions:
      "Write like a Columbia student deep in the Core Curriculum: reference Lit Hum, Contemporary Civilization, philosophers, classic books and late nights in Butler Library.",
  },
] as const;

export type VibeId = (typeof VIBES)[number]["id"];

export const DEFAULT_VIBE: VibeId = "genz";

export function isVibeId(value: unknown): value is VibeId {
  return VIBES.some((vibe) => vibe.id === value);
}

export function getVibe(id: string) {
  return VIBES.find((vibe) => vibe.id === id) ?? VIBES[0];
}
