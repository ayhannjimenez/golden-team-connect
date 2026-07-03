export type Category = 'Miembro' | 'Cliente' | 'Distribuidor' | 'Lider' | 'Prospecto' | 'Otro';
export type ContactStatus = 'Activo' | 'Pausado' | 'Dado de baja';
export type Channel = 'WhatsApp' | 'SMS' | 'Ambos';
export type QueueStatus = 'Pendiente' | 'Abierto' | 'Enviado' | 'Omitido' | 'Fallido';
export type VisualTheme = 'golden' | 'classic' | 'emerald' | 'burgundy';
export type AppLanguage = 'es' | 'en';
export type ContactLanguage = 'Español' | 'English';
export type MemberPurchaseType = 'Autosuscripción' | 'Compra única' | 'No sé' | 'Compra individual' | 'Suscripción' | 'Entrega física';
export type MemberInterest = 'Solo protocolo' | 'Interesado en negocio' | 'Distribuidor activo';
export type MemberProgramStatus = 'Sin iniciar' | 'Activo' | 'Pausado' | 'Completado';
export type TaskKind = 'Difusión' | 'Seguimiento' | 'Reunión' | 'Miembro' | 'Renovación' | 'LA Fitness';
export type TaskStatus = 'Pendiente' | 'Completada' | 'Pospuesta' | 'Cancelada';
export type ContactType = 'Miembro' | 'Distribuidor' | 'Ambos';

export interface Member {
  id?: number;
  firstName: string;
  lastName?: string;
  phone: string;
  countryCode: string;
  country?: string;
  email?: string;
  purchaseDate: string;
  estimatedDeliveryDate?: string;
  protocolStartDate?: string;
  feelGreatReferralLink?: string;
  preferredChannel: Exclude<Channel, 'Ambos'>;
  language?: ContactLanguage;
  purchaseType: MemberPurchaseType;
  contactType?: ContactType;
  interest: MemberInterest;
  notes?: string;
  programActive: boolean;
  programStatus: MemberProgramStatus;
  completedAt?: string;
  timezone?: string;
  weeklyEventsActive?: boolean;
  followUpTime?: string;
  reminderMinutes?: 15 | 30;
  nextOrderDate?: string;
  createdAt: string;
  updatedAt?: string;
  convertedFromContactId?: number;
}

export interface MeetingSnapshot {
  id?: number;
  name: string;
  dateTime: string;
  link: string;
  audience?: string;
}

export interface FollowUpTask {
  id?: number;
  memberId?: number;
  contactId?: number;
  queueItemId?: number;
  kind: TaskKind;
  program: string;
  title: string;
  contactName: string;
  phone: string;
  channel: Exclude<Channel, 'Ambos'> | 'No definido';
  language?: ContactLanguage;
  dueDate: string;
  dueTime: string;
  reminderMinutes?: 15 | 30;
  programDay?: number;
  sequenceDay?: number;
  templateKey?: string;
  templateId?: number;
  templateType?: 'base' | 'custom';
  templateVersion?: number;
  message: string;
  resolvedMessage?: string;
  status: TaskStatus;
  completedAt?: string;
  sentConfirmedAt?: string;
  attemptedAt?: string;
  attemptedChannel?: Exclude<Channel, 'Ambos'>;
  completedChannel?: Exclude<Channel, 'Ambos'>;
  notes?: string;
  createdAt: string;
  sourceKey?: string;
  source?: 'base' | 'custom';
  scheduledAt?: string;
  meetingLink?: string;
  meetingId?: number;
  meetingSnapshot?: MeetingSnapshot;
  dueAt?: string;
}

export interface WeeklyEvent {
  id?: number;
  name: string;
  weekday: number;
  eventTime: string;
  reminderTime: string;
  link: string;
  audience?: string;
  message: string;
  messageEn?: string;
  active: boolean;
  updatedAt: string;
}

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
  language?: ContactLanguage;
  consent: boolean;
  consentDate?: string;
  unsubscribedAt?: string;
  demo?: boolean;
}

export interface InternalList {
  id?: number;
  name: string;
  description?: string;
  lastMessageEs?: string;
  lastMessageEn?: string;
  lastSentAt?: string;
  createdAt: string;
  demo?: boolean;
}

export interface MessageTemplate {
  id?: number;
  name: string;
  body: string;
  createdAt: string;
  demo?: boolean;
  key?: string;
  internalTitle?: string;
  day?: number;
  defaultTime?: string;
  message?: string;
  originalMessage?: string;
  availableVariables?: string[];
  updatedAt?: string;
  templateVersion?: number;
  templateType?: 'base' | 'custom';
  active?: boolean;
  includeInNewFollowUps?: boolean;
}

export interface CampaignImage {
  name: string;
  type: string;
  dataUrl: string;
  size: number;
  updatedAt: string;
}

export interface MediaAsset {
  id?: number;
  name: string;
  type: string;
  dataUrl: string;
  size: number;
  kind: 'image' | 'video';
  createdAt: string;
  source?: 'local' | 'google-drive';
  driveFileId?: string;
  driveMimeType?: string;
  driveThumbnail?: string;
  driveWebViewLink?: string;
  driveDownloadMetadata?: string;
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
  mediaAssetId?: number;
  audienceLanguage?: ContactLanguage | 'Manual';
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
  language?: ContactLanguage;
  mediaAssetId?: number;
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
  profilePhoto?: string;
  preferredLanguage?: AppLanguage;
  googleDriveConnection?: 'disconnected' | 'connected';
  googleDriveAccount?: string;
  googleDriveTokenHint?: string;
  appStoreLink?: string;
  googlePlayLink?: string;
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
  members?: Member[];
  tasks?: FollowUpTask[];
  weeklyEvents?: WeeklyEvent[];
  mediaAssets?: MediaAsset[];
  settings: AppSettings;
}
