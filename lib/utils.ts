import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

const CHIP_LABELS: Record<string, string> = {
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
};

export function formatChipName(chipName?: string | null): string {
  if (!chipName) {
    return 'Unknown';
  }

  return CHIP_LABELS[chipName] ?? chipName;
}
