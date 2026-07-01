import type { Contact, ContactLanguage, FollowUpTask, Member, MemberPurchaseType, WeeklyEvent } from '../types';
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
    title: 'Bienvenida y comienzo',
    message: 'Hola, {{nombre_contacto}}. Me alegra mucho poder acompañarte durante estos primeros 30 días. Quería confirmar que ya tienes todo listo y saber si pudiste comenzar. Cualquier duda que tengas, estoy aquí para ayudarte.',
    goal: 'Confirmar recepción, establecer fecha de inicio y abrir comunicación.'
  },
  {
    day: 2,
    title: 'Primeras 48 horas',
    message: 'Hola, {{nombre_contacto}}. Quería saber cómo te ha ido durante estas primeras 48 horas. ¿Pudiste comenzar bien o te surgió alguna duda con la forma de utilizarlo?',
    goal: 'Comprobar que comenzó y detectar confusión antes de que abandone.'
  },
  {
    day: 4,
    title: 'Experiencia inicial',
    message: 'Hola, {{nombre_contacto}}. Ya llevas varios días comenzando tu rutina. ¿Qué ha sido lo primero que has notado o qué es lo que más te ha gustado hasta ahora?',
    goal: 'Provocar respuesta, identificar experiencia positiva y aumentar compromiso.'
  },
  {
    day: 7,
    title: 'Primera semana',
    message: 'Hola, {{nombre_contacto}}. Ya completaste tu primera semana. ¿Cómo te has sentido y qué parte de la rutina se te ha hecho más fácil o más difícil mantener?',
    goal: 'Evaluar consistencia e identificar obstáculos.'
  },
  {
    day: 10,
    title: 'Resolver obstáculos',
    message: 'Hola, {{nombre_contacto}}. Quería tocar base contigo para asegurarme de que todo siga claro. ¿Hay algo que se te esté olvidando, algo que no entiendas o alguna parte de la rutina con la que necesites ayuda?',
    goal: 'Evitar pérdida de uso y resolver problemas prácticos.'
  },
  {
    day: 14,
    title: 'Mitad del primer mes',
    message: 'Hola, {{nombre_contacto}}. Ya estás llegando a la mitad de tu primer mes. Comparando con cuando comenzaste, ¿qué cambios has notado en tu energía, rutina o manera de sentirte durante el día?',
    goal: 'Ayudar a reconocer progreso y reforzar continuidad sin prometer resultados médicos.'
  },
  {
    day: 18,
    title: 'Mantener consistencia',
    message: 'Hola, {{nombre_contacto}}. Solo quería recordarte que la consistencia durante estas primeras semanas es muy importante. ¿Has podido mantener la rutina la mayoría de los días?',
    goal: 'Reforzar el hábito y detectar interrupciones.'
  },
  {
    day: 21,
    title: 'Preparar el segundo mes',
    message: 'Hola, {{nombre_contacto}}. Ya estás entrando en la última parte de tu primer mes. Quería revisar cuánto producto te queda y asegurarme de que tengas todo listo para continuar sin interrupciones.',
    goal: 'Identificar tipo de compra y anticipar el segundo mes.'
  },
  {
    day: 25,
    title: 'Próximo pedido',
    message: 'Hola, {{nombre_contacto}}. Tu próximo mes se está acercando. Quería saber si ya tienes todo listo para continuar o si necesitas que te ayude con tu próximo pedido. Aquí tienes mi enlace por si lo necesitas:\n\n{{feelgreat_link}}',
    goal: 'Prevenir interrupciones y resolver dudas de renovación.'
  },
  {
    day: 28,
    title: 'Experiencia del primer mes',
    message: 'Hola, {{nombre_contacto}}. Ya estás por completar tu primer mes. ¿Cuál dirías que ha sido el cambio o beneficio que más valoras desde que comenzaste?',
    goal: 'Recopilar experiencia y fortalecer percepción de valor.'
  },
  {
    day: 30,
    title: 'Completar 30 días',
    message: 'Hola, {{nombre_contacto}}. Hoy completas tus primeros 30 días. Me gustaría saber cómo describirías tu experiencia hasta ahora y confirmar que tengas todo preparado para continuar durante tu segundo mes.',
    goal: 'Cerrar el primer ciclo, confirmar continuidad y preparar el siguiente programa.'
  }
];

export const first30DayStepsEn: FollowUpStep[] = [
  { day: 0, title: 'Welcome and getting started', message: 'Hi {{nombre_contacto}}, I’m excited to support you throughout your first 30 days. I wanted to confirm that you have everything ready and see whether you were able to get started. I’m here to help with any questions.', goal: 'Confirm setup and open communication.' },
  { day: 2, title: 'First 48 hours', message: 'Hi {{nombre_contacto}}, I wanted to check in and see how your first 48 hours have gone. Were you able to get started comfortably, or do you have any questions about how to use everything?', goal: 'Check early progress.' },
  { day: 4, title: 'Initial experience', message: 'Hi {{nombre_contacto}}, you’ve now had a few days to begin your routine. What is the first thing you have noticed, or what have you liked most so far?', goal: 'Invite a response.' },
  { day: 7, title: 'First week', message: 'Hi {{nombre_contacto}}, you’ve completed your first week. How have you been feeling, and which part of the routine has been easiest or most difficult to maintain?', goal: 'Review consistency.' },
  { day: 10, title: 'Remove obstacles', message: 'Hi {{nombre_contacto}}, I wanted to check in and make sure everything is still clear. Is there anything you tend to forget, anything you do not understand, or any part of the routine you need help with?', goal: 'Resolve practical issues.' },
  { day: 14, title: 'Halfway through the first month', message: 'Hi {{nombre_contacto}}, you’re reaching the halfway point of your first month. Compared with when you started, what changes have you noticed in your energy, routine, or how you feel throughout the day?', goal: 'Recognize progress.' },
  { day: 18, title: 'Maintain consistency', message: 'Hi {{nombre_contacto}}, I just wanted to remind you that consistency during these first few weeks is important. Have you been able to follow the routine most days?', goal: 'Reinforce the habit.' },
  { day: 21, title: 'Prepare for month two', message: 'Hi {{nombre_contacto}}, you’re entering the final part of your first month. I wanted to check how much product you have left and make sure you are ready to continue without interruptions.', goal: 'Prepare continuity.' },
  { day: 25, title: 'Next order', message: 'Hi {{nombre_contacto}}, your next month is approaching. I wanted to see whether you already have everything ready to continue or need help with your next order. Here is my link if you need it:\n\n{{feelgreat_link}}', goal: 'Prevent interruption.' },
  { day: 28, title: 'First-month experience', message: 'Hi {{nombre_contacto}}, you’re about to complete your first month. What would you say is the change or benefit you value most since you started?', goal: 'Review first month.' },
  { day: 30, title: 'Complete 30 days', message: 'Hi {{nombre_contacto}}, today you complete your first 30 days. I’d love to hear how you would describe your experience so far and confirm that you have everything ready to continue into your second month.', goal: 'Close the first cycle.' }
];

export function stepsForLanguage(language: ContactLanguage = 'Español'): FollowUpStep[] {
  return language === 'English' ? first30DayStepsEn : first30DaySteps;
}

export const defaultWeeklyEvents: WeeklyEvent[] = [
  {
    name: 'Unicity Monday Meeting',
    weekday: 1,
    eventTime: '19:00',
    reminderTime: '18:30',
    link: 'https://us06web.zoom.us/j/88673512174?pwd=vDsClPnuX1Wi7Xgm8W1u9MuAIbLGPl.1',
    message: 'Hola, {{nombre_contacto}}. Te recuerdo que hoy a las 7:00 p. m. tenemos el Unicity Monday Meeting. Aquí tienes el enlace para conectarte:\n\n{{enlace_evento}}',
    messageEn: 'Hi {{nombre_contacto}}, this is a reminder that today at 7:00 p.m. we have the Unicity Monday Meeting. Here is the link to join:\n\n{{enlace_evento}}',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Capacitación y Liderazgo',
    weekday: 1,
    eventTime: '21:00',
    reminderTime: '20:30',
    link: 'https://us02web.zoom.us/j/84616673775',
    message: 'Hola, {{nombre_contacto}}. Hoy a las 9:00 p. m. tenemos Capacitación y Liderazgo. Aquí tienes el enlace para conectarte:\n\n{{enlace_evento}}',
    messageEn: 'Hi {{nombre_contacto}}, today at 9:00 p.m. we have our Leadership Training. Here is the link to join:\n\n{{enlace_evento}}',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Academia Salud Metabólica',
    weekday: 2,
    eventTime: '21:00',
    reminderTime: '20:30',
    link: 'https://us02web.zoom.us/j/84616673775',
    message: 'Hola, {{nombre_contacto}}. Hoy a las 9:00 p. m. tenemos la Academia de Salud Metabólica. Aquí tienes el enlace para conectarte:\n\n{{enlace_evento}}',
    messageEn: 'Hi {{nombre_contacto}}, today at 9:00 p.m. we have the Metabolic Health Academy. Here is the link to join:\n\n{{enlace_evento}}',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Presentación de Negocio',
    weekday: 6,
    eventTime: '11:30',
    reminderTime: '11:00',
    link: 'https://us06web.zoom.us/j/6421915226',
    message: 'Hola, {{nombre_contacto}}. Hoy a las 11:30 a. m. tenemos nuestra Presentación de Negocio. Aquí tienes el enlace para conectarte:\n\n{{enlace_evento}}',
    messageEn: 'Hi {{nombre_contacto}}, today at 11:30 a.m. we have our Business Presentation. Here is the link to join:\n\n{{enlace_evento}}',
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
  const language = member.language || 'Español';
  return stepsForLanguage(language).map((step) => ({
    memberId: member.id,
    kind: 'Seguimiento',
    program: FIRST_30_DAYS_PROGRAM,
    title: step.title,
    contactName: memberName(member),
    phone: member.phone,
    channel: member.preferredChannel,
    dueDate: dateKeyFrom(member.protocolStartDate!, step.day),
    dueTime: member.followUpTime || DEFAULT_TASK_TIME,
    reminderMinutes: member.reminderMinutes || 30,
    language,
    programDay: step.day,
    message: step.message.replaceAll('{{nombre_contacto}}', member.firstName).replaceAll('{{feelgreat_link}}', feelGreatLink || '{{feelgreat_link}}'),
    status: 'Pendiente',
    createdAt: new Date().toISOString(),
    sourceKey: `member:${member.id}:day:${step.day}`
  }));
}

export function buildRenewalTask(member: Member): FollowUpTask | null {
  if (!member.id || !member.nextOrderDate) return null;
  return {
    memberId: member.id,
    kind: 'Seguimiento',
    program: 'Recordatorio de segundo pedido',
    title: 'Próximo pedido',
    contactName: memberName(member),
    phone: member.phone,
    channel: member.preferredChannel,
    language: member.language || 'Español',
    dueDate: dateKeyFrom(member.nextOrderDate, -5),
    dueTime: member.followUpTime || DEFAULT_TASK_TIME,
    reminderMinutes: member.reminderMinutes || 30,
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
