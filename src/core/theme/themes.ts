/**
 * Every theme HLITH ships. A theme is a full set of colour tokens (tokens.css for
 * Glacier, tokens-light.css and tokens-themes.css for the rest) plus its own
 * background art (ThemeArt.tsx). No React and no imports here, so prefs.ts can use
 * the ids without pulling in anything else.
 */

export const THEME_IDS = [
  'dark',
  'light',
  'candlelight',
  'crimson',
  'bifrost',
  'ascendant',
  'noctune-bloom',
  'ethereal-dune',
  'astral-lagoon',
  'crimson-haze',
  'jade-whisper',
  'velvet-twilight',
  'amber-mirage',
  'midnight-sakura',
] as const;
export type Theme = (typeof THEME_IDS)[number];

export interface ThemeInfo {
  id: Theme;
  /** What the picker and the Account page call it. */
  name: string;
  /** One line about the mood, in plain words. */
  mood: string;
  /** Dark or light surfaces. Light themes darken game colours used as text. */
  tone: 'dark' | 'light';
  /** The page colour, for the browser's address bar (meta theme-color). Same as --bg-app. */
  app: string;
}

export const THEMES: readonly ThemeInfo[] = [
  { id: 'dark', name: 'Glacier', mood: 'Ice over dark stone, with the high seat’s rings and ravens.', tone: 'dark', app: '#08090b' },
  { id: 'candlelight', name: 'Candlelight', mood: 'Warm candle glow over near-black: leather, rust and peach.', tone: 'dark', app: '#110706' },
  { id: 'crimson', name: 'Crimson Rose', mood: 'Dark roses and thorns, worn leather and warm greys.', tone: 'dark', app: '#130f0d' },
  { id: 'bifrost', name: 'Bifröst', mood: 'A bridge of stars over deep night, with northern lights.', tone: 'dark', app: '#060a16' },
  { id: 'noctune-bloom', name: 'Noctune Bloom', mood: 'Mystical, deep, feminine: plum night, mauve petals, flowers opening under the moon.', tone: 'dark', app: '#110a19' },
  { id: 'astral-lagoon', name: 'Astral Lagoon', mood: 'Calm, oceanic, dreamy: still sea-teal water, ripples and a reflected moon.', tone: 'dark', app: '#061a22' },
  { id: 'crimson-haze', name: 'Crimson Haze', mood: 'Bold, rare, intense: deep wine, red smoke and an eclipse.', tone: 'dark', app: '#18050d' },
  { id: 'jade-whisper', name: 'Jade Whisper', mood: 'Fresh, calm, refined: dark jade, bamboo and a carved jade disc in the mist.', tone: 'dark', app: '#0f1c18' },
  { id: 'velvet-twilight', name: 'Velvet Twilight', mood: 'Luxurious, moody, royal: violet velvet drapes, a crescent moon and a crown.', tone: 'dark', app: '#110c22' },
  { id: 'midnight-sakura', name: 'Midnight Sakura', mood: 'Mysterious, soft, enchanting: cherry blossoms falling in a blue-black night.', tone: 'dark', app: '#0b0e1a' },
  { id: 'ascendant', name: 'Ascendant', mood: 'Marble statues and wings in morning light, edged with gold.', tone: 'light', app: '#efebe3' },
  { id: 'ethereal-dune', name: 'Ethereal Dune', mood: 'Soft, earthy, elegant: pale sand, wind-drawn dunes and a low sun.', tone: 'light', app: '#f4efe6' },
  { id: 'amber-mirage', name: 'Amber Mirage', mood: 'Warm, exotic, timeless: honey light, a shimmering sun and star-tiled arches.', tone: 'light', app: '#fbf0de' },
  { id: 'light', name: 'Light', mood: 'Plain and bright: cool paper and dark ink, with faint ice rings.', tone: 'light', app: '#f3f6f8' },
];

export const isTheme = (v: unknown): v is Theme => typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);

/** The theme's details; anything unknown (an old or newer saved value) is Glacier. */
export const themeInfo = (id: unknown): ThemeInfo => THEMES.find((t) => t.id === id) ?? (THEMES[0] as ThemeInfo);
