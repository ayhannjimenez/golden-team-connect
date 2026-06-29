export interface PhonePreview {
  raw: string;
  normalized: string;
  valid: boolean;
  message: string;
}

export function onlyDigits(value: string): string {
  return value.replace(/[\s\-()+.]/g, '').replace(/\D/g, '');
}

export function normalizePhone(raw: string, defaultCountryCode = '1'): PhonePreview {
  const digits = onlyDigits(raw);
  const country = onlyDigits(defaultCountryCode || '1') || '1';

  if (!digits) {
    return { raw, normalized: '', valid: false, message: 'El numero no puede estar vacio.' };
  }

  let normalized = digits;
  if (country === '1' && digits.length === 10) normalized = `1${digits}`;
  if (country !== '1' && !digits.startsWith(country)) normalized = `${country}${digits}`;

  const valid = normalized.length >= 8 && normalized.length <= 15;
  return {
    raw,
    normalized,
    valid,
    message: valid ? `Se guardara como ${normalized}` : 'El numero debe tener entre 8 y 15 digitos.'
  };
}

export function isDuplicatePhone(phone: string, existingPhones: string[], currentPhone?: string): boolean {
  return existingPhones.some((candidate) => candidate === phone && candidate !== currentPhone);
}
