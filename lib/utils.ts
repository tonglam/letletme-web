import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCompactNumber(number: number): string {
  const formatter = Intl.NumberFormat("en", { notation: "compact" });
  return formatter.format(number);
}
