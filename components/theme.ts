// Visual identity per merchant. Tailwind needs full class names, so they are spelled out.
export type Tone = { name: string; emoji: string; bar: string; tile: string; text: string; ring: string };

export const TONES: Record<string, Tone> = {
  "alpine-supply": {
    name: "Alpine Supply Co.",
    emoji: "⛷️",
    bar: "bg-glacier",
    tile: "bg-glacier/15",
    text: "text-glacier",
    ring: "ring-glacier/40",
  },
  "night-owl-coffee": {
    name: "Night Owl Coffee Roasters",
    emoji: "☕",
    bar: "bg-amber",
    tile: "bg-amber/15",
    text: "text-amber",
    ring: "ring-amber/40",
  },
  "paperleaf-books": {
    name: "Paperleaf Books",
    emoji: "📚",
    bar: "bg-leaf",
    tile: "bg-leaf/15",
    text: "text-leaf",
    ring: "ring-leaf/40",
  },
};

export const TOPUP_TONE: Tone = {
  name: "Money added",
  emoji: "＋",
  bar: "bg-violet",
  tile: "bg-violet/15",
  text: "text-violet",
  ring: "ring-violet/40",
};

const FALLBACK: Tone = { name: "Merchant", emoji: "🛍️", bar: "bg-muted", tile: "bg-line", text: "text-muted", ring: "ring-line" };

export function toneFor(merchantId: string | null | undefined): Tone {
  return (merchantId && TONES[merchantId]) || FALLBACK;
}

export function toneByName(name: string): Tone {
  return Object.values(TONES).find((t) => t.name === name) || FALLBACK;
}
