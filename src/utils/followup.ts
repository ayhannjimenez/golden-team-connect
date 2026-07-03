import type { AppSettings, Contact, ContactLanguage, ContactType, FollowUpTask, MeetingSnapshot, Member, MemberPurchaseType, MessageTemplate, WeeklyEvent } from '../types';
import { cleanUnresolvedMessage, personalizeMessage } from './messages';
import { normalizePhone } from './phone';

export const FIRST_30_DAYS_PROGRAM = 'Primeros 30 días';
export const DEFAULT_TIMEZONE = 'America/New_York';

export interface FollowUpStep {
  day: number;
  key: string;
  title: string;
  defaultTime: string;
  message: string;
  goal?: string;
}

export const followUpVariables = ['{{firstName}}', '{{feelGreatReferralLink}}', '{{meetingName}}', '{{meetingDateTime}}', '{{meetingLink}}', '{{appStoreLink}}', '{{googlePlayLink}}'];

export const first30DaySteps: FollowUpStep[] = [
  {
    day: 0,
    key: 'followup-day-0',
    title: 'Bienvenida',
    defaultTime: 'now',
    message: '¡Hola, {{firstName}}! Quiero felicitarte por haber tomado la decisión de invertir en tu salud.\n\nHoy comienza una etapa nueva, y durante estos próximos 30 días estaré aquí para ayudarte a entender el protocolo, crear una buena rutina y aprovechar esta oportunidad al máximo.\n\nCuando recibas tu caja, déjame saber. No tienes que hacer este proceso solo.'
  },
  {
    day: 2,
    key: 'followup-day-2',
    title: 'Definir propósito',
    defaultTime: '09:15',
    message: '{{firstName}}, todo proceso cobra más fuerza cuando recordamos por qué comenzamos.\n\n¿Qué es lo principal que te gustaría mejorar durante estos próximos 30 días?\n\nPuede ser tu energía, tus antojos, tu relación con la comida o simplemente comenzar a sentirte mejor.\n\nCuéntame cuál es tu meta principal.'
  },
  {
    day: 4,
    key: 'followup-day-4',
    title: 'Aplicación y enlace personal',
    defaultTime: '11:30',
    message: '¡Espero que estés teniendo un excelente día, {{firstName}}!\n\nDescarga la aplicación Feel Great – Fasting Coach para registrar tu Unimate, Balance, comidas y periodo de ayuno. Te ayudará a convertir tu nueva decisión en un hábito.\n\niPhone:\n{{appStoreLink}}\n\nAndroid:\n{{googlePlayLink}}\n\nTambién tienes tu propio enlace para compartir Feel Great:\n\n{{feelGreatReferralLink}}\n\nCuando alguien compra utilizando tu enlace, puedes recibir $10 en crédito de producto. Así puedes ayudar a otra persona y acumular crédito para tus próximas órdenes.'
  },
  {
    day: 7,
    key: 'followup-day-7',
    title: 'Uso correcto y presentación del sistema',
    defaultTime: '08:45',
    message: '¡Buenos días, {{firstName}}! Quiero asegurarme de que tengas clara tu rutina.\n\nComienza el día con tu primer Unimate y toma el segundo antes de tu primera comida, antes de entrenar o cuando necesites apoyo con tu energía y enfoque.\n\nToma Balance antes o con tu comida más fuerte y bébelo inmediatamente después de mezclarlo.\n\nAdemás, nuestros uplines nos proveen semanalmente un sistema de educación, salud y formación empresarial sin costo. Puedes conectarte según el tiempo te lo permita para aprender, crecer y mantenerte cerca de la comunidad.\n\n¿Ya comenzaste o todavía estás esperando tu caja?'
  },
  {
    day: 10,
    key: 'followup-day-10',
    title: 'Primer check-in',
    defaultTime: '12:15',
    message: '¿Cómo va todo hasta ahora, {{firstName}}?\n\nYa llevas varios días construyendo una rutina nueva. ¿Qué has notado en tu energía, apetito, digestión o antojos?\n\nNo busques solamente cambios enormes. Muchas veces el progreso comienza con pequeñas señales que antes pasábamos por alto.'
  },
  {
    day: 14,
    key: 'followup-day-14',
    title: 'Invitación al sistema',
    defaultTime: '17:45',
    message: '{{firstName}}, los productos son una parte del proceso, pero el conocimiento y la comunidad son los que nos ayudan a mantener dirección.\n\nTu próxima oportunidad para conectarte es:\n\n{{meetingName}}\n{{meetingDateTime}}\n{{meetingLink}}\n\nNo tienes que encender la cámara ni hablar. Puedes escuchar mientras trabajas o haces otras cosas.\n\nLo importante es mantenerte cerca de un ambiente que te ayude a avanzar.'
  },
  {
    day: 18,
    key: 'followup-day-18',
    title: 'Consistencia',
    defaultTime: '10:30',
    message: 'Un recordatorio para ti hoy, {{firstName}}: no necesitas hacerlo todo perfecto para seguir avanzando.\n\nSi un día te sales de la rutina, simplemente vuelve a comenzar con tu próxima decisión.\n\nLa verdadera victoria no es nunca fallar. Es no abandonar.\n\nDel 1 al 10, ¿cómo sientes que va tu consistencia?'
  },
  {
    day: 22,
    key: 'followup-day-22',
    title: 'Comunidad e invitación',
    defaultTime: '18:15',
    message: '¡Ya estás entrando en una etapa importante, {{firstName}}!\n\nUna decisión comienza a convertirse en estilo de vida cuando nos mantenemos conectados, seguimos aprendiendo y nos rodeamos de personas que también quieren avanzar.\n\nEsta semana puedes conectarte en:\n\n{{meetingName}}\n{{meetingDateTime}}\n{{meetingLink}}\n\nEste sistema está diseñado para formar personas, desarrollar líderes y ayudarnos a romper nuestros propios límites.\n\n¿Crees que puedas conectarte?'
  },
  {
    day: 26,
    key: 'followup-day-26',
    title: 'Reconocer la experiencia',
    defaultTime: '13:00',
    message: '{{firstName}}, ya estás cerca de completar tus primeros 30 días.\n\nQuiero hacerte una pregunta importante:\n\n¿Qué ha sido lo que más te ha gustado de tu experiencia hasta ahora?\n\nA veces necesitamos detenernos y reconocer lo bueno para darnos cuenta de cuánto hemos avanzado.'
  },
  {
    day: 30,
    key: 'followup-day-30',
    title: 'Continuidad',
    defaultTime: '10:00',
    message: '¡Felicidades, {{firstName}}! Hoy completas tus primeros 30 días.\n\nDe todo lo que viviste durante este primer mes, ¿qué fue lo que más te gustó?\n\nAhora que ya conoces mejor el protocolo y has comenzado a desarrollar una rutina, el próximo paso es continuar construyendo sobre lo que ya comenzaste.\n\n¿Cuál es el resultado principal que te gustaría alcanzar durante tus próximos 30 días?'
  }
];

export const first30DayStepsEn = first30DaySteps;

export function stepsForLanguage(_language: ContactLanguage = 'Español'): FollowUpStep[] {
  return first30DaySteps;
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function buildLocalDueAt(dateKey: string, time: string): string {
  return `${dateKey}T${time || '00:00'}`;
}

export function localTimeKey(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
}

export function isTaskOpen(task: Pick<FollowUpTask, 'status'>): boolean {
  return task.status !== 'Completada' && task.status !== 'Cancelada';
}

export function defaultFollowUpTemplates(now = new Date()): MessageTemplate[] {
  return first30DaySteps.map((step) => ({
    key: step.key,
    name: step.title,
    internalTitle: step.title,
    day: step.day,
    defaultTime: step.defaultTime,
    body: step.message,
    message: step.message,
    originalMessage: step.message,
    availableVariables: followUpVariables,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    templateVersion: 1
  }));
}

export const defaultWeeklyEvents: WeeklyEvent[] = [
  {
    name: 'Unicity Monday Meeting',
    weekday: 1,
    eventTime: '19:00',
    reminderTime: '19:00',
    link: 'https://us06web.zoom.us/j/88673512174?pwd=vDsClPnuX1Wi7Xgm8W1u9MuAIbLGPl.1',
    audience: 'Miembros y distribuidores',
    message: '',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Capacitación y Liderazgo',
    weekday: 1,
    eventTime: '21:00',
    reminderTime: '21:00',
    link: 'https://us02web.zoom.us/j/84616673775',
    audience: 'Principalmente distribuidores, pero disponible para miembros interesados en aprender sobre el negocio',
    message: '',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Academia de Salud Metabólica',
    weekday: 2,
    eventTime: '21:00',
    reminderTime: '21:00',
    link: 'https://us02web.zoom.us/j/84616673775',
    audience: 'Miembros y distribuidores',
    message: '',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Presentación de Negocio',
    weekday: 6,
    eventTime: '11:30',
    reminderTime: '11:30',
    link: 'https://us06web.zoom.us/j/6421915226',
    audience: 'Distribuidores, prospectos de negocio y miembros interesados',
    message: '',
    active: true,
    updatedAt: new Date().toISOString()
  }
];

export function memberName(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
}

export function currentProgramDay(startDate?: string, now = new Date()): number | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

export function renewalMessageForPurchaseType(purchaseType: MemberPurchaseType, feelGreatLink = ''): string {
  if (purchaseType === 'Autosuscripción' || purchaseType === 'Suscripción') {
    return 'Hola, {{nombre_contacto}}. Tu próximo mes se está acercando. Quería confirmar que toda la información de tu suscripción esté correcta y saber si necesitas ayuda antes de que se procese.';
  }
  if (purchaseType === 'Compra única' || purchaseType === 'Compra individual') {
    return `Hola, {{nombre_contacto}}. Tu próximo mes se está acercando. Quería saber si ya deseas preparar tu próximo pedido para que puedas continuar sin interrupciones. Si necesitas el enlace, aquí lo tienes: ${feelGreatLink || '{{feelgreat_link}}'}`;
  }
  return 'Hola, {{nombre_contacto}}. Tu próximo mes se está acercando. ¿Sabes si tu pedido quedó en suscripción o si necesitas realizar un nuevo pedido? Puedo ayudarte a verificarlo.';
}

export function isBusinessEligible(member: Pick<Member, 'interest'>): boolean {
  return member.interest === 'Interesado en negocio' || member.interest === 'Distribuidor activo';
}

function audienceScore(event: WeeklyEvent, contactType?: ContactType): number {
  const audience = (event.audience || '').toLowerCase();
  if (!event.active) return -1;
  if (contactType === 'Ambos' || !contactType) return audience.includes('miembro') && audience.includes('distribuidor') ? 3 : 1;
  if (contactType === 'Miembro') return audience.includes('miembro') ? 3 : audience.includes('disponible') ? 1 : -1;
  if (contactType === 'Distribuidor') return audience.includes('distribuidor') || audience.includes('negocio') || audience.includes('liderazgo') ? 3 : -1;
  return 1;
}

export function nextOccurrence(event: WeeklyEvent, afterDueAt: string): Date | null {
  if (!event.active) return null;
  const after = new Date(afterDueAt);
  if (Number.isNaN(after.getTime())) return null;
  for (let offset = 0; offset <= 14; offset += 1) {
    const candidate = new Date(after);
    candidate.setDate(after.getDate() + offset);
    if (candidate.getDay() !== event.weekday) continue;
    const [hour, minute] = event.eventTime.split(':').map(Number);
    candidate.setHours(hour || 0, minute || 0, 0, 0);
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  return null;
}

export function findNextMeeting(events: WeeklyEvent[], dueAt: string, contactType?: ContactType): MeetingSnapshot | undefined {
  return events
    .map((event) => ({ event, score: audienceScore(event, contactType), occurrence: nextOccurrence(event, dueAt) }))
    .filter((item): item is { event: WeeklyEvent; score: number; occurrence: Date } => item.score >= 0 && Boolean(item.occurrence))
    .sort((a, b) => b.score - a.score || a.occurrence.getTime() - b.occurrence.getTime())[0]
    ? (() => {
        const best = events
          .map((event) => ({ event, score: audienceScore(event, contactType), occurrence: nextOccurrence(event, dueAt) }))
          .filter((item): item is { event: WeeklyEvent; score: number; occurrence: Date } => item.score >= 0 && Boolean(item.occurrence))
          .sort((a, b) => b.score - a.score || a.occurrence.getTime() - b.occurrence.getTime())[0];
        return {
          id: best.event.id,
          name: best.event.name,
          dateTime: best.occurrence.toLocaleString('es-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          link: best.event.link,
          audience: best.event.audience
        };
      })()
    : undefined;
}

export function resolveFollowUpMessage(template: MessageTemplate | FollowUpStep, member: Member, settings: Partial<AppSettings> = {}, meeting?: MeetingSnapshot): string {
  const body = 'body' in template ? template.message || template.body : template.message;
  const contact: Contact = {
    firstName: member.firstName,
    lastName: member.lastName || '',
    phone: member.phone,
    countryCode: member.countryCode || '1',
    country: member.country || '',
    category: member.contactType === 'Distribuidor' ? 'Distribuidor' : 'Miembro',
    listIds: [],
    tags: [],
    createdAt: member.createdAt,
    status: 'Activo',
    preferredChannel: member.preferredChannel,
    consent: true
  };
  return personalizeMessage(body, contact, '', {
    firstName: member.firstName,
    feelGreatReferralLink: member.feelGreatReferralLink || '',
    appStoreLink: settings.appStoreLink || '',
    googlePlayLink: settings.googlePlayLink || '',
    meetingName: meeting?.name || '',
    meetingDateTime: meeting?.dateTime || '',
    meetingLink: meeting?.link || ''
  });
}

export function buildFirst30DayTasks(member: Member, settingsOrLink: Partial<AppSettings> | string = {}, templates: MessageTemplate[] = defaultFollowUpTemplates(), events: WeeklyEvent[] = defaultWeeklyEvents, now = new Date()): FollowUpTask[] {
  if (!member.id || !member.protocolStartDate) return [];
  const settings = typeof settingsOrLink === 'string' ? { feelGreatLink: settingsOrLink } : settingsOrLink;
  return first30DaySteps.map((step) => {
    const template = templates.find((item) => item.key === step.key) || defaultFollowUpTemplates().find((item) => item.key === step.key)!;
    const dueDate = step.day === 0 ? localDateKey(now) : addCalendarDays(member.protocolStartDate!, step.day);
    const dueTime = step.day === 0 ? localTimeKey(now) : template.defaultTime || step.defaultTime;
    const dueAt = buildLocalDueAt(dueDate, dueTime);
    const meetingSnapshot = step.day === 14 || step.day === 22 ? findNextMeeting(events, dueAt, member.contactType) : undefined;
    const resolvedMessage = cleanUnresolvedMessage(resolveFollowUpMessage(template, member, settings, meetingSnapshot));
    return {
      memberId: member.id,
      kind: 'Seguimiento',
      program: FIRST_30_DAYS_PROGRAM,
      title: template.internalTitle || template.name || step.title,
      contactName: memberName(member),
      phone: member.phone,
      channel: member.preferredChannel,
      language: member.language || 'Español',
      dueDate,
      dueTime,
      dueAt,
      reminderMinutes: 30,
      programDay: step.day,
      sequenceDay: step.day,
      templateKey: step.key,
      templateVersion: template.templateVersion || 1,
      message: resolvedMessage,
      resolvedMessage,
      status: 'Pendiente',
      createdAt: now.toISOString(),
      sourceKey: `member:${member.id}:first30:${step.day}`,
      meetingId: meetingSnapshot?.id,
      meetingSnapshot,
      meetingLink: meetingSnapshot?.link
    };
  });
}

export function buildRenewalTask(member: Member): FollowUpTask | null {
  if (!member.id || !member.nextOrderDate) return null;
  const dueDate = addCalendarDays(member.nextOrderDate, -5);
  return {
    memberId: member.id,
    kind: 'Seguimiento',
    program: 'Recordatorio de segundo pedido',
    title: 'Próximo pedido',
    contactName: memberName(member),
    phone: member.phone,
    channel: member.preferredChannel,
    language: member.language || 'Español',
    dueDate,
    dueTime: '10:00',
    dueAt: buildLocalDueAt(dueDate, '10:00'),
    reminderMinutes: 30,
    message: 'Hola, {{nombre_contacto}}. Tu próximo pedido se acerca en unos días. Quería asegurarme de que todo esté correcto y saber si necesitas ayuda con algún cambio antes de que se procese.'.replaceAll('{{nombre_contacto}}', member.firstName),
    status: 'Pendiente',
    createdAt: new Date().toISOString(),
    sourceKey: `member:${member.id}:renewal:${member.nextOrderDate}`
  };
}

export function parsePastedProspects(text: string, existingPhones: string[] = [], defaultCountryCode = '1'): { contacts: Contact[]; invalid: string[]; duplicates: string[] } {
  const existing = new Set(existingPhones);
  const contacts: Contact[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];

  text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const phoneMatch = line.match(/(\+?\d[\d\s().-]{7,}\d)/);
    const name = line.replace(phoneMatch?.[0] || '', '').replace(/[,\-|]+/g, ' ').trim();
    const phonePreview = normalizePhone(phoneMatch?.[0] || '', defaultCountryCode);
    if (!name || !phonePreview.valid) {
      invalid.push(line);
      return;
    }
    if (existing.has(phonePreview.normalized) || contacts.some((contact) => contact.phone === phonePreview.normalized)) {
      duplicates.push(line);
      return;
    }
    contacts.push({
      firstName: name.split(/\s+/)[0] || name,
      lastName: name.split(/\s+/).slice(1).join(' '),
      phone: phonePreview.normalized,
      countryCode: defaultCountryCode,
      country: 'Estados Unidos',
      category: 'Prospecto',
      listIds: [],
      tags: ['LA Fitness', 'Primer mensaje pendiente'],
      createdAt: new Date().toISOString(),
      status: 'Activo',
      preferredChannel: 'WhatsApp',
      consent: true,
      consentDate: new Date().toISOString()
    });
  });

  return { contacts, invalid, duplicates };
}
