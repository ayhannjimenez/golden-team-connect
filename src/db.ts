import Dexie, { type Table } from 'dexie';
import type { AppSettings, Campaign, Contact, FollowUpTask, InternalList, MediaAsset, Member, MessageTemplate, QueueItem, WeeklyEvent } from './types';

export class LocalDatabase extends Dexie {
  contacts!: Table<Contact, number>;
  lists!: Table<InternalList, number>;
  templates!: Table<MessageTemplate, number>;
  campaigns!: Table<Campaign, number>;
  queue!: Table<QueueItem, number>;
  members!: Table<Member, number>;
  tasks!: Table<FollowUpTask, number>;
  weeklyEvents!: Table<WeeklyEvent, number>;
  mediaAssets!: Table<MediaAsset, number>;
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
    this.version(3).stores({
      contacts: '++id, &phone, firstName, lastName, status, category, preferredChannel, language, *listIds, demo',
      lists: '++id, name, demo',
      templates: '++id, name, demo',
      campaigns: '++id, name, createdAt, demo',
      queue: '++id, campaignId, contactId, status, language',
      members: '++id, &phone, firstName, lastName, programStatus, interest, protocolStartDate, language, nextOrderDate',
      tasks: '++id, memberId, contactId, queueItemId, kind, status, dueDate, sourceKey, language',
      weeklyEvents: '++id, name, weekday, active',
      mediaAssets: '++id, name, kind, createdAt',
      settings: 'id'
    });
    this.version(4).stores({
      contacts: '++id, &phone, firstName, lastName, status, category, preferredChannel, language, *listIds, demo',
      lists: '++id, name, demo',
      templates: '++id, name, demo',
      campaigns: '++id, name, createdAt, demo',
      queue: '++id, campaignId, contactId, status, language',
      members: '++id, &phone, firstName, lastName, programStatus, interest, protocolStartDate, language, nextOrderDate',
      tasks: '++id, memberId, contactId, queueItemId, kind, status, dueDate, sourceKey, language',
      weeklyEvents: '++id, name, weekday, active',
      mediaAssets: '++id, name, kind, createdAt, source, driveFileId',
      settings: 'id'
    });
    this.version(5).stores({
      contacts: '++id, &phone, firstName, lastName, status, category, preferredChannel, language, *listIds, demo',
      lists: '++id, name, demo',
      templates: '++id, key, name, day, demo',
      campaigns: '++id, name, createdAt, demo',
      queue: '++id, campaignId, contactId, status, language',
      members: '++id, &phone, firstName, lastName, programStatus, interest, contactType, protocolStartDate, language, nextOrderDate',
      tasks: '++id, memberId, contactId, queueItemId, kind, status, dueDate, dueAt, sourceKey, templateKey, sequenceDay, language',
      weeklyEvents: '++id, name, weekday, active',
      mediaAssets: '++id, name, kind, createdAt, source, driveFileId',
      settings: 'id'
    }).upgrade(async (tx) => {
      const members = tx.table<Member, number>('members');
      const tasks = tx.table<FollowUpTask, number>('tasks');
      const settings = tx.table<AppSettings, string>('settings');
      await members.toCollection().modify((member) => {
        member.feelGreatReferralLink = member.feelGreatReferralLink || '';
        member.contactType = member.contactType || (member.interest === 'Distribuidor activo' || member.interest === 'Interesado en negocio' ? 'Distribuidor' : 'Miembro');
        member.timezone = member.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
        member.updatedAt = member.updatedAt || member.createdAt || new Date().toISOString();
        if (member.purchaseType === 'Compra única') member.purchaseType = 'Compra individual';
        if (member.purchaseType === 'Autosuscripción') member.purchaseType = 'Suscripción';
      });
      await tasks.toCollection().modify((task) => {
        task.sequenceDay = task.sequenceDay ?? task.programDay;
        task.templateKey = task.templateKey || (typeof task.sequenceDay === 'number' ? `followup-day-${task.sequenceDay}` : undefined);
        task.resolvedMessage = task.resolvedMessage || task.message;
        task.dueAt = task.dueAt || (task.dueDate && task.dueTime ? `${task.dueDate}T${task.dueTime}` : undefined);
      });
      const current = await settings.get('main');
      if (current) await settings.put({ ...current, appStoreLink: current.appStoreLink || '', googlePlayLink: current.googlePlayLink || '' });
    });
  }
}

export const db = new LocalDatabase();

export const defaultSettings: AppSettings = {
  id: 'main',
  ownerName: '',
  feelGreatLink: '',
  sessionActive: false,
  profilePhoto: '',
  preferredLanguage: 'es',
  googleDriveConnection: 'disconnected',
  googleDriveAccount: '',
  googleDriveTokenHint: '',
  appStoreLink: '',
  googlePlayLink: '',
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
  await db.transaction('rw', [db.contacts, db.lists, db.templates, db.campaigns, db.queue, db.members, db.tasks, db.weeklyEvents, db.mediaAssets, db.settings], async () => {
    await Promise.all([db.contacts.clear(), db.lists.clear(), db.templates.clear(), db.campaigns.clear(), db.queue.clear(), db.members.clear(), db.tasks.clear(), db.weeklyEvents.clear(), db.mediaAssets.clear()]);
    await db.settings.put({ ...defaultSettings, demoSeeded: false });
  });
}
