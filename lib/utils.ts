import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'label', 'caption'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PositionCode = 'GKP' | 'DEF' | 'MID' | 'FWD' | 'UNK';

export function normalizePosition(position?: string | null): PositionCode {
  const normalized = position?.trim().toUpperCase();

  switch (normalized) {
    case 'GKP':
    case 'GOALKEEPER':
      return 'GKP';
    case 'DEF':
    case 'DEFENDER':
      return 'DEF';
    case 'MID':
    case 'MIDFIELDER':
      return 'MID';
    case 'FWD':
    case 'FORWARD':
      return 'FWD';
    default:
      return 'UNK';
  }
}

export function formatCompactNumber(number: number): string {
  const formatter = Intl.NumberFormat('en', { notation: 'compact' });
  return formatter.format(number);
}

export function formatInteger(number: number): string {
  return new Intl.NumberFormat('en-US').format(number);
}

const CHIP_CODES: Record<string, string> = {
  bboost: 'BB',
  bb: 'BB',
  benchboost: 'BB',
  bench_boost: 'BB',
  '3xc': 'TC',
  tc: 'TC',
  triplecaptain: 'TC',
  triple_captain: 'TC',
  wildcard: 'WC',
  wc: 'WC',
  freehit: 'FH',
  fh: 'FH',
  free_hit: 'FH',
};

/** Normalize API enums and aliases to the stable FPL chip codes used in UI/share text. */
export function formatChipName(chipName?: string | null): string {
  if (!chipName) {
    return 'Unknown';
  }

  const raw = chipName.trim().toLowerCase()
  const compact = raw.replace(/[\s-]+/g, '_')
  const nosep = raw.replace(/[\s_-]+/g, '')
  return (
    CHIP_CODES[raw] ??
    CHIP_CODES[compact] ??
    CHIP_CODES[nosep] ??
    chipName
  )
}
