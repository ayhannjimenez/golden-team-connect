import type { Contact } from '../types';

export interface MessageContext {
  userName?: string;
  feelGreatLink?: string;
  firstName?: string;
  feelGreatReferralLink?: string;
  location?: string;
  eventLink?: string;
  meetingName?: string;
  meetingDateTime?: string;
  meetingLink?: string;
  appStoreLink?: string;
  googlePlayLink?: string;
}

export function personalizeMessage(template: string, contact: Contact, listName = '', context: MessageContext = {}): string {
  return cleanUnresolvedMessage(template
    .replaceAll('{{nombre}}', contact.firstName)
    .replaceAll('{{apellido}}', contact.lastName)
    .replaceAll('{{pais}}', contact.country)
    .replaceAll('{{categoria}}', contact.category)
    .replaceAll('{{lista}}', listName)
    .replaceAll('{{nombre_usuario}}', context.userName || '')
    .replaceAll('{{feelgreat_link}}', context.feelGreatLink || '')
    .replaceAll('{{firstName}}', context.firstName || contact.firstName)
    .replaceAll('{{feelGreatReferralLink}}', context.feelGreatReferralLink || '')
    .replaceAll('{{ubicacion}}', context.location || '')
    .replaceAll('{{enlace_evento}}', context.eventLink || '')
    .replaceAll('{{meetingName}}', context.meetingName || '')
    .replaceAll('{{meetingDateTime}}', context.meetingDateTime || '')
    .replaceAll('{{meetingLink}}', context.meetingLink || '')
    .replaceAll('{{appStoreLink}}', context.appStoreLink || '')
    .replaceAll('{{googlePlayLink}}', context.googlePlayLink || '')
    .replaceAll('{{nombre_contacto}}', contact.firstName)
    .replaceAll('{{apellido_contacto}}', contact.lastName)
    .replaceAll('{{pais_contacto}}', contact.country));
}

export function cleanUnresolvedMessage(message: string): string {
  const lines = message.split('\n');
  const result: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/\{\{[^}]+}}/.test(line)) {
      const previous = result[result.length - 1]?.trim().toLowerCase();
      if (previous === 'iphone:' || previous === 'android:') result.pop();
      continue;
    }
    if (!line.trim()) {
      const previous = result[result.length - 1]?.trim().toLowerCase();
      if (previous === 'iphone:' || previous === 'android:') {
        result.pop();
        continue;
      }
    }
    result.push(line);
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function messageNeedsFeelGreatLink(message: string): boolean {
  return message.includes('{{feelgreat_link}}');
}

export function smsSegments(message: string): number {
  if (!message) return 0;
  return Math.ceil(message.length / 160);
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const safePhone = phone.replace(/\D/g, '');
  return `https://wa.me/${safePhone}?text=${encodeURIComponent(message)}`;
}

export function buildSmsLink(phone: string, message: string, platform = navigator.userAgent): string {
  const safePhone = phone.replace(/[^\d]/g, '');
  const separator = /iPhone|iPad|Macintosh/i.test(platform) ? '&' : '?';
  return `sms:${safePhone}${separator}body=${encodeURIComponent(message)}`;
}

export function bestQueueIndex<T extends { status: string }>(items: T[]): number {
  const pending = items.findIndex((item) => item.status === 'Pendiente');
  return pending >= 0 ? pending : 0;
}
