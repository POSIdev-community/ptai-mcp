export const Effects = {
  NotApplied: 'not_applied',
  Applied: 'applied',
  Partial: 'partial',
  Unknown: 'unknown',
} as const;
export type Effects = (typeof Effects)[keyof typeof Effects];
