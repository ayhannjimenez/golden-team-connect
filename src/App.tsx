import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import {
  Bell,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FileImage,
  Home,
  Library,
  Link2,
  LogOut,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Power,
  Send,
  Share2,
  Trash2,
  Upload,
  Users,
  X
} from 'lucide-react';
import { db, defaultSettings, ensureSettings } from './db';
import { isValidAccessCode, normalizeAccessCode } from './accessConfig';
import type { AppLanguage, AppSettings, Campaign, Channel, Contact, ContactLanguage, ContactType, FollowUpTask, InternalList, MediaAsset, Member, MessageTemplate, QueueItem, QueueStatus, WeeklyEvent } from './types';
import { exportContactsCsv, parseContactsCsv, csvRowToContact } from './utils/csv';
import { buildFirst30DayTasks, buildLocalDueAt, buildTaskFromTemplate, currentProgramDay, defaultFollowUpTemplates, defaultWeeklyEvents, findNextMeeting, getDeviceTimezone, isTaskOpen, localDateKey, memberName, parsePastedProspects, resolveFollowUpMessage, templateDisplayTime } from './utils/followup';
import { compressImage, fileToDataUrl, shareImage } from './utils/image';
import { clearDriveToken, driveFileToMediaAsset, readDriveToken } from './utils/googleDrive';
import { bestQueueIndex, buildSmsLink, buildWhatsAppDeepLink, buildWhatsAppLink, cleanUnresolvedMessage, personalizeMessage } from './utils/messages';
import { isDuplicatePhone, normalizePhone } from './utils/phone';

type GoogleTokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

type MainSection = 'inicio' | 'difusion' | 'seguimiento' | 'tareas';
type TaskGroup = 'Hoy' | 'Vencidas' | 'Próximas' | 'Completadas';
type TaskFilter = 'Todas' | 'Difusión' | 'Seguimiento' | 'Reuniones';
type Audience = ContactLanguage | 'Manual';
type AccountPanel = 'profile' | 'link' | 'templates' | 'system' | 'language' | null;
type BroadcastTab = 'lists' | 'library';
type DriveFilter = 'all' | 'photos' | 'videos';

const entryLogoSrc = `${import.meta.env.BASE_URL}golden-team-logo-transparent.png`;
const officeUrl = 'https://office.unicity.com/#/dashboard';
const unicityLibraryUrl = 'https://office.unicity.com/#/library';
const productsUrl = 'https://shop.unicity.com/usa/en/products';
const paylutionUrl = 'https://unicity.paylution.com/hw2web/landing.xhtml?faces-redirect=true&refreshme=true';
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
const googleAppId = import.meta.env.VITE_GOOGLE_APP_ID || '';
const contactLanguages: ContactLanguage[] = ['Español', 'English'];

const copy = {
  es: {
    nav: { inicio: 'Inicio', difusion: 'Difusión', seguimiento: 'Seguimiento', tareas: 'Tareas' },
    homeTitle: 'Hola',
    myLink: 'Mi enlace',
    account: 'Cuenta',
    profileInfo: 'Información del perfil',
    feelLink: 'Mi Feel Great Link',
    linkCenter: 'Centro de enlaces',
    language: 'Idioma',
    logout: 'Cerrar sesión',
    broadcast: 'Difusión',
    broadcastSub: 'Crea una lista, prepara tu contenido y envíalo contacto por contacto.',
    newList: 'Nueva lista',
    lists: 'Listas',
    library: 'Biblioteca',
    connectDriveTitle: 'Conecta tu Google Drive para acceder y reutilizar tus fotos y videos.',
    connectDrive: 'Conectar Google Drive',
    drivePending: 'Configuración de Google pendiente',
    addFromDrive: 'Añadir desde Drive',
    uploadToDrive: 'Subir a Drive',
    disconnectDrive: 'Desconectar Drive',
    all: 'Todo',
    photos: 'Fotos',
    videos: 'Videos',
    noContent: 'No hay contenido seleccionado.',
    followUps: 'Seguimiento',
    followUpsSub: 'Acompaña cada persona durante sus primeros 30 días.',
    addPeople: 'Añadir persona',
    importContact: 'Importar contacto',
    importContacts: 'Importar contactos',
    tasks: 'Tareas',
    tasksSub: 'Mensajes pendientes de seguimiento.',
    save: 'Guardar',
    edit: 'Editar',
    delete: 'Eliminar',
    copy: 'Copiar',
    share: 'Compartir',
    open: 'Abrir',
    name: 'Nombre',
    phone: 'Teléfono',
    channel: 'Canal',
    status: 'Estado',
    today: 'Hoy',
    overdue: 'Vencidas',
    upcoming: 'Próximas',
    completed: 'Completadas'
  },
  en: {
    nav: { inicio: 'Home', difusion: 'Broadcast', seguimiento: 'Follow-ups', tareas: 'Tasks' },
    homeTitle: 'Hi',
    myLink: 'My link',
    account: 'Account',
    profileInfo: 'Profile information',
    feelLink: 'My Feel Great Link',
    linkCenter: 'Link center',
    language: 'Language',
    logout: 'Log out',
    broadcast: 'Broadcast',
    broadcastSub: 'Create a list, prepare your content, and send it contact by contact.',
    newList: 'New list',
    lists: 'Lists',
    library: 'Library',
    connectDriveTitle: 'Connect your Google Drive to access and reuse your photos and videos.',
    connectDrive: 'Connect Google Drive',
    drivePending: 'Google configuration pending',
    addFromDrive: 'Add from Drive',
    uploadToDrive: 'Upload to Drive',
    disconnectDrive: 'Disconnect Drive',
    all: 'All',
    photos: 'Photos',
    videos: 'Videos',
    noContent: 'No content selected.',
    followUps: 'Follow-ups',
    followUpsSub: 'Support each person during their first 30 days.',
    addPeople: 'Add person',
    importContact: 'Import contact',
    importContacts: 'Import contacts',
    tasks: 'Tasks',
    tasksSub: 'Pending follow-up messages.',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    copy: 'Copy',
    share: 'Share',
    open: 'Open',
    name: 'Name',
    phone: 'Phone',
    channel: 'Channel',
    status: 'Status',
    today: 'Today',
    overdue: 'Overdue',
    upcoming: 'Upcoming',
    completed: 'Completed'
  }
} as const;

function todayIso() {
  return new Date().toISOString();
}

function todayKey() {
  return localDateKey();
}

function shortDate(value?: string, language: AppLanguage = 'es') {
  if (!value) return language === 'en' ? 'No date' : 'Sin fecha';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'es-US', { month: 'short', day: 'numeric' });
}

function shortDateTime(value?: string, language: AppLanguage = 'es') {
  if (!value) return language === 'en' ? 'No date' : 'Sin fecha';
  return new Date(value).toLocaleString(language === 'en' ? 'en-US' : 'es-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function taskNotificationAt(task: FollowUpTask) {
  const dueAt = new Date(task.scheduledAt || task.dueAt || buildLocalDueAt(task.dueDate, task.dueTime)).getTime();
  if (Number.isNaN(dueAt)) return '';
  if (task.sourceKey?.startsWith('notification-test:')) return new Date(dueAt).toISOString();
  return new Date(dueAt - (task.reminderMinutes || 30) * 60 * 1000).toISOString();
}

function notificationStatusLabel(permission: NotificationPermission | 'unsupported') {
  if (permission === 'unsupported') return 'No compatible';
  if (permission === 'default') return 'No solicitadas';
  if (permission === 'granted') return 'Permitidas';
  return 'Denegadas';
}

function normalizeFeelGreatLink(value: string) {
  return value.trim().replace(/\s+/g, '');
}

function isValidFeelGreatLink(value: string) {
  try {
    const url = new URL(normalizeFeelGreatLink(value));
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function displayName(settings: AppSettings) {
  return settings.ownerName.trim() || 'Ayhann';
}

function firstName(settings: AppSettings) {
  return displayName(settings).split(/\s+/)[0] || displayName(settings);
}

function contactFullName(contact: Contact) {
  return `${contact.firstName} ${contact.lastName || ''}`.trim();
}

function contactLanguage(contact: Contact): ContactLanguage {
  const tagged = contact.tags.find((tag) => tag.startsWith('Idioma:'))?.slice(7);
  return contact.language || (tagged === 'English' ? 'English' : 'Español');
}

function withLanguageTag(contact: Contact, language: ContactLanguage) {
  return [...contact.tags.filter((tag) => !tag.startsWith('Idioma:')), `Idioma:${language}`];
}

function taskType(task: FollowUpTask): TaskFilter {
  if (task.queueItemId || task.kind === 'Difusión' || task.kind === 'LA Fitness') return 'Difusión';
  if (task.kind === 'Reunión') return 'Reuniones';
  return 'Seguimiento';
}

function readableUrl(url?: string) {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function googleConfigured() {
  return Boolean(googleClientId && googleApiKey && googleAppId);
}

function driveConfigMissing(language: AppLanguage) {
  const missing = [
    !googleClientId ? 'VITE_GOOGLE_CLIENT_ID' : '',
    !googleApiKey ? 'VITE_GOOGLE_API_KEY' : '',
    !googleAppId ? 'VITE_GOOGLE_APP_ID' : ''
  ].filter(Boolean);
  if (!missing.length) return '';
  return language === 'en'
    ? `Missing Google Cloud values: ${missing.join(', ')}.`
    : `Faltan valores de Google Cloud: ${missing.join(', ')}.`;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'G').toUpperCase();
}

function GlobeIcon() {
  return <span className="text-lg font-black">文</span>;
}

function Field({ label, children, helper }: { label: string; children: ReactNode; helper?: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
      {helper ? <span className="text-xs font-medium leading-relaxed text-slate-500">{helper}</span> : null}
    </label>
  );
}

function PrimaryButton({ children, onClick, type = 'button', disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(5,5,5,0.12)] transition hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, type = 'button', disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-brand transition hover:border-brandLight hover:text-brandDark disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>
      {children}
    </button>
  );
}

function IconButton({ label, children, onClick, className = '' }: { label: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className={`grid min-h-12 min-w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-brand shadow-sm transition hover:border-brandLight ${className}`}>
      {children}
    </button>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-[1.4rem] border border-[rgb(var(--color-border))] bg-white p-4 shadow-[0_10px_28px_rgba(5,5,5,0.055)] ${className}`}>{children}</section>;
}

function Header({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section
      className="-mx-4 min-w-0 rounded-b-[2rem] bg-brand pb-6 text-white shadow-soft sm:-mx-6"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 1rem)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 1rem)'
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="max-w-full whitespace-normal break-words text-[1.55rem] font-black leading-tight tracking-normal sm:text-2xl">{title}</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/70">{subtitle}</p>
        </div>
        {action}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const color =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'warn'
        ? 'border-gold/40 bg-gold/15 text-brand'
        : tone === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : tone === 'accent'
            ? 'border-gold/35 bg-[#f6f0dc] text-brand'
            : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex min-w-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${color}`}>{children}</span>;
}

function App() {
  const [active, setActive] = useState<MainSection>('inicio');
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState('Listo.');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<InternalList[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [entryName, setEntryName] = useState('');
  const [entryLink, setEntryLink] = useState('');
  const [entryAccessCode, setEntryAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPanel, setAccountPanel] = useState<AccountPanel>(null);
  const [profileName, setProfileName] = useState('');
  const [profileLink, setProfileLink] = useState('');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [broadcastTab, setBroadcastTab] = useState<BroadcastTab>('lists');
  const [newListOpen, setNewListOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [listLanguageFilter, setListLanguageFilter] = useState<'Todos' | ContactLanguage>('Todos');
  const [broadcastContact, setBroadcastContact] = useState({ firstName: '', lastName: '', phone: '', language: 'Español' as ContactLanguage, channel: 'WhatsApp' as Channel });
  const [csvText, setCsvText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [messageEs, setMessageEs] = useState('');
  const [messageEn, setMessageEn] = useState('');
  const [audience, setAudience] = useState<Audience>('Español');
  const [selectedBroadcastContactIds, setSelectedBroadcastContactIds] = useState<number[]>([]);
  const [broadcastChannel, setBroadcastChannel] = useState<Channel>('WhatsApp');
  const [selectedMediaId, setSelectedMediaId] = useState<number | ''>('');
  const [activeCampaignId, setActiveCampaignId] = useState<number | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [driveFilter, setDriveFilter] = useState<DriveFilter>('all');
  const [googleLibrariesReady] = useState(false);
  const [googleLibrariesError] = useState('');
  const [driveToken, setDriveToken] = useState(() => readDriveToken());
  const [followForm, setFollowForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    feelGreatReferralLink: '',
    language: 'Español' as ContactLanguage,
    startDate: todayKey(),
    channel: 'WhatsApp' as Exclude<Channel, 'Ambos'>,
    purchaseType: 'Compra individual' as Member['purchaseType'],
    contactType: 'Miembro' as ContactType
  });
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | 'new' | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', day: 0, defaultTime: '10:00', active: true, includeInNewFollowUps: false });
  const [templateApplyMode, setTemplateApplyMode] = useState<'library' | 'new' | 'selected'>('library');
  const [templateSelectionId, setTemplateSelectionId] = useState<number | null>(null);
  const [selectedTemplateMemberIds, setSelectedTemplateMemberIds] = useState<number[]>([]);
  const [templateDraft, setTemplateDraft] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | 'new' | null>(null);
  const [meetingForm, setMeetingForm] = useState({ name: '', weekday: 1, eventTime: '19:00', link: '', audience: '', active: true });
  const [pendingSendTask, setPendingSendTask] = useState<{ taskId: number; channel: 'WhatsApp' | 'SMS' } | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [taskGroup, setTaskGroup] = useState<TaskGroup>('Hoy');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'));
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const templateTextRef = useRef<HTMLTextAreaElement | null>(null);
  const googleTokenClientRef = useRef<GoogleTokenClient | null>(null);

  const lang = settings.preferredLanguage || 'es';
  const c = copy[lang];
  const selectedList = lists.find((list) => list.id === selectedListId) || null;
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) || null;
  const selectedQueue = useMemo(() => queue.filter((item) => item.campaignId === activeCampaignId), [activeCampaignId, queue]);
  const currentQueueItem = selectedQueue[queueIndex];
  const selectedMember = members.find((member) => member.id === selectedMemberId) || null;
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) || null, [selectedTaskId, tasks]);
  const activeDriveToken = driveToken?.expiresAt && driveToken.expiresAt > Date.now() + 30_000 ? driveToken : null;
  const driveConnected = Boolean(activeDriveToken);

  async function ensureFollowUpDefaults() {
    const now = new Date();
    const existingTemplates = await db.templates.toArray();
    const defaults = defaultFollowUpTemplates(now);
    for (const item of defaults) {
      const existing = existingTemplates.find((template) => template.key === item.key);
      if (!existing) await db.templates.add(item);
      if (existing?.id) {
        await db.templates.update(existing.id, {
          templateType: existing.templateType || 'base',
          active: existing.active ?? true,
          includeInNewFollowUps: existing.includeInNewFollowUps ?? true,
          originalMessage: existing.originalMessage || item.originalMessage,
          availableVariables: existing.availableVariables || item.availableVariables
        });
      }
    }
    if (!(await db.weeklyEvents.count())) await db.weeklyEvents.bulkAdd(defaultWeeklyEvents.map((event) => ({ ...event, updatedAt: now.toISOString() })));
    const currentSettings = await ensureSettings();
    if (!currentSettings.appStoreLink) await db.settings.put({ ...currentSettings, appStoreLink: 'https://apps.apple.com/app/id6445913865' });
  }

  async function migrateActiveFollowUps() {
    const [allMembers, allTemplates, allEvents, currentSettings] = await Promise.all([db.members.toArray(), db.templates.toArray(), db.weeklyEvents.toArray(), ensureSettings()]);
    for (const member of allMembers.filter((item) => item.id && item.protocolStartDate && ['Activo', 'Pausado'].includes(item.programStatus))) {
      const memberTasks = await db.tasks.where('memberId').equals(member.id!).toArray();
      const completedDays = new Set(memberTasks.filter((task) => task.status === 'Completada').map((task) => task.sequenceDay ?? task.programDay).filter((day): day is number => typeof day === 'number'));
      const pendingProgramTasks = memberTasks.filter((task) => task.program === 'Primeros 30 días' && isTaskOpen(task));
      if (pendingProgramTasks.length) await db.tasks.bulkDelete(pendingProgramTasks.map((task) => task.id!).filter(Boolean));
      const normalizedMember: Member = {
        ...member,
        feelGreatReferralLink: member.feelGreatReferralLink || '',
        contactType: member.contactType || (member.interest === 'Distribuidor activo' || member.interest === 'Interesado en negocio' ? 'Distribuidor' : 'Miembro'),
        timezone: member.timezone || getDeviceTimezone(),
        updatedAt: member.updatedAt || todayIso()
      };
      await db.members.update(member.id!, normalizedMember);
      const baseTemplates = allTemplates.filter((template) => template.templateType !== 'custom');
      const nextTasks = buildFirst30DayTasks(normalizedMember, currentSettings, baseTemplates, allEvents).filter((task) => !completedDays.has(task.sequenceDay || 0));
      const existingSourceKeys = new Set((await db.tasks.where('memberId').equals(member.id!).toArray()).map((task) => task.sourceKey).filter(Boolean));
      const missing = nextTasks.filter((task) => !existingSourceKeys.has(task.sourceKey));
      if (missing.length) await db.tasks.bulkAdd(missing);
    }
  }

  async function loadAll(message?: string) {
    await cleanupDemoRecords();
    await ensureFollowUpDefaults();
    await migrateActiveFollowUps();
    const [loadedSettings, loadedContacts, loadedLists, loadedCampaigns, loadedQueue, loadedMembers, loadedTasks, loadedEvents, loadedTemplates, loadedMedia] = await Promise.all([
      ensureSettings(),
      db.contacts.orderBy('firstName').toArray(),
      db.lists.orderBy('name').toArray(),
      db.campaigns.orderBy('createdAt').reverse().toArray(),
      db.queue.orderBy('id').toArray(),
      db.members.orderBy('firstName').toArray(),
      db.tasks.orderBy('dueDate').toArray(),
      db.weeklyEvents.orderBy('weekday').toArray(),
      db.templates.orderBy('day').toArray(),
      db.mediaAssets.orderBy('createdAt').reverse().toArray()
    ]);
    setSettings(loadedSettings);
    setProfileName(loadedSettings.ownerName || '');
    setProfileLink(loadedSettings.feelGreatLink || '');
    setContacts(loadedContacts);
    setLists(loadedLists);
    setCampaigns(loadedCampaigns);
    setQueue(loadedQueue);
    setMembers(loadedMembers);
    setTasks(loadedTasks);
    setWeeklyEvents(loadedEvents);
    setTemplates(loadedTemplates);
    setMediaAssets(loadedMedia);
    if (!loadedSettings.sessionActive) {
      setEntryName((current) => current || loadedSettings.ownerName || '');
      setEntryLink((current) => current || loadedSettings.feelGreatLink || '');
    }
    if (!activeCampaignId) {
      const pendingCampaign = loadedCampaigns.find((campaign) => loadedQueue.some((item) => item.campaignId === campaign.id && ['Pendiente', 'Abierto'].includes(item.status)));
      if (pendingCampaign?.id) setActiveCampaignId(pendingCampaign.id);
    }
    setReady(true);
    if (message) setNotice(message);
  }

  async function cleanupDemoRecords() {
    await db.transaction('rw', [db.contacts, db.lists, db.templates, db.campaigns, db.queue, db.settings], async () => {
      await Promise.all([
        db.queue.filter((item) => Boolean(item.contactSnapshot?.demo)).delete(),
        db.contacts.where('demo').equals(1).delete(),
        db.lists.where('demo').equals(1).delete(),
        db.templates.where('demo').equals(1).delete(),
        db.campaigns.where('demo').equals(1).delete()
      ]);
      const current = await ensureSettings();
      if (current.demoSeeded) await db.settings.put({ ...current, demoSeeded: false });
    });
  }

  useEffect(() => {
    loadAll().catch((error) => setNotice(error instanceof Error ? error.message : 'No se pudieron cargar los datos.'));
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onAppNotice = (event: Event) => setNotice((event as CustomEvent<string>).detail);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('app-notice', onAppNotice);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('app-notice', onAppNotice);
    };
  }, []);

  useEffect(() => {
    setQueueIndex(bestQueueIndex(selectedQueue));
  }, [activeCampaignId, selectedQueue.length]);

  useEffect(() => {
    const askConfirmation = () => {
      if (pendingSendTask && document.visibilityState === 'visible') setShowSendConfirm(true);
    };
    window.addEventListener('focus', askConfirmation);
    document.addEventListener('visibilitychange', askConfirmation);
    return () => {
      window.removeEventListener('focus', askConfirmation);
      document.removeEventListener('visibilitychange', askConfirmation);
    };
  }, [pendingSendTask]);

  const listContacts = useMemo(() => {
    if (!selectedList?.id) return [];
    return contacts.filter((contact) => contact.listIds.includes(selectedList.id!));
  }, [contacts, selectedList]);

  const visibleListContacts = useMemo(() => {
    if (listLanguageFilter === 'Todos') return listContacts;
    return listContacts.filter((contact) => contactLanguage(contact) === listLanguageFilter);
  }, [listContacts, listLanguageFilter]);

  const activeFollowPeople = useMemo(() => members.filter((member) => member.programStatus === 'Activo'), [members]);
  const activeSelectableMembers = useMemo(() => activeFollowPeople.filter((member) => {
    const day = currentProgramDay(member.protocolStartDate);
    return day !== null && day <= 30;
  }), [activeFollowPeople]);
  const completedFollowPeople = useMemo(() => members.filter((member) => member.programStatus === 'Completado'), [members]);
  const baseTemplates = useMemo(() => templates.filter((template) => template.templateType !== 'custom' && template.key?.startsWith('followup-day-')).sort((a, b) => (a.day || 0) - (b.day || 0)), [templates]);
  const customTemplates = useMemo(() => templates.filter((template) => template.templateType === 'custom').sort((a, b) => (a.day || 0) - (b.day || 0) || (a.name || '').localeCompare(b.name || '')), [templates]);
  const memberStatusById = useMemo(() => new Map(members.map((member) => [member.id, member.programStatus])), [members]);
  const actionTasks = useMemo(() => [...tasks].sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`)), [tasks]);
  const visibleOpenTasks = useMemo(() => actionTasks.filter((task) => isTaskOpen(task) && (!task.memberId || memberStatusById.get(task.memberId) !== 'Pausado' && memberStatusById.get(task.memberId) !== 'Completado')), [actionTasks, memberStatusById]);
  const todayTasks = useMemo(() => visibleOpenTasks.filter((task) => task.dueDate === todayKey()), [visibleOpenTasks]);
  const overdueTasks = useMemo(() => visibleOpenTasks.filter((task) => task.dueDate < todayKey()), [visibleOpenTasks]);
  const upcomingTasks = useMemo(() => visibleOpenTasks.filter((task) => task.dueDate > todayKey()), [visibleOpenTasks]);
  const completedTasks = useMemo(() => actionTasks.filter((task) => task.status === 'Completada'), [actionTasks]);
  const taskBadge = todayTasks.length + overdueTasks.length;

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || notificationPermission !== 'granted') return;
    const timers = visibleOpenTasks
      .filter((task) => task.id && task.id > 0)
      .map((task) => {
        const notificationAt = new Date(taskNotificationAt(task)).getTime();
        const delay = notificationAt - Date.now();
        if (delay <= 0 || delay > 2_147_483_647) return null;
        return window.setTimeout(() => {
          const first = task.contactName.split(/\s+/)[0] || task.contactName;
          void showLocalNotification(
            task.sourceKey?.startsWith('notification-test:') ? 'Golden Team Connect' : `Enviar mensaje a ${first}`,
            task.sourceKey?.startsWith('notification-test:') ? 'Prueba: enviar mensaje de seguimiento.' : `Día ${task.sequenceDay ?? task.programDay ?? '-'} · Seguimiento de 30 días`,
            `golden-team-task-${task.id}`
          );
        }, delay);
      })
      .filter((timer): timer is number => typeof timer === 'number');
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [notificationPermission, visibleOpenTasks]);

  function messageContext() {
    return { userName: displayName(settings), feelGreatLink: settings.feelGreatLink || '' };
  }

  async function saveSettingsPatch(patch: Partial<AppSettings>, message = lang === 'en' ? 'Saved.' : 'Guardado.') {
    const updated = { ...settings, ...patch, id: 'main' as const };
    await db.settings.put(updated);
    setSettings(updated);
    setNotice(message);
  }

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    const name = entryName.trim();
    const link = normalizeFeelGreatLink(entryLink);
    if (!name) return setEntryError('Escribe tu nombre.');
    if (!isValidFeelGreatLink(link)) return setEntryError('Revisa que hayas pegado tu enlace completo.');
    if (!isValidAccessCode(entryAccessCode)) return setEntryError('Código incorrecto. Verifica e intenta nuevamente.');
    await saveSettingsPatch({ ownerName: name, feelGreatLink: link, sessionActive: true, visualTheme: settings.visualTheme || 'golden' }, 'Bienvenido a Golden Team Connect.');
    setEntryAccessCode('');
    setEntryError('');
  }

  async function closeSession() {
    if (!confirm(lang === 'en' ? 'Log out? Your local data will stay on this device.' : '¿Cerrar sesión? Tus datos locales permanecerán en este dispositivo.')) return;
    await saveSettingsPatch({ sessionActive: false }, lang === 'en' ? 'Session closed.' : 'Sesión cerrada.');
    setEntryAccessCode('');
    setAccountOpen(false);
  }

  async function copyFeelGreatLink() {
    if (!settings.feelGreatLink) return setNotice(lang === 'en' ? 'Add your Feel Great Link first.' : 'Añade tu Feel Great Link primero.');
    await navigator.clipboard.writeText(settings.feelGreatLink);
    setNotice(lang === 'en' ? 'Link copied.' : 'Enlace copiado.');
  }

  function openFeelGreatLink() {
    if (!settings.feelGreatLink) return setNotice(lang === 'en' ? 'Add your Feel Great Link first.' : 'Añade tu Feel Great Link primero.');
    window.open(settings.feelGreatLink, '_blank', 'noopener,noreferrer');
  }

  async function shareFeelGreatLink() {
    if (!settings.feelGreatLink) return setNotice(lang === 'en' ? 'Add your Feel Great Link first.' : 'Añade tu Feel Great Link primero.');
    if (navigator.share) await navigator.share({ title: 'Feel Great Link', text: settings.feelGreatLink, url: settings.feelGreatLink });
    else await copyFeelGreatLink();
  }

  async function requestReminderNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      setNotice('Este navegador no permite notificaciones locales programadas. Tus tareas seguirán visibles en Tareas.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setNotice(permission === 'granted'
      ? 'Notificaciones activadas. La app intentará avisarte 30 minutos antes mientras esté abierta.'
      : 'Activa las notificaciones para recibir avisos antes de tus mensajes.');
  }

  async function showLocalNotification(title: string, body: string, tag: string) {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (registration?.showNotification) {
        await registration.showNotification(title, { body, tag });
        return;
      }
    }
    new Notification(title, { body, tag });
  }

  async function sendTestNotification() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      setNotice('Este navegador no permite notificaciones locales. Tus tareas seguirán visibles dentro de la app.');
      return;
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== 'granted') {
      setNotice('Permiso de notificaciones no concedido. Los recordatorios seguirán visibles dentro de la app.');
      return;
    }
    await showLocalNotification('Golden Team Connect', 'Notificación de prueba recibida correctamente.', `golden-team-test-${Date.now()}`);
    setNotice('Notificación de prueba enviada si tu navegador la permite.');
  }

  async function createTwoMinuteReminderTest() {
    const due = new Date(Date.now() + 2 * 60 * 1000);
    const dueDate = localDateKey(due);
    const dueTime = due.toTimeString().slice(0, 5);
    const dueAt = `${dueDate}T${dueTime}`;
    const id = await db.tasks.add({
      kind: 'Seguimiento',
      program: 'Prueba de notificaciones',
      title: 'Prueba de notificaciones',
      contactName: 'Golden Team Connect',
      phone: settings.personalNumber || '',
      channel: 'No definido',
      dueDate,
      dueTime,
      dueAt,
      scheduledAt: dueAt,
      message: 'Prueba: enviar mensaje de seguimiento.',
      resolvedMessage: 'Prueba: enviar mensaje de seguimiento.',
      status: 'Pendiente',
      createdAt: todayIso(),
      sourceKey: `notification-test:${Date.now()}`
    });
    setTaskGroup('Hoy');
    setSelectedTaskId(id);
    setActive('tareas');
    await loadAll('Reminder de prueba creado para dentro de 2 minutos.');
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const link = normalizeFeelGreatLink(profileLink);
    if (!profileName.trim()) return setNotice(lang === 'en' ? 'Name is required.' : 'El nombre es obligatorio.');
    if (link && !isValidFeelGreatLink(link)) return setNotice(lang === 'en' ? 'Check your Feel Great Link.' : 'Revisa tu Feel Great Link.');
    await saveSettingsPatch({ ownerName: profileName.trim(), feelGreatLink: link }, lang === 'en' ? 'Profile saved.' : 'Perfil guardado.');
  }

  async function handleProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 700, 0.82);
      await saveSettingsPatch({ profilePhoto: compressed.dataUrl }, lang === 'en' ? 'Photo saved.' : 'Foto guardada.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar la foto.');
    } finally {
      if (event.target) event.target.value = '';
    }
  }

  async function createList(event: FormEvent) {
    event.preventDefault();
    const name = listName.trim();
    if (!name) return setNotice(lang === 'en' ? 'List name is required.' : 'Escribe el nombre de la lista.');
    const id = await db.lists.add({ name, createdAt: todayIso() });
    setListName('');
    setNewListOpen(false);
    setSelectedListId(id);
    await loadAll(lang === 'en' ? 'List created.' : 'Lista creada.');
  }

  async function deleteList(id?: number) {
    if (!id || !confirm(lang === 'en' ? 'Delete this list? Contacts will stay saved.' : '¿Eliminar esta lista? Los contactos permanecerán guardados.')) return;
    await db.transaction('rw', db.lists, db.contacts, async () => {
      await db.lists.delete(id);
      const affected = await db.contacts.where('listIds').equals(id).toArray();
      await Promise.all(affected.map((contact) => db.contacts.update(contact.id!, { listIds: contact.listIds.filter((listId) => listId !== id) })));
    });
    setSelectedListId(null);
    await loadAll(lang === 'en' ? 'List deleted.' : 'Lista eliminada.');
  }

  async function saveBroadcastContact(event: FormEvent) {
    event.preventDefault();
    if (!selectedList?.id) return;
    const preview = normalizePhone(broadcastContact.phone, settings.defaultCountryCode);
    if (!broadcastContact.firstName.trim()) return setNotice(lang === 'en' ? 'Name is required.' : 'Escribe el nombre.');
    if (!preview.valid) return setNotice(preview.message);
    if (isDuplicatePhone(preview.normalized, contacts.map((contact) => contact.phone))) return setNotice(lang === 'en' ? 'That phone already exists.' : 'Ese teléfono ya existe.');
    await db.contacts.add({
      firstName: broadcastContact.firstName.trim(),
      lastName: broadcastContact.lastName.trim(),
      phone: preview.normalized,
      countryCode: settings.defaultCountryCode,
      country: settings.defaultCountry,
      category: 'Prospecto',
      listIds: [selectedList.id],
      tags: [`Idioma:${broadcastContact.language}`],
      language: broadcastContact.language,
      createdAt: todayIso(),
      status: 'Activo',
      preferredChannel: broadcastContact.channel,
      consent: true,
      consentDate: todayIso()
    });
    setBroadcastContact({ firstName: '', lastName: '', phone: '', language: 'Español', channel: 'WhatsApp' });
    await loadAll(lang === 'en' ? 'Contact added.' : 'Contacto añadido.');
  }

  async function importBroadcastCsv() {
    if (!selectedList?.id) return;
    const preview = parseContactsCsv(csvText, contacts.map((contact) => contact.phone), settings.defaultCountryCode);
    if (!preview.valid.length) return setNotice(lang === 'en' ? 'No valid contacts found.' : 'No se encontraron contactos válidos.');
    if (!confirm(`${lang === 'en' ? 'Import' : 'Importar'} ${preview.valid.length}?`)) return;
    await db.contacts.bulkAdd(preview.valid.map((row) => csvRowToContact(row, [selectedList.id!], settings.defaultCountryCode, settings.defaultCountry)));
    setCsvText('');
    await loadAll(`${preview.valid.length} ${lang === 'en' ? 'contacts imported.' : 'contactos importados.'}`);
  }

  async function importBroadcastPaste() {
    if (!selectedList?.id) return;
    const parsed = parsePastedProspects(pasteText, contacts.map((contact) => contact.phone), settings.defaultCountryCode);
    if (!parsed.contacts.length) return setNotice(lang === 'en' ? 'No valid contacts found.' : 'No se encontraron contactos válidos.');
    await db.contacts.bulkAdd(parsed.contacts.map((contact) => ({ ...contact, listIds: [selectedList.id!], tags: withLanguageTag(contact, 'Español'), language: 'Español' as ContactLanguage })));
    setPasteText('');
    await loadAll(`${parsed.contacts.length} ${lang === 'en' ? 'contacts imported.' : 'contactos importados.'}`);
  }

  async function importFromDeviceContacts(target: 'broadcast') {
    const nav = navigator as Navigator & { contacts?: { select: (props: string[], options: { multiple: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>> } };
    if (!nav.contacts?.select) return setNotice(lang === 'en' ? 'Device contact picker is not available here. Use CSV, paste, or manual entry.' : 'La selección de contactos del dispositivo no está disponible aquí. Usa CSV, pegar lista o entrada manual.');
    const picked = await nav.contacts.select(['name', 'tel'], { multiple: true });
    if (!picked.length) return;
    if (target === 'broadcast' && selectedList?.id) {
      const rows: Contact[] = [];
      for (const item of picked) {
        const name = item.name?.[0] || '';
        const phone = normalizePhone(item.tel?.[0] || '', settings.defaultCountryCode);
        if (name && phone.valid && !contacts.some((contact) => contact.phone === phone.normalized)) {
          rows.push({
            firstName: name.split(/\s+/)[0] || name,
            lastName: name.split(/\s+/).slice(1).join(' '),
            phone: phone.normalized,
            countryCode: settings.defaultCountryCode,
            country: settings.defaultCountry,
            category: 'Prospecto',
            listIds: [selectedList.id],
            tags: ['Idioma:Español'],
            language: 'Español',
            createdAt: todayIso(),
            status: 'Activo',
            preferredChannel: 'WhatsApp',
            consent: true,
            consentDate: todayIso()
          });
        }
      }
      if (rows.length) await db.contacts.bulkAdd(rows);
    }
    await loadAll(lang === 'en' ? 'Device contacts reviewed.' : 'Contactos del dispositivo revisados.');
  }

  async function handleMediaFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error(lang === 'en' ? 'Use an image or compatible short video.' : 'Usa una imagen o video corto compatible.');
      if (file.type.startsWith('video/') && file.size > 25_000_000) throw new Error(lang === 'en' ? 'This video is too large for local storage.' : 'Este video es muy grande para guardarlo localmente.');
      const payload = file.type.startsWith('image/') ? await compressImage(file) : { dataUrl: await fileToDataUrl(file), size: file.size };
      await db.mediaAssets.add({
        name: file.name,
        type: file.type,
        dataUrl: payload.dataUrl,
        size: payload.size,
        kind: file.type.startsWith('image/') ? 'image' : 'video',
        createdAt: todayIso()
      });
      await loadAll(lang === 'en' ? 'Media saved.' : 'Media guardada.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el archivo.');
    } finally {
      if (event.target) event.target.value = '';
    }
  }

  async function deleteMedia(id?: number) {
    if (!id || !confirm(lang === 'en' ? 'Delete this media item?' : '¿Eliminar este archivo?')) return;
    await db.mediaAssets.delete(id);
    if (selectedMediaId === id) setSelectedMediaId('');
    await loadAll(lang === 'en' ? 'Media deleted.' : 'Media eliminada.');
  }

  async function openDrivePicker(accessToken: string) {
    if (!window.google?.picker) return setNotice('Google Picker no está listo todavía.');
    const picker = new window.google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(googleApiKey)
      .setAppId(googleAppId)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .addView(new window.google.picker.DocsView().setIncludeFolders(false).setSelectFolderEnabled(false).setMimeTypes('image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm'))
      .setCallback(async (data: any) => {
        if (data.action === window.google.picker.Action.CANCEL) return;
        if (data.action !== window.google.picker.Action.PICKED) return;
        const docs = (data.docs || []) as Array<any>;
        const assets = docs.map((doc) => driveFileToMediaAsset({
          id: doc.id,
          name: doc.name,
          mimeType: doc.mimeType || '',
          thumbnailUrl: doc.thumbnails?.[0]?.url || doc.iconUrl,
          webViewLink: doc.url,
          url: doc.url
        }));
        if (!assets.length) return;
        const existing = new Set((await db.mediaAssets.where('source').equals('google-drive').toArray()).map((asset) => asset.driveFileId));
        const fresh = assets.filter((asset) => asset.driveFileId && !existing.has(asset.driveFileId));
        if (fresh.length) await db.mediaAssets.bulkAdd(fresh);
        await loadAll(`${fresh.length || assets.length} archivo(s) de Drive añadidos.`);
      })
      .build();
    picker.setVisible(true);
  }

  function requestGoogleDriveToken(prompt = '') {
    if (!googleConfigured()) return setNotice(`${c.drivePending}. ${driveConfigMissing(lang)}`);
    if (!googleLibrariesReady || !googleTokenClientRef.current) return setNotice(googleLibrariesError || 'Google Drive todavía está cargando.');
    googleTokenClientRef.current.requestAccessToken(prompt ? { prompt } : undefined);
  }

  function connectGoogleDrive() {
    if (!googleConfigured()) return setNotice(`${c.drivePending}. ${driveConfigMissing(lang)}`);
    requestGoogleDriveToken('consent');
  }

  async function disconnectGoogleDrive() {
    if (!confirm(lang === 'en' ? 'Disconnect Google Drive? Original files will not be deleted.' : '¿Desconectar Google Drive? No se borrarán los archivos originales.')) return;
    clearDriveToken();
    setDriveToken(null);
    await saveSettingsPatch({ googleDriveConnection: 'disconnected', googleDriveAccount: '', googleDriveTokenHint: '' }, lang === 'en' ? 'Drive disconnected.' : 'Drive desconectado.');
  }

  function addFromDrive() {
    if (!googleConfigured()) return setNotice(`${c.drivePending}. ${driveConfigMissing(lang)}`);
    const token = readDriveToken();
    if (!token) {
      clearDriveToken();
      setDriveToken(null);
      requestGoogleDriveToken('');
      return;
    }
    setDriveToken(token);
    void openDrivePicker(token.accessToken);
  }

  function previewBroadcastContacts() {
    if (!selectedList?.id) return [];
    if (audience === 'Manual') return listContacts.filter((contact) => selectedBroadcastContactIds.includes(contact.id || 0));
    return listContacts.filter((contact) => contactLanguage(contact) === audience);
  }

  async function createBroadcastQueue(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedList?.id) return;
    const targetContacts = previewBroadcastContacts();
    if (!targetContacts.length) return setNotice(lang === 'en' ? 'No contacts selected.' : 'No hay contactos seleccionados.');
    const missingMessage = targetContacts.some((contact) => contactLanguage(contact) === 'English' ? !messageEn.trim() : !messageEs.trim());
    if (missingMessage && !selectedMediaId) return setNotice(lang === 'en' ? 'Write a message or select media.' : 'Escribe un mensaje o selecciona media.');
    if (!confirm(`${lang === 'en' ? 'Start queue for' : 'Comenzar envío para'} ${targetContacts.length}?`)) return;
    await db.lists.update(selectedList.id, { lastMessageEs: messageEs, lastMessageEn: messageEn });
    const campaignId = await db.campaigns.add({
      name: `${selectedList.name} ${new Date().toLocaleDateString()}`,
      message: messageEs || messageEn,
      listIds: [selectedList.id],
      contactIds: targetContacts.map((contact) => contact.id!).filter(Boolean),
      channel: broadcastChannel,
      mediaAssetId: selectedMediaId || undefined,
      audienceLanguage: audience,
      createdAt: todayIso()
    });
    const items: QueueItem[] = targetContacts.map((contact) => {
      const language = contactLanguage(contact);
      const baseMessage = language === 'English' ? messageEn : messageEs;
      return {
        campaignId,
        contactId: contact.id!,
        contactSnapshot: contact,
        listNames: [selectedList.name],
        channel: broadcastChannel === 'Ambos' ? contact.preferredChannel : broadcastChannel,
        language,
        mediaAssetId: selectedMediaId || undefined,
        personalizedMessage: personalizeMessage(baseMessage, contact, selectedList.name, messageContext()),
        status: 'Pendiente',
        createdAt: todayIso()
      };
    });
    await db.queue.bulkAdd(items);
    setActiveCampaignId(campaignId);
    setQueueIndex(0);
    await loadAll(lang === 'en' ? 'Queue prepared.' : 'Cola preparada.');
  }

  async function setQueueStatus(item: QueueItem, status: QueueStatus, advance = false) {
    if (!item.id) return;
    await db.queue.update(item.id, {
      status,
      openedAt: status === 'Abierto' ? todayIso() : item.openedAt,
      completedAt: ['Enviado', 'Omitido', 'Fallido'].includes(status) ? todayIso() : item.completedAt
    });
    await loadAll(`${lang === 'en' ? 'Status' : 'Estado'}: ${status}`);
    if (advance) setQueueIndex((index) => Math.min(index + 1, selectedQueue.length - 1));
  }

  async function copyMessage(message: string) {
    await navigator.clipboard.writeText(message);
    setNotice(lang === 'en' ? 'Message copied.' : 'Mensaje copiado.');
  }

  async function shareQueueMedia(item?: QueueItem) {
    const asset = mediaAssets.find((media) => media.id === (item?.mediaAssetId || activeCampaign?.mediaAssetId));
    if (!asset) return setNotice(lang === 'en' ? 'No media selected.' : 'No hay media seleccionada.');
    if (asset.kind === 'image') setNotice(await shareImage(asset.dataUrl, asset.name, asset.type));
    else {
      if (navigator.share) await navigator.share({ title: asset.name, text: asset.name });
      setNotice(lang === 'en' ? 'If the app cannot attach video, share it manually from your files.' : 'Si la app no adjunta el video, compártelo manualmente desde tus archivos.');
    }
  }

  async function openWhatsAppFor(target: QueueItem | FollowUpTask | Contact, message?: string) {
    const phone = 'contactSnapshot' in target ? target.contactSnapshot.phone : target.phone;
    const text = 'personalizedMessage' in target ? target.personalizedMessage : message || ('message' in target ? target.message : '');
    const deepLink = buildWhatsAppDeepLink(phone, text);
    const fallbackLink = buildWhatsAppLink(phone, text);
    if (!online) setNotice(lang === 'en' ? 'WhatsApp may need connection.' : 'WhatsApp puede requerir conexión.');
    window.location.href = deepLink;
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') window.location.href = fallbackLink;
    }, 900);
    if ('kind' in target && target.id && target.id > 0) {
      await db.tasks.update(target.id, { attemptedAt: todayIso(), attemptedChannel: 'WhatsApp' });
      setPendingSendTask({ taskId: target.id, channel: 'WhatsApp' });
    }
    if ('personalizedMessage' in target) await setQueueStatus(target, 'Abierto');
  }

  async function openSmsFor(target: QueueItem | FollowUpTask | Contact, message?: string) {
    const phone = 'contactSnapshot' in target ? target.contactSnapshot.phone : target.phone;
    const text = 'personalizedMessage' in target ? target.personalizedMessage : message || ('message' in target ? target.message : '');
    if ('kind' in target && target.id && target.id > 0) {
      await db.tasks.update(target.id, { attemptedAt: todayIso(), attemptedChannel: 'SMS' });
      setPendingSendTask({ taskId: target.id, channel: 'SMS' });
    }
    window.location.href = buildSmsLink(phone, text);
    if ('personalizedMessage' in target) await setQueueStatus(target, 'Abierto');
  }

  async function saveFollowPerson(event: FormEvent) {
    event.preventDefault();
    const preview = normalizePhone(followForm.phone, settings.defaultCountryCode);
    const referralLink = normalizeFeelGreatLink(followForm.feelGreatReferralLink);
    if (!followForm.firstName.trim()) return setNotice(lang === 'en' ? 'Name is required.' : 'Escribe el nombre.');
    if (!preview.valid) return setNotice(preview.message);
    if (!followForm.startDate) return setNotice(lang === 'en' ? 'Start date is required.' : 'Selecciona la fecha de inicio.');
    if (referralLink && !isValidFeelGreatLink(referralLink)) return setNotice(lang === 'en' ? 'Check the Feel Great Link.' : 'Revisa el enlace personal de Feel Great.');
    if (!referralLink && !confirm(lang === 'en' ? 'This person has no individual Feel Great Link yet. Continue anyway?' : 'Esta persona todavía no tiene enlace individual de Feel Great. ¿Continuar de todos modos?')) return;
    const existing = members.find((member) => member.phone === preview.normalized);
    if (existing?.programStatus === 'Activo' && !confirm(lang === 'en' ? 'This person already has an active program. Restart it?' : 'Esta persona ya tiene un programa activo. ¿Reiniciarlo?')) return;
    const now = new Date();
    const member: Member = {
      ...(existing || {}),
      firstName: followForm.firstName.trim(),
      lastName: followForm.lastName.trim(),
      phone: preview.normalized,
      countryCode: preview.countryCode || settings.defaultCountryCode,
      country: settings.defaultCountry,
      purchaseDate: followForm.startDate,
      protocolStartDate: followForm.startDate,
      feelGreatReferralLink: referralLink,
      preferredChannel: followForm.channel,
      language: followForm.language,
      purchaseType: followForm.purchaseType,
      contactType: followForm.contactType,
      interest: followForm.contactType === 'Distribuidor' || followForm.contactType === 'Ambos' ? 'Interesado en negocio' : 'Solo protocolo',
      programActive: true,
      programStatus: 'Activo',
      timezone: getDeviceTimezone(),
      createdAt: existing?.createdAt || now.toISOString(),
      updatedAt: now.toISOString()
    };
    await db.transaction('rw', [db.members, db.tasks], async () => {
      const id = existing?.id ? (await db.members.put(member), existing.id) : await db.members.add(member);
      const saved = { ...member, id };
      const openExisting = await db.tasks.where('memberId').equals(id).and((task) => task.program === 'Primeros 30 días' && isTaskOpen(task)).toArray();
      if (openExisting.length) await db.tasks.bulkDelete(openExisting.map((task) => task.id!).filter(Boolean));
      const completedDays = new Set((await db.tasks.where('memberId').equals(id).toArray()).filter((task) => task.status === 'Completada').map((task) => task.sequenceDay ?? task.programDay));
      const nextTasks = buildFirst30DayTasks(saved, settings, templates, weeklyEvents, now).filter((task) => !completedDays.has(task.sequenceDay));
      const sourceKeys = new Set((await db.tasks.where('memberId').equals(id).toArray()).map((task) => task.sourceKey).filter(Boolean));
      const missing = nextTasks.filter((task) => !sourceKeys.has(task.sourceKey));
      if (missing.length) await db.tasks.bulkAdd(missing);
    });
    setFollowForm({ firstName: '', lastName: '', phone: '', feelGreatReferralLink: '', language: 'Español', startDate: todayKey(), channel: 'WhatsApp', purchaseType: 'Compra individual', contactType: 'Miembro' });
    await loadAll(lang === 'en' ? 'Follow-up started.' : 'Seguimiento activado.');
  }

  async function regenerateFollowTasks(member: Member) {
    if (!member.id) return;
    const existingCompleted = await db.tasks.where('memberId').equals(member.id).and((task) => task.status === 'Completada').toArray();
    await db.tasks.where('memberId').equals(member.id).and((task) => task.program === 'Primeros 30 días' && isTaskOpen(task)).delete();
    const nextTasks = buildFirst30DayTasks(member, settings, templates, weeklyEvents).filter((task) => !existingCompleted.some((done) => done.sourceKey === task.sourceKey));
    if (nextTasks.length) await db.tasks.bulkAdd(nextTasks);
    await loadAll(lang === 'en' ? 'Tasks regenerated.' : 'Tareas regeneradas.');
  }

  async function completeTask(task: FollowUpTask, channel?: 'WhatsApp' | 'SMS') {
    if (!task.id || task.id < 0) {
      const item = queue.find((candidate) => candidate.id === task.queueItemId);
      if (item) await setQueueStatus(item, 'Enviado');
      return;
    }
    const completedAt = todayIso();
    await db.transaction('rw', [db.tasks, db.members], async () => {
      await db.tasks.update(task.id!, { status: 'Completada', completedAt, sentConfirmedAt: completedAt, completedChannel: channel || task.attemptedChannel });
      if ((task.sequenceDay ?? task.programDay) === 30 && task.memberId) {
        await db.members.update(task.memberId, { programStatus: 'Completado', programActive: false, completedAt, updatedAt: completedAt });
        const remaining = await db.tasks.where('memberId').equals(task.memberId).and((item) => item.id !== task.id && item.program === 'Primeros 30 días' && isTaskOpen(item)).toArray();
        if (remaining.length) await Promise.all(remaining.map((item) => db.tasks.update(item.id!, { status: 'Cancelada' as const })));
      }
    });
    setSelectedTaskId(null);
    setSelectedMemberId(null);
    setPendingSendTask(null);
    setShowSendConfirm(false);
    setActive((task.sequenceDay ?? task.programDay) === 30 ? 'seguimiento' : 'tareas');
    await loadAll(`${lang === 'en' ? 'Day' : 'Mensaje del Día'} ${task.sequenceDay ?? task.programDay ?? ''} ${lang === 'en' ? 'completed.' : 'completado.'}`);
  }

  async function postponeTask(task: FollowUpTask, mode: '30' | 'later' | 'tomorrow' | 'custom') {
    if (!task.id || task.id < 0) return;
    const date = new Date();
    let dueDate = todayKey();
    let dueTime = task.dueTime;
    if (mode === '30') {
      date.setMinutes(date.getMinutes() + 30);
      dueDate = date.toISOString().slice(0, 10);
      dueTime = date.toTimeString().slice(0, 5);
    }
    if (mode === 'later') dueTime = '17:00';
    if (mode === 'tomorrow') {
      const tomorrow = new Date(`${todayKey()}T00:00:00`);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dueDate = tomorrow.toISOString().slice(0, 10);
      dueTime = '10:00';
    }
    if (mode === 'custom') {
      const value = prompt(lang === 'en' ? 'New date and time (YYYY-MM-DD HH:mm)' : 'Nueva fecha y hora (YYYY-MM-DD HH:mm)', `${task.dueDate} ${task.dueTime}`);
      if (!value) return;
      const [customDate, customTime = '10:00'] = value.split(/\s+/);
      dueDate = customDate;
      dueTime = customTime;
    }
    await db.tasks.update(task.id, { dueDate, dueTime, status: 'Pospuesta' });
    await loadAll(lang === 'en' ? 'Task postponed.' : 'Tarea pospuesta.');
  }

  function openTemplateEditor(template?: MessageTemplate) {
    if (!template) {
      setSelectedTemplateId('new');
      setTemplateForm({ name: '', day: 0, defaultTime: '10:00', active: true, includeInNewFollowUps: false });
      setTemplateApplyMode('library');
      setSelectedTemplateMemberIds([]);
      setTemplateDraft('');
      return;
    }
    setSelectedTemplateId(template.id || null);
    setTemplateForm({
      name: template.internalTitle || template.name,
      day: template.day ?? 0,
      defaultTime: template.defaultTime === 'now' ? '10:00' : template.defaultTime || '10:00',
      active: template.active !== false,
      includeInNewFollowUps: template.includeInNewFollowUps === true
    });
    setTemplateApplyMode(template.includeInNewFollowUps ? 'new' : 'library');
    setSelectedTemplateMemberIds([]);
    setTemplateDraft(template.message || template.body);
  }

  function closeTemplateEditor() {
    setSelectedTemplateId(null);
    setTemplateSelectionId(null);
    setSelectedTemplateMemberIds([]);
    setTemplateDraft('');
  }

  function insertTemplateVariable(variable: string) {
    const textarea = templateTextRef.current;
    if (!textarea) {
      setTemplateDraft((current) => `${current}${variable}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${templateDraft.slice(0, start)}${variable}${templateDraft.slice(end)}`;
    setTemplateDraft(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  async function refreshFutureTemplateTasks(template: MessageTemplate, requireConfirmation: boolean) {
    if (!template.id && !template.key) return;
    const related = template.templateType === 'custom'
      ? await db.tasks.where('templateId').equals(template.id || 0).and((task) => isTaskOpen(task)).toArray()
      : await db.tasks.where('templateKey').equals(template.key || '').and((task) => isTaskOpen(task)).toArray();
    if (!related.length) return;
    if (requireConfirmation && !confirm('¿Actualizar recordatorios futuros pendientes relacionados con esta plantilla?')) return;
    const events = await db.weeklyEvents.toArray();
    await Promise.all(related.map(async (task) => {
      if (!task.id || !task.memberId) return;
      const member = await db.members.get(task.memberId);
      if (!member) return;
      const nextTask = buildTaskFromTemplate(member, template, settings, events, new Date());
      const meetingSnapshot = nextTask?.meetingSnapshot || task.meetingSnapshot;
      const resolvedMessage = cleanUnresolvedMessage(resolveFollowUpMessage(template, member, settings, meetingSnapshot));
      const nextDueIsPast = nextTask?.dueAt ? new Date(nextTask.dueAt).getTime() <= Date.now() : true;
      await db.tasks.update(task.id, {
        title: template.internalTitle || template.name,
        message: resolvedMessage,
        resolvedMessage,
        templateVersion: template.templateVersion,
        meetingSnapshot,
        meetingLink: meetingSnapshot?.link,
        meetingId: meetingSnapshot?.id,
        ...(template.templateType === 'custom' && nextTask && !nextDueIsPast ? { dueDate: nextTask.dueDate, dueTime: nextTask.dueTime, dueAt: nextTask.dueAt, scheduledAt: nextTask.dueAt, sequenceDay: nextTask.sequenceDay, programDay: nextTask.programDay } : {})
      });
    }));
  }

  async function saveTemplateForm(event?: FormEvent) {
    event?.preventDefault();
    const existing = typeof selectedTemplateId === 'number' ? templates.find((template) => template.id === selectedTemplateId) : undefined;
    const isNew = selectedTemplateId === 'new';
    const isBase = Boolean(existing && existing.templateType !== 'custom');
    if (!templateForm.name.trim()) return setNotice('Escribe el nombre de la plantilla.');
    if (templateForm.day < 0 || templateForm.day > 30) return setNotice('Selecciona un día entre 0 y 30.');
    if (!templateDraft.trim()) return setNotice('Escribe el mensaje de la plantilla.');
    const now = todayIso();
    const includeInNewFollowUps = isBase ? true : templateApplyMode === 'new' || templateForm.includeInNewFollowUps;
    const payload: MessageTemplate = {
      ...(existing || {}),
      key: existing?.key || `custom-${Date.now()}`,
      name: templateForm.name.trim(),
      internalTitle: templateForm.name.trim(),
      day: templateForm.day,
      defaultTime: isBase && existing?.defaultTime === 'now' ? 'now' : templateForm.defaultTime,
      body: templateDraft,
      message: templateDraft,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      templateVersion: (existing?.templateVersion || 0) + 1,
      templateType: isBase ? 'base' : 'custom',
      active: isBase ? true : templateForm.active,
      includeInNewFollowUps,
      originalMessage: existing?.originalMessage,
      availableVariables: existing?.availableVariables || ['{{firstName}}', '{{feelGreatReferralLink}}', '{{meetingName}}', '{{meetingDateTime}}', '{{meetingLink}}', '{{appStoreLink}}', '{{googlePlayLink}}']
    };
    const savedId = await db.templates.put(payload);
    const saved = { ...payload, id: typeof savedId === 'number' ? savedId : existing?.id };
    await refreshFutureTemplateTasks(saved, !isBase && !isNew);
    if (!isBase && templateApplyMode === 'selected' && saved.id) {
      setTemplateSelectionId(saved.id);
      setSelectedTemplateMemberIds([]);
      await loadAll(isNew ? 'Plantilla creada.' : 'Plantilla actualizada.');
      return;
    }
    closeTemplateEditor();
    await loadAll(isNew ? 'Plantilla creada.' : 'Plantilla actualizada.');
  }

  async function addTemplateToSelectedMembers() {
    if (!templateSelectionId) return;
    const template = await db.templates.get(templateSelectionId);
    if (!template) return setNotice('No se encontró la plantilla.');
    if (!selectedTemplateMemberIds.length) return setNotice('Selecciona al menos una persona.');
    const selectedMembers = activeSelectableMembers.filter((member) => member.id && selectedTemplateMemberIds.includes(member.id));
    let added = 0;
    let skipped = 0;
    await db.transaction('rw', [db.tasks], async () => {
      for (const member of selectedMembers) {
        const task = buildTaskFromTemplate(member, template, settings, weeklyEvents, new Date(), { skipPast: true });
        if (!task?.sourceKey) {
          skipped += 1;
          continue;
        }
        const duplicate = await db.tasks.where('sourceKey').equals(task.sourceKey).first();
        if (duplicate) {
          skipped += 1;
          continue;
        }
        await db.tasks.add(task);
        added += 1;
      }
    });
    const message = `Plantilla añadida a ${added} personas. ${skipped} personas fueron omitidas porque ese día ya pasó o ya existía.`;
    closeTemplateEditor();
    await loadAll(message);
  }

  async function deleteCustomTemplate(template: MessageTemplate) {
    if (!template.id || template.templateType !== 'custom') return;
    if (!confirm('¿Eliminar esta plantilla?\n\nSe eliminará de la biblioteca y se cancelarán sus recordatorios futuros pendientes. Los mensajes ya completados permanecerán en el historial.')) return;
    const now = Date.now();
    await db.transaction('rw', [db.templates, db.tasks], async () => {
      await db.templates.delete(template.id!);
      const related = await db.tasks.where('templateId').equals(template.id!).and((task) => isTaskOpen(task) && new Date(task.dueAt || buildLocalDueAt(task.dueDate, task.dueTime)).getTime() >= now).toArray();
      await Promise.all(related.map((task) => task.id ? db.tasks.update(task.id, { status: 'Cancelada' }) : Promise.resolve()));
    });
    closeTemplateEditor();
    await loadAll('Plantilla eliminada.');
  }

  async function restoreTemplate(template: MessageTemplate) {
    setTemplateDraft(template.originalMessage || template.body);
  }

  function openMeetingEditor(event?: WeeklyEvent) {
    if (!event) {
      setSelectedMeetingId('new');
      setMeetingForm({ name: '', weekday: 1, eventTime: '19:00', link: '', audience: 'Miembros y distribuidores', active: true });
      return;
    }
    setSelectedMeetingId(event.id || null);
    setMeetingForm({ name: event.name, weekday: event.weekday, eventTime: event.eventTime, link: event.link, audience: event.audience || '', active: event.active });
  }

  async function saveMeeting(event: FormEvent) {
    event.preventDefault();
    if (!meetingForm.name.trim()) return setNotice('Escribe el nombre de la reunión.');
    const payload: WeeklyEvent = {
      id: typeof selectedMeetingId === 'number' ? selectedMeetingId : undefined,
      name: meetingForm.name.trim(),
      weekday: Number(meetingForm.weekday),
      eventTime: meetingForm.eventTime,
      reminderTime: meetingForm.eventTime,
      link: meetingForm.link.trim(),
      audience: meetingForm.audience.trim(),
      message: '',
      active: meetingForm.active,
      updatedAt: todayIso()
    };
    await db.weeklyEvents.put(payload);
    setSelectedMeetingId(null);
    await loadAll(lang === 'en' ? 'Meeting saved.' : 'Reunión guardada.');
  }

  async function toggleMemberStatus(member: Member, status: Member['programStatus']) {
    if (!member.id) return;
    if (member.programStatus === 'Pausado' && status === 'Activo' && !confirm('¿Reanudar manteniendo las fechas originales?')) return;
    await db.members.update(member.id, { programStatus: status, programActive: status === 'Activo', updatedAt: todayIso() });
    await loadAll(status === 'Pausado' ? 'Seguimiento pausado.' : 'Seguimiento reanudado.');
  }

  function listStats(list: InternalList) {
    const people = contacts.filter((contact) => contact.listIds.includes(list.id!));
    const es = people.filter((contact) => contactLanguage(contact) === 'Español').length;
    const en = people.filter((contact) => contactLanguage(contact) === 'English').length;
    const pending = queue.filter((item) => item.listNames.includes(list.name) && ['Pendiente', 'Abierto'].includes(item.status)).length;
    const lastSent = queue.filter((item) => item.listNames.includes(list.name) && item.completedAt).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))[0];
    return { total: people.length, es, en, pending, lastSent: lastSent?.completedAt };
  }

  function queueProgress() {
    const total = selectedQueue.length;
    const done = selectedQueue.filter((item) => ['Enviado', 'Omitido', 'Fallido'].includes(item.status)).length;
    const pending = selectedQueue.filter((item) => ['Pendiente', 'Abierto'].includes(item.status)).length;
    return { total, done, pending };
  }

  const navItems: Array<{ id: MainSection; icon: ReactNode; label: string }> = [
    { id: 'inicio', icon: <Home size={20} />, label: c.nav.inicio },
    { id: 'seguimiento', icon: <Users size={20} />, label: c.nav.seguimiento },
    { id: 'tareas', icon: <Bell size={20} />, label: c.nav.tareas }
  ];

  const renderEntry = () => (
    <div className="theme-golden min-h-screen min-h-[100svh] min-h-[100dvh] bg-[#000000] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] text-white">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] min-h-[calc(100svh-2.5rem)] min-h-[calc(100dvh-2.5rem)] max-w-md flex-col justify-center bg-[#000000]">
        <div className="mb-6 text-center">
          <img src={entryLogoSrc} alt="Golden Team" className="mx-auto mb-5 h-auto w-[82vw] max-w-[20rem] object-contain sm:max-w-[22rem]" />
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.24em] text-gold/90">Acceso interno del equipo</p>
          <h1 className="mt-2.5 text-[2rem] font-black leading-tight tracking-normal sm:text-[2.15rem]">Golden Team Connect</h1>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-white/72">Organiza. Da seguimiento. Mantente conectado.</p>
        </div>
        <form className="grid gap-3.5" onSubmit={submitEntry}>
          <Field label="Nombre"><input className="input border-white/12 bg-white/[0.97] text-black shadow-none" value={entryName} onChange={(event) => setEntryName(event.target.value)} placeholder="Ayhann" /></Field>
          <Field label="Feel Great Link"><input className="input border-white/12 bg-white/[0.97] text-black shadow-none" value={entryLink} onChange={(event) => setEntryLink(event.target.value)} placeholder="https://..." /></Field>
          <Field label="Código de acceso" helper="Ingresa el código proporcionado por Golden Team.">
            <div className="flex min-w-0 gap-2">
              <input className="input min-w-0 border-white/12 bg-white/[0.97] text-black shadow-none" type={showAccessCode ? 'text' : 'password'} value={entryAccessCode} onChange={(event) => setEntryAccessCode(normalizeAccessCode(event.target.value))} placeholder="Código de acceso" autoCapitalize="characters" spellCheck={false} />
              <IconButton label={showAccessCode ? 'Ocultar código de acceso' : 'Mostrar código de acceso'} onClick={() => setShowAccessCode((current) => !current)} className="shrink-0">{showAccessCode ? <EyeOff /> : <Eye />}</IconButton>
            </div>
          </Field>
          {entryError ? <p className="rounded-2xl border border-red-400/40 bg-red-500/15 p-3 text-sm font-bold text-red-100">{entryError}</p> : null}
          <PrimaryButton type="submit" className="mt-1 bg-gold text-black shadow-none hover:bg-goldDark"><Check size={18} />Entrar</PrimaryButton>
          <p className="text-center text-xs leading-relaxed text-white/45">Esta es una puerta de acceso simple local, no autenticación profesional. No usa backend.</p>
        </form>
      </div>
    </div>
  );

  const renderHome = () => {
    const nextFollowTask = [...overdueTasks, ...todayTasks, ...upcomingTasks].find((task) => taskType(task) === 'Seguimiento');
    const quickLinks = [
      { name: 'Office', url: officeUrl, icon: <Power size={19} /> },
      { name: 'Library', url: unicityLibraryUrl, icon: <FileText size={19} /> },
      { name: 'Productos', url: productsUrl, icon: <Package size={19} /> },
      { name: 'Paylution', url: paylutionUrl, icon: <CreditCard size={19} /> }
    ];
    return (
    <div className="grid gap-4">
      <button onClick={() => setAccountOpen(true)} className="-mx-4 min-w-0 rounded-b-[2rem] bg-brand px-4 pb-7 text-left text-white shadow-soft sm:-mx-6 sm:px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}>
        <div className="flex min-w-0 items-center gap-4">
          {settings.profilePhoto ? <img src={settings.profilePhoto} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/20" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/10 text-xl font-black ring-2 ring-white/20">{initials(displayName(settings))}</div>}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black tracking-normal">{c.homeTitle}, {firstName(settings)}</h1>
            <p className="mt-1 text-sm font-semibold text-white/65">{lang === 'en' ? 'Tap to open account' : 'Toca para abrir Cuenta'}</p>
          </div>
          <ChevronRight className="shrink-0 text-white/70" />
        </div>
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><p className="text-xs font-bold text-slate-500">{c.followUps}</p><strong className="text-3xl text-ink">{activeFollowPeople.length}</strong><p className="text-sm text-slate-500">{lang === 'en' ? 'active' : 'activos'}</p></Card>
        <Card><p className="text-xs font-bold text-slate-500">{c.tasks}</p><strong className="text-3xl text-ink">{taskBadge}</strong><p className="text-sm text-slate-500">{lang === 'en' ? 'today + overdue' : 'hoy + vencidas'}</p></Card>
      </div>
      <Card>
        <h2 className="text-lg font-black text-ink">{lang === 'en' ? 'Next follow-up' : 'Próximo seguimiento'}</h2>
        <div className="mt-3 grid gap-2">
          {nextFollowTask ? (
            <button onClick={() => { setSelectedTaskId(nextFollowTask.id || null); setActive('tareas'); }} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-left">
              <span className="min-w-0"><strong className="block truncate text-sm text-ink">{nextFollowTask.contactName}</strong><span className="block truncate text-xs text-slate-500">Día {nextFollowTask.sequenceDay ?? nextFollowTask.programDay ?? '-'} · {nextFollowTask.title} · {shortDate(nextFollowTask.dueDate, lang)} {nextFollowTask.dueTime}</span></span>
              <Badge tone={nextFollowTask.dueDate < todayKey() ? 'bad' : 'warn'}>{nextFollowTask.dueDate < todayKey() ? 'Vencido' : nextFollowTask.dueDate === todayKey() ? 'Hoy' : 'Próximo'}</Badge>
            </button>
          ) : <p className="text-sm text-slate-500">{lang === 'en' ? 'No active follow-ups right now.' : 'No hay seguimientos activos ahora.'}</p>}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-black text-ink">Accesos rápidos</h2>
        <div className="mt-3 grid gap-2">
          {quickLinks.map((item) => (
            <button key={item.name} onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} className="flex min-h-[60px] w-full min-w-0 items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">{item.icon}</span>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-ink">{item.name}</strong><span className="block truncate text-xs text-slate-500">{readableUrl(item.url)}</span></span>
              <ExternalLink size={17} className="shrink-0 text-slate-400" />
            </button>
          ))}
          <div className="flex min-h-[60px] min-w-0 items-center gap-2 rounded-2xl bg-[#f6f0dc] p-3 ring-1 ring-[#e4d39a]">
            <button onClick={openFeelGreatLink} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-brand shadow-sm"><Link2 size={19} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-ink">Mi Feel Great Link</strong><span className="block truncate text-xs text-slate-500">{settings.feelGreatLink ? readableUrl(settings.feelGreatLink) : 'Sin configurar'}</span></span>
            </button>
            <IconButton label="Copiar Feel Great Link" onClick={copyFeelGreatLink} className="shrink-0 bg-white"><Copy size={17} /></IconButton>
          </div>
        </div>
      </Card>
    </div>
    );
  };

  const renderTemplateRow = (template: MessageTemplate) => (
    <button key={template.id || template.key} onClick={() => openTemplateEditor(template)} className="flex min-h-[76px] w-full min-w-0 items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-slate-50">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-sm font-black text-brand">D{template.day ?? 0}</span>
      <span className="min-w-0 flex-1">
        <strong className="block whitespace-normal break-words text-sm leading-tight text-ink">{template.internalTitle || template.name}</strong>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>{templateDisplayTime(template, lang)}</span>
          <Badge tone={template.templateType === 'custom' ? 'accent' : 'warn'}>{template.templateType === 'custom' ? 'Personalizada' : 'Base'}</Badge>
          {template.templateType === 'custom' ? <Badge tone={template.active === false ? 'warn' : 'good'}>{template.active === false ? 'Inactiva' : 'Activa'}</Badge> : null}
        </span>
      </span>
      <ChevronRight className="shrink-0 text-slate-400" />
    </button>
  );

  const renderTemplateSelection = () => {
    const allSelected = activeSelectableMembers.length > 0 && activeSelectableMembers.every((member) => member.id && selectedTemplateMemberIds.includes(member.id));
    return (
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-ink">Seleccionar personas</h2>
            <p className="text-sm text-slate-500">Solo seguimientos activos dentro de sus primeros 30 días.</p>
          </div>
          <IconButton label="Cerrar" onClick={() => setTemplateSelectionId(null)}><X /></IconButton>
        </div>
        {activeSelectableMembers.length ? (
          <div className="grid gap-2">
            <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-black text-ink">
              <input type="checkbox" checked={allSelected} onChange={(event) => setSelectedTemplateMemberIds(event.target.checked ? activeSelectableMembers.map((member) => member.id!).filter(Boolean) : [])} />
              Seleccionar todas
            </label>
            {activeSelectableMembers.map((member) => {
              const day = currentProgramDay(member.protocolStartDate) ?? 0;
              return (
                <label key={member.id} className="flex min-h-[72px] min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <input type="checkbox" checked={Boolean(member.id && selectedTemplateMemberIds.includes(member.id))} onChange={(event) => setSelectedTemplateMemberIds((current) => event.target.checked ? [...new Set([...current, member.id!])] : current.filter((id) => id !== member.id))} />
                  <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{memberName(member)}</strong><span className="text-xs text-slate-500">Día {Math.min(day, 30)} · Inicio {shortDate(member.protocolStartDate || '', lang)}</span></span>
                </label>
              );
            })}
            <PrimaryButton onClick={addTemplateToSelectedMembers}><Plus size={17} />Añadir mensaje a seleccionados</PrimaryButton>
          </div>
        ) : <p className="text-sm text-slate-500">No hay personas activas dentro de sus primeros 30 días.</p>}
      </Card>
    );
  };

  const renderTemplateEditor = () => {
    const template = typeof selectedTemplateId === 'number' ? templates.find((item) => item.id === selectedTemplateId) : undefined;
    const isNew = selectedTemplateId === 'new';
    const isBase = Boolean(template && template.templateType !== 'custom');
    if (templateSelectionId) return renderTemplateSelection();
    return (
      <Card>
        <form className="grid gap-4" onSubmit={saveTemplateForm}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-ink">{isNew ? 'Nueva plantilla' : (template?.internalTitle || template?.name || 'Plantilla')}</h2>
              <p className="text-sm text-slate-500">{isBase ? 'Plantilla base' : 'Plantilla personalizada'}</p>
            </div>
            <IconButton label="Cerrar" onClick={closeTemplateEditor}><X /></IconButton>
          </div>
          <Field label="Nombre de la plantilla"><input className="input" value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Día dentro del programa">
              <select className="input" value={templateForm.day} disabled={isBase} onChange={(event) => setTemplateForm((current) => ({ ...current, day: Number(event.target.value) }))}>
                {Array.from({ length: 31 }, (_, day) => <option key={day} value={day}>Día {day}</option>)}
              </select>
            </Field>
            <Field label="Hora"><input className="input" type="time" value={templateForm.defaultTime} onChange={(event) => setTemplateForm((current) => ({ ...current, defaultTime: event.target.value }))} /></Field>
          </div>
          {!isBase ? (
            <div className="grid gap-2">
              <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={templateForm.active} onChange={(event) => setTemplateForm((current) => ({ ...current, active: event.target.checked }))} />Activa</label>
              <Field label="Aplicación de la plantilla">
                <select className="input" value={templateApplyMode} onChange={(event) => setTemplateApplyMode(event.target.value as 'library' | 'new' | 'selected')}>
                  <option value="library">Guardar solamente como plantilla</option>
                  <option value="new">Añadir a todos los seguimientos nuevos</option>
                  <option value="selected">Añadir a seguimientos activos seleccionados</option>
                </select>
              </Field>
            </div>
          ) : null}
          <Field label="Mensaje">
            <textarea ref={templateTextRef} className="input min-h-80" value={templateDraft} onChange={(event) => setTemplateDraft(event.target.value)} />
          </Field>
          <div className="grid gap-2 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-black uppercase text-slate-500">Insertar variable</p>
            <div className="flex flex-wrap gap-2">
              {['{{firstName}}', '{{feelGreatReferralLink}}', '{{meetingName}}', '{{meetingDateTime}}', '{{meetingLink}}', '{{appStoreLink}}', '{{googlePlayLink}}'].map((variable) => (
                <SecondaryButton key={variable} onClick={() => insertTemplateVariable(variable)} className="min-h-10 px-3 py-2 text-xs">{variable}</SecondaryButton>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <PrimaryButton type="submit"><Check size={16} />{isNew ? 'Guardar plantilla' : 'Guardar cambios'}</PrimaryButton>
            <SecondaryButton onClick={closeTemplateEditor}><X size={16} />Cancelar</SecondaryButton>
            {isBase && template ? <SecondaryButton onClick={() => restoreTemplate(template)}><Bell size={16} />Restaurar original</SecondaryButton> : null}
            {!isNew && !isBase && template ? <SecondaryButton onClick={() => deleteCustomTemplate(template)} className="text-red-700"><Trash2 size={16} />Eliminar plantilla</SecondaryButton> : null}
          </div>
        </form>
      </Card>
    );
  };

  const renderAccount = () => (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-soft pb-6">
      <div className="mx-auto grid max-w-2xl gap-4 px-4 sm:px-6">
        <Header
          title={accountPanel ? (accountPanel === 'profile' ? c.profileInfo : accountPanel === 'link' ? c.linkCenter : accountPanel === 'templates' ? 'Plantillas de mensajes' : accountPanel === 'system' ? 'Sistema y reuniones' : c.language) : c.account}
          subtitle={accountPanel ? displayName(settings) : ''}
          action={settings.profilePhoto ? <img src={settings.profilePhoto} className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/20" alt="" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10 text-xl font-black ring-2 ring-white/20">{initials(displayName(settings))}</div>}
        >
          <button onClick={() => accountPanel ? (closeTemplateEditor(), setAccountPanel(null)) : setAccountOpen(false)} className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-black text-white"><ChevronLeft size={18} />{accountPanel ? c.account : (lang === 'en' ? 'Back' : 'Atrás')}</button>
        </Header>
        {!accountPanel ? (
          <Card className="p-2">
            {[
              { id: 'profile' as const, icon: <Camera size={20} />, title: c.profileInfo, value: displayName(settings) },
              { id: 'link' as const, icon: <Link2 size={20} />, title: c.linkCenter, value: settings.feelGreatLink ? readableUrl(settings.feelGreatLink) : (lang === 'en' ? 'Not set' : 'Sin configurar') },
              { id: 'templates' as const, icon: <MessageCircle size={20} />, title: 'Plantillas de mensajes', value: `${baseTemplates.length} base · ${customTemplates.length} personalizadas` },
              { id: 'system' as const, icon: <Bell size={20} />, title: 'Sistema y reuniones', value: `${weeklyEvents.length} reuniones` },
              { id: 'language' as const, icon: <GlobeIcon />, title: c.language, value: lang === 'en' ? 'English' : 'Español' }
            ].map((row) => (
              <button key={row.id} onClick={() => setAccountPanel(row.id)} className="flex min-h-[72px] w-full min-w-0 items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-slate-50">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-brand">{row.icon}</span>
                <span className="min-w-0 flex-1"><strong className="block text-base text-ink">{row.title}</strong><span className="block truncate text-sm text-slate-500">{row.value}</span></span>
                <ChevronRight className="shrink-0 text-slate-400" />
              </button>
            ))}
            <button onClick={closeSession} className="flex min-h-[72px] w-full min-w-0 items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-slate-50">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-brand"><LogOut size={20} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-base text-ink">{c.logout}</strong><span className="block truncate text-sm text-slate-500">{lang === 'en' ? 'Keeps all local data' : 'Conserva todos los datos locales'}</span></span>
              <ChevronRight className="shrink-0 text-slate-400" />
            </button>
          </Card>
        ) : null}
        {accountPanel === 'profile' ? (
          <Card>
            <form className="grid gap-4" onSubmit={saveProfile}>
              <div className="grid place-items-center gap-3">
                {settings.profilePhoto ? <img src={settings.profilePhoto} className="h-24 w-24 rounded-full object-cover" alt="" /> : <div className="grid h-24 w-24 place-items-center rounded-full bg-brand text-3xl font-black text-white">{initials(displayName(settings))}</div>}
                <input ref={photoInputRef} className="hidden" type="file" accept="image/*" onChange={handleProfilePhoto} />
                <div className="flex flex-wrap justify-center gap-2">
                  <SecondaryButton onClick={() => photoInputRef.current?.click()}><Camera size={16} />{settings.profilePhoto ? (lang === 'en' ? 'Change photo' : 'Cambiar foto') : (lang === 'en' ? 'Add photo' : 'Añadir foto')}</SecondaryButton>
                  {settings.profilePhoto ? <SecondaryButton onClick={() => saveSettingsPatch({ profilePhoto: '' }, lang === 'en' ? 'Photo removed.' : 'Foto eliminada.')}><Trash2 size={16} />{lang === 'en' ? 'Remove photo' : 'Eliminar foto'}</SecondaryButton> : null}
                </div>
              </div>
              <Field label={c.name}><input className="input" value={profileName} onChange={(event) => setProfileName(event.target.value)} /></Field>
              <PrimaryButton type="submit"><Check size={16} />{c.save}</PrimaryButton>
            </form>
          </Card>
        ) : null}
        {accountPanel === 'link' ? (
          <Card>
            <form className="grid gap-4" onSubmit={saveProfile}>
              <div className="rounded-[1.4rem] bg-[#f6f0dc] p-4 ring-1 ring-[#e4d39a]">
                <h2 className="text-lg font-black text-ink">Mi Feel Great Link</h2>
                <p className="mt-1 text-sm text-slate-600">Comparte tu enlace y facilita el acceso a tus clientes.</p>
                <Field label="Feel Great Link"><input className="input mt-3 bg-white" value={profileLink} onChange={(event) => setProfileLink(event.target.value)} /></Field>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <PrimaryButton type="submit"><Check size={16} />{c.save}</PrimaryButton>
                  <SecondaryButton onClick={copyFeelGreatLink}><Copy size={16} />{c.copy}</SecondaryButton>
                  <SecondaryButton onClick={shareFeelGreatLink}><Share2 size={16} />{c.share}</SecondaryButton>
                  <SecondaryButton onClick={openFeelGreatLink}><ExternalLink size={16} />{c.open}</SecondaryButton>
                </div>
              </div>
              <div className="grid gap-2">
                {[
                  { name: 'Office', url: officeUrl, icon: <Power size={18} /> },
                  { name: 'Library', url: unicityLibraryUrl, icon: <FileText size={18} /> },
                  { name: 'Productos', url: productsUrl, icon: <Package size={18} /> },
                  { name: 'Paylution', url: paylutionUrl, icon: <CreditCard size={18} /> }
                ].map((item) => (
                  <button key={item.name} type="button" onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} className="flex min-h-[60px] w-full min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-slate-100">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-brand shadow-sm">{item.icon}</span>
                    <span className="min-w-0 flex-1"><strong className="block text-sm text-ink">{item.name}</strong><span className="block truncate text-xs text-slate-500">{item.url}</span></span>
                    <ExternalLink size={17} className="shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            </form>
          </Card>
        ) : null}
        {accountPanel === 'templates' ? (
          <div className="grid gap-3">
            {selectedTemplateId || templateSelectionId ? renderTemplateEditor() : (
              <>
            <Card>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="App Store Link"><input className="input" value={settings.appStoreLink || 'https://apps.apple.com/app/id6445913865'} onChange={(event) => saveSettingsPatch({ appStoreLink: event.target.value }, 'Link actualizado.')} placeholder="https://apps.apple.com/app/id6445913865" /></Field>
                <Field label="Google Play Link"><input className="input" value={settings.googlePlayLink || ''} onChange={(event) => saveSettingsPatch({ googlePlayLink: event.target.value }, 'Link actualizado.')} placeholder="Pendiente" /></Field>
              </div>
              {(!settings.appStoreLink || !settings.googlePlayLink) ? <p className="mt-3 text-sm text-amber-700">Faltan enlaces oficiales de la aplicación. Las líneas vacías se eliminarán del mensaje enviado.</p> : null}
            </Card>
            <Card className="p-2">
              <div className="px-2 pb-2 pt-1"><h2 className="text-lg font-black text-ink">Programa base de 30 días</h2></div>
              {baseTemplates.map((template) => renderTemplateRow(template))}
            </Card>
            <PrimaryButton onClick={() => openTemplateEditor()} className="w-full"><Plus size={17} />Crear nueva plantilla</PrimaryButton>
            {customTemplates.length ? (
              <Card className="p-2">
                <div className="px-2 pb-2 pt-1"><h2 className="text-lg font-black text-ink">Plantillas personalizadas</h2></div>
                {customTemplates.map((template) => renderTemplateRow(template))}
              </Card>
            ) : null}
              </>
            )}
          </div>
        ) : null}
        {accountPanel === 'system' ? (
          <div className="grid gap-3">
            <Card className="p-2">
              {weeklyEvents.map((event) => (
                <button key={event.id || event.name} onClick={() => openMeetingEditor(event)} className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl px-3 text-left hover:bg-slate-50">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-black ${event.active ? 'bg-slate-100 text-brand' : 'bg-slate-100 text-slate-400'}`}>{event.weekday}</span>
                  <span className="min-w-0 flex-1"><strong className="block text-sm text-ink">{event.name}</strong><span className="block truncate text-xs text-slate-500">{event.eventTime} · {event.audience || 'Audiencia sin definir'}</span></span>
                  <ChevronRight className="shrink-0 text-slate-400" />
                </button>
              ))}
              <PrimaryButton onClick={() => openMeetingEditor()} className="mt-3 w-full"><Plus size={16} />Añadir reunión</PrimaryButton>
            </Card>
            {selectedMeetingId ? (
              <Card>
                <form className="grid gap-3" onSubmit={saveMeeting}>
                  <Field label="Nombre"><input className="input" value={meetingForm.name} onChange={(event) => setMeetingForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Día"><select className="input" value={meetingForm.weekday} onChange={(event) => setMeetingForm((current) => ({ ...current, weekday: Number(event.target.value) }))}><option value={1}>Lunes</option><option value={2}>Martes</option><option value={3}>Miércoles</option><option value={4}>Jueves</option><option value={5}>Viernes</option><option value={6}>Sábado</option><option value={0}>Domingo</option></select></Field>
                    <Field label="Hora"><input className="input" type="time" value={meetingForm.eventTime} onChange={(event) => setMeetingForm((current) => ({ ...current, eventTime: event.target.value }))} /></Field>
                  </div>
                  <Field label="Enlace"><input className="input" value={meetingForm.link} onChange={(event) => setMeetingForm((current) => ({ ...current, link: event.target.value }))} /></Field>
                  <Field label="Audiencia"><input className="input" value={meetingForm.audience} onChange={(event) => setMeetingForm((current) => ({ ...current, audience: event.target.value }))} /></Field>
                  <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={meetingForm.active} onChange={(event) => setMeetingForm((current) => ({ ...current, active: event.target.checked }))} />Activa</label>
                  <div className="grid grid-cols-2 gap-2"><PrimaryButton type="submit"><Check size={16} />Guardar</PrimaryButton><SecondaryButton onClick={() => setSelectedMeetingId(null)}><X size={16} />Cancelar</SecondaryButton></div>
                </form>
              </Card>
            ) : null}
          </div>
        ) : null}
        {accountPanel === 'language' ? (
          <Card>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => saveSettingsPatch({ preferredLanguage: 'es' }, 'Idioma actualizado.')} className={`rounded-2xl p-4 text-sm font-black ${lang === 'es' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>Español</button>
              <button onClick={() => saveSettingsPatch({ preferredLanguage: 'en' }, 'Language updated.')} className={`rounded-2xl p-4 text-sm font-black ${lang === 'en' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>English</button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );

  const renderBroadcast = () => {
    if (selectedList) return renderBroadcastList();
    return (
      <div className="grid gap-4">
        <Header title={c.broadcast} subtitle={c.broadcastSub}>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-brandDark/60 p-1">
            <button onClick={() => setBroadcastTab('lists')} className={`min-h-11 rounded-xl text-sm font-black ${broadcastTab === 'lists' ? 'bg-white text-brand' : 'text-white/80'}`}>{c.lists}</button>
            <button onClick={() => setBroadcastTab('library')} className={`min-h-11 rounded-xl text-sm font-black ${broadcastTab === 'library' ? 'bg-white text-brand' : 'text-white/80'}`}>{c.library}</button>
          </div>
        </Header>
        {broadcastTab === 'lists' ? (
          <>
            <div className="flex justify-end">
              <PrimaryButton onClick={() => setNewListOpen(true)}><Plus size={17} />{c.newList}</PrimaryButton>
            </div>
            <div className="grid gap-3">
              {lists.map((list) => {
                const stats = listStats(list);
                return (
                  <button key={list.id} onClick={() => { setSelectedListId(list.id!); setMessageEs(list.lastMessageEs || ''); setMessageEn(list.lastMessageEn || ''); }} className="min-w-0 rounded-[1.4rem] border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-black text-ink">{list.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">{stats.total} contactos · {stats.es} Español · {stats.en} English</p>
                      </div>
                      {stats.pending ? <Badge tone="warn">{stats.pending} pendientes</Badge> : <Badge>{stats.lastSent ? shortDate(stats.lastSent, lang) : (lang === 'en' ? 'No send' : 'Sin envío')}</Badge>}
                    </div>
                  </button>
                );
              })}
              {!lists.length ? <Card><p className="text-sm text-slate-500">{lang === 'en' ? 'You do not have any lists yet.' : 'Todavía no tienes listas.'}</p></Card> : null}
            </div>
          </>
        ) : renderMediaLibrary()}
        {newListOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center">
            <Card className="w-full max-w-md">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-ink">{c.newList}</h2>
                <IconButton label="Cerrar" onClick={() => setNewListOpen(false)}><X /></IconButton>
              </div>
              <form className="grid gap-3" onSubmit={createList}>
                <Field label={lang === 'en' ? 'List name' : 'Nombre de la lista'}><input className="input" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="LA Fitness" /></Field>
                <PrimaryButton type="submit"><Plus size={17} />{c.newList}</PrimaryButton>
              </form>
            </Card>
          </div>
        ) : null}
      </div>
    );
  };

  const renderBroadcastList = () => {
    const stats = listStats(selectedList!);
    const previewContacts = previewBroadcastContacts();
    const previewContact = previewContacts[0];
    const previewMessage = previewContact ? personalizeMessage(contactLanguage(previewContact) === 'English' ? messageEn : messageEs, previewContact, selectedList!.name, messageContext()) : '';
    return (
      <div className="grid gap-4">
        <button onClick={() => setSelectedListId(null)} className="inline-flex w-fit items-center gap-2 text-sm font-black text-brand"><ChevronLeft size={18} />{c.broadcast}</button>
        <Header title={selectedList!.name} subtitle={`${stats.total} contactos · ${stats.es} Español · ${stats.en} English · ${stats.pending} pendientes`} action={<IconButton label={c.delete} onClick={() => deleteList(selectedList!.id)}><Trash2 /></IconButton>} />
        {currentQueueItem && activeCampaign?.listIds.includes(selectedList!.id!) ? renderQueue() : null}
        <div className="grid gap-2 sm:grid-cols-5">
          <PrimaryButton onClick={() => document.getElementById('broadcast-contact-name')?.focus()}><Plus size={17} />Añadir contacto</PrimaryButton>
          <SecondaryButton onClick={() => importFromDeviceContacts('broadcast')}><Phone size={17} />Teléfono</SecondaryButton>
          <SecondaryButton onClick={() => { setSelectedListId(null); setBroadcastTab('library'); }}><Library size={17} />{c.library}</SecondaryButton>
          <SecondaryButton onClick={() => createBroadcastQueue()}><Send size={17} />Comenzar envío</SecondaryButton>
          <SecondaryButton onClick={() => downloadFile(exportContactsCsv(listContacts), `${selectedList!.name}.csv`, 'text/csv')}><Download size={17} />CSV</SecondaryButton>
        </div>
        <Card>
          <form className="grid gap-3" onSubmit={saveBroadcastContact}>
            <h2 className="text-lg font-black text-ink">Añadir contacto</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={c.name}><input id="broadcast-contact-name" className="input" value={broadcastContact.firstName} onChange={(event) => setBroadcastContact((current) => ({ ...current, firstName: event.target.value }))} /></Field>
              <Field label="Apellido"><input className="input" value={broadcastContact.lastName} onChange={(event) => setBroadcastContact((current) => ({ ...current, lastName: event.target.value }))} /></Field>
              <Field label={c.phone}><input className="input" value={broadcastContact.phone} onChange={(event) => setBroadcastContact((current) => ({ ...current, phone: event.target.value }))} /></Field>
              <Field label={c.language}><select className="input" value={broadcastContact.language} onChange={(event) => setBroadcastContact((current) => ({ ...current, language: event.target.value as ContactLanguage }))}>{contactLanguages.map((item) => <option key={item}>{item}</option>)}</select></Field>
            </div>
            <PrimaryButton type="submit"><Plus size={17} />Añadir</PrimaryButton>
          </form>
        </Card>
        <Card>
          <h2 className="text-lg font-black text-ink">{c.importContacts}</h2>
          <div className="mt-3 grid gap-3">
            <Field label="CSV"><textarea className="input min-h-28" value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="nombre,telefono,idioma" /></Field>
            <div className="flex flex-wrap gap-2"><SecondaryButton onClick={importBroadcastCsv}><Upload size={16} />Importar CSV</SecondaryButton></div>
            <Field label={lang === 'en' ? 'Paste list' : 'Pegar lista'}><textarea className="input min-h-24" value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Maria 4075551234" /></Field>
            <SecondaryButton onClick={importBroadcastPaste}><Upload size={16} />{lang === 'en' ? 'Import pasted list' : 'Importar lista pegada'}</SecondaryButton>
          </div>
        </Card>
        {renderMediaLibrary()}
        <Card>
          <form className="grid gap-3" onSubmit={createBroadcastQueue}>
            <h2 className="text-lg font-black text-ink">Preparar difusión</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Audiencia"><select className="input" value={audience} onChange={(event) => setAudience(event.target.value as Audience)}><option>Español</option><option>English</option><option>Manual</option></select></Field>
              <Field label={c.channel}><select className="input" value={broadcastChannel} onChange={(event) => setBroadcastChannel(event.target.value as Channel)}><option>WhatsApp</option><option>SMS</option><option>Ambos</option></select></Field>
              <Field label="Media"><select className="input" value={selectedMediaId} onChange={(event) => setSelectedMediaId(event.target.value ? Number(event.target.value) : '')}><option value="">Sin media</option>{mediaAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></Field>
            </div>
            <Field label="Mensaje Español"><textarea className="input min-h-28" value={messageEs} onChange={(event) => setMessageEs(event.target.value)} placeholder="Hola {{nombre_contacto}}, soy {{nombre_usuario}}..." /></Field>
            <Field label="Message English"><textarea className="input min-h-28" value={messageEn} onChange={(event) => setMessageEn(event.target.value)} placeholder="Hi {{nombre_contacto}}, this is {{nombre_usuario}}..." /></Field>
            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              <strong>{previewContacts.length}</strong> contactos seleccionados. Variables: <code>{'{{nombre_contacto}}'}</code>, <code>{'{{nombre_usuario}}'}</code>, <code>{'{{feelgreat_link}}'}</code>
              {previewContact ? <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-3">{previewMessage || 'Vista previa sin texto.'}</p> : null}
            </div>
            <PrimaryButton type="submit"><Send size={17} />Comenzar envío</PrimaryButton>
          </form>
        </Card>
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-ink">Contactos</h2>
            <select className="input w-auto" value={listLanguageFilter} onChange={(event) => setListLanguageFilter(event.target.value as 'Todos' | ContactLanguage)}><option>Todos</option><option>Español</option><option>English</option></select>
          </div>
          <div className="grid gap-2">
            {visibleListContacts.map((contact) => (
              <label key={contact.id} className="flex min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <input type="checkbox" checked={selectedBroadcastContactIds.includes(contact.id!)} onChange={(event) => setSelectedBroadcastContactIds((current) => event.target.checked ? [...new Set([...current, contact.id!])] : current.filter((id) => id !== contact.id))} />
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{contactFullName(contact)}</strong><span className="text-xs text-slate-500">{contact.phone} · {contactLanguage(contact)}</span></span>
              </label>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  const renderQueue = () => {
    if (!currentQueueItem) return null;
    const progress = queueProgress();
    const media = mediaAssets.find((asset) => asset.id === (currentQueueItem.mediaAssetId || activeCampaign?.mediaAssetId));
    return (
      <Card className="border-gold/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black text-ink">{progress.done + 1} de {progress.total}</h2><p className="text-sm text-slate-500">{progress.pending} pendientes</p></div>
          <Badge tone="warn">{currentQueueItem.status}</Badge>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <h3 className="text-xl font-black text-ink">{contactFullName(currentQueueItem.contactSnapshot)}</h3>
          <p className="text-sm text-slate-500">{currentQueueItem.contactSnapshot.phone} · {currentQueueItem.language || contactLanguage(currentQueueItem.contactSnapshot)} · {currentQueueItem.channel}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{currentQueueItem.personalizedMessage || 'Solo media seleccionada.'}</p>
          {media ? <p className="mt-3 text-sm font-bold text-brand">{media.kind === 'image' ? 'Imagen' : 'Video'}: {media.name}</p> : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PrimaryButton onClick={() => openWhatsAppFor(currentQueueItem)}><MessageCircle size={16} />WhatsApp</PrimaryButton>
          <SecondaryButton onClick={() => openSmsFor(currentQueueItem)}><Phone size={16} />SMS</SecondaryButton>
          <SecondaryButton onClick={() => copyMessage(currentQueueItem.personalizedMessage)}><Copy size={16} />Copiar</SecondaryButton>
          <SecondaryButton onClick={() => shareQueueMedia(currentQueueItem)}><Share2 size={16} />Media</SecondaryButton>
          <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Enviado', true)}><Check size={16} />Enviado y siguiente</SecondaryButton>
          <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Omitido', true)}>Omitir</SecondaryButton>
          <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Fallido', true)}>No se pudo enviar</SecondaryButton>
        </div>
      </Card>
    );
  };

  const renderMediaLibrary = () => (
    <Card>
      <input ref={mediaInputRef} className="hidden" type="file" accept="image/*,video/*" onChange={handleMediaFile} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-ink">{c.library}</h2>
          <p className="text-sm text-slate-500">{driveConnected ? 'Google Drive conectado' : c.connectDriveTitle}</p>
        </div>
        {driveConnected ? <Badge tone="good">Google Drive conectado</Badge> : <Badge tone="warn">{googleConfigured() ? (lang === 'en' ? 'Ready' : 'Listo') : c.drivePending}</Badge>}
      </div>
      {!driveConnected ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm leading-relaxed text-slate-600">{googleConfigured() ? (googleLibrariesReady ? c.connectDriveTitle : (googleLibrariesError || 'Preparando Google Drive...')) : `${c.drivePending}. ${driveConfigMissing(lang)}`}</p>
          <PrimaryButton onClick={connectGoogleDrive} disabled={!googleConfigured() || !googleLibrariesReady} className="mt-4"><Cloud size={17} />{c.connectDrive}</PrimaryButton>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={addFromDrive}><Cloud size={17} />Seleccionar desde Drive</PrimaryButton>
            <SecondaryButton onClick={disconnectGoogleDrive}><LogOut size={17} />{c.disconnectDrive}</SecondaryButton>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
            {(['all', 'photos', 'videos'] as DriveFilter[]).map((filter) => <button key={filter} onClick={() => setDriveFilter(filter)} className={`min-h-10 rounded-xl text-sm font-black ${driveFilter === filter ? 'bg-white text-brand shadow-sm' : 'text-slate-600'}`}>{filter === 'all' ? c.all : filter === 'photos' ? c.photos : c.videos}</button>)}
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {mediaAssets.filter((asset) => driveFilter === 'all' || (driveFilter === 'photos' && asset.kind === 'image') || (driveFilter === 'videos' && asset.kind === 'video')).map((asset) => (
          <article key={asset.id} className="min-w-0 rounded-2xl bg-slate-50 p-3">
            {asset.kind === 'image' ? <img src={asset.driveThumbnail || asset.dataUrl} alt="" className="h-32 w-full rounded-xl object-cover" /> : <div className="grid h-32 place-items-center rounded-xl bg-brand text-white"><FileImage /><span className="text-xs">{asset.type}</span></div>}
            <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0"><strong className="block truncate text-sm text-ink">{asset.name}</strong><span className="text-xs text-slate-500">{asset.source === 'google-drive' ? 'Google Drive' : `${Math.round(asset.size / 1024)} KB`}</span></span>
              <div className="flex gap-2">
                {asset.driveWebViewLink ? <IconButton label={c.open} onClick={() => window.open(asset.driveWebViewLink, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /></IconButton> : null}
                <IconButton label={c.delete} onClick={() => deleteMedia(asset.id)}><Trash2 size={16} /></IconButton>
              </div>
            </div>
          </article>
        ))}
        {!mediaAssets.length ? <p className="text-sm text-slate-500">{c.noContent}</p> : null}
      </div>
    </Card>
  );

  const renderFollowUps = () => (
    <div className="grid gap-4">
      <Header title={c.followUps} subtitle={c.followUpsSub} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs font-bold text-slate-500">{lang === 'en' ? 'Active people' : 'Personas activas'}</p><strong className="text-3xl">{activeFollowPeople.length}</strong></Card>
        <Card><p className="text-xs font-bold text-slate-500">{c.today}</p><strong className="text-3xl">{todayTasks.filter((task) => taskType(task) === 'Seguimiento').length}</strong></Card>
        <Card><p className="text-xs font-bold text-slate-500">{lang === 'en' ? 'Overdue' : 'Vencidos'}</p><strong className="text-3xl">{overdueTasks.filter((task) => taskType(task) === 'Seguimiento').length}</strong></Card>
        <Card><p className="text-xs font-bold text-slate-500">{lang === 'en' ? 'Completed 30 days' : 'Completaron 30 días'}</p><strong className="text-3xl">{completedFollowPeople.length}</strong></Card>
      </div>
      <Card>
        <form className="grid gap-3" onSubmit={saveFollowPerson}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-ink">{c.addPeople}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={c.name}><input className="input" value={followForm.firstName} onChange={(event) => setFollowForm((current) => ({ ...current, firstName: event.target.value }))} /></Field>
            <Field label="Apellido opcional"><input className="input" value={followForm.lastName} onChange={(event) => setFollowForm((current) => ({ ...current, lastName: event.target.value }))} /></Field>
            <Field label={c.phone} helper="Incluye el código del país. Ejemplo: +52 para México."><input className="input" type="tel" inputMode="tel" autoComplete="tel" value={followForm.phone} onChange={(event) => setFollowForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+1 407 555 1234" /></Field>
            <Field label="Enlace personal de Feel Great" helper={!followForm.feelGreatReferralLink ? 'Puedes continuar si todavía no lo tienes, con confirmación.' : undefined}><input className="input" value={followForm.feelGreatReferralLink} onChange={(event) => setFollowForm((current) => ({ ...current, feelGreatReferralLink: event.target.value }))} placeholder="https://..." /></Field>
            <Field label={c.language}><select className="input" value={followForm.language} onChange={(event) => setFollowForm((current) => ({ ...current, language: event.target.value as ContactLanguage }))}><option>Español</option><option>English</option></select></Field>
            <Field label="Fecha de inicio"><input className="input" type="date" value={followForm.startDate} onChange={(event) => setFollowForm((current) => ({ ...current, startDate: event.target.value }))} /></Field>
            <Field label={c.channel}><select className="input" value={followForm.channel} onChange={(event) => setFollowForm((current) => ({ ...current, channel: event.target.value as Exclude<Channel, 'Ambos'> }))}><option>WhatsApp</option><option>SMS</option></select></Field>
            <Field label="Tipo de compra"><select className="input" value={followForm.purchaseType} onChange={(event) => setFollowForm((current) => ({ ...current, purchaseType: event.target.value as Member['purchaseType'] }))}><option>Compra individual</option><option>Suscripción</option><option>Entrega física</option></select></Field>
            <Field label="Tipo de contacto"><select className="input" value={followForm.contactType} onChange={(event) => setFollowForm((current) => ({ ...current, contactType: event.target.value as ContactType }))}><option>Miembro</option><option>Distribuidor</option><option>Ambos</option></select></Field>
          </div>
          <PrimaryButton type="submit"><Plus size={17} />Iniciar seguimiento de 30 días</PrimaryButton>
        </form>
      </Card>
      <div className="grid gap-3">
        {[...activeFollowPeople, ...completedFollowPeople].map((member) => renderMemberCard(member))}
        {!members.length ? <Card><p className="text-sm text-slate-500">No hay personas en seguimiento.</p></Card> : null}
      </div>
      {selectedMember ? renderMemberDetail(selectedMember) : null}
    </div>
  );

  const renderMemberCard = (member: Member) => {
    const day = currentProgramDay(member.protocolStartDate);
    const progress = day === null ? 0 : Math.min(100, Math.round((Math.min(day, 30) / 30) * 100));
    const pending = tasks.filter((task) => task.memberId === member.id && isTaskOpen(task)).sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`))[0];
    return (
      <button key={member.id} onClick={() => setSelectedMemberId(member.id!)} className="min-w-0 rounded-[1.4rem] border border-slate-100 bg-white p-4 text-left shadow-sm">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="truncate text-lg font-black text-ink">{memberName(member)}</h3><p className="text-sm text-slate-500">{member.phone} · {member.language || 'Español'} · {member.preferredChannel}</p></div>
          <Badge tone={member.programStatus === 'Completado' ? 'good' : member.programStatus === 'Pausado' ? 'warn' : 'accent'}>{member.programStatus === 'Completado' ? '100%' : member.programStatus === 'Pausado' ? 'Pausado' : `Día ${Math.min(day ?? 0, 30)} de 30`}</Badge>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} /></div>
        <p className="mt-2 text-sm text-slate-500">{pending ? `${pending.title} · ${shortDate(pending.dueDate, lang)} ${pending.dueTime}` : 'Sin tareas pendientes'}</p>
      </button>
    );
  };

  const renderMemberDetail = (member: Member) => {
    const memberTasks = tasks.filter((task) => task.memberId === member.id).sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`));
    const nextTask = memberTasks.find((task) => isTaskOpen(task));
    const day = currentProgramDay(member.protocolStartDate);
    const progress = day === null ? 0 : Math.min(100, Math.round((Math.min(day, 30) / 30) * 100));
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-soft px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="mx-auto grid max-w-2xl gap-4">
          <button onClick={() => setSelectedMemberId(null)} className="inline-flex w-fit items-center gap-2 text-sm font-black text-brand"><ChevronLeft size={18} />{c.followUps}</button>
          <Header title={memberName(member)} subtitle={`${member.phone} · ${member.language || 'Español'} · ${member.preferredChannel}`} />
          <Card>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Progreso</p><h2 className="text-3xl font-black text-ink">{member.programStatus === 'Completado' ? '100%' : `${progress}%`}</h2></div><Badge tone="accent">Día {Math.min(day ?? 0, 30)} de 30</Badge></div>
            <div className="mt-3 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} /></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SecondaryButton onClick={() => regenerateFollowTasks(member)}><Bell size={16} />Regenerar tareas</SecondaryButton>
              {member.programStatus === 'Activo' ? <SecondaryButton onClick={() => toggleMemberStatus(member, 'Pausado')}>Pausar</SecondaryButton> : null}
              {member.programStatus === 'Pausado' ? <SecondaryButton onClick={() => toggleMemberStatus(member, 'Activo')}>Reanudar</SecondaryButton> : null}
              {member.programStatus === 'Completado' ? <SecondaryButton onClick={() => { setFollowForm((current) => ({ ...current, firstName: member.firstName, lastName: member.lastName || '', phone: member.phone, feelGreatReferralLink: member.feelGreatReferralLink || '', channel: member.preferredChannel, purchaseType: member.purchaseType, contactType: member.contactType || 'Miembro', startDate: todayKey() })); setSelectedMemberId(null); }}>Iniciar nuevo ciclo</SecondaryButton> : null}
            </div>
          </Card>
          {nextTask ? renderTaskDetail(nextTask) : <Card><p className="text-sm text-slate-500">No hay próxima tarea pendiente.</p></Card>}
          <Card>
            <h2 className="text-lg font-black text-ink">Tareas</h2>
            <div className="mt-3 grid gap-2">{memberTasks.map((task) => <button key={task.id} onClick={() => setSelectedTaskId(task.id || null)} className="rounded-2xl bg-slate-50 p-3 text-left"><strong className="block text-sm text-ink">{task.title}</strong><span className="text-xs text-slate-500">Día {task.sequenceDay ?? task.programDay ?? '-'} · {shortDate(task.dueDate, lang)} {task.dueTime} · {task.status}</span></button>)}</div>
          </Card>
        </div>
      </div>
    );
  };

  const renderTasks = () => {
    const source = taskGroup === 'Hoy' ? todayTasks : taskGroup === 'Vencidas' ? overdueTasks : taskGroup === 'Próximas' ? upcomingTasks : completedTasks;
    const taskGroupCards = [
      { group: 'Hoy' as const, label: 'Hoy', count: todayTasks.length, tone: 'bg-[#f6f0dc] text-brand' },
      { group: 'Vencidas' as const, label: 'Vencidos', count: overdueTasks.length, tone: 'bg-red-50 text-red-700' },
      { group: 'Próximas' as const, label: 'Próximos', count: upcomingTasks.length, tone: 'bg-amber-50 text-amber-700' },
      { group: 'Completadas' as const, label: 'Completados', count: completedTasks.length, tone: 'bg-emerald-50 text-emerald-700' }
    ];
    return (
      <div className="grid gap-4">
        <Header title={c.tasks} subtitle={c.tasksSub} />
        <Card className="border border-[#e4d39a] bg-[#f6f0dc]">
          <p className="text-sm font-bold text-ink">Prueba de notificaciones</p>
          <p className="mt-1 text-xs font-black uppercase tracking-wide text-slate-500">Estado: {notificationStatusLabel(notificationPermission)}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">Las notificaciones automáticas con la app cerrada requieren Web Push con servidor. Esta prueba valida notificaciones locales disponibles en este dispositivo.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryButton onClick={requestReminderNotifications}><Bell size={16} />Activar notificaciones</SecondaryButton>
            <SecondaryButton onClick={sendTestNotification}><Bell size={16} />Enviar notificación de prueba</SecondaryButton>
            <SecondaryButton onClick={createTwoMinuteReminderTest}><Bell size={16} />Crear reminder de prueba en 2 minutos</SecondaryButton>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {taskGroupCards.map((card) => (
            <button key={card.group} onClick={() => setTaskGroup(card.group)} className={`rounded-[1.25rem] border p-4 text-left shadow-sm transition ${taskGroup === card.group ? 'border-brand bg-white ring-2 ring-brand/10' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${card.tone}`}>{card.label}</span>
              <strong className="mt-3 block text-3xl text-ink">{card.count}</strong>
              <span className="text-xs font-bold text-slate-500">mensajes</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          {source.map((task) => (
            <button key={`${task.id}-${task.sourceKey}`} onClick={() => setSelectedTaskId(task.id || null)} className="min-w-0 rounded-[1.4rem] border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-black text-ink">{task.contactName}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-700">Día {task.sequenceDay ?? task.programDay ?? '-'} · {task.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{shortDate(task.dueDate, lang)} {task.dueTime} · Aviso {shortDateTime(taskNotificationAt(task), lang)} · {task.channel === 'WhatsApp' || task.channel === 'SMS' ? task.channel : 'Método no definido'}</p>
                </div>
                <ChevronRight className="shrink-0 text-slate-400" />
              </div>
            </button>
          ))}
          {!source.length ? <Card><p className="text-sm text-slate-500">Sin tareas en esta vista.</p></Card> : null}
        </div>
        {selectedTask ? <div className="fixed inset-0 z-50 overflow-y-auto bg-soft px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]"><div className="mx-auto max-w-2xl">{renderTaskDetail(selectedTask, true)}</div></div> : null}
      </div>
    );
  };

  const renderTaskDetail = (task: FollowUpTask, modal = false) => {
    const member = task.memberId ? members.find((item) => item.id === task.memberId) : null;
    const template = task.templateKey ? templates.find((item) => item.key === task.templateKey) : null;
    const refreshedMeeting = member && template && isTaskOpen(task) && (task.sequenceDay === 14 || task.sequenceDay === 22)
      ? findNextMeeting(weeklyEvents, task.dueAt || buildLocalDueAt(task.dueDate, task.dueTime), member.contactType)
      : task.meetingSnapshot;
    const displayMessage = member && template && isTaskOpen(task)
      ? cleanUnresolvedMessage(resolveFollowUpMessage(template, member, settings, refreshedMeeting))
      : task.resolvedMessage || task.message;
    const displayTask = { ...task, message: displayMessage, meetingSnapshot: refreshedMeeting, meetingLink: refreshedMeeting?.link || task.meetingLink };
    return (
      <Card className="grid gap-4">
        {modal ? <button onClick={() => setSelectedTaskId(null)} className="inline-flex w-fit items-center gap-2 text-sm font-black text-brand"><ChevronLeft size={18} />{c.tasks}</button> : null}
        <div><h2 className="text-xl font-black text-ink">{task.title}</h2><p className="text-sm text-slate-500">{task.contactName} · Día {task.sequenceDay ?? task.programDay ?? '-'} · {task.phone}</p><p className="mt-1 text-xs font-semibold text-slate-500">Aviso: {shortDateTime(taskNotificationAt(task), lang)}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="whitespace-pre-wrap text-sm text-slate-700">{displayMessage}</p>{displayTask.meetingLink ? <button onClick={() => window.open(displayTask.meetingLink, '_blank', 'noopener,noreferrer')} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-brand"><ExternalLink size={16} />Zoom</button> : null}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {isTaskOpen(task) ? <PrimaryButton onClick={() => openWhatsAppFor(displayTask)}><MessageCircle size={16} />WhatsApp</PrimaryButton> : null}
          {isTaskOpen(task) ? <SecondaryButton onClick={() => openSmsFor(displayTask)}><Phone size={16} />SMS</SecondaryButton> : null}
          <SecondaryButton onClick={() => copyMessage(displayMessage)}><Copy size={16} />Copiar</SecondaryButton>
          {isTaskOpen(task) ? <SecondaryButton onClick={() => completeTask(displayTask)}><Check size={16} />Marcar como completado</SecondaryButton> : null}
          {isTaskOpen(task) ? <SecondaryButton onClick={() => postponeTask(task, '30')}>30 min</SecondaryButton> : null}
          {isTaskOpen(task) ? <SecondaryButton onClick={() => postponeTask(task, 'later')}>Más tarde</SecondaryButton> : null}
          {isTaskOpen(task) ? <SecondaryButton onClick={() => postponeTask(task, 'tomorrow')}>Mañana 10:00</SecondaryButton> : null}
          {isTaskOpen(task) ? <SecondaryButton onClick={() => postponeTask(task, 'custom')}>Elegir fecha</SecondaryButton> : null}
        </div>
      </Card>
    );
  };

  const currentView = active === 'inicio' ? renderHome() : active === 'difusion' ? renderBroadcast() : active === 'seguimiento' ? renderFollowUps() : renderTasks();

  if (!ready) return <div className="theme-golden grid min-h-screen place-items-center bg-black text-white">Cargando Golden Team Connect...</div>;
  if (!settings.sessionActive) return renderEntry();

  return (
    <div className="theme-golden min-h-screen overflow-x-hidden bg-soft text-ink">
      <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)+6.25rem)] pt-0 sm:px-6 lg:pb-10">
        {currentView}
        <p className="text-center text-xs text-slate-500">{notice}</p>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActive(item.id)} className={`relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.68rem] font-black leading-tight transition ${active === item.id ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
              {item.icon}
              <span className="max-w-full text-center">{item.label}</span>
              {item.id === 'tareas' && taskBadge ? <span className="absolute right-2 top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[0.65rem] font-black text-black">{taskBadge}</span> : null}
            </button>
          ))}
        </div>
      </nav>
      {accountOpen ? renderAccount() : null}
      {showSendConfirm && pendingSendTask ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/40 p-4 sm:place-items-center">
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-black text-ink">¿Enviaste este mensaje?</h2>
            <p className="mt-2 text-sm text-slate-500">Confirma solo si el mensaje fue enviado en {pendingSendTask.channel}.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <PrimaryButton onClick={() => {
                const task = tasks.find((item) => item.id === pendingSendTask.taskId);
                if (task) completeTask(task, pendingSendTask.channel);
              }}><Check size={16} />Sí, marcar como completado</PrimaryButton>
              <SecondaryButton onClick={() => { setShowSendConfirm(false); setPendingSendTask(null); }}>Todavía no</SecondaryButton>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default App;
