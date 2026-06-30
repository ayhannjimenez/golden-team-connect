import Dexie, { type Table } from 'dexie';
import type { AppSettings, Campaign, Contact, FollowUpTask, InternalList, Member, MessageTemplate, QueueItem, WeeklyEvent } from './types';

export class LocalDatabase extends Dexie {
  contacts!: Table<Contact, number>;
  lists!: Table<InternalList, number>;
  templates!: Table<MessageTemplate, number>;
  campaigns!: Table<Campaign, number>;
  queue!: Table<QueueItem, number>;
  members!: Table<Member, number>;
  tasks!: Table<FollowUpTask, number>;
  weeklyEvents!: Table<WeeklyEvent, number>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('difusion-local-privada');
    this.version(1).stores({
      contacts: '++id, &phone, firstName, lastName, status, category, preferredChannel, *listIds, demo',
      lists: '++id, name, demo',
      templates: '++id, name, demo',
      campaigns: '++id, name, createdAt, demo',
      queue: '++id, campaignId, contactId, status',
      settings: 'id'
    });
    this.version(2).stores({
      contacts: '++id, &phone, firstName, lastName, status, category, preferredChannel, *listIds, demo',
      lists: '++id, name, demo',
      templates: '++id, name, demo',
      campaigns: '++id, name, createdAt, demo',
      queue: '++id, campaignId, contactId, status',
      members: '++id, &phone, firstName, lastName, programStatus, interest, protocolStartDate, nextOrderDate',
      tasks: '++id, memberId, contactId, queueItemId, kind, status, dueDate, sourceKey',
      weeklyEvents: '++id, name, weekday, active',
      settings: 'id'
    });
  }
}

export const db = new LocalDatabase();

export const defaultSettings: AppSettings = {
  id: 'main',
  ownerName: '',
  feelGreatLink: '',
  sessionActive: false,
  visualTheme: 'golden',
  personalNumber: '14075063846',
  defaultCountryCode: '1',
  defaultCountry: 'Estados Unidos',
  preferredChannel: 'WhatsApp',
  autoOpenWhatsApp: false,
  confirmBeforeAdvance: true,
  theme: 'Claro',
  textSize: 'Normal',
  demoSeeded: false
};

export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('main');
  if (existing) {
    const merged = { ...defaultSettings, ...existing };
    if (JSON.stringify(merged) !== JSON.stringify(existing)) await db.settings.put(merged);
    return merged;
  }
  await db.settings.put(defaultSettings);
  return defaultSettings;
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.contacts, db.lists, db.templates, db.campaigns, db.queue, db.members, db.tasks, db.weeklyEvents, db.settings], async () => {
    await Promise.all([db.contacts.clear(), db.lists.clear(), db.templates.clear(), db.campaigns.clear(), db.queue.clear(), db.members.clear(), db.tasks.clear(), db.weeklyEvents.clear()]);
    await db.settings.put({ ...defaultSettings, demoSeeded: false });
  });
}
