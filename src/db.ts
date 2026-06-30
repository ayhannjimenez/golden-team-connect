import Dexie, { type Table } from 'dexie';
import type { AppSettings, Campaign, Contact, InternalList, MessageTemplate, QueueItem } from './types';

export class LocalDatabase extends Dexie {
  contacts!: Table<Contact, number>;
  lists!: Table<InternalList, number>;
  templates!: Table<MessageTemplate, number>;
  campaigns!: Table<Campaign, number>;
  queue!: Table<QueueItem, number>;
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
  await db.transaction('rw', [db.contacts, db.lists, db.templates, db.campaigns, db.queue, db.settings], async () => {
    await Promise.all([db.contacts.clear(), db.lists.clear(), db.templates.clear(), db.campaigns.clear(), db.queue.clear()]);
    await db.settings.put({ ...defaultSettings, demoSeeded: false });
  });
}
