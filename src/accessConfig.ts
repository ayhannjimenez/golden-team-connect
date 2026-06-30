export const GOLDEN_TEAM_ACCESS_CODE = 'K7M9Q4TX8R';

export function normalizeAccessCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function isValidAccessCode(value: string): boolean {
  return normalizeAccessCode(value) === GOLDEN_TEAM_ACCESS_CODE;
}
