import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  Clipboard,
  Copy,
  Database,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  Home,
  Import,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Smartphone,
  Trash2,
  Upload,
  User,
  Users,
  X
} from 'lucide-react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { clearAllData, db, defaultSettings, ensureSettings } from './db';
import { isValidAccessCode, normalizeAccessCode } from './accessConfig';
import type { AppSettings, Campaign, CampaignImage, CampaignPreview, Channel, Contact, ContactStatus, FollowUpTask, InternalList, Member, MemberInterest, MemberPurchaseType, MessageTemplate, QueueItem, QueueStatus, TaskKind, VisualTheme, WeeklyEvent } from './types';
import { backupSummary, validateBackup } from './utils/backup';
import { csvRowToContact, exportContactsCsv, parseContactsCsv } from './utils/csv';
import { buildFirst30DayTasks, buildRenewalTask, currentProgramDay, defaultWeeklyEvents, isBusinessEligible, memberName, parsePastedProspects } from './utils/followup';
import { compressImage, shareImage } from './utils/image';
import { bestQueueIndex, buildSmsLink, buildWhatsAppLink, messageNeedsFeelGreatLink, personalizeMessage, smsSegments } from './utils/messages';
import { isDuplicatePhone, normalizePhone } from './utils/phone';

type MainSection = 'inicio' | 'miembros' | 'laFitness' | 'tareas';
type ConfigPanel = 'perfil' | 'mensajesMiembros' | 'mensajesLa' | 'semanal' | 'ubicaciones' | 'importar' | 'copias' | 'informacion';
type SendStep = 1 | 2 | 3;
type PeopleFilter = 'Todos' | 'Nuevos' | 'Contactados' | 'Respondieron' | 'Seguimiento' | 'Cerrados';
type BusinessStatus =
  | 'Nuevo'
  | 'Mensaje pendiente'
  | 'Contactado'
  | 'Respondio'
  | 'Interesado'
  | 'Requiere llamada'
  | 'Seguimiento'
  | 'Cerrado'
  | 'No respondio'
  | 'No interesado'
  | 'Dado de baja';

type TaskGroup = 'Hoy' | 'Vencidas' | 'Próximas' | 'Completadas';

const mainSections: Array<{ id: MainSection; label: string; icon: ReactNode }> = [
  { id: 'inicio', label: 'Inicio', icon: <Home size={20} /> },
  { id: 'miembros', label: 'Miembros', icon: <Users size={20} /> },
  { id: 'laFitness', label: 'LA Fitness', icon: <MapPin size={20} /> },
  { id: 'tareas', label: 'Tareas', icon: <Bell size={20} /> }
];

const configPanels: Array<{ id: ConfigPanel; label: string; icon: ReactNode }> = [
  { id: 'perfil', label: 'Perfil', icon: <User size={18} /> },
  { id: 'mensajesMiembros', label: 'Mensajes de miembros', icon: <Clipboard size={18} /> },
  { id: 'mensajesLa', label: 'Mensajes de LA Fitness', icon: <MessageCircle size={18} /> },
  { id: 'semanal', label: 'Sistema semanal Golden Team', icon: <CalendarClock size={18} /> },
  { id: 'ubicaciones', label: 'Ubicaciones', icon: <MapPin size={18} /> },
  { id: 'importar', label: 'Importar y exportar', icon: <Import size={18} /> },
  { id: 'copias', label: 'Copias de seguridad', icon: <Database size={18} /> },
  { id: 'informacion', label: 'Información', icon: <CircleAlert size={18} /> }
];

const categories: Contact['category'][] = ['Miembro', 'Cliente', 'Distribuidor', 'Lider', 'Prospecto', 'Otro'];
const statuses: ContactStatus[] = ['Activo', 'Pausado', 'Dado de baja'];
const channels: Channel[] = ['WhatsApp', 'SMS', 'Ambos'];
const queueStatuses: QueueStatus[] = ['Pendiente', 'Abierto', 'Enviado', 'Omitido', 'Fallido'];
const businessStatuses: BusinessStatus[] = ['Nuevo', 'Mensaje pendiente', 'Contactado', 'Respondio', 'Interesado', 'Requiere llamada', 'Seguimiento', 'Cerrado', 'No respondio', 'No interesado', 'Dado de baja'];
const peopleFilters: PeopleFilter[] = ['Todos', 'Nuevos', 'Contactados', 'Respondieron', 'Seguimiento', 'Cerrados'];
const laLocations = ['Junction', 'Maitland', 'Otra ubicacion'];
const languages = ['Espanol', 'Ingles'];
const purchaseTypes: MemberPurchaseType[] = ['Autosuscripción', 'Compra única', 'No sé'];
const memberInterests: MemberInterest[] = ['Solo protocolo', 'Interesado en negocio', 'Distribuidor activo'];
const taskGroups: TaskGroup[] = ['Hoy', 'Vencidas', 'Próximas', 'Completadas'];
const taskFilters: Array<'Todas' | TaskKind> = ['Todas', 'Miembro', 'Renovación', 'Reunión', 'LA Fitness'];
const logoSrc = `${import.meta.env.BASE_URL}golden-team-logo.jpeg`;
const themeOptions: Array<{ id: VisualTheme; label: string; detail: string }> = [
  { id: 'golden', label: 'Golden Team', detail: 'Negro, blanco y dorado' },
  { id: 'classic', label: 'Classic Blue', detail: 'Azul marino, azul claro y blanco' },
  { id: 'emerald', label: 'Emerald', detail: 'Verde oscuro, blanco y gris claro' },
  { id: 'burgundy', label: 'Burgundy', detail: 'Vino, crema y dorado' }
];

const blankContact: Contact = {
  firstName: '',
  lastName: '',
  phone: '',
  countryCode: '1',
  country: 'Estados Unidos',
  email: '',
  category: 'Prospecto',
  listIds: [],
  tags: [],
  notes: '',
  createdAt: '',
  status: 'Activo',
  preferredChannel: 'WhatsApp',
  consent: true,
  consentDate: ''
};

const blankTemplate: MessageTemplate = { name: '', body: '', createdAt: '' };
const blankCampaign: Campaign = { name: '', message: '', listIds: [], contactIds: [], channel: 'WhatsApp', notes: '', createdAt: '' };
const blankMember: Member = {
  firstName: '',
  lastName: '',
  phone: '',
  countryCode: '1',
  country: 'Estados Unidos',
  email: '',
  purchaseDate: todayKey(),
  estimatedDeliveryDate: '',
  protocolStartDate: '',
  preferredChannel: 'WhatsApp',
  purchaseType: 'No sé',
  interest: 'Solo protocolo',
  notes: '',
  programActive: false,
  programStatus: 'Sin iniciar',
  weeklyEventsActive: false,
  nextOrderDate: '',
  createdAt: ''
};

function todayIso() {
  return new Date().toISOString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(value?: string) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-US', { month: 'short', day: 'numeric' });
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

function tagValue(contact: Contact, prefix: string, fallback: string) {
  return contact.tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1) || fallback;
}

function withTag(contact: Contact, prefix: string, value: string) {
  const rest = contact.tags.filter((tag) => !tag.startsWith(`${prefix}:`));
  return value ? [...rest, `${prefix}:${value}`] : rest;
}

function commercialStatus(contact: Contact): BusinessStatus {
  if (contact.status === 'Dado de baja') return 'Dado de baja';
  const found = contact.tags.find((tag) => businessStatuses.includes(tag as BusinessStatus));
  return (found as BusinessStatus | undefined) || 'Nuevo';
}

function statusTone(status: BusinessStatus): 'good' | 'warn' | 'bad' | 'blue' | 'neutral' {
  if (['Respondio', 'Interesado', 'Cerrado'].includes(status)) return 'good';
  if (['Mensaje pendiente', 'Requiere llamada', 'Seguimiento'].includes(status)) return 'warn';
  if (['No respondio', 'No interesado', 'Dado de baja'].includes(status)) return 'bad';
  if (status === 'Contactado') return 'blue';
  return 'neutral';
}

function SectionShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-6xl gap-4">{children}</div>;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.7rem] border border-slate-100 bg-white p-5 shadow-soft ${className}`}>{children}</section>;
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-normal text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </label>
  );
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'blue' }) {
  const color =
    tone === 'good'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : tone === 'bad'
          ? 'bg-red-50 text-red-800 border-red-200'
          : tone === 'blue'
            ? 'bg-sky-50 text-sky-800 border-sky-200'
            : 'bg-slate-50 text-slate-700 border-slate-200';
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${color}`}>{children}</span>;
}

function PrimaryButton({ children, onClick, type = 'button', disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, type = 'button', disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-brand transition hover:border-brandLight hover:text-brandDark disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>
      {children}
    </button>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid min-h-12 min-w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-brand shadow-sm transition hover:border-brandLight">
      {children}
    </button>
  );
}

function App() {
  const [active, setActive] = useState<MainSection>('inicio');
  const [online, setOnline] = useState(navigator.onLine);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<InternalList[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('Listo.');
  const [configOpen, setConfigOpen] = useState(false);
  const [configPanel, setConfigPanel] = useState<ConfigPanel>('perfil');
  const [profileOpen, setProfileOpen] = useState(false);
  const [entryName, setEntryName] = useState('');
  const [entryLink, setEntryLink] = useState('');
  const [entryAccessCode, setEntryAccessCode] = useState('');
  const [entryError, setEntryError] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [quickLinkOpen, setQuickLinkOpen] = useState(false);
  const [contactForm, setContactForm] = useState<Contact>(blankContact);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactLanguage, setContactLanguage] = useState('Espanol');
  const [contactGym, setContactGym] = useState('Junction');
  const [contactProduct, setContactProduct] = useState('');
  const [contactNextAction, setContactNextAction] = useState('Enviar mensaje');
  const [contactBusinessStatus, setContactBusinessStatus] = useState<BusinessStatus>('Nuevo');
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [memberForm, setMemberForm] = useState<Member>(blankMember);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberTaskTime, setMemberTaskTime] = useState('10:00');
  const [pastedProspects, setPastedProspects] = useState('');
  const [taskGroup, setTaskGroup] = useState<TaskGroup>('Hoy');
  const [taskFilter, setTaskFilter] = useState<'Todas' | TaskKind>('Todas');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('Todos');
  const [listFilter, setListFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [listName, setListName] = useState('');
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState<MessageTemplate>(blankTemplate);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [previewContactId, setPreviewContactId] = useState<number | ''>('');
  const [campaignForm, setCampaignForm] = useState<Campaign>(blankCampaign);
  const [campaignImage, setCampaignImage] = useState<CampaignImage | undefined>();
  const [sendStep, setSendStep] = useState<SendStep>(1);
  const [recipientMode, setRecipientMode] = useState('LA Fitness');
  const [sendLanguage, setSendLanguage] = useState('Espanol');
  const [activeCampaignId, setActiveCampaignId] = useState<number | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [csvText, setCsvText] = useState('');
  const [csvDefaultCode, setCsvDefaultCode] = useState('1');
  const [backupText, setBackupText] = useState('');
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('merge');
  const [doubleDelete, setDoubleDelete] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadAll(message?: string) {
    const existingEvents = await db.weeklyEvents.count();
    if (!existingEvents) await db.weeklyEvents.bulkAdd(defaultWeeklyEvents.map((event) => ({ ...event, updatedAt: todayIso() })));
    const [loadedSettings, loadedContacts, loadedLists, loadedTemplates, loadedCampaigns, loadedQueue, loadedMembers, loadedTasks, loadedWeeklyEvents] = await Promise.all([
      ensureSettings(),
      db.contacts.orderBy('firstName').toArray(),
      db.lists.orderBy('name').toArray(),
      db.templates.orderBy('name').toArray(),
      db.campaigns.orderBy('createdAt').reverse().toArray(),
      db.queue.orderBy('id').toArray(),
      db.members.orderBy('firstName').toArray(),
      db.tasks.orderBy('dueDate').toArray(),
      db.weeklyEvents.orderBy('weekday').toArray()
    ]);
    setSettings(loadedSettings);
    setContacts(loadedContacts);
    setLists(loadedLists);
    setTemplates(loadedTemplates);
    setCampaigns(loadedCampaigns);
    setQueue(loadedQueue);
    setMembers(loadedMembers);
    setTasks(loadedTasks);
    setWeeklyEvents(loadedWeeklyEvents);
    if (!loadedSettings.sessionActive) {
      setEntryName((current) => current || loadedSettings.ownerName || '');
      setEntryLink((current) => current || loadedSettings.feelGreatLink || '');
    }
    setReady(true);
    if (!activeCampaignId && loadedCampaigns[0]?.id) setActiveCampaignId(loadedCampaigns[0].id);
    if (message) setNotice(message);
  }

  useEffect(() => {
    const boot = async () => {
      await loadAll('Datos locales cargados.');
    };
    boot().catch((error) => setNotice(error instanceof Error ? error.message : 'No se pudieron cargar los datos.'));
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

  const selectedQueue = useMemo(() => queue.filter((item) => item.campaignId === activeCampaignId), [activeCampaignId, queue]);
  const currentQueueItem = selectedQueue[queueIndex];
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId);

  useEffect(() => {
    setQueueIndex(bestQueueIndex(selectedQueue));
  }, [activeCampaignId, selectedQueue.length]);

  const selectedPerson = contacts.find((contact) => contact.id === selectedPersonId) || null;
  const selectedMember = members.find((member) => member.id === selectedMemberId) || null;
  const phonePreview = useMemo(() => normalizePhone(contactForm.phone, contactForm.countryCode || settings.defaultCountryCode), [contactForm.countryCode, contactForm.phone, settings.defaultCountryCode]);
  const phoneDuplicate = useMemo(() => isDuplicatePhone(phonePreview.normalized, contacts.map((contact) => contact.phone), editingContactId ? contacts.find((contact) => contact.id === editingContactId)?.phone : undefined), [contacts, editingContactId, phonePreview.normalized]);
  const memberPhonePreview = useMemo(() => normalizePhone(memberForm.phone, memberForm.countryCode || settings.defaultCountryCode), [memberForm.countryCode, memberForm.phone, settings.defaultCountryCode]);
  const memberPhoneDuplicate = useMemo(() => isDuplicatePhone(memberPhonePreview.normalized, members.map((member) => member.phone), editingMemberId ? members.find((member) => member.id === editingMemberId)?.phone : undefined), [editingMemberId, memberPhonePreview.normalized, members]);

  const todayContacts = useMemo(() => contacts.filter((contact) => contact.createdAt?.slice(0, 10) === todayKey()), [contacts]);
  const laFitnessContacts = useMemo(() => contacts.filter((contact) => contact.category === 'Prospecto' || contact.tags.includes('LA Fitness') || tagValue(contact, 'Gimnasio', '').includes('Junction') || tagValue(contact, 'Gimnasio', '').includes('Maitland') || contact.listIds.some((id) => lists.find((list) => list.id === id)?.name.toLowerCase().includes('fitness'))), [contacts, lists]);
  const activeMembers = useMemo(() => members.filter((member) => member.programStatus !== 'Completado'), [members]);
  const todayTaskKey = todayKey();
  const memberTasks = useMemo(() => tasks, [tasks]);
  const queueTasks = useMemo<FollowUpTask[]>(() => queue.filter((item) => item.status === 'Pendiente' || item.status === 'Abierto').map((item) => ({
    id: -Number(item.id || 0),
    queueItemId: item.id,
    contactId: item.contactId,
    kind: 'LA Fitness',
    program: 'Cola individual LA Fitness',
    title: item.status === 'Abierto' ? 'Confirmar envío' : 'Enviar mensaje',
    contactName: `${item.contactSnapshot.firstName} ${item.contactSnapshot.lastName}`.trim(),
    phone: item.contactSnapshot.phone,
    channel: item.channel === 'SMS' || item.channel === 'WhatsApp' ? item.channel : item.contactSnapshot.preferredChannel === 'SMS' ? 'SMS' : 'WhatsApp',
    dueDate: item.createdAt.slice(0, 10),
    dueTime: '10:00',
    message: item.personalizedMessage,
    status: 'Pendiente',
    createdAt: item.createdAt,
    sourceKey: `queue:${item.id}`
  })), [queue]);
  const allActionTasks = useMemo(() => [...memberTasks, ...queueTasks].sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`)), [memberTasks, queueTasks]);
  const todaysTasks = useMemo(() => allActionTasks.filter((task) => task.status !== 'Completada' && task.dueDate === todayTaskKey), [allActionTasks, todayTaskKey]);
  const overdueTasks = useMemo(() => allActionTasks.filter((task) => task.status !== 'Completada' && task.dueDate < todayTaskKey), [allActionTasks, todayTaskKey]);
  const upcomingTasks = useMemo(() => allActionTasks.filter((task) => task.status !== 'Completada' && task.dueDate > todayTaskKey), [allActionTasks, todayTaskKey]);
  const completedTasks = useMemo(() => allActionTasks.filter((task) => task.status === 'Completada'), [allActionTasks]);
  const selectedTask = allActionTasks.find((task) => task.id === selectedTaskId) || null;

  const filteredContacts = useMemo(() => {
    const query = contactSearch.toLowerCase();
    return contacts.filter((contact) => {
      const business = commercialStatus(contact);
      const gym = tagValue(contact, 'Gimnasio', '');
      const inSearch = `${contact.firstName} ${contact.lastName} ${contact.phone} ${gym}`.toLowerCase().includes(query);
      const inChip =
        peopleFilter === 'Todos' ||
        (peopleFilter === 'Nuevos' && business === 'Nuevo') ||
        (peopleFilter === 'Contactados' && ['Mensaje pendiente', 'Contactado'].includes(business)) ||
        (peopleFilter === 'Respondieron' && ['Respondio', 'Interesado'].includes(business)) ||
        (peopleFilter === 'Seguimiento' && ['Requiere llamada', 'Seguimiento', 'No respondio'].includes(business)) ||
        (peopleFilter === 'Cerrados' && business === 'Cerrado');
      return (
        inSearch &&
        inChip &&
        (!listFilter || contact.listIds.includes(Number(listFilter))) &&
        (!countryFilter || contact.country === countryFilter) &&
        (!categoryFilter || contact.category === categoryFilter) &&
        (!statusFilter || contact.status === statusFilter) &&
        (!channelFilter || contact.preferredChannel === channelFilter)
      );
    });
  }, [categoryFilter, channelFilter, contactSearch, contacts, countryFilter, listFilter, peopleFilter, statusFilter]);

  const sendSelectedContacts = useMemo(() => {
    const selected = new Map<number, Contact>();
    const add = (contact: Contact) => {
      if (contact.id) selected.set(contact.id, contact);
    };
    if (recipientMode === 'LA Fitness') laFitnessContacts.forEach(add);
    if (recipientMode === 'Todos los prospectos pendientes') laFitnessContacts.filter((contact) => ['Nuevo', 'Mensaje pendiente'].includes(commercialStatus(contact))).forEach(add);
    if (recipientMode === 'Ubicacion especifica') contacts.filter((contact) => tagValue(contact, 'Gimnasio', '') === contactGym).forEach(add);
    if (recipientMode === 'Personas importadas hoy') todayContacts.filter((contact) => laFitnessContacts.some((prospect) => prospect.id === contact.id)).forEach(add);
    if (recipientMode === 'Personas que no respondieron') contacts.filter((contact) => commercialStatus(contact) === 'No respondio').forEach(add);
    if (recipientMode === 'Seguimiento semanal') laFitnessContacts.filter((contact) => commercialStatus(contact) === 'Seguimiento').forEach(add);
    campaignForm.contactIds.forEach((id) => {
      const contact = contacts.find((item) => item.id === id);
      if (contact) add(contact);
    });
    campaignForm.listIds.forEach((id) => contacts.filter((contact) => contact.listIds.includes(id)).forEach(add));
    return Array.from(selected.values());
  }, [campaignForm.contactIds, campaignForm.listIds, contactGym, contacts, laFitnessContacts, recipientMode, todayContacts]);

  const campaignPreview = useMemo<CampaignPreview>(() => {
    const included: Contact[] = [];
    const excluded: CampaignPreview['excluded'] = [];
    sendSelectedContacts.forEach((contact) => {
      const normalized = normalizePhone(contact.phone, contact.countryCode || settings.defaultCountryCode);
      if (contact.status === 'Dado de baja' || commercialStatus(contact) === 'Dado de baja') excluded.push({ contact, reason: 'Dado de baja' });
      else if (contact.status === 'Pausado') excluded.push({ contact, reason: 'Pausado' });
      else if (!contact.consent) excluded.push({ contact, reason: 'Sin consentimiento' });
      else if (!normalized.valid) excluded.push({ contact, reason: 'Numero invalido' });
      else included.push(contact);
    });
    return { contacts: included, excluded };
  }, [sendSelectedContacts, settings.defaultCountryCode]);

  function listNames(ids: number[]) {
    return ids.map((id) => lists.find((list) => list.id === id)?.name).filter(Boolean).join(', ');
  }

  function messageContext() {
    return { userName: displayName(settings), feelGreatLink: settings.feelGreatLink || '' };
  }

  function insertMessageVariable(variable: '{{nombre_contacto}}' | '{{feelgreat_link}}') {
    setCampaignForm((current) => ({ ...current, message: `${current.message}${current.message ? ' ' : ''}${variable}` }));
  }

  async function saveProfilePatch(patch: Partial<AppSettings>, message = 'Perfil guardado.') {
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
    await saveProfilePatch({ ownerName: name, feelGreatLink: link, sessionActive: true, visualTheme: settings.visualTheme || 'golden' }, 'Bienvenido a Golden Team Connect.');
    setEntryAccessCode('');
    setEntryError('');
  }

  async function closeSession() {
    if (!confirm('Cerrar sesión? Tus datos guardados permanecerán en este dispositivo.')) return;
    await saveProfilePatch({ sessionActive: false }, 'Sesión cerrada.');
    setEntryAccessCode('');
    setProfileOpen(false);
  }

  async function copyFeelGreatLink() {
    if (!settings.feelGreatLink) return setNotice('Añade tu Feel Great Link en tu perfil.');
    await navigator.clipboard.writeText(settings.feelGreatLink);
    setNotice('Enlace copiado.');
  }

  function openFeelGreatLink() {
    if (!settings.feelGreatLink) return setNotice('Añade tu Feel Great Link en tu perfil.');
    window.open(settings.feelGreatLink, '_blank', 'noopener,noreferrer');
  }

  async function shareFeelGreatLink() {
    if (!settings.feelGreatLink) return setNotice('Añade tu Feel Great Link en tu perfil.');
    if (navigator.share) {
      await navigator.share({ title: 'Mi Feel Great Link', text: settings.feelGreatLink, url: settings.feelGreatLink });
      setNotice('Enlace compartido.');
    } else {
      await copyFeelGreatLink();
    }
  }

  function resetContactForm() {
    setContactForm({ ...blankContact, countryCode: settings.defaultCountryCode, country: settings.defaultCountry });
    setEditingContactId(null);
    setContactLanguage('Espanol');
    setContactGym('Junction');
    setContactProduct('');
    setContactNextAction('Enviar mensaje');
    setContactBusinessStatus('Nuevo');
  }

  function resetMemberForm() {
    setMemberForm({ ...blankMember, countryCode: settings.defaultCountryCode, country: settings.defaultCountry, purchaseDate: todayKey() });
    setMemberTaskTime('10:00');
    setEditingMemberId(null);
  }

  function editMember(member: Member) {
    setMemberForm(member);
    setMemberTaskTime('10:00');
    setEditingMemberId(member.id || null);
    setSelectedMemberId(null);
    setActive('miembros');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function regenerateMemberTasks(member: Member) {
    if (!member.id) return;
    const existingCompleted = await db.tasks.where('memberId').equals(member.id).and((task) => task.status === 'Completada').toArray();
    await db.tasks.where('memberId').equals(member.id).and((task) => task.status !== 'Completada').delete();
    const generated = member.programActive && member.protocolStartDate && member.programStatus === 'Activo' ? buildFirst30DayTasks(member, settings.feelGreatLink || '').map((task) => ({ ...task, dueTime: memberTaskTime || task.dueTime })) : [];
    const renewal = buildRenewalTask(member);
    const nextTasks = [...generated, ...(renewal ? [renewal] : [])].filter((task) => !existingCompleted.some((done) => done.sourceKey === task.sourceKey));
    if (nextTasks.length) await db.tasks.bulkAdd(nextTasks);
  }

  async function saveMember(event: FormEvent) {
    event.preventDefault();
    if (!memberForm.firstName.trim()) return setNotice('Escribe el nombre del miembro.');
    if (!memberPhonePreview.valid) return setNotice(memberPhonePreview.message);
    if (memberPhoneDuplicate) return setNotice('Ese número ya existe en miembros.');
    const wantsProgram = Boolean(memberForm.programActive && memberForm.protocolStartDate);
    const payload: Member = {
      ...memberForm,
      firstName: memberForm.firstName.trim(),
      lastName: memberForm.lastName?.trim() || '',
      phone: memberPhonePreview.normalized,
      countryCode: memberForm.countryCode || settings.defaultCountryCode,
      country: memberForm.country || settings.defaultCountry,
      createdAt: memberForm.createdAt || todayIso(),
      programActive: wantsProgram,
      programStatus: wantsProgram ? 'Activo' : memberForm.protocolStartDate ? memberForm.programStatus : 'Sin iniciar'
    };
    const memberId = editingMemberId ? editingMemberId : await db.members.add(payload);
    await db.members.put({ ...payload, id: memberId });
    await regenerateMemberTasks({ ...payload, id: memberId });
    resetMemberForm();
    await loadAll(editingMemberId ? 'Miembro actualizado.' : 'Miembro añadido.');
  }

  async function completeMemberTask(task: FollowUpTask, channel?: 'WhatsApp' | 'SMS') {
    if (!task.id || task.id < 0) return;
    await db.tasks.update(task.id, { status: 'Completada', completedAt: todayIso(), completedChannel: channel || (task.channel === 'No definido' ? undefined : task.channel) });
    if (task.programDay === 30 && task.memberId) await db.members.update(task.memberId, { programStatus: 'Completado', programActive: false });
    await loadAll('Tarea completada.');
  }

  async function postponeMemberTask(task: FollowUpTask, mode: 'today' | 'tomorrow' | 'three' | 'custom') {
    if (!task.id || task.id < 0) return;
    const date = new Date(`${todayKey()}T00:00:00`);
    let dueTime = task.dueTime;
    if (mode === 'today') dueTime = '17:00';
    if (mode === 'tomorrow') date.setDate(date.getDate() + 1);
    if (mode === 'three') date.setDate(date.getDate() + 3);
    if (mode === 'custom') {
      const value = prompt('Fecha nueva (YYYY-MM-DD)', task.dueDate);
      if (!value) return;
      await db.tasks.update(task.id, { dueDate: value, status: 'Pospuesta' });
      await loadAll('Tarea pospuesta.');
      return;
    }
    await db.tasks.update(task.id, { dueDate: date.toISOString().slice(0, 10), dueTime: mode === 'tomorrow' ? '10:00' : dueTime, status: 'Pospuesta' });
    await loadAll('Tarea pospuesta.');
  }

  async function addTaskNote(task: FollowUpTask) {
    if (!task.id || task.id < 0) return setNotice('Añade la nota desde el perfil del prospecto en LA Fitness.');
    const note = prompt('Nueva nota para esta tarea');
    if (!note) return;
    const notes = [task.notes, `[${new Date().toLocaleString()}] ${note}`].filter(Boolean).join('\n');
    await db.tasks.update(task.id, { notes });
    await loadAll('Nota guardada en la tarea.');
  }

  async function pauseMemberProgram(member: Member) {
    if (!member.id) return;
    await db.members.update(member.id, { programStatus: 'Pausado', programActive: false });
    await loadAll('Programa pausado.');
  }

  async function finishMemberProgram(member: Member) {
    if (!member.id || !confirm('Finalizar el programa de este miembro?')) return;
    await db.members.update(member.id, { programStatus: 'Completado', programActive: false });
    await loadAll('Programa finalizado.');
  }

  async function activateMonthlyFollowUp(member: Member) {
    if (!member.id || !confirm('Pasar a seguimiento mensual para este miembro?')) return;
    const due = new Date();
    due.setMonth(due.getMonth() + 1);
    await db.tasks.add({
      memberId: member.id,
      kind: 'Miembro',
      program: 'Seguimiento mensual',
      title: 'Seguimiento mensual',
      contactName: memberName(member),
      phone: member.phone,
      channel: member.preferredChannel,
      dueDate: due.toISOString().slice(0, 10),
      dueTime: '10:00',
      message: `Hola, ${member.firstName}. Quería tocar base contigo y saber cómo te ha ido este mes.`,
      status: 'Pendiente',
      createdAt: todayIso(),
      sourceKey: `member:${member.id}:monthly:${due.toISOString().slice(0, 10)}`
    });
    await loadAll('Seguimiento mensual creado.');
  }

  function editContact(contact: Contact) {
    setContactForm(contact);
    setEditingContactId(contact.id || null);
    setContactLanguage(tagValue(contact, 'Idioma', 'Espanol'));
    setContactGym(tagValue(contact, 'Gimnasio', 'Junction'));
    setContactProduct(tagValue(contact, 'Muestra', ''));
    setContactNextAction(tagValue(contact, 'Proxima', 'Enviar mensaje'));
    setContactBusinessStatus(commercialStatus(contact));
    setActive('laFitness');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveContact(event: FormEvent) {
    event.preventDefault();
    if (!contactForm.firstName.trim()) return setNotice('Escribe el nombre.');
    if (!phonePreview.valid) return setNotice(phonePreview.message);
    if (phoneDuplicate) return setNotice('Ese numero ya existe.');
    let tags = contactForm.tags.filter((tag) => !businessStatuses.includes(tag as BusinessStatus));
    tags = withTag({ ...contactForm, tags }, 'Idioma', contactLanguage);
    tags = withTag({ ...contactForm, tags }, 'Gimnasio', contactGym);
    tags = withTag({ ...contactForm, tags }, 'Muestra', contactProduct);
    tags = withTag({ ...contactForm, tags }, 'Proxima', contactNextAction);
    if (contactBusinessStatus !== 'Dado de baja') tags.push(contactBusinessStatus);
    const payload: Contact = {
      ...contactForm,
      firstName: contactForm.firstName.trim(),
      lastName: contactForm.lastName.trim(),
      phone: phonePreview.normalized,
      countryCode: contactForm.countryCode || settings.defaultCountryCode,
      country: contactForm.country || settings.defaultCountry,
      tags,
      createdAt: contactForm.createdAt || todayIso(),
      status: contactBusinessStatus === 'Dado de baja' ? 'Dado de baja' : contactForm.status === 'Dado de baja' ? 'Activo' : contactForm.status,
      consentDate: contactForm.consent ? contactForm.consentDate || todayIso() : undefined,
      unsubscribedAt: contactBusinessStatus === 'Dado de baja' ? contactForm.unsubscribedAt || todayIso() : undefined
    };
    if (editingContactId) await db.contacts.put({ ...payload, id: editingContactId });
    else await db.contacts.add(payload);
    resetContactForm();
    await loadAll(editingContactId ? 'Persona actualizada.' : 'Persona anadida.');
  }

  async function deleteContact(id?: number) {
    if (!id || !confirm('Eliminar esta persona? El historial existente se conserva.')) return;
    await db.contacts.delete(id);
    setSelectedPersonId(null);
    await loadAll('Persona eliminada.');
  }

  async function setBusinessStatus(contact: Contact, status: BusinessStatus) {
    const tags = contact.tags.filter((tag) => !businessStatuses.includes(tag as BusinessStatus));
    if (status !== 'Dado de baja') tags.push(status);
    await db.contacts.update(contact.id!, {
      tags,
      status: status === 'Dado de baja' ? 'Dado de baja' : contact.status === 'Dado de baja' ? 'Activo' : contact.status,
      unsubscribedAt: status === 'Dado de baja' ? todayIso() : contact.unsubscribedAt
    });
    await loadAll(`Estado cambiado a ${status}.`);
  }

  async function addNote(contact: Contact) {
    const note = prompt('Nueva nota');
    if (!note) return;
    const notes = [contact.notes, `[${new Date().toLocaleString()}] ${note}`].filter(Boolean).join('\n');
    await db.contacts.update(contact.id!, { notes });
    await loadAll('Nota guardada.');
  }

  async function saveList(event: FormEvent) {
    event.preventDefault();
    const name = listName.trim();
    if (!name) return setNotice('Escribe el nombre de la lista.');
    if (editingListId) await db.lists.update(editingListId, { name });
    else await db.lists.add({ name, createdAt: todayIso() });
    setListName('');
    setEditingListId(null);
    await loadAll(editingListId ? 'Lista actualizada.' : 'Lista creada.');
  }

  async function deleteList(id?: number) {
    if (!id || !confirm('Eliminar esta lista? Las personas no se eliminaran.')) return;
    await db.transaction('rw', db.lists, db.contacts, async () => {
      await db.lists.delete(id);
      const affected = await db.contacts.where('listIds').equals(id).toArray();
      await Promise.all(affected.map((contact) => db.contacts.update(contact.id!, { listIds: contact.listIds.filter((listId) => listId !== id) })));
    });
    await loadAll('Lista eliminada.');
  }

  async function duplicateList(list: InternalList) {
    const newId = await db.lists.add({ name: `${list.name} copia`, description: list.description, createdAt: todayIso() });
    const members = contacts.filter((contact) => contact.listIds.includes(list.id!));
    await Promise.all(members.map((contact) => db.contacts.update(contact.id!, { listIds: [...contact.listIds, newId] })));
    await loadAll('Lista duplicada con sus personas.');
  }

  async function addSelectedToList(listId: number) {
    await Promise.all(
      selectedContacts.map(async (id) => {
        const contact = await db.contacts.get(id);
        if (contact && !contact.listIds.includes(listId)) await db.contacts.update(id, { listIds: [...contact.listIds, listId] });
      })
    );
    await loadAll('Personas anadidas a la lista.');
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    if (!templateForm.name.trim() || !templateForm.body.trim()) return setNotice('El mensaje necesita nombre y texto.');
    const payload = { ...templateForm, createdAt: templateForm.createdAt || todayIso() };
    if (editingTemplateId) await db.templates.update(editingTemplateId, payload);
    else await db.templates.add(payload);
    setTemplateForm(blankTemplate);
    setEditingTemplateId(null);
    await loadAll(editingTemplateId ? 'Mensaje guardado actualizado.' : 'Mensaje guardado.');
  }

  async function deleteTemplate(id?: number) {
    if (!id || !confirm('Eliminar este mensaje guardado?')) return;
    await db.templates.delete(id);
    await loadAll('Mensaje eliminado.');
  }

  function selectTemplate(id: string) {
    const template = templates.find((item) => item.id === Number(id));
    setCampaignForm((current) => ({ ...current, templateId: template?.id, message: template?.body || current.message }));
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error('La imagen supera 8 MB. Usa una version mas liviana.');
      const compressed = await compressImage(file);
      setCampaignImage({ name: file.name, type: file.type, dataUrl: compressed.dataUrl, size: compressed.size, updatedAt: todayIso() });
      setNotice('Imagen preparada localmente.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar la imagen.');
    }
  }

  async function createCampaign(event?: FormEvent) {
    event?.preventDefault();
    if (!campaignForm.message.trim()) return setNotice('Escribe o selecciona un mensaje.');
    if (messageNeedsFeelGreatLink(campaignForm.message) && !isValidFeelGreatLink(settings.feelGreatLink || '')) {
      setProfileOpen(true);
      return setNotice('Añade tu Feel Great Link en tu perfil para utilizar este mensaje.');
    }
    if (campaignPreview.contacts.length === 0) return setNotice('No hay personas validas para comenzar.');
    if (!confirm(`Comenzar envios para ${campaignPreview.contacts.length} personas?`)) return;
    const campaign: Campaign = {
      ...campaignForm,
      name: campaignForm.name.trim() || `Envio Golden Team ${new Date().toLocaleDateString()}`,
      image: campaignImage,
      createdAt: todayIso()
    };
    const campaignId = await db.campaigns.add(campaign);
    const items: QueueItem[] = campaignPreview.contacts.map((contact) => {
      const names = contact.listIds.map((id) => lists.find((list) => list.id === id)?.name).filter(Boolean) as string[];
      return {
        campaignId,
        contactId: contact.id!,
        contactSnapshot: contact,
        listNames: names,
        channel: campaign.channel === 'Ambos' ? contact.preferredChannel : campaign.channel,
        personalizedMessage: personalizeMessage(campaign.message, contact, names[0] || '', messageContext()),
        status: 'Pendiente',
        createdAt: todayIso()
      };
    });
    await db.queue.bulkAdd(items);
    await Promise.all(campaignPreview.contacts.map((contact) => setBusinessStatus(contact, 'Mensaje pendiente')));
    setCampaignForm(blankCampaign);
    setCampaignImage(undefined);
    setSendStep(3);
    setActiveCampaignId(campaignId);
    await loadAll('Personas pendientes preparadas.');
  }

  async function setQueueStatus(item: QueueItem, status: QueueStatus, advance = false) {
    await db.queue.update(item.id!, {
      status,
      openedAt: status === 'Abierto' ? todayIso() : item.openedAt,
      completedAt: ['Enviado', 'Omitido', 'Fallido'].includes(status) ? todayIso() : item.completedAt
    });
    if (status === 'Abierto') await setBusinessStatus(item.contactSnapshot, 'Contactado');
    if (status === 'Enviado') await setBusinessStatus(item.contactSnapshot, 'Contactado');
    await loadAll(`Estado cambiado a ${status}.`);
    if (advance) setQueueIndex((index) => Math.min(index + 1, selectedQueue.length - 1));
  }

  async function copyMessage(message: string) {
    await navigator.clipboard.writeText(message);
    setNotice('Mensaje copiado.');
  }

  async function openWhatsApp(item: QueueItem | Contact, message?: string) {
    const contact = 'contactSnapshot' in item ? item.contactSnapshot : item;
    const text = 'personalizedMessage' in item ? item.personalizedMessage : message || '';
    if (!online) setNotice('Estas sin conexion. Puedes copiar el mensaje; WhatsApp necesita conexion.');
    window.open(buildWhatsAppLink(contact.phone, text), '_blank', 'noopener,noreferrer');
    if ('personalizedMessage' in item) await setQueueStatus(item, 'Abierto');
  }

  async function openSms(item: QueueItem | Contact, message?: string) {
    const contact = 'contactSnapshot' in item ? item.contactSnapshot : item;
    const text = 'personalizedMessage' in item ? item.personalizedMessage : message || '';
    window.location.href = buildSmsLink(contact.phone, text);
    if ('personalizedMessage' in item) await setQueueStatus(item, 'Abierto');
  }

  function callContact(contact: Contact) {
    window.location.href = `tel:${contact.phone}`;
  }

  async function importCsv() {
    const preview = parseContactsCsv(csvText, contacts.map((contact) => contact.phone), csvDefaultCode);
    if (preview.invalid.length || preview.duplicates.length) {
      setNotice(`CSV revisado: ${preview.valid.length} validos, ${preview.invalid.length} con errores, ${preview.duplicates.length} duplicados.`);
    }
    if (!preview.valid.length) return;
    if (!confirm(`Importar ${preview.valid.length} personas validas?`)) return;
    await db.contacts.bulkAdd(preview.valid.map((row) => csvRowToContact(row, [], csvDefaultCode, settings.defaultCountry)));
    setCsvText('');
    await loadAll('Personas importadas desde CSV.');
  }

  async function importPastedProspects() {
    const parsed = parsePastedProspects(pastedProspects, contacts.map((contact) => contact.phone), csvDefaultCode);
    if (!parsed.contacts.length) return setNotice(`No se encontraron prospectos válidos. Errores: ${parsed.invalid.length}. Duplicados: ${parsed.duplicates.length}.`);
    if (!confirm(`Importar ${parsed.contacts.length} prospectos? ${parsed.invalid.length} líneas excluidas, ${parsed.duplicates.length} duplicados.`)) return;
    await db.contacts.bulkAdd(parsed.contacts);
    setPastedProspects('');
    await loadAll('Prospectos importados desde lista pegada.');
  }

  async function convertProspectToMember(contact: Contact) {
    if (!contact.id) return;
    if (members.some((member) => member.phone === contact.phone)) return setNotice('Ese teléfono ya existe en Miembros.');
    if (!confirm('Convertir este prospecto en miembro activo?')) return;
    const purchaseDate = prompt('Fecha de compra (YYYY-MM-DD)', todayKey()) || todayKey();
    const protocolStartDate = prompt('Fecha de inicio del protocolo (YYYY-MM-DD, opcional)', '') || '';
    const member: Member = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      countryCode: contact.countryCode,
      country: contact.country,
      email: contact.email,
      purchaseDate,
      protocolStartDate,
      preferredChannel: contact.preferredChannel === 'SMS' ? 'SMS' : 'WhatsApp',
      purchaseType: 'No sé',
      interest: 'Solo protocolo',
      notes: contact.notes,
      programActive: Boolean(protocolStartDate),
      programStatus: protocolStartDate ? 'Activo' : 'Sin iniciar',
      weeklyEventsActive: false,
      createdAt: todayIso(),
      convertedFromContactId: contact.id
    };
    const memberId = await db.members.add(member);
    await db.members.put({ ...member, id: memberId });
    if (protocolStartDate) await regenerateMemberTasks({ ...member, id: memberId });
    await setBusinessStatus(contact, 'Cerrado');
    setSelectedPersonId(null);
    setActive('miembros');
    await loadAll('Prospecto convertido en miembro activo.');
  }

  async function saveWeeklyEvent(eventItem: WeeklyEvent, patch: Partial<WeeklyEvent>) {
    if (!eventItem.id) return;
    await db.weeklyEvents.update(eventItem.id, { ...patch, updatedAt: todayIso() });
    await loadAll('Reunión actualizada.');
  }

  async function exportBackup() {
    const backup = {
      app: 'difusion-local-privada' as const,
      version: 1 as const,
      exportedAt: todayIso(),
      contacts,
      lists,
      templates,
      campaigns,
      queue,
      members,
      tasks,
      weeklyEvents,
      settings
    };
    downloadFile(JSON.stringify(backup, null, 2), `backup-golden-team-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    setNotice('Copia de seguridad exportada.');
  }

  async function restoreBackup() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(backupText);
    } catch {
      return setNotice('El JSON del backup no es valido.');
    }
    if (!validateBackup(parsed)) return setNotice('El archivo no tiene la estructura esperada.');
    if (!confirm(`Restaurar backup: ${backupSummary(parsed)}?`)) return;
    if (restoreMode === 'replace') {
      await db.transaction('rw', [db.contacts, db.lists, db.templates, db.campaigns, db.queue, db.members, db.tasks, db.weeklyEvents, db.settings], async () => {
        await Promise.all([db.contacts.clear(), db.lists.clear(), db.templates.clear(), db.campaigns.clear(), db.queue.clear(), db.members.clear(), db.tasks.clear(), db.weeklyEvents.clear()]);
        await db.contacts.bulkPut(parsed.contacts);
        await db.lists.bulkPut(parsed.lists);
        await db.templates.bulkPut(parsed.templates);
        await db.campaigns.bulkPut(parsed.campaigns);
        await db.queue.bulkPut(parsed.queue);
        await db.members.bulkPut(parsed.members || []);
        await db.tasks.bulkPut(parsed.tasks || []);
        await db.weeklyEvents.bulkPut(parsed.weeklyEvents || []);
        await db.settings.put(parsed.settings);
      });
    } else {
      const existingPhones = new Set(contacts.map((contact) => contact.phone));
      await db.contacts.bulkAdd(parsed.contacts.filter((contact) => !existingPhones.has(contact.phone)).map(({ id: _id, ...contact }) => contact));
      await db.lists.bulkAdd(parsed.lists.map(({ id: _id, ...list }) => list));
      await db.templates.bulkAdd(parsed.templates.map(({ id: _id, ...template }) => template));
      const campaignIdMap = new Map<number, number>();
      for (const campaign of parsed.campaigns) {
        const oldId = campaign.id;
        const { id: _id, ...campaignWithoutId } = campaign;
        const newId = await db.campaigns.add(campaignWithoutId);
        if (oldId) campaignIdMap.set(oldId, newId);
      }
      await db.queue.bulkAdd(parsed.queue.filter((item) => campaignIdMap.has(item.campaignId)).map(({ id: _id, ...item }) => ({ ...item, campaignId: campaignIdMap.get(item.campaignId)! })));
      await db.members.bulkAdd((parsed.members || []).filter((member) => !members.some((existing) => existing.phone === member.phone)).map(({ id: _id, ...member }) => member));
      await db.tasks.bulkAdd((parsed.tasks || []).map(({ id: _id, ...task }) => task));
      await db.weeklyEvents.bulkAdd((parsed.weeklyEvents || []).map(({ id: _id, ...event }) => event));
    }
    setBackupText('');
    await loadAll('Backup restaurado.');
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const feelGreatLink = normalizeFeelGreatLink(settings.feelGreatLink || '');
    if (feelGreatLink && !isValidFeelGreatLink(feelGreatLink)) return setNotice('Revisa que hayas pegado tu enlace completo.');
    const normalizedPersonal = normalizePhone(settings.personalNumber, settings.defaultCountryCode);
    await db.settings.put({ ...settings, feelGreatLink, personalNumber: normalizedPersonal.valid ? normalizedPersonal.normalized : settings.personalNumber });
    await loadAll('Perfil guardado.');
  }

  async function deleteAllData() {
    if (doubleDelete !== 'BORRAR') return setNotice('Escribe BORRAR para confirmar.');
    if (!confirm('Borrar todos los datos locales de este dispositivo?')) return;
    await clearAllData();
    setDoubleDelete('');
    await loadAll('Todos los datos locales fueron borrados.');
  }

  async function duplicateCampaign(campaign: Campaign) {
    const { id: _id, createdAt: _createdAt, ...rest } = campaign;
    const newId = await db.campaigns.add({ ...rest, name: `${campaign.name} copia`, createdAt: todayIso() });
    setActiveCampaignId(newId);
    setActive('laFitness');
    await loadAll('Envio duplicado.');
  }

  async function retryFailed(campaign: Campaign) {
    const failed = queue.filter((item) => item.campaignId === campaign.id && item.status === 'Fallido');
    if (!failed.length) return setNotice('No hay fallidos para reintentar.');
    await Promise.all(failed.map((item) => db.queue.update(item.id!, { status: 'Pendiente', completedAt: undefined })));
    setActiveCampaignId(campaign.id!);
    setActive('laFitness');
    await loadAll('Fallidos devueltos a pendientes.');
  }

  async function exportCampaignSummary(campaign: Campaign) {
    const items = queue.filter((item) => item.campaignId === campaign.id);
    const csv = ['nombre,telefono,canal,estado', ...items.map((item) => `${item.contactSnapshot.firstName} ${item.contactSnapshot.lastName},${item.contactSnapshot.phone},${item.channel},${item.status}`)].join('\n');
    downloadFile(csv, `resumen-${campaign.name}.csv`, 'text/csv');
  }

  const nav = (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-r lg:border-t-0 lg:px-5 lg:py-6">
      <div className="mb-7 hidden lg:block">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Golden Team" className="h-12 w-12 rounded-3xl object-cover" />
          <div>
            <p className="text-lg font-black text-ink">Golden Team Connect</p>
            <p className="text-xs leading-tight text-slate-500">Organiza. Da seguimiento. Mantente conectado.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-1">
        {mainSections.map((section) => (
          <button key={section.id} onClick={() => setActive(section.id)} className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-xs font-bold transition lg:min-h-12 lg:flex-row lg:justify-start lg:px-4 lg:text-base ${active === section.id ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
            {section.icon}
            <span>{section.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );

  const personCard = (contact: Contact) => {
    const business = commercialStatus(contact);
    const lastQueue = [...queue].reverse().find((item) => item.contactId === contact.id);
    return (
      <article key={contact.id} className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
        <button onClick={() => setSelectedPersonId(contact.id!)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-ink">{contact.firstName} {contact.lastName}</h3>
              <p className="text-sm text-slate-500">{contact.phone}</p>
              <p className="mt-1 text-sm text-slate-500">{tagValue(contact, 'Idioma', 'Espanol')} · {tagValue(contact, 'Gimnasio', listNames(contact.listIds) || 'LA Fitness')}</p>
            </div>
            <Badge tone={statusTone(business)}><Circle size={8} fill="currentColor" />{business}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
            <span>Registro: {shortDate(contact.createdAt)}</span>
            <span>Ultima: {lastQueue ? shortDate(lastQueue.openedAt || lastQueue.completedAt || lastQueue.createdAt) : 'Sin contacto'}</span>
          </div>
        </button>
      </article>
    );
  };

  const memberCard = (member: Member) => {
    const day = currentProgramDay(member.protocolStartDate);
    const memberPendingTasks = tasks.filter((task) => task.memberId === member.id && task.status !== 'Completada');
    const nextTask = memberPendingTasks.sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`))[0];
    const progress = day === null ? 0 : Math.min(100, Math.round((Math.min(day, 30) / 30) * 100));
    return (
      <article key={member.id} className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
        <button onClick={() => setSelectedMemberId(member.id!)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-ink">{memberName(member)}</h3>
              <p className="text-sm text-slate-500">{member.phone} · {member.preferredChannel}</p>
              <p className="mt-1 text-sm text-slate-500">{member.interest} · {member.purchaseType}</p>
            </div>
            <Badge tone={member.programStatus === 'Activo' ? 'good' : member.programStatus === 'Pausado' ? 'warn' : 'neutral'}>{member.programStatus}</Badge>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold text-slate-500"><span>{day === null ? 'Sin inicio' : `Día ${Math.min(day, 30)} de 30`}</span><span>{nextTask ? `${nextTask.title} · ${shortDate(nextTask.dueDate)}` : 'Sin tarea pendiente'}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} /></div>
          </div>
        </button>
      </article>
    );
  };

  const renderMembers = () => {
    const filteredMembers = members.filter((member) => `${member.firstName} ${member.lastName} ${member.phone}`.toLowerCase().includes(memberSearch.toLowerCase()));
    return (
      <SectionShell>
        <Card>
          <SectionTitle title="Miembros" subtitle="Personas que ya compraron o ya están registradas" action={<PrimaryButton onClick={resetMemberForm}><Plus size={18} />Añadir miembro</PrimaryButton>} />
          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={20} />
            <input className="input pl-12" placeholder="Buscar miembro" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <Card>
            <SectionTitle title={editingMemberId ? 'Editar miembro' : 'Añadir miembro'} subtitle="La fecha de inicio calcula el programa" />
            <form className="mt-4 grid gap-3" onSubmit={saveMember}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre"><input className="input" value={memberForm.firstName} onChange={(event) => setMemberForm((current) => ({ ...current, firstName: event.target.value }))} /></Field>
                <Field label="Apellido opcional"><input className="input" value={memberForm.lastName || ''} onChange={(event) => setMemberForm((current) => ({ ...current, lastName: event.target.value }))} /></Field>
              </div>
              <div className="grid grid-cols-[86px_1fr] gap-3">
                <Field label="Código"><input className="input" value={memberForm.countryCode} onChange={(event) => setMemberForm((current) => ({ ...current, countryCode: event.target.value }))} /></Field>
                <Field label="Teléfono" error={memberPhoneDuplicate ? 'Este número ya existe.' : undefined}><input className="input" value={memberForm.phone} onChange={(event) => setMemberForm((current) => ({ ...current, phone: event.target.value }))} inputMode="tel" /></Field>
              </div>
              <Badge tone={memberPhonePreview.valid && !memberPhoneDuplicate ? 'good' : 'warn'}>{memberPhonePreview.message}</Badge>
              <Field label="Email opcional"><input className="input" type="email" value={memberForm.email || ''} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="País opcional"><input className="input" value={memberForm.country || ''} onChange={(event) => setMemberForm((current) => ({ ...current, country: event.target.value }))} /></Field>
                <Field label="Canal preferido"><select className="input" value={memberForm.preferredChannel} onChange={(event) => setMemberForm((current) => ({ ...current, preferredChannel: event.target.value as 'WhatsApp' | 'SMS' }))}><option>WhatsApp</option><option>SMS</option></select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de compra"><input className="input" type="date" value={memberForm.purchaseDate} onChange={(event) => setMemberForm((current) => ({ ...current, purchaseDate: event.target.value }))} /></Field>
                <Field label="Entrega estimada opcional"><input className="input" type="date" value={memberForm.estimatedDeliveryDate || ''} onChange={(event) => setMemberForm((current) => ({ ...current, estimatedDeliveryDate: event.target.value }))} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inicio del protocolo"><input className="input" type="date" value={memberForm.protocolStartDate || ''} onChange={(event) => setMemberForm((current) => ({ ...current, protocolStartDate: event.target.value, programActive: Boolean(event.target.value) }))} /></Field>
                <Field label="Hora de tareas"><input className="input" type="time" value={memberTaskTime} onChange={(event) => setMemberTaskTime(event.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de compra"><select className="input" value={memberForm.purchaseType} onChange={(event) => setMemberForm((current) => ({ ...current, purchaseType: event.target.value as MemberPurchaseType }))}>{purchaseTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Interés"><select className="input" value={memberForm.interest} onChange={(event) => setMemberForm((current) => ({ ...current, interest: event.target.value as MemberInterest }))}>{memberInterests.map((item) => <option key={item}>{item}</option>)}</select></Field>
              </div>
              <Field label="Próximo pedido opcional"><input className="input" type="date" value={memberForm.nextOrderDate || ''} onChange={(event) => setMemberForm((current) => ({ ...current, nextOrderDate: event.target.value }))} /></Field>
              <label className="flex items-start gap-3 rounded-3xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" className="mt-1 h-5 w-5" checked={memberForm.programActive} onChange={(event) => setMemberForm((current) => ({ ...current, programActive: event.target.checked }))} />Activar programa de 30 días</label>
              <label className="flex items-start gap-3 rounded-3xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" className="mt-1 h-5 w-5" checked={Boolean(memberForm.weeklyEventsActive)} disabled={!isBusinessEligible(memberForm)} onChange={(event) => setMemberForm((current) => ({ ...current, weeklyEventsActive: event.target.checked }))} />Activar reuniones semanales</label>
              <Field label="Notas"><textarea className="input min-h-28" value={memberForm.notes || ''} onChange={(event) => setMemberForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <PrimaryButton type="submit"><Check size={18} />Guardar miembro</PrimaryButton>
                <SecondaryButton onClick={resetMemberForm}><X size={18} />Limpiar</SecondaryButton>
              </div>
            </form>
          </Card>

          <div className="grid gap-3">
            {filteredMembers.map(memberCard)}
          </div>
        </div>

        {selectedMember ? (
          <div className="fixed inset-0 z-40 bg-ink/35 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm" onClick={() => setSelectedMemberId(null)}>
            <div className="mx-auto max-h-[90vh] max-w-xl overflow-auto rounded-[2rem] bg-white p-5 shadow-soft" onClick={(event) => event.stopPropagation()}>
              <SectionTitle title={memberName(selectedMember)} subtitle={`${selectedMember.phone} · Día ${currentProgramDay(selectedMember.protocolStartDate) ?? '-'} de 30`} action={<IconButton label="Cerrar" onClick={() => setSelectedMemberId(null)}><X /></IconButton>} />
              <div className="mt-4 grid gap-3">
                <Badge tone={selectedMember.programStatus === 'Activo' ? 'good' : 'neutral'}>{selectedMember.programStatus}</Badge>
                <p className="text-sm text-slate-600">Inicio: {shortDate(selectedMember.protocolStartDate)} · Tipo: {selectedMember.purchaseType}</p>
                <p className="text-sm text-slate-600">Interés: {selectedMember.interest}</p>
                <div className="rounded-3xl bg-slate-50 p-4"><p className="font-bold">Notas</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{selectedMember.notes || 'Sin notas.'}</p></div>
                <SectionTitle title="Próxima tarea" subtitle={tasks.find((task) => task.memberId === selectedMember.id && task.status !== 'Completada')?.title || 'Sin tarea pendiente'} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <SecondaryButton onClick={() => openWhatsApp({ ...selectedMember, id: selectedMember.id } as unknown as Contact, `Hola ${selectedMember.firstName}`)}><MessageCircle size={17} />WhatsApp</SecondaryButton>
                  <SecondaryButton onClick={() => openSms({ ...selectedMember, id: selectedMember.id } as unknown as Contact, `Hola ${selectedMember.firstName}`)}><Smartphone size={17} />SMS</SecondaryButton>
                  <SecondaryButton onClick={() => callContact({ ...selectedMember, id: selectedMember.id } as unknown as Contact)}><Phone size={17} />Llamar</SecondaryButton>
                  <SecondaryButton onClick={() => editMember(selectedMember)}><Edit3 size={17} />Editar</SecondaryButton>
                  <SecondaryButton onClick={() => pauseMemberProgram(selectedMember)}><CalendarClock size={17} />Pausar</SecondaryButton>
                  <SecondaryButton onClick={() => finishMemberProgram(selectedMember)}><Check size={17} />Finalizar</SecondaryButton>
                </div>
                {selectedMember.programStatus === 'Completado' ? <PrimaryButton onClick={() => activateMonthlyFollowUp(selectedMember)}>Pasar a seguimiento mensual</PrimaryButton> : null}
              </div>
            </div>
          </div>
        ) : null}
      </SectionShell>
    );
  };

  const renderHome = () => (
    <SectionShell>
      <div className="rounded-[2rem] bg-gradient-to-br from-brand to-brandDark p-6 text-white shadow-soft">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Golden Team" className="h-12 w-12 rounded-2xl object-cover" />
          <p className="text-sm font-semibold text-white/80">Herramienta interna de Golden Team.</p>
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">Hola, {displayName(settings)}</h1>
        <p className="mt-1 max-w-xl text-white/80">Estas son tus acciones de hoy.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone={online ? 'good' : 'warn'}>{online ? 'En linea' : 'Modo sin conexion'}</Badge>
          <Badge tone="blue">{notice}</Badge>
          <button onClick={() => setQuickLinkOpen((current) => !current)} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white">Mi enlace</button>
        </div>
        {quickLinkOpen ? (
          <div className="mt-4 grid gap-2 rounded-3xl border border-white/15 bg-white/10 p-3 sm:inline-grid sm:grid-cols-3">
            <button onClick={copyFeelGreatLink} className="rounded-2xl bg-white px-3 py-2 text-sm font-bold text-brand">Copiar</button>
            <button onClick={shareFeelGreatLink} className="rounded-2xl bg-white px-3 py-2 text-sm font-bold text-brand">Compartir</button>
            <button onClick={openFeelGreatLink} className="rounded-2xl bg-white px-3 py-2 text-sm font-bold text-brand">Abrir</button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Miembros activos" subtitle="Acompañamiento de primeros 30 días" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Seguimientos para hoy</p><strong className="text-3xl text-ink">{todaysTasks.filter((task) => task.kind === 'Miembro').length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Seguimientos vencidos</p><strong className="text-3xl text-ink">{overdueTasks.filter((task) => task.kind === 'Miembro').length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Primeros 30 días</p><strong className="text-3xl text-ink">{activeMembers.filter((member) => member.programStatus === 'Activo').length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Renovaciones próximas</p><strong className="text-3xl text-ink">{upcomingTasks.filter((task) => task.kind === 'Renovación').length}</strong></div>
          </div>
          <PrimaryButton className="mt-5 w-full" onClick={() => setActive('tareas')}><Bell size={18} />Ver seguimientos</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title="Prospectos LA Fitness" subtitle="Cola manual de WhatsApp y SMS" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Mensajes pendientes</p><strong className="text-3xl text-ink">{queueTasks.length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Sin respuesta</p><strong className="text-3xl text-ink">{laFitnessContacts.filter((contact) => ['No respondio', 'Sin respuesta'].includes(commercialStatus(contact))).length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Seguimientos semanales</p><strong className="text-3xl text-ink">{laFitnessContacts.filter((contact) => commercialStatus(contact) === 'Seguimiento').length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Envíos en progreso</p><strong className="text-3xl text-ink">{campaigns.filter((campaign) => queue.some((item) => item.campaignId === campaign.id && ['Pendiente', 'Abierto'].includes(item.status))).length}</strong></div>
          </div>
          <PrimaryButton className="mt-5 w-full" onClick={() => { setActive('laFitness'); setSendStep(3); }}><Send size={18} />Continuar envíos</PrimaryButton>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Tareas de hoy" subtitle="Miembros, renovaciones, reuniones y LA Fitness" />
        <div className="mt-4 grid gap-3">
          {todaysTasks.length ? todaysTasks.slice(0, 8).map((task) => (
            <button key={`${task.kind}-${task.id}`} onClick={() => { setSelectedTaskId(task.id || null); setActive('tareas'); }} className="flex items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4 text-left">
              <span className="min-w-0">
                <span className="block truncate font-black">{task.contactName}</span>
                <span className="block text-sm text-slate-500">{task.title} · Día {task.programDay ?? '-'} · {task.channel}</span>
              </span>
              <span className="shrink-0 text-sm font-bold text-brand">{task.dueTime}<ArrowRight className="ml-1 inline" size={17} /></span>
            </button>
          )) : <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">No hay tareas para hoy. Al abrir la app se seguirán mostrando las vencidas y próximas.</p>}
        </div>
      </Card>
    </SectionShell>
  );

  const renderPeople = () => (
    <SectionShell>
      <Card>
        <SectionTitle title="Prospectos LA Fitness" subtitle="Personas que todavía no han comprado" action={<PrimaryButton onClick={resetContactForm}><Plus size={18} />Añadir prospecto</PrimaryButton>} />
        <div className="mt-4 grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={20} />
            <input className="input pl-12" placeholder="Buscar por nombre, teléfono o ubicación" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {peopleFilters.map((filter) => (
              <button key={filter} onClick={() => setPeopleFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${peopleFilter === filter ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'}`}>{filter}</button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <Card>
          <SectionTitle title={editingContactId ? 'Editar prospecto' : 'Añadir prospecto'} subtitle="LA Fitness: datos mínimos, seguimiento manual" />
          <form className="mt-4 grid gap-3" onSubmit={saveContact}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre"><input className="input" value={contactForm.firstName} onChange={(event) => setContactForm((current) => ({ ...current, firstName: event.target.value }))} /></Field>
              <Field label="Apellido"><input className="input" value={contactForm.lastName} onChange={(event) => setContactForm((current) => ({ ...current, lastName: event.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-[86px_1fr] gap-3">
              <Field label="Codigo"><input className="input" value={contactForm.countryCode} onChange={(event) => setContactForm((current) => ({ ...current, countryCode: event.target.value }))} /></Field>
              <Field label="Telefono" error={phoneDuplicate ? 'Este numero ya existe.' : undefined}><input className="input" value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} inputMode="tel" /></Field>
            </div>
            <Badge tone={phonePreview.valid && !phoneDuplicate ? 'good' : 'warn'}>{phonePreview.message}</Badge>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Idioma"><select className="input" value={contactLanguage} onChange={(event) => setContactLanguage(event.target.value)}>{languages.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Gimnasio"><select className="input" value={contactGym} onChange={(event) => setContactGym(event.target.value)}>{laLocations.map((item) => <option key={item}>{item}</option>)}</select></Field>
            </div>
            <Field label="Correo"><input className="input" value={contactForm.email || ''} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} type="email" /></Field>
            <Field label="Estado"><select className="input" value={contactBusinessStatus} onChange={(event) => setContactBusinessStatus(event.target.value as BusinessStatus)}>{businessStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Próximo seguimiento"><input className="input" value={contactNextAction} onChange={(event) => setContactNextAction(event.target.value)} /></Field>
            <Field label="Formula o muestra probada"><input className="input" value={contactProduct} onChange={(event) => setContactProduct(event.target.value)} /></Field>
            <Field label="Notas"><textarea className="input min-h-28" value={contactForm.notes || ''} onChange={(event) => setContactForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
            <label className="flex items-start gap-3 rounded-3xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" className="mt-1 h-5 w-5" checked={contactForm.consent} onChange={(event) => setContactForm((current) => ({ ...current, consent: event.target.checked }))} />Aceptó recibir comunicación de seguimiento.</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton type="submit"><Check size={18} />Guardar</PrimaryButton>
              <SecondaryButton onClick={resetContactForm}><X size={18} />Limpiar</SecondaryButton>
            </div>
          </form>
        </Card>

        <div className="grid gap-3">
          {filteredContacts.map(personCard)}
        </div>
      </div>

      {selectedPerson ? (
        <div className="fixed inset-0 z-40 bg-ink/35 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm" onClick={() => setSelectedPersonId(null)}>
          <div className="mx-auto max-h-[90vh] max-w-xl overflow-auto rounded-[2rem] bg-white p-5 shadow-soft" onClick={(event) => event.stopPropagation()}>
            <SectionTitle title={`${selectedPerson.firstName} ${selectedPerson.lastName}`} subtitle={`${selectedPerson.phone} · ${tagValue(selectedPerson, 'Gimnasio', 'LA Fitness')}`} action={<IconButton label="Cerrar" onClick={() => setSelectedPersonId(null)}><X /></IconButton>} />
            <div className="mt-4 grid gap-3">
              <Badge tone={statusTone(commercialStatus(selectedPerson))}>{commercialStatus(selectedPerson)}</Badge>
              <p className="text-sm text-slate-600">Idioma: {tagValue(selectedPerson, 'Idioma', 'Espanol')}</p>
              <p className="text-sm text-slate-600">Canal preferido: {selectedPerson.preferredChannel}</p>
              <p className="text-sm text-slate-600">Registro: {shortDate(selectedPerson.createdAt)}</p>
              <p className="text-sm text-slate-600">Proxima accion: {tagValue(selectedPerson, 'Proxima', 'Enviar mensaje')}</p>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="font-bold">Notas</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{selectedPerson.notes || 'Sin notas.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SecondaryButton onClick={() => openWhatsApp(selectedPerson, `Hola ${selectedPerson.firstName}`)}><MessageCircle size={17} />WhatsApp</SecondaryButton>
                <SecondaryButton onClick={() => openSms(selectedPerson, `Hola ${selectedPerson.firstName}`)}><Smartphone size={17} />SMS</SecondaryButton>
                <SecondaryButton onClick={() => callContact(selectedPerson)}><Phone size={17} />Llamar</SecondaryButton>
                <SecondaryButton onClick={() => addNote(selectedPerson)}><Plus size={17} />Nota</SecondaryButton>
              </div>
              <div className="grid gap-2">
                <select className="input" value={commercialStatus(selectedPerson)} onChange={(event) => setBusinessStatus(selectedPerson, event.target.value as BusinessStatus)}>{businessStatuses.map((item) => <option key={item}>{item}</option>)}</select>
                <div className="grid grid-cols-2 gap-2">
                  <SecondaryButton onClick={() => editContact(selectedPerson)}><Edit3 size={17} />Editar</SecondaryButton>
                {commercialStatus(selectedPerson) === 'Cerrado' || commercialStatus(selectedPerson) === 'Interesado' ? <SecondaryButton onClick={() => convertProspectToMember(selectedPerson)}><Users size={17} />Convertir en miembro</SecondaryButton> : null}
                <SecondaryButton onClick={() => deleteContact(selectedPerson.id)}><Trash2 size={17} />Eliminar</SecondaryButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SectionShell>
  );

  const renderSend = () => (
    <SectionShell>
      <Card>
        <SectionTitle title="Flujo de envío LA Fitness" subtitle="Una persona a la vez. No se envía automáticamente." action={<Badge tone="blue">Paso {sendStep} de 3</Badge>} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((step) => <button key={step} onClick={() => setSendStep(step as SendStep)} className={`rounded-2xl py-3 text-sm font-black ${sendStep === step ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'}`}>{step === 1 ? 'Destinatarios' : step === 2 ? 'Mensaje' : 'Revisar'}</button>)}
        </div>
      </Card>

      {sendStep === 1 ? (
        <Card>
          <SectionTitle title="Elegir contactos" subtitle="Selecciona prospectos pendientes o una ubicación" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {['Todos los prospectos pendientes', 'Ubicacion especifica', 'Personas importadas hoy', 'Personas que no respondieron', 'Seguimiento semanal', 'Selección manual'].map((mode) => (
              <button key={mode} onClick={() => setRecipientMode(mode)} className={`rounded-3xl border p-4 text-left font-bold ${recipientMode === mode ? 'border-brand bg-sky-50 text-brand' : 'border-slate-100 bg-white text-ink'}`}>{mode}</button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Ubicacion"><select className="input" value={contactGym} onChange={(event) => setContactGym(event.target.value)}>{laLocations.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Selección manual"><select multiple className="input min-h-32" value={campaignForm.contactIds.map(String)} onChange={(event) => setCampaignForm((current) => ({ ...current, contactIds: Array.from(event.target.selectedOptions).map((option) => Number(option.value)) }))}>{laFitnessContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select></Field>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-3xl bg-slate-50 p-4">
            <span className="font-bold">Seleccionados</span>
            <strong className="text-3xl text-brand">{campaignPreview.contacts.length}</strong>
          </div>
          <PrimaryButton className="mt-4 w-full" onClick={() => setSendStep(2)}>Continuar<ChevronRight size={18} /></PrimaryButton>
        </Card>
      ) : null}

      {sendStep === 2 ? (
        <Card>
          <SectionTitle title="Preparar mensaje" subtitle="Variables: nombre, mi enlace, ubicación o enlace de evento" />
          <div className="mt-4 grid gap-3">
            <Field label="Mensaje guardado"><select className="input" value={campaignForm.templateId || ''} onChange={(event) => selectTemplate(event.target.value)}><option value="">Sin mensaje guardado</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Idioma"><select className="input" value={sendLanguage} onChange={(event) => setSendLanguage(event.target.value)}>{languages.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Canal"><select className="input" value={campaignForm.channel} onChange={(event) => setCampaignForm((current) => ({ ...current, channel: event.target.value as Channel }))}>{channels.map((item) => <option key={item}>{item}</option>)}</select></Field>
            </div>
            <Field label="Texto"><textarea className="input min-h-44" value={campaignForm.message} onChange={(event) => setCampaignForm((current) => ({ ...current, message: event.target.value }))} placeholder="Hola {{nombre_contacto}}, ..." /></Field>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={() => insertMessageVariable('{{nombre_contacto}}')}><Plus size={16} />Añadir nombre</SecondaryButton>
              <SecondaryButton onClick={() => insertMessageVariable('{{feelgreat_link}}')}><Plus size={16} />Añadir mi enlace</SecondaryButton>
            </div>
            <p className="text-sm text-slate-500">{campaignForm.message.length} caracteres · {smsSegments(campaignForm.message)} segmento(s) SMS</p>
            <div className="rounded-3xl border border-slate-100 p-4">
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImage} />
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => fileInputRef.current?.click()}><FileImage size={17} />Imagen opcional</SecondaryButton>
                {campaignImage ? <SecondaryButton onClick={() => setCampaignImage(undefined)}><Trash2 size={17} />Quitar</SecondaryButton> : null}
              </div>
              {campaignImage ? <img src={campaignImage.dataUrl} alt="Vista previa" className="mt-3 max-h-64 rounded-3xl object-cover" /> : <p className="mt-2 text-sm text-slate-500">La imagen se comparte o descarga manualmente. No se adjunta automáticamente al texto.</p>}
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="font-bold">Vista previa</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{campaignPreview.contacts[0] ? personalizeMessage(campaignForm.message, campaignPreview.contacts[0], listNames(campaignPreview.contacts[0].listIds).split(', ')[0] || '', messageContext()) : 'Selecciona destinatarios.'}</p>
            </div>
            <PrimaryButton onClick={() => setSendStep(3)}>Revisar<ChevronRight size={18} /></PrimaryButton>
          </div>
        </Card>
      ) : null}

      {sendStep === 3 ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
          <Card>
            <SectionTitle title="Revisar" subtitle="No se envía automáticamente" />
            <div className="mt-4 grid gap-3">
              <Badge tone="blue">{campaignPreview.contacts.length} destinatarios</Badge>
              <Badge tone={campaignPreview.excluded.length ? 'warn' : 'good'}>{campaignPreview.excluded.length} excluidos</Badge>
              <Badge tone="neutral">Canal: {campaignForm.channel}</Badge>
              {messageNeedsFeelGreatLink(campaignForm.message) && !isValidFeelGreatLink(settings.feelGreatLink || '') ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold">Añade tu Feel Great Link en tu perfil para utilizar este mensaje.</p>
                  <SecondaryButton className="mt-3" onClick={() => setProfileOpen(true)}><User size={16} />Ir a mi perfil</SecondaryButton>
                </div>
              ) : null}
              <div className="rounded-3xl bg-slate-50 p-4"><p className="whitespace-pre-wrap text-sm">{campaignForm.message || 'Sin mensaje.'}</p></div>
              {campaignImage ? <img src={campaignImage.dataUrl} alt="Imagen" className="max-h-56 rounded-3xl object-cover" /> : null}
              {campaignPreview.excluded.map(({ contact, reason }) => <p key={contact.id} className="text-sm text-slate-500">{contact.firstName} {contact.lastName}: {reason}</p>)}
              <PrimaryButton onClick={() => createCampaign()}>Comenzar envios</PrimaryButton>
            </div>
          </Card>
          <Card>
            <SectionTitle title="Cola individual" subtitle={activeCampaign ? activeCampaign.name : 'Continúa donde lo dejaste'} />
            {currentQueueItem ? (
              <div className="mt-4 grid gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="blue">{queueIndex + 1} de {selectedQueue.length}</Badge>
                  {queueStatuses.map((status) => <Badge key={status}>{status}: {selectedQueue.filter((item) => item.status === status).length}</Badge>)}
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <h3 className="text-xl font-black">{currentQueueItem.contactSnapshot.firstName} {currentQueueItem.contactSnapshot.lastName}</h3>
                  <p className="text-slate-500">{currentQueueItem.contactSnapshot.phone} · {currentQueueItem.channel}</p>
                  <p className="mt-3 whitespace-pre-wrap">{currentQueueItem.personalizedMessage}</p>
                </div>
                {activeCampaign?.image ? <img src={activeCampaign.image.dataUrl} alt="Imagen del envio" className="max-h-72 rounded-3xl object-cover" /> : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <SecondaryButton onClick={() => copyMessage(currentQueueItem.personalizedMessage)}><Copy size={17} />Copiar</SecondaryButton>
                  {activeCampaign?.image ? <SecondaryButton onClick={() => shareImage(activeCampaign.image!.dataUrl, activeCampaign.image!.name, activeCampaign.image!.type).then(setNotice)}><Share2 size={17} />Imagen</SecondaryButton> : null}
                  <PrimaryButton onClick={() => openWhatsApp(currentQueueItem)}><MessageCircle size={17} />WhatsApp</PrimaryButton>
                  <SecondaryButton onClick={() => openSms(currentQueueItem)}><Smartphone size={17} />SMS</SecondaryButton>
                  <PrimaryButton onClick={() => setQueueStatus(currentQueueItem, 'Enviado', true)}><ChevronRight size={17} />Enviado y siguiente</PrimaryButton>
                  <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Enviado')}><Check size={17} />Marcar enviado</SecondaryButton>
                  <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Omitido')}><X size={17} />Omitido</SecondaryButton>
                  <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Fallido')}><CircleAlert size={17} />No se pudo enviar</SecondaryButton>
                  <SecondaryButton onClick={() => setQueueIndex((index) => Math.max(0, index - 1))}><ChevronLeft size={17} />Anterior</SecondaryButton>
                  <SecondaryButton onClick={() => setQueueIndex((index) => Math.min(selectedQueue.length - 1, index + 1))}>Siguiente<ChevronRight size={17} /></SecondaryButton>
                </div>
              </div>
            ) : <p className="mt-4 text-slate-500">No hay personas pendientes seleccionadas.</p>}
          </Card>
        </div>
      ) : null}
    </SectionShell>
  );

  const renderLaFitness = () => (
    <SectionShell>
      <Card>
        <SectionTitle title="LA Fitness" subtitle="Prospectos que todavía no han comprado" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Prospectos totales</p><strong className="text-3xl">{laFitnessContacts.length}</strong></div>
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Primer mensaje pendiente</p><strong className="text-3xl">{laFitnessContacts.filter((contact) => ['Nuevo', 'Mensaje pendiente'].includes(commercialStatus(contact))).length}</strong></div>
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Esperando respuesta</p><strong className="text-3xl">{laFitnessContacts.filter((contact) => commercialStatus(contact) === 'Contactado').length}</strong></div>
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Seguimiento semana</p><strong className="text-3xl">{laFitnessContacts.filter((contact) => commercialStatus(contact) === 'Seguimiento').length}</strong></div>
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Convertidos</p><strong className="text-3xl">{laFitnessContacts.filter((contact) => commercialStatus(contact) === 'Cerrado').length}</strong></div>
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Pausados</p><strong className="text-3xl">{laFitnessContacts.filter((contact) => contact.status === 'Pausado').length}</strong></div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <PrimaryButton onClick={() => setConfigPanel('importar')}><Upload size={17} />Importar contactos</PrimaryButton>
          <SecondaryButton onClick={() => { resetContactForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Plus size={17} />Añadir prospecto</SecondaryButton>
          <SecondaryButton onClick={() => setSendStep(1)}><Send size={17} />Comenzar envíos</SecondaryButton>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Pegar lista" subtitle="Ejemplo: María López, 4075551234" />
        <div className="mt-4 grid gap-3">
          <textarea className="input min-h-28" value={pastedProspects} onChange={(event) => setPastedProspects(event.target.value)} placeholder={'María López, 4075551234\nJohn Smith, 3215559876'} />
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={importPastedProspects}><Import size={17} />Importar lista pegada</PrimaryButton>
            <SecondaryButton onClick={() => setConfigOpen(true)}><Settings size={17} />CSV y backups</SecondaryButton>
          </div>
        </div>
      </Card>

      {renderPeople()}
      {renderSend()}
    </SectionShell>
  );

  const tasksForCurrentGroup = () => {
    const source = taskGroup === 'Hoy' ? todaysTasks : taskGroup === 'Vencidas' ? overdueTasks : taskGroup === 'Próximas' ? upcomingTasks : completedTasks;
    return source.filter((task) => taskFilter === 'Todas' || task.kind === taskFilter);
  };

  const openTaskChannel = async (task: FollowUpTask, channel: 'WhatsApp' | 'SMS') => {
    if (task.queueItemId) {
      const queueItem = queue.find((item) => item.id === task.queueItemId);
      if (!queueItem) return setNotice('No se encontró la cola de envío.');
      if (channel === 'WhatsApp') await openWhatsApp(queueItem);
      else await openSms(queueItem);
      return;
    }
    const pseudoContact = {
      firstName: task.contactName.split(' ')[0] || task.contactName,
      lastName: task.contactName.split(' ').slice(1).join(' '),
      phone: task.phone,
      countryCode: settings.defaultCountryCode,
      country: settings.defaultCountry,
      category: task.kind === 'LA Fitness' ? 'Prospecto' : 'Miembro',
      listIds: [],
      tags: [],
      createdAt: task.createdAt,
      status: 'Activo',
      preferredChannel: task.channel === 'SMS' ? 'SMS' : 'WhatsApp',
      consent: true
    } as Contact;
    if (channel === 'WhatsApp') await openWhatsApp(pseudoContact, task.message);
    else await openSms(pseudoContact, task.message);
  };

  const completeTask = async (task: FollowUpTask) => {
    if (task.queueItemId) {
      const queueItem = queue.find((item) => item.id === task.queueItemId);
      if (queueItem) await setQueueStatus(queueItem, 'Enviado', true);
      return;
    }
    await completeMemberTask(task);
  };

  const renderTasks = () => {
    const visibleTasks = tasksForCurrentGroup();
    return (
      <SectionShell>
        <Card>
          <SectionTitle title="Tareas" subtitle="Action Hub de Golden Team Connect" />
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {taskGroups.map((group) => <button key={group} onClick={() => setTaskGroup(group)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${taskGroup === group ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'}`}>{group}</button>)}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {taskFilters.map((filter) => <button key={filter} onClick={() => setTaskFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${taskFilter === filter ? 'bg-brandDark text-white' : 'bg-slate-100 text-slate-600'}`}>{filter}</button>)}
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-3">
            {visibleTasks.length ? visibleTasks.map((task) => (
              <article key={`${task.kind}-${task.id}`} className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
                <button onClick={() => setSelectedTaskId(task.id || null)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black">{task.contactName}</h3>
                      <p className="text-sm text-slate-500">{task.title} · {task.program}</p>
                      <p className="mt-1 text-xs text-slate-500">{shortDate(task.dueDate)} · {task.dueTime} · {task.channel} · Día {task.programDay ?? '-'}</p>
                    </div>
                    <Badge tone={task.status === 'Completada' ? 'good' : task.dueDate < todayKey() ? 'bad' : 'blue'}>{task.kind}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{task.message}</p>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => setSelectedTaskId(task.id || null)}>Abrir</SecondaryButton>
                  <SecondaryButton onClick={() => openTaskChannel(task, 'WhatsApp')}><MessageCircle size={16} />WhatsApp</SecondaryButton>
                  <SecondaryButton onClick={() => openTaskChannel(task, 'SMS')}><Smartphone size={16} />SMS</SecondaryButton>
                  <SecondaryButton onClick={() => completeTask(task)}><Check size={16} />Completar</SecondaryButton>
                </div>
              </article>
            )) : <Card><p className="text-sm text-slate-500">No hay tareas en esta vista.</p></Card>}
          </div>

          <Card>
            <SectionTitle title="Detalle" subtitle={selectedTask ? selectedTask.contactName : 'Selecciona una tarea'} />
            {selectedTask ? (
              <div className="mt-4 grid gap-3">
                <Badge tone="blue">{selectedTask.kind} · {selectedTask.status}</Badge>
                <p className="text-sm text-slate-600">{selectedTask.program} · {shortDate(selectedTask.dueDate)} · {selectedTask.dueTime}</p>
                <div className="rounded-3xl bg-slate-50 p-4"><p className="whitespace-pre-wrap text-sm">{selectedTask.message}</p></div>
                <div className="grid grid-cols-2 gap-2">
                  <SecondaryButton onClick={() => copyMessage(selectedTask.message)}><Copy size={16} />Copiar</SecondaryButton>
                  <SecondaryButton onClick={() => openTaskChannel(selectedTask, 'WhatsApp')}><MessageCircle size={16} />WhatsApp</SecondaryButton>
                  <SecondaryButton onClick={() => openTaskChannel(selectedTask, 'SMS')}><Smartphone size={16} />SMS</SecondaryButton>
                  <SecondaryButton onClick={() => callContact({ firstName: selectedTask.contactName, lastName: '', phone: selectedTask.phone, countryCode: settings.defaultCountryCode, country: settings.defaultCountry, category: 'Otro', listIds: [], tags: [], createdAt: selectedTask.createdAt, status: 'Activo', preferredChannel: 'WhatsApp', consent: true })}><Phone size={16} />Llamar</SecondaryButton>
                  <PrimaryButton onClick={() => completeTask(selectedTask)}><Check size={16} />Completar</PrimaryButton>
                  <SecondaryButton onClick={() => addTaskNote(selectedTask)}><Plus size={16} />Añadir nota</SecondaryButton>
                </div>
                {!selectedTask.queueItemId && selectedTask.id && selectedTask.id > 0 ? (
                  <div className="grid gap-2">
                    <p className="text-sm font-bold text-slate-700">Posponer</p>
                    <div className="grid grid-cols-2 gap-2">
                      <SecondaryButton onClick={() => postponeMemberTask(selectedTask, 'today')}>Más tarde hoy</SecondaryButton>
                      <SecondaryButton onClick={() => postponeMemberTask(selectedTask, 'tomorrow')}>Mañana 10:00</SecondaryButton>
                      <SecondaryButton onClick={() => postponeMemberTask(selectedTask, 'three')}>En 3 días</SecondaryButton>
                      <SecondaryButton onClick={() => postponeMemberTask(selectedTask, 'custom')}>Elegir fecha</SecondaryButton>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">Las tareas vencidas y de hoy se revisan cada vez que abres la app.</p>}
          </Card>
        </div>
      </SectionShell>
    );
  };

  const renderThemePicker = () => (
    <div className="grid gap-2 sm:grid-cols-2">
      {themeOptions.map((theme) => (
        <button
          key={theme.id}
          onClick={() => saveProfilePatch({ visualTheme: theme.id }, `Tema ${theme.label} aplicado.`)}
          className={`rounded-3xl border p-4 text-left transition ${settings.visualTheme === theme.id ? 'border-brand bg-brand text-white' : 'border-slate-100 bg-slate-50 text-ink'}`}
        >
          <span className="block font-black">{theme.label}</span>
          <span className={`mt-1 block text-sm ${settings.visualTheme === theme.id ? 'text-white/75' : 'text-slate-500'}`}>{theme.detail}</span>
        </button>
      ))}
    </div>
  );

  const renderProfile = () => (
    <div className="fixed inset-0 z-40 bg-ink/45 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm" onClick={() => setProfileOpen(false)}>
      <div className="mx-auto max-h-[92vh] max-w-2xl overflow-auto rounded-[2rem] bg-white p-5 shadow-soft" onClick={(event) => event.stopPropagation()}>
        <SectionTitle title="Perfil" subtitle="Tu acceso interno y enlace personal" action={<IconButton label="Cerrar" onClick={() => setProfileOpen(false)}><X /></IconButton>} />
        <div className="mt-4 grid gap-4">
          <Card className="bg-brand text-white">
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="Golden Team" className="h-16 w-16 rounded-3xl object-cover" />
              <div>
                <p className="text-sm text-white/70">Estado de sesión</p>
                <h3 className="text-2xl font-black">{settings.sessionActive ? 'Sesión iniciada' : 'Sesión cerrada'}</h3>
              </div>
            </div>
          </Card>

          <form className="grid gap-3" onSubmit={saveSettings}>
            <Field label="Nombre"><input className="input" value={settings.ownerName} onChange={(event) => setSettings((current) => ({ ...current, ownerName: event.target.value }))} /></Field>
            <Field label="Feel Great Link"><input className="input" value={settings.feelGreatLink || ''} onChange={(event) => setSettings((current) => ({ ...current, feelGreatLink: normalizeFeelGreatLink(event.target.value) }))} placeholder="https://..." /></Field>
            {settings.feelGreatLink && !isValidFeelGreatLink(settings.feelGreatLink) ? <Badge tone="warn">Revisa que hayas pegado tu enlace completo.</Badge> : null}
            <PrimaryButton type="submit"><Check size={17} />Guardar perfil</PrimaryButton>
          </form>

          <Card>
            <SectionTitle title="Mi Feel Great Link" subtitle={settings.feelGreatLink ? settings.feelGreatLink : 'Aun no has guardado tu enlace'} />
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <SecondaryButton onClick={copyFeelGreatLink}><Copy size={16} />Copiar</SecondaryButton>
              <SecondaryButton onClick={shareFeelGreatLink}><Share2 size={16} />Compartir</SecondaryButton>
              <SecondaryButton onClick={openFeelGreatLink}><ExternalLink size={16} />Abrir</SecondaryButton>
              <SecondaryButton onClick={() => setNotice('Edita el enlace arriba y toca Guardar perfil.')}><Edit3 size={16} />Editar</SecondaryButton>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Tema visual" subtitle="Cuatro estilos prediseñados con buen contraste" />
            <div className="mt-4">{renderThemePicker()}</div>
          </Card>

          <SecondaryButton onClick={closeSession}><X size={17} />Cerrar sesión</SecondaryButton>
        </div>
      </div>
    </div>
  );

  const renderConfig = () => (
    <div className="fixed inset-0 z-40 bg-ink/35 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm" onClick={() => setConfigOpen(false)}>
      <div className="mx-auto grid max-h-[92vh] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-soft lg:grid-cols-[280px_1fr]" onClick={(event) => event.stopPropagation()}>
        <aside className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-black">Configuracion</h2><p className="text-sm text-slate-500">Funciones avanzadas</p></div>
            <IconButton label="Cerrar" onClick={() => setConfigOpen(false)}><X /></IconButton>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto lg:grid">
            {configPanels.map((panel) => <button key={panel.id} onClick={() => setConfigPanel(panel.id)} className={`flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-bold ${configPanel === panel.id ? 'bg-brand text-white' : 'bg-slate-50 text-slate-600'}`}>{panel.icon}{panel.label}</button>)}
          </div>
        </aside>
        <div className="max-h-[92vh] overflow-auto p-5">
          {configPanel === 'ubicaciones' ? (
            <div className="grid gap-4">
              <SectionTitle title="Ubicaciones" subtitle="Junction, Maitland y listas internas" />
              <form className="flex gap-2" onSubmit={saveList}><input className="input" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Nombre de lista" /><PrimaryButton type="submit"><Check size={17} /></PrimaryButton></form>
              <div className="grid gap-3 md:grid-cols-2">
                {lists.map((list) => {
                  const members = contacts.filter((contact) => contact.listIds.includes(list.id!));
                  return <article key={list.id} className="rounded-3xl border border-slate-100 p-4"><h3 className="font-black">{list.name}</h3><p className="text-sm text-slate-500">{members.length} personas</p><div className="mt-3 flex flex-wrap gap-2"><SecondaryButton onClick={() => { setListName(list.name); setEditingListId(list.id!); }}><Edit3 size={16} />Editar</SecondaryButton><SecondaryButton onClick={() => duplicateList(list)}><Copy size={16} />Duplicar</SecondaryButton><SecondaryButton onClick={() => downloadFile(exportContactsCsv(members), `${list.name}.csv`, 'text/csv')}><Download size={16} />CSV</SecondaryButton><SecondaryButton onClick={() => deleteList(list.id)}><Trash2 size={16} />Eliminar</SecondaryButton></div></article>;
                })}
              </div>
            </div>
          ) : null}

          {configPanel === 'mensajesMiembros' || configPanel === 'mensajesLa' ? (
            <div className="grid gap-4">
              <SectionTitle title={configPanel === 'mensajesMiembros' ? 'Mensajes de miembros' : 'Mensajes de LA Fitness'} subtitle="Mensajes guardados editables" />
              <form className="grid gap-3" onSubmit={saveTemplate}>
                <Field label="Nombre"><input className="input" value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Mensaje"><textarea className="input min-h-40" value={templateForm.body} onChange={(event) => setTemplateForm((current) => ({ ...current, body: event.target.value }))} /></Field>
                <p className="text-sm text-slate-500">{templateForm.body.length} caracteres · {smsSegments(templateForm.body)} segmento(s) SMS</p>
                <PrimaryButton type="submit"><Check size={17} />Guardar</PrimaryButton>
              </form>
              <input className="input" placeholder="Buscar mensaje guardado" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} />
              <select className="input" value={previewContactId} onChange={(event) => setPreviewContactId(event.target.value ? Number(event.target.value) : '')}><option value="">Persona para probar</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select>
              {templates.filter((template) => template.name.toLowerCase().includes(templateSearch.toLowerCase())).map((template) => {
                const previewContact = contacts.find((contact) => contact.id === previewContactId) || contacts[0];
                return <article key={template.id} className="rounded-3xl border border-slate-100 p-4"><h3 className="font-black">{template.name}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{previewContact ? personalizeMessage(template.body, previewContact, listNames(previewContact.listIds).split(', ')[0] || '', messageContext()) : template.body}</p><div className="mt-3 flex flex-wrap gap-2"><SecondaryButton onClick={() => { setTemplateForm(template); setEditingTemplateId(template.id!); }}><Edit3 size={16} />Editar</SecondaryButton><SecondaryButton onClick={() => db.templates.add({ name: `${template.name} copia`, body: template.body, createdAt: todayIso() }).then(() => loadAll('Mensaje duplicado.'))}><Copy size={16} />Duplicar</SecondaryButton><SecondaryButton onClick={() => deleteTemplate(template.id)}><Trash2 size={16} />Eliminar</SecondaryButton></div></article>;
              })}
            </div>
          ) : null}

          {configPanel === 'semanal' ? (
            <div className="grid gap-4">
              <SectionTitle title="Sistema semanal Golden Team" subtitle="Solo para interesados en negocio o distribuidores" />
              {weeklyEvents.map((eventItem) => (
                <article key={eventItem.id} className="rounded-3xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{eventItem.name}</h3>
                      <p className="text-sm text-slate-500">Día {eventItem.weekday} · Evento {eventItem.eventTime} · Recordatorio {eventItem.reminderTime}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={eventItem.active} onChange={(event) => saveWeeklyEvent(eventItem, { active: event.target.checked })} />Activo</label>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Field label="Enlace"><input className="input" value={eventItem.link} onChange={(event) => saveWeeklyEvent(eventItem, { link: event.target.value })} /></Field>
                    <Field label="Mensaje"><textarea className="input min-h-28" value={eventItem.message} onChange={(event) => saveWeeklyEvent(eventItem, { message: event.target.value })} /></Field>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {configPanel === 'importar' ? (
            <div className="grid gap-4">
              <SectionTitle title="Importar y exportar" subtitle="CSV general, prospectos LA Fitness y exportación" />
              <div className="grid gap-3">
                <div className="grid gap-2 md:grid-cols-3">
                  <select className="input" value={listFilter} onChange={(event) => setListFilter(event.target.value)}><option value="">Todas las listas</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
                  <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Todas las categorias</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
                  <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos los estados</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
                  <select className="input" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}><option value="">Todos los canales</option>{channels.map((item) => <option key={item}>{item}</option>)}</select>
                  <input className="input" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} placeholder="Pais" />
                  <SecondaryButton onClick={() => setSelectedContacts(filteredContacts.map((contact) => contact.id!).filter(Boolean))}>Seleccionar visibles</SecondaryButton>
                </div>
                <input className="input" value={csvDefaultCode} onChange={(event) => setCsvDefaultCode(event.target.value)} placeholder="Codigo de pais por defecto" />
                <textarea className="input min-h-40" value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="nombre,apellido,telefono,codigo_pais,pais,categoria,lista,notas,consentimiento,canal_preferido" />
                <div className="flex flex-wrap gap-2"><PrimaryButton onClick={importCsv}><Upload size={17} />Importar</PrimaryButton><SecondaryButton onClick={() => downloadFile(exportContactsCsv(filteredContacts), 'personas.csv', 'text/csv')}><Download size={17} />Exportar visibles</SecondaryButton>{lists[0] ? <SecondaryButton onClick={() => addSelectedToList(lists[0].id!)}>Anadir seleccionados a {lists[0].name}</SecondaryButton> : null}</div>
              </div>
            </div>
          ) : null}

          {configPanel === 'copias' ? (
            <div className="grid gap-4">
              <SectionTitle title="Copias de seguridad" subtitle="Exportar o restaurar datos locales" />
              <PrimaryButton onClick={exportBackup}><Download size={17} />Exportar JSON</PrimaryButton>
              <select className="input" value={restoreMode} onChange={(event) => setRestoreMode(event.target.value as 'replace' | 'merge')}><option value="merge">Combinar sin duplicar numeros</option><option value="replace">Reemplazar todos los datos</option></select>
              <textarea className="input min-h-48" value={backupText} onChange={(event) => setBackupText(event.target.value)} placeholder="Pega aqui el JSON del backup" />
              <PrimaryButton onClick={restoreBackup}><Upload size={17} />Validar y restaurar</PrimaryButton>
              <SectionTitle title="Historial de envios" subtitle="Opciones avanzadas" />
              {campaigns.map((campaign) => <article key={campaign.id} className="rounded-3xl border border-slate-100 p-4"><h3 className="font-black">{campaign.name}</h3><p className="text-sm text-slate-500">{queue.filter((item) => item.campaignId === campaign.id).length} personas</p><div className="mt-3 flex flex-wrap gap-2"><SecondaryButton onClick={() => { setActiveCampaignId(campaign.id!); setActive('laFitness'); setSendStep(3); setConfigOpen(false); }}>Abrir</SecondaryButton><SecondaryButton onClick={() => duplicateCampaign(campaign)}><Copy size={16} />Duplicar</SecondaryButton><SecondaryButton onClick={() => retryFailed(campaign)}><RefreshCw size={16} />Fallidos</SecondaryButton><SecondaryButton onClick={() => exportCampaignSummary(campaign)}><Download size={16} />Resumen</SecondaryButton><SecondaryButton onClick={() => confirm('Eliminar este envio y sus personas pendientes?') && db.transaction('rw', db.campaigns, db.queue, async () => { await db.campaigns.delete(campaign.id!); await db.queue.where('campaignId').equals(campaign.id!).delete(); }).then(() => loadAll('Envio eliminado.'))}><Trash2 size={16} />Eliminar</SecondaryButton></div></article>)}
            </div>
          ) : null}

          {configPanel === 'perfil' ? (
            <form className="grid gap-3" onSubmit={saveSettings}>
              <SectionTitle title="Perfil" subtitle="Datos del propietario y comportamiento" />
              <Field label="Nombre"><input className="input" value={settings.ownerName} onChange={(event) => setSettings((current) => ({ ...current, ownerName: event.target.value }))} /></Field>
              <Field label="Numero personal"><input className="input" value={settings.personalNumber} onChange={(event) => setSettings((current) => ({ ...current, personalNumber: event.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Codigo"><input className="input" value={settings.defaultCountryCode} onChange={(event) => setSettings((current) => ({ ...current, defaultCountryCode: event.target.value }))} /></Field><Field label="Pais"><input className="input" value={settings.defaultCountry} onChange={(event) => setSettings((current) => ({ ...current, defaultCountry: event.target.value }))} /></Field></div>
              <Field label="Canal preferido"><select className="input" value={settings.preferredChannel} onChange={(event) => setSettings((current) => ({ ...current, preferredChannel: event.target.value as Channel }))}>{channels.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <PrimaryButton type="submit"><Check size={17} />Guardar</PrimaryButton>
              <div className="rounded-3xl border border-red-200 bg-red-50 p-4"><p className="font-black text-red-800">Borrar todos los datos</p><input className="input mt-2" value={doubleDelete} onChange={(event) => setDoubleDelete(event.target.value)} placeholder="Escribe BORRAR" /><SecondaryButton className="mt-2" onClick={deleteAllData}><Trash2 size={17} />Borrar datos locales</SecondaryButton></div>
            </form>
          ) : null}

          {configPanel === 'informacion' ? (
            <div className="grid gap-4 text-sm text-slate-600">
              <SectionTitle title="Información" subtitle="Limitaciones reales y estado local" />
              <p>Los datos se guardan localmente en IndexedDB. La app funciona sin backend y no usa servicios pagados.</p>
              <p>WhatsApp y SMS se abren manualmente por persona. No se crean grupos ni envios automaticos.</p>
              <p>Las notificaciones de sistema en iPhone o PWA estática no siempre son confiables en segundo plano; la app mantiene recordatorios internos y los muestra al abrir.</p>
              <p>La arquitectura mantiene el flujo de preparacion separado de la apertura manual, para poder sustituir esta salida por una integracion oficial futura sin reconstruir toda la experiencia.</p>
              <p>Contactos: {contacts.length}. Miembros: {members.length}. Tareas: {tasks.length}. Envios: {campaigns.length}. Personas pendientes: {queue.length}.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderEntry = () => (
    <div className="theme-golden min-h-screen bg-black px-5 py-[calc(env(safe-area-inset-top)+1.25rem)] text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-center">
        <div className="mb-8 overflow-hidden rounded-[2rem] bg-black">
          <img src={logoSrc} alt="Golden Team" className="mx-auto w-full max-w-sm object-contain mix-blend-screen" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Acceso interno del equipo</p>
          <h1 className="mt-3 text-4xl font-black tracking-normal">Golden Team Connect</h1>
          <p className="mt-2 text-white/70">Organiza. Da seguimiento. Mantente conectado.</p>
          <p className="mt-2 text-sm text-white/45">Herramienta interna de Golden Team.</p>
        </div>
        <form className="mt-8 grid gap-4" onSubmit={submitEntry}>
          <Field label="Nombre"><input className="input border-white/10 bg-white/95 text-black" value={entryName} onChange={(event) => setEntryName(event.target.value)} placeholder="Ayhann" /></Field>
          <Field label="Feel Great Link"><input className="input border-white/10 bg-white/95 text-black" value={entryLink} onChange={(event) => setEntryLink(event.target.value)} placeholder="https://..." /></Field>
          <Field label="Código de acceso">
            <div className="flex gap-2">
              <input
                className="input border-white/10 bg-white/95 text-black"
                type={showAccessCode ? 'text' : 'password'}
                value={entryAccessCode}
                onChange={(event) => setEntryAccessCode(normalizeAccessCode(event.target.value))}
                placeholder="Código de acceso"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <IconButton label={showAccessCode ? 'Ocultar código de acceso' : 'Mostrar código de acceso'} onClick={() => setShowAccessCode((current) => !current)}>{showAccessCode ? <EyeOff /> : <Eye />}</IconButton>
            </div>
            <span className="text-xs font-medium text-white/55">Ingresa el código proporcionado por Golden Team.</span>
          </Field>
          {entryError ? <p className="rounded-2xl border border-red-400/40 bg-red-500/15 p-3 text-sm font-bold text-red-100">{entryError}</p> : null}
          <PrimaryButton type="submit" className="bg-gold text-black hover:bg-goldDark"><Check size={18} />Entrar</PrimaryButton>
          <p className="text-center text-xs leading-relaxed text-white/45">Esta es una puerta de acceso simple local, no autenticación profesional. No usa backend.</p>
        </form>
      </div>
    </div>
  );

  return (
    !ready ? (
      <div className="theme-golden grid min-h-screen place-items-center bg-black text-white">Cargando Golden Team Connect...</div>
    ) : !settings.sessionActive ? (
      renderEntry()
    ) : (
    <div className={`theme-${settings.visualTheme || 'golden'} min-h-screen bg-soft text-ink lg:flex`}>
      {nav}
      <main className="w-full px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-[calc(env(safe-area-inset-top)+1rem)] lg:px-8 lg:pb-8">
        <header className="mx-auto mb-5 flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0 lg:hidden">
            <p className="text-xs font-bold text-brand">Golden Team Connect</p>
            <p className="truncate text-sm text-slate-500">Organiza. Da seguimiento. Mantente conectado.</p>
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-brand">Golden Team Connect</p>
            <h1 className="text-3xl font-black tracking-normal">{mainSections.find((section) => section.id === active)?.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => setActive('laFitness')} className="hidden sm:inline-flex"><MapPin size={17} />LA Fitness</SecondaryButton>
            <IconButton label="Perfil" onClick={() => setProfileOpen(true)}><User /></IconButton>
            <IconButton label="Configuracion" onClick={() => setConfigOpen(true)}><Settings /></IconButton>
          </div>
        </header>

        {active === 'inicio' ? renderHome() : null}
        {active === 'miembros' ? renderMembers() : null}
        {active === 'laFitness' ? renderLaFitness() : null}
        {active === 'tareas' ? renderTasks() : null}
      </main>
      {configOpen ? renderConfig() : null}
      {profileOpen ? renderProfile() : null}
    </div>
    )
  );
}

export default App;
