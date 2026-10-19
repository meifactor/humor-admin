// Caption reactions. `chartColor` is a dark-surface step of each subway hue, validated for
// colorblind separation in this order (dead, huh, funny, cringe); keep charts in this order.
export const REACTIONS = [
  { id: "dead", emoji: "💀", label: "I'm dead", points: 2, chartColor: "#e66767" },
  { id: "huh", emoji: "🤨", label: "Doesn't make sense", points: -1, chartColor: "#3987e5" },
  { id: "funny", emoji: "😂", label: "Funny", points: 1, chartColor: "#c98500" },
  { id: "cringe", emoji: "😬", label: "Cringe", points: 0, chartColor: "#199e70" },
] as const;

export type ReactionId = (typeof REACTIONS)[number]["id"];

export function isReactionId(value: unknown): value is ReactionId {
  return REACTIONS.some((reaction) => reaction.id === value);
}

export function getReaction(id: string) {
  return REACTIONS.find((reaction) => reaction.id === id) ?? REACTIONS[0];
}
