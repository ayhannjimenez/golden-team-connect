import type { Contact, FollowUpTask, Member, MemberPurchaseType, WeeklyEvent } from '../types';
import { normalizePhone } from './phone';

export const DEFAULT_TASK_TIME = '10:00';
export const FIRST_30_DAYS_PROGRAM = 'Primeros 30 días';

export interface FollowUpStep {
  day: number;
  title: string;
  message: string;
  goal: string;
}

export const first30DaySteps: FollowUpStep[] = [
  {
    day: 0,
    title: 'Bienvenida y confirmación',
    message: 'Hola, {{nombre_contacto}}. Me alegra mucho poder acompañarte durante este proceso. Quería confirmar que ya recibiste todo y saber cuándo tienes pensado comenzar. Cualquier duda que tengas, estoy aquí para ayudarte.',
    goal: 'Confirmar recepción, establecer fecha de inicio y abrir comunicación.'
  },
  {
    day: 2,
    title: 'Revisar primeras 48 horas',
    message: 'Hola, {{nombre_contacto}}. Quería saber cómo te ha ido durante estas primeras 48 horas. ¿Pudiste comenzar bien o te ha surgido alguna duda con la forma de utilizarlo?',
    goal: 'Comprobar que comenzó y detectar confusión antes de que abandone.'
  },
  {
    day: 4,
    title: 'Conocer experiencia inicial',
    message: 'Hola, {{nombre_contacto}}. Ya llevas varios días comenzando tu rutina. ¿Qué ha sido lo primero que has notado o qué ha sido lo que más te ha gustado hasta ahora?',
    goal: 'Provocar respuesta, identificar experiencia positiva y aumentar compromiso.'
  },
  {
    day: 7,
    title: 'Revisión de primera semana',
    message: 'Hola, {{nombre_contacto}}. Ya completaste tu primera semana. ¿Cómo te has sentido y qué parte de la rutina se te ha hecho más fácil o más difícil mantener?',
    goal: 'Evaluar consistencia e identificar obstáculos.'
  },
  {
    day: 10,
    title: 'Eliminar obstáculos',
    message: 'Hola, {{nombre_contacto}}. Quería tocar base contigo para asegurarme de que todo siga claro. ¿Hay algo que se te esté olvidando, algo que no entiendas o alguna parte de la rutina con la que necesites ayuda?',
    goal: 'Evitar pérdida de uso y resolver problemas prácticos.'
  },
  {
    day: 14,
    title: 'Revisión de mitad de mes',
    message: 'Hola, {{nombre_contacto}}. Ya estás llegando a la mitad de tu primer mes. Comparando con cuando comenzaste, ¿qué cambios has notado en tu energía, rutina o manera de sentirte durante el día?',
    goal: 'Ayudar a reconocer progreso y reforzar continuidad sin prometer resultados médicos.'
  },
  {
    day: 18,
    title: 'Mantener el hábito',
    message: 'Hola, {{nombre_contacto}}. Solo quería recordarte que la consistencia durante estas primeras semanas es muy importante. ¿Has podido mantener la rutina la mayoría de los días?',
    goal: 'Reforzar el hábito y detectar interrupciones.'
  },
  {
    day: 21,
    title: 'Preparar continuidad',
    message: 'Hola, {{nombre_contacto}}. Ya estás entrando en la última parte de tu primer mes. Quería revisar cuánto producto te queda y asegurarme de que tengas todo listo para continuar sin interrupciones. ¿Estás en autosuscripción o realizaste una compra única?',
    goal: 'Identificar tipo de compra y anticipar el segundo mes.'
  },
  {
    day: 25,
    title: 'Confirmar próximo mes',
    message: '',
    goal: 'Prevenir interrupciones y resolver dudas de renovación.'
  },
  {
    day: 28,
    title: 'Revisar experiencia completa',
    message: 'Hola, {{nombre_contacto}}. Ya estás por completar tu primer mes. ¿Cuál dirías que ha sido el cambio o beneficio que más valoras desde que comenzaste?',
    goal: 'Recopilar experiencia y fortalecer percepción de valor.'
  },
  {
    day: 30,
    title: 'Completar primeros 30 días',
    message: 'Hola, {{nombre_contacto}}. Hoy completas tus primeros 30 días. Me gustaría saber cómo describirías tu experiencia hasta ahora y confirmar que tengas todo preparado para continuar durante tu segundo mes.',
    goal: 'Cerrar el primer ciclo, confirmar continuidad y preparar el siguiente programa.'
  }
];

export const defaultWeeklyEvents: WeeklyEvent[] = [
  {
    name: 'Unicity Monday Meeting',
    weekday: 1,
    eventTime: '19:00',
    reminderTime: '18:00',
    link: 'https://us06web.zoom.us/j/88673512174?pwd=vDsClPnuX1Wi7Xgm8W1u9MuAIbLGPl.1',
    message: 'Hola, {{nombre_contacto}}. Te recuerdo que hoy a las 7:00 p. m. tenemos el Unicity Monday Meeting. Es una excelente oportunidad para conectarte, aprender y comenzar la semana enfocado. Aquí tienes el enlace:\n\n{{enlace_evento}}',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Capacitación y Liderazgo',
    weekday: 1,
    eventTime: '21:00',
    reminderTime: '20:00',
    link: 'https://us02web.zoom.us/j/84616673775',
    message: 'Hola, {{nombre_contacto}}. Hoy a las 9:00 p. m. tenemos nuestra Capacitación y Liderazgo. Si tu tiempo te lo permite, conéctate para continuar desarrollándote personal y empresarialmente:\n\n{{enlace_evento}}',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Academia Salud Metabólica',
    weekday: 2,
    eventTime: '21:00',
    reminderTime: '20:00',
    link: 'https://us02web.zoom.us/j/84616673775',
    message: 'Hola, {{nombre_contacto}}. Hoy a las 9:00 p. m. tenemos la Academia de Salud Metabólica. Esta capacitación te ayudará a comprender mejor el sistema y compartir la información con más seguridad:\n\n{{enlace_evento}}',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Presentación de Negocio',
    weekday: 6,
    eventTime: '11:30',
    reminderTime: '10:30',
    link: 'https://us06web.zoom.us/j/6421915226',
    message: 'Hola, {{nombre_contacto}}. Hoy a las 11:30 a. m. tenemos la Presentación de Negocio. Puedes conectarte para conocer mejor la oportunidad y compartir el enlace con alguien que quiera evaluar el proyecto:\n\n{{enlace_evento}}',
    active: true,
    updatedAt: new Date().toISOString()
  }
];

function dateKeyFrom(baseDate: string, daysToAdd: number): string {
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

export function memberName(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
}

export function currentProgramDay(startDate?: string, now = new Date()): number | null {
  if (!startDate) return null;
  const [year, month, day] = startDate.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((today - start) / 86_400_000));
}

export function renewalMessageForPurchaseType(purchaseType: MemberPurchaseType, feelGreatLink = ''): string {
  if (purchaseType === 'Autosuscripción') {
    return 'Hola, {{nombre_contacto}}. Tu próximo mes se está acercando. Quería confirmar que toda la información de tu autosuscripción esté correcta y saber si necesitas ayuda antes de que se procese.';
  }
  if (purchaseType === 'Compra única') {
    return `Hola, {{nombre_contacto}}. Tu próximo mes se está acercando. Quería saber si ya deseas preparar tu próximo pedido para que puedas continuar sin interrupciones. Si necesitas el enlace, aquí lo tienes: ${feelGreatLink || '{{feelgreat_link}}'}`;
  }
  return 'Hola, {{nombre_contacto}}. Tu próximo mes se está acercando. ¿Sabes si tu pedido quedó en autosuscripción o si necesitas realizar un nuevo pedido? Puedo ayudarte a verificarlo.';
}

export function buildFirst30DayTasks(member: Member, feelGreatLink = ''): FollowUpTask[] {
  if (!member.id || !member.protocolStartDate) return [];
  return first30DaySteps.map((step) => ({
    memberId: member.id,
    kind: 'Miembro',
    program: FIRST_30_DAYS_PROGRAM,
    title: step.title,
    contactName: memberName(member),
    phone: member.phone,
    channel: member.preferredChannel,
    dueDate: dateKeyFrom(member.protocolStartDate!, step.day),
    dueTime: DEFAULT_TASK_TIME,
    programDay: step.day,
    message: (step.day === 25 ? renewalMessageForPurchaseType(member.purchaseType, feelGreatLink) : step.message).replaceAll('{{nombre_contacto}}', member.firstName),
    status: 'Pendiente',
    createdAt: new Date().toISOString(),
    sourceKey: `member:${member.id}:day:${step.day}`
  }));
}

export function buildRenewalTask(member: Member): FollowUpTask | null {
  if (!member.id || !member.nextOrderDate) return null;
  return {
    memberId: member.id,
    kind: 'Renovación',
    program: 'Recordatorio de segundo pedido',
    title: 'Próximo pedido',
    contactName: memberName(member),
    phone: member.phone,
    channel: member.preferredChannel,
    dueDate: dateKeyFrom(member.nextOrderDate, -5),
    dueTime: DEFAULT_TASK_TIME,
    message: 'Hola, {{nombre_contacto}}. Tu próximo pedido se acerca en unos días. Quería asegurarme de que todo esté correcto y saber si necesitas ayuda con algún cambio antes de que se procese.'.replaceAll('{{nombre_contacto}}', member.firstName),
    status: 'Pendiente',
    createdAt: new Date().toISOString(),
    sourceKey: `member:${member.id}:renewal:${member.nextOrderDate}`
  };
}

export function isBusinessEligible(member: Pick<Member, 'interest'>): boolean {
  return member.interest === 'Interesado en negocio' || member.interest === 'Distribuidor activo';
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
