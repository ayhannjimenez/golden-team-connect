export interface PhonePreview {
  raw: string;
  normalized: string;
  countryCode: string;
  valid: boolean;
  message: string;
}

export function onlyDigits(value: string): string {
  return value.replace(/[\s\-()+.]/g, '').replace(/\D/g, '');
}

export function normalizePhone(raw: string, defaultCountryCode = '1'): PhonePreview {
  const trimmed = raw.trim();
  const digits = onlyDigits(raw);
  const country = onlyDigits(defaultCountryCode || '1') || '1';

  if (!digits) {
    return { raw, normalized: '', countryCode: country, valid: false, message: 'Incluye el código del país y revisa el número.' };
  }

  const knownCodes = ['1', '52', '57', '506'];
  const deriveCode = (value: string) => knownCodes.find((code) => value.startsWith(code) && value.length > (code === '1' ? 10 : code.length + 7));
  let normalized = digits;
  let countryCode = country;

  if (trimmed.startsWith('+')) {
    countryCode = deriveCode(digits) || country;
    normalized = digits;
  } else if (digits.length === 10 && country === '1') {
    normalized = `1${digits}`;
    countryCode = '1';
  } else {
    const detected = deriveCode(digits);
    if (detected && !(digits.length === 10 && country === '1')) {
      countryCode = detected;
      normalized = digits;
    } else if (!digits.startsWith(country)) {
      normalized = `${country}${digits}`;
      countryCode = country;
    }
  }

  const valid = normalized.length >= 8 && normalized.length <= 15;
  return {
    raw,
    normalized,
    countryCode,
    valid,
    message: valid ? `Se guardará como ${normalized}` : 'Incluye el código del país y revisa el número.'
  };
}

export function isDuplicatePhone(phone: string, existingPhones: string[], currentPhone?: string): boolean {
  return existingPhones.some((candidate) => candidate === phone && candidate !== currentPhone);
}
