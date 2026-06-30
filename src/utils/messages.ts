import type { Contact } from '../types';

export interface MessageContext {
  userName?: string;
  feelGreatLink?: string;
  location?: string;
  eventLink?: string;
}

export function personalizeMessage(template: string, contact: Contact, listName = '', context: MessageContext = {}): string {
  return template
    .replaceAll('{{nombre}}', contact.firstName)
    .replaceAll('{{apellido}}', contact.lastName)
    .replaceAll('{{pais}}', contact.country)
    .replaceAll('{{categoria}}', contact.category)
    .replaceAll('{{lista}}', listName)
    .replaceAll('{{nombre_usuario}}', context.userName || '')
    .replaceAll('{{feelgreat_link}}', context.feelGreatLink || '')
    .replaceAll('{{ubicacion}}', context.location || '')
    .replaceAll('{{enlace_evento}}', context.eventLink || '')
    .replaceAll('{{nombre_contacto}}', contact.firstName)
    .replaceAll('{{apellido_contacto}}', contact.lastName)
    .replaceAll('{{pais_contacto}}', contact.country);
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
