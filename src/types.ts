export type Category = 'Miembro' | 'Cliente' | 'Distribuidor' | 'Lider' | 'Prospecto' | 'Otro';
export type ContactStatus = 'Activo' | 'Pausado' | 'Dado de baja';
export type Channel = 'WhatsApp' | 'SMS' | 'Ambos';
export type QueueStatus = 'Pendiente' | 'Abierto' | 'Enviado' | 'Omitido' | 'Fallido';
export type VisualTheme = 'golden' | 'classic' | 'emerald' | 'burgundy';

export interface Contact {
  id?: number;
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  country: string;
  email?: string;
  category: Category;
  listIds: number[];
  tags: string[];
  notes?: string;
  createdAt: string;
  status: ContactStatus;
  preferredChannel: Channel;
  consent: boolean;
  consentDate?: string;
  unsubscribedAt?: string;
  demo?: boolean;
}

export interface InternalList {
  id?: number;
  name: string;
  description?: string;
  createdAt: string;
  demo?: boolean;
}

export interface MessageTemplate {
  id?: number;
  name: string;
  body: string;
  createdAt: string;
  demo?: boolean;
}

export interface CampaignImage {
  name: string;
  type: string;
  dataUrl: string;
  size: number;
  updatedAt: string;
}

export interface Campaign {
  id?: number;
  name: string;
  message: string;
  templateId?: number;
  listIds: number[];
  contactIds: number[];
  channel: Channel;
  notes?: string;
  image?: CampaignImage;
  createdAt: string;
  demo?: boolean;
}

export interface QueueItem {
  id?: number;
  campaignId: number;
  contactId: number;
  contactSnapshot: Contact;
  listNames: string[];
  channel: Channel;
  personalizedMessage: string;
  status: QueueStatus;
  openedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AppSettings {
  id: 'main';
  ownerName: string;
  feelGreatLink?: string;
  sessionActive?: boolean;
  visualTheme?: VisualTheme;
  personalNumber: string;
  defaultCountryCode: string;
  defaultCountry: string;
  preferredChannel: Channel;
  autoOpenWhatsApp: boolean;
  confirmBeforeAdvance: boolean;
  theme: 'Claro';
  textSize: 'Normal' | 'Grande';
  demoSeeded: boolean;
}

export interface CampaignPreview {
  contacts: Contact[];
  excluded: Array<{ contact: Contact; reason: string }>;
}

export interface BackupFile {
  app: 'difusion-local-privada';
  version: 1;
  exportedAt: string;
  contacts: Contact[];
  lists: InternalList[];
  templates: MessageTemplate[];
  campaigns: Campaign[];
  queue: QueueItem[];
  settings: AppSettings;
}
