import { db, ensureSettings } from './db';
import type { Campaign, Contact, InternalList, MessageTemplate, QueueItem } from './types';
import { personalizeMessage } from './utils/messages';

const now = () => new Date().toISOString();

export async function seedDemoData(): Promise<void> {
  const settings = await ensureSettings();
  const existing = await db.contacts.count();
  if (settings.demoSeeded || existing > 0) return;

  const listIds = await db.lists.bulkAdd(
    [
      { name: 'Golden Team', description: 'Equipo principal', createdAt: now(), demo: true },
      { name: 'Seguimiento semanal', description: 'Personas para seguimiento', createdAt: now(), demo: true },
      { name: 'Orlando', description: 'Contactos de Orlando', createdAt: now(), demo: true }
    ] satisfies InternalList[],
    { allKeys: true }
  );

  const contacts: Contact[] = [
    ['Ana', 'Rivera', '13215550001', 'Miembro', [listIds[0], listIds[2]]],
    ['Luis', 'Torres', '13215550002', 'Cliente', [listIds[1]]],
    ['Maria', 'Santos', '13215550003', 'Distribuidor', [listIds[0]]],
    ['Carlos', 'Vega', '13215550004', 'Lider', [listIds[0], listIds[1]]],
    ['Elena', 'Cruz', '13215550005', 'Prospecto', [listIds[1]]],
    ['Rafael', 'Diaz', '13215550006', 'Cliente', [listIds[2]]],
    ['Sofia', 'Morales', '13215550007', 'Miembro', [listIds[0]]],
    ['Diego', 'Ortiz', '13215550008', 'Otro', [listIds[1], listIds[2]]],
    ['Valeria', 'Reyes', '13215550009', 'Prospecto', [listIds[2]]],
    ['Mateo', 'Nunez', '13215550010', 'Distribuidor', [listIds[0], listIds[1]]]
  ].map(([firstName, lastName, phone, category, ids]) => ({
    firstName: String(firstName),
    lastName: String(lastName),
    phone: String(phone),
    countryCode: '1',
    country: 'Estados Unidos',
    category: category as Contact['category'],
    listIds: ids as number[],
    tags: [],
    notes: 'Dato de demostracion',
    createdAt: now(),
    status: firstName === 'Diego' ? 'Pausado' : 'Activo',
    preferredChannel: firstName === 'Luis' ? 'SMS' : 'WhatsApp',
    consent: firstName !== 'Valeria',
    consentDate: firstName !== 'Valeria' ? now() : undefined,
    demo: true
  }));
  const contactIds = await db.contacts.bulkAdd(contacts, { allKeys: true });

  await db.templates.bulkAdd([
    {
      name: 'Recordatorio de entrenamiento',
      body: 'Hola {{nombre}}, recuerda que hoy tenemos entrenamiento. Me confirmas si puedes asistir.',
      createdAt: now(),
      demo: true
    },
    {
      name: 'Enlace para referidos',
      body: 'Hola {{nombre}}, ya tienes disponible tu enlace personal para referir personas. Si necesitas ayuda, escribeme.',
      createdAt: now(),
      demo: true
    },
    {
      name: 'Seguimiento del viernes',
      body: 'Hola {{nombre}}, paso a darte seguimiento antes del viernes. Como vas con lo que hablamos?',
      createdAt: now(),
      demo: true
    },
    {
      name: 'Reunion del miercoles',
      body: 'Hola {{nombre}}, te recuerdo la reunion del miercoles. Sera importante para {{categoria}}.',
      createdAt: now(),
      demo: true
    },
    {
      name: 'Bienvenida',
      body: 'Bienvenido/a {{nombre}}. Me alegra tenerte en {{lista}}.',
      createdAt: now(),
      demo: true
    }
  ] satisfies MessageTemplate[]);

  const campaignIds = await db.campaigns.bulkAdd(
    [
      {
        name: 'Seguimiento semanal demo',
        message: 'Hola {{nombre}}, este es un seguimiento privado e individual.',
        listIds: [listIds[1]],
        contactIds: [],
        channel: 'WhatsApp',
        notes: 'Campana completada de prueba',
        createdAt: now(),
        demo: true
      },
      {
        name: 'Recordatorio pendiente demo',
        message: 'Hola {{nombre}}, recuerda revisar la informacion de esta semana.',
        listIds: [listIds[0]],
        contactIds: [],
        channel: 'Ambos',
        notes: 'Campana pendiente de prueba',
        createdAt: now(),
        demo: true
      }
    ] satisfies Campaign[],
    { allKeys: true }
  );

  const queue: QueueItem[] = contacts.slice(0, 6).map((contact, index) => ({
    campaignId: Number(campaignIds[index < 2 ? 0 : 1]),
    contactId: Number(contactIds[index]),
    contactSnapshot: { ...contact, id: Number(contactIds[index]) },
    listNames: ['Golden Team'],
    channel: index === 4 ? 'SMS' : 'WhatsApp',
    personalizedMessage: personalizeMessage(index < 2 ? 'Hola {{nombre}}, gracias por confirmar.' : 'Hola {{nombre}}, recuerda revisar la informacion de esta semana.', contact, 'Golden Team'),
    status: index < 2 ? 'Enviado' : 'Pendiente',
    completedAt: index < 2 ? now() : undefined,
    createdAt: now()
  }));
  await db.queue.bulkAdd(queue);
  await db.settings.put({ ...settings, demoSeeded: true });
}

export async function removeDemoData(): Promise<void> {
  await db.transaction('rw', [db.contacts, db.lists, db.templates, db.campaigns, db.queue, db.settings], async () => {
    await Promise.all([
      db.queue.where('campaignId').above(0).and((item) => Boolean(item.contactSnapshot.demo)).delete(),
      db.contacts.where('demo').equals(1).delete(),
      db.lists.where('demo').equals(1).delete(),
      db.templates.where('demo').equals(1).delete(),
      db.campaigns.where('demo').equals(1).delete()
    ]);
    const settings = await ensureSettings();
    await db.settings.put({ ...settings, demoSeeded: false });
  });
}
