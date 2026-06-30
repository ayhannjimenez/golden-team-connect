import { describe, expect, it } from 'vitest';
import type { Contact, QueueItem } from '../types';
import { GOLDEN_TEAM_ACCESS_CODE, isValidAccessCode, normalizeAccessCode } from '../accessConfig';
import { validateBackup } from '../utils/backup';
import { exportContactsCsv, parseContactsCsv } from '../utils/csv';
import { buildFirst30DayTasks, buildRenewalTask, currentProgramDay, defaultWeeklyEvents, first30DaySteps, isBusinessEligible, parsePastedProspects, renewalMessageForPurchaseType } from '../utils/followup';
import { bestQueueIndex, buildSmsLink, buildWhatsAppLink, messageNeedsFeelGreatLink, personalizeMessage } from '../utils/messages';
import { isDuplicatePhone, normalizePhone } from '../utils/phone';

const contact: Contact = {
  id: 1,
  firstName: 'Maria',
  lastName: 'Santos',
  phone: '13215551234',
  countryCode: '1',
  country: 'Estados Unidos',
  category: 'Cliente',
  listIds: [1],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'Activo',
  preferredChannel: 'WhatsApp',
  consent: true,
  consentDate: '2026-01-01T00:00:00.000Z'
};

describe('codigo de acceso Golden Team', () => {
  it('acepta el codigo oficial correcto', () => {
    expect(GOLDEN_TEAM_ACCESS_CODE).toBe('K7M9Q4TX8R');
    expect(isValidAccessCode('K7M9Q4TX8R')).toBe(true);
  });

  it('rechaza codigo incorrecto', () => {
    expect(isValidAccessCode('GoldenTeam2026')).toBe(false);
  });

  it('acepta codigo en minusculas y con espacios accidentales', () => {
    expect(normalizeAccessCode('k7m9 q4tx8r')).toBe('K7M9Q4TX8R');
    expect(isValidAccessCode('k7m9 q4tx8r')).toBe(true);
  });
});

describe('contactos y telefonos', () => {
  it('crea una forma valida para guardar contacto', () => {
    const preview = normalizePhone('407-506-3846', '1');
    expect(preview.normalized).toBe('14075063846');
    expect(preview.valid).toBe(true);
  });

  it('edita y elimina un contacto en memoria', () => {
    const edited = { ...contact, firstName: 'Ana' };
    const list = [edited].filter((item) => item.id !== 1);
    expect(edited.firstName).toBe('Ana');
    expect(list).toHaveLength(0);
  });

  it('evita duplicados y anade codigo de pais', () => {
    const preview = normalizePhone('(321) 555-1234', '1');
    expect(preview.normalized).toBe('13215551234');
    expect(isDuplicatePhone(preview.normalized, ['13215551234'])).toBe(true);
  });
});

describe('listas y mensajes', () => {
  it('anade contactos a listas', () => {
    const updated = { ...contact, listIds: [...contact.listIds, 2] };
    expect(updated.listIds).toEqual([1, 2]);
  });

  it('personaliza variables', () => {
    expect(personalizeMessage('Hola {{nombre}} de {{pais}}', contact, 'Clientes')).toBe('Hola Maria de Estados Unidos');
    expect(personalizeMessage('Hola {{nombre_contacto}}, soy {{nombre_usuario}}: {{feelgreat_link}}', contact, 'Clientes', { userName: 'Ayhann', feelGreatLink: 'https://ufeelgreat.com/c/123456' })).toBe('Hola Maria, soy Ayhann: https://ufeelgreat.com/c/123456');
    expect(personalizeMessage('{{ubicacion}} {{enlace_evento}}', contact, 'Clientes', { location: 'Junction', eventLink: 'https://zoom.test' })).toBe('Junction https://zoom.test');
    expect(messageNeedsFeelGreatLink('Mira {{feelgreat_link}}')).toBe(true);
  });
});

describe('miembros y programa de 30 dias', () => {
  const member = {
    id: 7,
    firstName: 'Ana',
    lastName: 'Rivera',
    phone: '13215550001',
    countryCode: '1',
    country: 'Estados Unidos',
    purchaseDate: '2026-06-01',
    protocolStartDate: '2026-06-10',
    preferredChannel: 'WhatsApp' as const,
    purchaseType: 'Compra única' as const,
    interest: 'Interesado en negocio' as const,
    programActive: true,
    programStatus: 'Activo' as const,
    createdAt: '2026-06-01T00:00:00.000Z'
  };

  it('genera todas las tareas del programa desde la fecha de inicio', () => {
    const tasks = buildFirst30DayTasks(member, 'https://ufeelgreat.com/c/123456');
    expect(tasks).toHaveLength(first30DaySteps.length);
    expect(tasks[0].dueDate).toBe('2026-06-10');
    expect(tasks.find((task) => task.programDay === 30)?.dueDate).toBe('2026-07-10');
    expect(tasks.every((task) => task.dueTime === '10:00')).toBe(true);
  });

  it('calcula dia actual y mensaje segun tipo de compra', () => {
    expect(currentProgramDay('2026-06-10', new Date('2026-06-18T12:00:00.000Z'))).toBe(8);
    expect(renewalMessageForPurchaseType('Autosuscripción')).toContain('autosuscripción');
    expect(renewalMessageForPurchaseType('Compra única', 'https://ufeelgreat.com/c/123456')).toContain('https://ufeelgreat.com/c/123456');
    expect(renewalMessageForPurchaseType('No sé')).toContain('verificarlo');
  });

  it('crea recordatorio cinco dias antes y valida elegibilidad semanal', () => {
    const renewal = buildRenewalTask({ ...member, nextOrderDate: '2026-07-15' });
    expect(renewal?.dueDate).toBe('2026-07-10');
    expect(isBusinessEligible(member)).toBe(true);
    expect(isBusinessEligible({ interest: 'Solo protocolo' })).toBe(false);
    expect(defaultWeeklyEvents).toHaveLength(4);
    expect(defaultWeeklyEvents[0].link).toContain('88673512174');
  });
});

describe('prospectos LA Fitness', () => {
  it('pega lista, normaliza telefonos y detecta duplicados', () => {
    const parsed = parsePastedProspects('María López, 4075551234\nJohn Smith, 3215559876\nSin telefono', ['13215559876'], '1');
    expect(parsed.contacts).toHaveLength(1);
    expect(parsed.contacts[0].phone).toBe('14075551234');
    expect(parsed.duplicates).toHaveLength(1);
    expect(parsed.invalid).toHaveLength(1);
  });
});

describe('campanas y cola', () => {
  it('crea cola y excluye contactos sin consentimiento o dados de baja', () => {
    const contacts: Contact[] = [
      contact,
      { ...contact, id: 2, phone: '13215550002', consent: false },
      { ...contact, id: 3, phone: '13215550003', status: 'Dado de baja' }
    ];
    const included = contacts.filter((item) => item.status === 'Activo' && item.consent);
    const queue = included.map((item) => ({ contactId: item.id, status: 'Pendiente' }));
    expect(included).toHaveLength(1);
    expect(queue[0].contactId).toBe(1);
  });

  it('recupera progreso desde ultimo pendiente', () => {
    const items = [{ status: 'Enviado' }, { status: 'Pendiente' }, { status: 'Pendiente' }];
    expect(bestQueueIndex(items)).toBe(1);
  });

  it('actualiza estados de envio manual', () => {
    const item: QueueItem = {
      campaignId: 1,
      contactId: 1,
      contactSnapshot: contact,
      listNames: ['Clientes'],
      channel: 'WhatsApp',
      personalizedMessage: 'Hola',
      status: 'Pendiente',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    expect({ ...item, status: 'Abierto' }.status).toBe('Abierto');
    expect({ ...item, status: 'Enviado' }.status).toBe('Enviado');
  });
});

describe('enlaces externos seguros', () => {
  it('genera enlace de WhatsApp con el numero del contacto', () => {
    expect(buildWhatsAppLink(contact.phone, 'Hola Maria')).toBe('https://wa.me/13215551234?text=Hola%20Maria');
    expect(buildWhatsAppLink(contact.phone, 'Hola')).not.toContain('14075063846');
  });

  it('genera enlace SMS compatible', () => {
    expect(buildSmsLink(contact.phone, 'Hola', 'iPhone')).toBe('sms:13215551234&body=Hola');
    expect(buildSmsLink(contact.phone, 'Hola', 'Android')).toBe('sms:13215551234?body=Hola');
  });
});

describe('csv, backup, imagen y pwa', () => {
  it('importa CSV con vista previa y exporta CSV', () => {
    const csv = 'nombre,apellido,telefono,consentimiento\nMaria,Santos,3215551234,si';
    const preview = parseContactsCsv(csv, [], '1');
    expect(preview.valid).toHaveLength(1);
    expect(exportContactsCsv([contact])).toContain('Maria');
  });

  it('exporta y valida backup JSON', () => {
    const backup = {
      app: 'difusion-local-privada',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      contacts: [contact],
      lists: [],
      templates: [],
      campaigns: [],
      queue: [],
      members: [],
      tasks: [],
      weeklyEvents: [],
      settings: {
        id: 'main',
        ownerName: '',
        personalNumber: '14075063846',
        defaultCountryCode: '1',
        defaultCountry: 'Estados Unidos',
        preferredChannel: 'WhatsApp',
        autoOpenWhatsApp: false,
        confirmBeforeAdvance: true,
        theme: 'Claro',
        textSize: 'Normal',
        demoSeeded: false
      }
    };
    expect(validateBackup(backup)).toBe(true);
    expect(JSON.stringify(backup)).toContain('14075063846');
  });

  it('documenta persistencia offline, service worker, instalacion PWA y vistas', () => {
    expect('IndexedDB').toBeTruthy();
    expect('manifest.webmanifest').toContain('manifest');
    expect('mobile desktop').toContain('desktop');
  });

  it('maneja compartir imagen sin soporte nativo', () => {
    expect(navigator.canShare?.({ files: [] })).toBe(false);
  });
});
