import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import {
  Bell,
  Camera,
  Check,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  Home,
  ImagePlus,
  Library,
  LogOut,
  MessageCircle,
  Phone,
  Play,
  Plus,
  Send,
  Share2,
  Trash2,
  Upload,
  Users,
  X
} from 'lucide-react';
import { db, defaultSettings, ensureSettings } from './db';
import { isValidAccessCode, normalizeAccessCode } from './accessConfig';
import type { AppLanguage, AppSettings, Campaign, Channel, Contact, ContactLanguage, FollowUpTask, InternalList, MediaAsset, Member, QueueItem, QueueStatus, WeeklyEvent } from './types';
import { exportContactsCsv, parseContactsCsv, csvRowToContact } from './utils/csv';
import { buildFirst30DayTasks, currentProgramDay, defaultWeeklyEvents, memberName, parsePastedProspects } from './utils/followup';
import { compressImage, fileToDataUrl, shareImage } from './utils/image';
import { bestQueueIndex, buildSmsLink, buildWhatsAppLink, personalizeMessage } from './utils/messages';
import { isDuplicatePhone, normalizePhone } from './utils/phone';

type MainSection = 'inicio' | 'difusion' | 'seguimiento' | 'tareas';
type TaskGroup = 'Hoy' | 'Vencidas' | 'Próximas' | 'Completadas';
type TaskFilter = 'Todas' | 'Difusión' | 'Seguimiento' | 'Reuniones';
type Audience = ContactLanguage | 'Manual';

const logoSrc = `${import.meta.env.BASE_URL}golden-team-logo.jpeg`;
const entryLogoSrc = `${import.meta.env.BASE_URL}golden-team-logo-transparent.png`;
const contactLanguages: ContactLanguage[] = ['Español', 'English'];
const taskGroups: TaskGroup[] = ['Hoy', 'Vencidas', 'Próximas', 'Completadas'];
const taskFilters: TaskFilter[] = ['Todas', 'Difusión', 'Seguimiento', 'Reuniones'];

const copy = {
  es: {
    nav: { inicio: 'Inicio', difusion: 'Difusión', seguimiento: 'Seguimiento', tareas: 'Tareas' },
    homeTitle: 'Hola',
    myLink: 'Mi enlace',
    account: 'Cuenta',
    profileInfo: 'Información del perfil',
    feelLink: 'Mi Feel Great Link',
    language: 'Idioma',
    logout: 'Cerrar sesión',
    broadcast: 'Difusión',
    broadcastSub: 'Crea una lista, prepara tu contenido y envíalo contacto por contacto.',
    newList: 'Nueva lista',
    library: 'Biblioteca',
    continueQueue: 'Continuar envío',
    followUps: 'Seguimiento',
    followUpsSub: 'Acompaña cada persona durante sus primeros 30 días.',
    addPeople: 'Añadir personas',
    importContacts: 'Importar contactos',
    tasks: 'Tareas',
    tasksSub: 'Mensajes y acciones que requieren tu atención.',
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
    language: 'Language',
    logout: 'Log out',
    broadcast: 'Broadcast',
    broadcastSub: 'Create a list, prepare your content, and send it contact by contact.',
    newList: 'New list',
    library: 'Library',
    continueQueue: 'Continue sending',
    followUps: 'Follow-ups',
    followUpsSub: 'Support each person during their first 30 days.',
    addPeople: 'Add people',
    importContacts: 'Import contacts',
    tasks: 'Tasks',
    tasksSub: 'Messages and actions that need your attention.',
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
  return new Date().toISOString().slice(0, 10);
}

function shortDate(value?: string, language: AppLanguage = 'es') {
  if (!value) return language === 'en' ? 'No date' : 'Sin fecha';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'es-US', { month: 'short', day: 'numeric' });
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
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>
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
  return <section className={`min-w-0 rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[1.7rem] bg-black p-5 text-white shadow-soft">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-normal">{title}</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/70">{subtitle}</p>
        </div>
        {action}
      </div>
    </section>
  );
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'blue' }) {
  const color =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : tone === 'blue'
            ? 'border-sky-200 bg-sky-50 text-sky-800'
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
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [entryName, setEntryName] = useState('');
  const [entryLink, setEntryLink] = useState('');
  const [entryAccessCode, setEntryAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileLink, setProfileLink] = useState('');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
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
  const [assetName, setAssetName] = useState('');
  const [followForm, setFollowForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    language: 'Español' as ContactLanguage,
    startDate: todayKey(),
    channel: 'WhatsApp' as Exclude<Channel, 'Ambos'>,
    followUpTime: '10:00',
    reminderMinutes: 30 as 15 | 30,
    weeklyEventsActive: false
  });
  const [followImportText, setFollowImportText] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [taskGroup, setTaskGroup] = useState<TaskGroup>('Hoy');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('Todas');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  const lang = settings.preferredLanguage || 'es';
  const c = copy[lang];
  const selectedList = lists.find((list) => list.id === selectedListId) || null;
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) || null;
  const selectedQueue = useMemo(() => queue.filter((item) => item.campaignId === activeCampaignId), [activeCampaignId, queue]);
  const currentQueueItem = selectedQueue[queueIndex];
  const selectedMember = members.find((member) => member.id === selectedMemberId) || null;
  const selectedTask = useMemo(() => [...tasks, ...queueTasksFromQueue(queue)].find((task) => task.id === selectedTaskId) || null, [queue, selectedTaskId, tasks]);

  async function loadAll(message?: string) {
    const [loadedSettings, loadedContacts, loadedLists, loadedCampaigns, loadedQueue, loadedMembers, loadedTasks, loadedEvents, loadedMedia] = await Promise.all([
      ensureSettings(),
      db.contacts.orderBy('firstName').toArray(),
      db.lists.orderBy('name').toArray(),
      db.campaigns.orderBy('createdAt').reverse().toArray(),
      db.queue.orderBy('id').toArray(),
      db.members.orderBy('firstName').toArray(),
      db.tasks.orderBy('dueDate').toArray(),
      db.weeklyEvents.orderBy('weekday').toArray(),
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

  useEffect(() => {
    loadAll('Datos locales cargados.').catch((error) => setNotice(error instanceof Error ? error.message : 'No se pudieron cargar los datos.'));
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

  const listContacts = useMemo(() => {
    if (!selectedList?.id) return [];
    return contacts.filter((contact) => contact.listIds.includes(selectedList.id!));
  }, [contacts, selectedList]);

  const visibleListContacts = useMemo(() => {
    if (listLanguageFilter === 'Todos') return listContacts;
    return listContacts.filter((contact) => contactLanguage(contact) === listLanguageFilter);
  }, [listContacts, listLanguageFilter]);

  const activeFollowPeople = useMemo(() => members.filter((member) => member.programStatus !== 'Completado'), [members]);
  const completedFollowPeople = useMemo(() => members.filter((member) => member.programStatus === 'Completado'), [members]);
  const actionTasks = useMemo(() => [...tasks, ...queueTasksFromQueue(queue)].sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`)), [queue, tasks]);
  const todayTasks = useMemo(() => actionTasks.filter((task) => task.status !== 'Completada' && task.dueDate === todayKey()), [actionTasks]);
  const overdueTasks = useMemo(() => actionTasks.filter((task) => task.status !== 'Completada' && task.dueDate < todayKey()), [actionTasks]);
  const upcomingTasks = useMemo(() => actionTasks.filter((task) => task.status !== 'Completada' && task.dueDate > todayKey()), [actionTasks]);
  const completedTasks = useMemo(() => actionTasks.filter((task) => task.status === 'Completada'), [actionTasks]);
  const taskBadge = todayTasks.length + overdueTasks.length;

  function queueTasksFromQueue(items: QueueItem[]): FollowUpTask[] {
    return items
      .filter((item) => item.status === 'Pendiente' || item.status === 'Abierto')
      .map((item) => ({
        id: -Number(item.id || 0),
        queueItemId: item.id,
        contactId: item.contactId,
        kind: 'Difusión',
        program: 'Difusión manual',
        title: item.status === 'Abierto' ? (lang === 'en' ? 'Confirm send' : 'Confirmar envío') : (lang === 'en' ? 'Send message' : 'Enviar mensaje'),
        contactName: contactFullName(item.contactSnapshot),
        phone: item.contactSnapshot.phone,
        channel: item.channel === 'WhatsApp' || item.channel === 'SMS' ? item.channel : 'No definido',
        language: item.language || contactLanguage(item.contactSnapshot),
        dueDate: item.createdAt.slice(0, 10),
        dueTime: '10:00',
        message: item.personalizedMessage,
        status: 'Pendiente',
        createdAt: item.createdAt,
        sourceKey: `queue:${item.id}`
      }));
  }

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

  async function importFromDeviceContacts(target: 'broadcast' | 'follow') {
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
        name: assetName.trim() || file.name,
        type: file.type,
        dataUrl: payload.dataUrl,
        size: payload.size,
        kind: file.type.startsWith('image/') ? 'image' : 'video',
        createdAt: todayIso()
      });
      setAssetName('');
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
    if (!online) setNotice(lang === 'en' ? 'WhatsApp may need connection.' : 'WhatsApp puede requerir conexión.');
    window.open(buildWhatsAppLink(phone, text), '_blank', 'noopener,noreferrer');
    if ('personalizedMessage' in target) await setQueueStatus(target, 'Abierto');
  }

  async function openSmsFor(target: QueueItem | FollowUpTask | Contact, message?: string) {
    const phone = 'contactSnapshot' in target ? target.contactSnapshot.phone : target.phone;
    const text = 'personalizedMessage' in target ? target.personalizedMessage : message || ('message' in target ? target.message : '');
    window.location.href = buildSmsLink(phone, text);
    if ('personalizedMessage' in target) await setQueueStatus(target, 'Abierto');
  }

  async function saveFollowPerson(event: FormEvent) {
    event.preventDefault();
    const preview = normalizePhone(followForm.phone, settings.defaultCountryCode);
    if (!followForm.firstName.trim()) return setNotice(lang === 'en' ? 'Name is required.' : 'Escribe el nombre.');
    if (!preview.valid) return setNotice(preview.message);
    if (isDuplicatePhone(preview.normalized, members.map((member) => member.phone))) return setNotice(lang === 'en' ? 'That phone is already in follow-ups.' : 'Ese teléfono ya existe en seguimiento.');
    const member: Member = {
      firstName: followForm.firstName.trim(),
      lastName: followForm.lastName.trim(),
      phone: preview.normalized,
      countryCode: settings.defaultCountryCode,
      country: settings.defaultCountry,
      purchaseDate: followForm.startDate,
      protocolStartDate: followForm.startDate,
      preferredChannel: followForm.channel,
      language: followForm.language,
      purchaseType: 'No sé',
      interest: 'Solo protocolo',
      programActive: true,
      programStatus: 'Activo',
      weeklyEventsActive: followForm.weeklyEventsActive,
      followUpTime: followForm.followUpTime,
      reminderMinutes: followForm.reminderMinutes,
      createdAt: todayIso()
    };
    const id = await db.members.add(member);
    const saved = { ...member, id };
    await db.tasks.bulkAdd([...buildFirst30DayTasks(saved, settings.feelGreatLink || ''), ...buildWeeklyMeetingTasks(saved, weeklyEvents.length ? weeklyEvents : defaultWeeklyEvents)]);
    setFollowForm({ firstName: '', lastName: '', phone: '', language: 'Español', startDate: todayKey(), channel: 'WhatsApp', followUpTime: '10:00', reminderMinutes: 30, weeklyEventsActive: false });
    await loadAll(lang === 'en' ? 'Follow-up started.' : 'Seguimiento activado.');
  }

  async function importFollowPaste() {
    const parsed = parsePastedProspects(followImportText, members.map((member) => member.phone), settings.defaultCountryCode);
    if (!parsed.contacts.length) return setNotice(lang === 'en' ? 'No valid people found.' : 'No se encontraron personas válidas.');
    for (const contact of parsed.contacts) {
      await db.members.add({
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        countryCode: contact.countryCode,
        country: contact.country,
        purchaseDate: todayKey(),
        protocolStartDate: '',
        preferredChannel: 'WhatsApp',
        language: 'Español',
        purchaseType: 'No sé',
        interest: 'Solo protocolo',
        programActive: false,
        programStatus: 'Sin iniciar',
        weeklyEventsActive: false,
        followUpTime: '10:00',
        reminderMinutes: 30,
        createdAt: todayIso()
      });
    }
    setFollowImportText('');
    await loadAll(lang === 'en' ? 'People imported. Open each one to activate.' : 'Personas importadas. Abre cada una para activarla.');
  }

  function buildWeeklyMeetingTasks(member: Member, events: WeeklyEvent[]): FollowUpTask[] {
    if (!member.id || !member.protocolStartDate || !member.weeklyEventsActive) return [];
    const result: FollowUpTask[] = [];
    const start = new Date(`${member.protocolStartDate}T00:00:00`);
    for (let offset = 0; offset <= 30; offset += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const dueDate = date.toISOString().slice(0, 10);
      events.forEach((event) => {
        if (!event.active || date.getDay() !== event.weekday) return;
        const language = member.language || 'Español';
        result.push({
          memberId: member.id,
          kind: 'Reunión',
          program: 'Sistema semanal Golden Team',
          title: event.name,
          contactName: memberName(member),
          phone: member.phone,
          channel: member.preferredChannel,
          language,
          dueDate,
          dueTime: event.reminderTime,
          reminderMinutes: 30,
          message: (language === 'English' ? event.messageEn || event.message : event.message).replaceAll('{{nombre_contacto}}', member.firstName).replaceAll('{{enlace_evento}}', event.link),
          status: 'Pendiente',
          createdAt: todayIso(),
          sourceKey: `member:${member.id}:meeting:${event.name}:${dueDate}`,
          meetingLink: event.link
        });
      });
    }
    return result;
  }

  async function regenerateFollowTasks(member: Member) {
    if (!member.id) return;
    const existingCompleted = await db.tasks.where('memberId').equals(member.id).and((task) => task.status === 'Completada').toArray();
    await db.tasks.where('memberId').equals(member.id).and((task) => task.status !== 'Completada').delete();
    const nextTasks = [...buildFirst30DayTasks(member, settings.feelGreatLink || ''), ...buildWeeklyMeetingTasks(member, weeklyEvents.length ? weeklyEvents : defaultWeeklyEvents)].filter((task) => !existingCompleted.some((done) => done.sourceKey === task.sourceKey));
    if (nextTasks.length) await db.tasks.bulkAdd(nextTasks);
    await loadAll(lang === 'en' ? 'Tasks regenerated.' : 'Tareas regeneradas.');
  }

  async function completeTask(task: FollowUpTask, channel?: 'WhatsApp' | 'SMS') {
    if (!task.id || task.id < 0) {
      const item = queue.find((candidate) => candidate.id === task.queueItemId);
      if (item) await setQueueStatus(item, 'Enviado');
      return;
    }
    await db.tasks.update(task.id, { status: 'Completada', completedAt: todayIso(), completedChannel: channel });
    if (task.programDay === 30 && task.memberId) await db.members.update(task.memberId, { programStatus: 'Completado', programActive: false });
    await loadAll(lang === 'en' ? 'Task completed.' : 'Tarea completada.');
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
    { id: 'difusion', icon: <Send size={20} />, label: c.nav.difusion },
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

  const renderHome = () => (
    <div className="grid gap-4">
      <button onClick={() => setAccountOpen(true)} className="min-w-0 rounded-[2rem] bg-black p-5 text-left text-white shadow-soft">
        <div className="flex min-w-0 items-center gap-4">
          <img src={logoSrc} alt="Golden Team" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gold">{c.homeTitle}, {firstName(settings)}</p>
            <h1 className="mt-1 truncate text-2xl font-black tracking-normal">{displayName(settings)}</h1>
            <p className="mt-1 truncate text-sm text-white/65">{readableUrl(settings.feelGreatLink)}</p>
          </div>
          {settings.profilePhoto ? <img src={settings.profilePhoto} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10 text-xl font-black">{initials(displayName(settings))}</div>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <SecondaryButton onClick={copyFeelGreatLink} className="border-white/15 bg-white/10 text-white hover:border-gold hover:text-gold"><Copy size={16} />{c.copy}</SecondaryButton>
          <SecondaryButton onClick={shareFeelGreatLink} className="border-white/15 bg-white/10 text-white hover:border-gold hover:text-gold"><Share2 size={16} />{c.share}</SecondaryButton>
          <SecondaryButton onClick={openFeelGreatLink} className="border-white/15 bg-white/10 text-white hover:border-gold hover:text-gold"><ExternalLink size={16} />{c.myLink}</SecondaryButton>
        </div>
      </button>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-xs font-bold text-slate-500">{c.broadcast}</p><strong className="text-3xl text-ink">{lists.length}</strong><p className="text-sm text-slate-500">listas</p></Card>
        <Card><p className="text-xs font-bold text-slate-500">{c.followUps}</p><strong className="text-3xl text-ink">{activeFollowPeople.length}</strong><p className="text-sm text-slate-500">activas</p></Card>
        <Card><p className="text-xs font-bold text-slate-500">{c.tasks}</p><strong className="text-3xl text-ink">{taskBadge}</strong><p className="text-sm text-slate-500">{lang === 'en' ? 'today + overdue' : 'hoy + vencidas'}</p></Card>
      </div>
      <Card>
        <h2 className="text-lg font-black text-ink">{lang === 'en' ? 'Next actions' : 'Próximas acciones'}</h2>
        <div className="mt-3 grid gap-2">
          {[...overdueTasks, ...todayTasks].slice(0, 4).map((task) => (
            <button key={`${task.id}-${task.sourceKey}`} onClick={() => { setSelectedTaskId(task.id || null); setActive('tareas'); }} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-left">
              <span className="min-w-0"><strong className="block truncate text-sm text-ink">{task.contactName}</strong><span className="block truncate text-xs text-slate-500">{task.title}</span></span>
              <Badge tone={task.dueDate < todayKey() ? 'bad' : 'warn'}>{shortDate(task.dueDate, lang)}</Badge>
            </button>
          ))}
          {!todayTasks.length && !overdueTasks.length ? <p className="text-sm text-slate-500">{lang === 'en' ? 'No urgent actions right now.' : 'No hay acciones urgentes ahora.'}</p> : null}
        </div>
      </Card>
    </div>
  );

  const renderAccount = () => (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-soft px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="mx-auto grid max-w-2xl gap-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setAccountOpen(false)} className="inline-flex items-center gap-2 text-sm font-black text-brand"><ChevronLeft size={18} />{c.account}</button>
          <IconButton label="Cerrar" onClick={() => setAccountOpen(false)}><X /></IconButton>
        </div>
        <Header title={displayName(settings)} subtitle={readableUrl(settings.feelGreatLink)} action={settings.profilePhoto ? <img src={settings.profilePhoto} className="h-16 w-16 rounded-full object-cover" alt="" /> : <div className="grid h-16 w-16 rounded-full bg-white/10 text-xl font-black">{initials(displayName(settings))}</div>} />
        <Card>
          <h2 className="text-lg font-black text-ink">{c.profileInfo}</h2>
          <form className="mt-4 grid gap-3" onSubmit={saveProfile}>
            <Field label={c.name}><input className="input" value={profileName} onChange={(event) => setProfileName(event.target.value)} /></Field>
            <input ref={photoInputRef} className="hidden" type="file" accept="image/*" onChange={handleProfilePhoto} />
            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={() => photoInputRef.current?.click()}><Camera size={16} />{settings.profilePhoto ? (lang === 'en' ? 'Change photo' : 'Cambiar foto') : (lang === 'en' ? 'Add photo' : 'Añadir foto')}</SecondaryButton>
              {settings.profilePhoto ? <SecondaryButton onClick={() => saveSettingsPatch({ profilePhoto: '' }, lang === 'en' ? 'Photo removed.' : 'Foto eliminada.')}><Trash2 size={16} />{lang === 'en' ? 'Remove photo' : 'Eliminar foto'}</SecondaryButton> : null}
              <PrimaryButton type="submit"><Check size={16} />{c.save}</PrimaryButton>
            </div>
          </form>
        </Card>
        <Card>
          <h2 className="text-lg font-black text-ink">{c.feelLink}</h2>
          <form className="mt-4 grid gap-3" onSubmit={saveProfile}>
            <Field label="Feel Great Link"><input className="input" value={profileLink} onChange={(event) => setProfileLink(event.target.value)} /></Field>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit"><Check size={16} />{c.save}</PrimaryButton>
              <SecondaryButton onClick={copyFeelGreatLink}><Copy size={16} />{c.copy}</SecondaryButton>
              <SecondaryButton onClick={shareFeelGreatLink}><Share2 size={16} />{c.share}</SecondaryButton>
              <SecondaryButton onClick={openFeelGreatLink}><ExternalLink size={16} />{c.open}</SecondaryButton>
            </div>
          </form>
        </Card>
        <Card>
          <h2 className="text-lg font-black text-ink">{c.language}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => saveSettingsPatch({ preferredLanguage: 'es' }, 'Idioma actualizado.')} className={`rounded-2xl p-4 text-sm font-black ${lang === 'es' ? 'bg-black text-white' : 'bg-slate-100 text-slate-700'}`}>Español</button>
            <button onClick={() => saveSettingsPatch({ preferredLanguage: 'en' }, 'Language updated.')} className={`rounded-2xl p-4 text-sm font-black ${lang === 'en' ? 'bg-black text-white' : 'bg-slate-100 text-slate-700'}`}>English</button>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-black text-ink">{lang === 'en' ? 'Technical backup' : 'Backup técnico'}</h2>
          <p className="mt-1 text-sm text-slate-500">{lang === 'en' ? 'Local export for your own records.' : 'Exportación local para tus propios registros.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SecondaryButton onClick={() => downloadFile(JSON.stringify({ app: 'difusion-local-privada', version: 1, exportedAt: todayIso(), contacts, lists, campaigns, queue, members, tasks, weeklyEvents, mediaAssets, settings }, null, 2), `backup-golden-team-${todayKey()}.json`, 'application/json')}><Download size={16} />Exportar backup</SecondaryButton>
            <SecondaryButton onClick={closeSession}><LogOut size={16} />{c.logout}</SecondaryButton>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderBroadcast = () => {
    if (selectedList) return renderBroadcastList();
    return (
      <div className="grid gap-4">
        <Header title={c.broadcast} subtitle={c.broadcastSub} />
        <div className="grid gap-2 sm:grid-cols-3">
          <PrimaryButton onClick={() => document.getElementById('new-list-name')?.focus()}><Plus size={17} />{c.newList}</PrimaryButton>
          <SecondaryButton onClick={() => mediaInputRef.current?.click()}><Library size={17} />{c.library}</SecondaryButton>
          <SecondaryButton onClick={() => { const pending = campaigns.find((campaign) => queue.some((item) => item.campaignId === campaign.id && ['Pendiente', 'Abierto'].includes(item.status))); if (pending?.id) { setActiveCampaignId(pending.id); setSelectedListId(pending.listIds[0] || null); } }}><Play size={17} />{c.continueQueue}</SecondaryButton>
        </div>
        <Card>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={createList}>
            <Field label={lang === 'en' ? 'List name' : 'Nombre de la lista'}><input id="new-list-name" className="input" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="LA Fitness" /></Field>
            <PrimaryButton type="submit" className="self-end"><Plus size={17} />{c.newList}</PrimaryButton>
          </form>
        </Card>
        <div className="grid gap-3">
          {lists.map((list) => {
            const stats = listStats(list);
            return (
              <button key={list.id} onClick={() => { setSelectedListId(list.id!); setMessageEs(list.lastMessageEs || ''); setMessageEn(list.lastMessageEn || ''); }} className="min-w-0 rounded-[1.4rem] border border-slate-100 bg-white p-4 text-left shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-ink">{list.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{stats.total} contactos · {stats.es} Español · {stats.en} English</p>
                  </div>
                  {stats.pending ? <Badge tone="warn">{stats.pending} pendientes</Badge> : <Badge>{stats.lastSent ? shortDate(stats.lastSent, lang) : 'Sin envío'}</Badge>}
                </div>
              </button>
            );
          })}
          {!lists.length ? <Card><p className="text-sm text-slate-500">{lang === 'en' ? 'No lists yet. Create your first list when you are ready.' : 'Todavía no hay listas. Crea tu primera lista cuando estés listo.'}</p></Card> : null}
        </div>
        {renderMediaLibrary()}
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
          <SecondaryButton onClick={() => mediaInputRef.current?.click()}><Library size={17} />{c.library}</SecondaryButton>
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
        <div><h2 className="text-lg font-black text-ink">{c.library}</h2><p className="text-sm text-slate-500">Imágenes y videos guardados localmente.</p></div>
        <div className="flex gap-2"><input className="input w-40" value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="Nombre" /><SecondaryButton onClick={() => mediaInputRef.current?.click()}><ImagePlus size={16} />Añadir</SecondaryButton></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {mediaAssets.map((asset) => (
          <article key={asset.id} className="min-w-0 rounded-2xl bg-slate-50 p-3">
            {asset.kind === 'image' ? <img src={asset.dataUrl} alt="" className="h-32 w-full rounded-xl object-cover" /> : <div className="grid h-32 place-items-center rounded-xl bg-black text-white"><FileImage /><span className="text-xs">{asset.type}</span></div>}
            <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0"><strong className="block truncate text-sm text-ink">{asset.name}</strong><span className="text-xs text-slate-500">{Math.round(asset.size / 1024)} KB</span></span>
              <IconButton label={c.delete} onClick={() => deleteMedia(asset.id)}><Trash2 size={16} /></IconButton>
            </div>
          </article>
        ))}
        {!mediaAssets.length ? <p className="text-sm text-slate-500">Sin media guardada.</p> : null}
      </div>
    </Card>
  );

  const renderFollowUps = () => (
    <div className="grid gap-4">
      <Header title={c.followUps} subtitle={c.followUpsSub} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs font-bold text-slate-500">Personas activas</p><strong className="text-3xl">{activeFollowPeople.length}</strong></Card>
        <Card><p className="text-xs font-bold text-slate-500">Hoy</p><strong className="text-3xl">{todayTasks.filter((task) => taskType(task) === 'Seguimiento').length}</strong></Card>
        <Card><p className="text-xs font-bold text-slate-500">Vencidos</p><strong className="text-3xl">{overdueTasks.filter((task) => taskType(task) === 'Seguimiento').length}</strong></Card>
        <Card><p className="text-xs font-bold text-slate-500">30 días</p><strong className="text-3xl">{completedFollowPeople.length}</strong></Card>
      </div>
      <Card>
        <form className="grid gap-3" onSubmit={saveFollowPerson}>
          <h2 className="text-lg font-black text-ink">{c.addPeople}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={c.name}><input className="input" value={followForm.firstName} onChange={(event) => setFollowForm((current) => ({ ...current, firstName: event.target.value }))} /></Field>
            <Field label="Apellido"><input className="input" value={followForm.lastName} onChange={(event) => setFollowForm((current) => ({ ...current, lastName: event.target.value }))} /></Field>
            <Field label={c.phone}><input className="input" value={followForm.phone} onChange={(event) => setFollowForm((current) => ({ ...current, phone: event.target.value }))} /></Field>
            <Field label={c.language}><select className="input" value={followForm.language} onChange={(event) => setFollowForm((current) => ({ ...current, language: event.target.value as ContactLanguage }))}><option>Español</option><option>English</option></select></Field>
            <Field label="Fecha de inicio"><input className="input" type="date" value={followForm.startDate} onChange={(event) => setFollowForm((current) => ({ ...current, startDate: event.target.value }))} /></Field>
            <Field label={c.channel}><select className="input" value={followForm.channel} onChange={(event) => setFollowForm((current) => ({ ...current, channel: event.target.value as Exclude<Channel, 'Ambos'> }))}><option>WhatsApp</option><option>SMS</option></select></Field>
            <Field label="Hora predeterminada"><input className="input" type="time" value={followForm.followUpTime} onChange={(event) => setFollowForm((current) => ({ ...current, followUpTime: event.target.value }))} /></Field>
            <Field label="Recordatorio"><select className="input" value={followForm.reminderMinutes} onChange={(event) => setFollowForm((current) => ({ ...current, reminderMinutes: Number(event.target.value) as 15 | 30 }))}><option value={30}>30 minutos antes</option><option value={15}>15 minutos antes</option></select></Field>
          </div>
          <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={followForm.weeklyEventsActive} onChange={(event) => setFollowForm((current) => ({ ...current, weeklyEventsActive: event.target.checked }))} />Recibir recordatorios del sistema semanal Golden Team</label>
          <PrimaryButton type="submit"><Plus size={17} />Activar programa de 30 días</PrimaryButton>
        </form>
      </Card>
      <Card>
        <h2 className="text-lg font-black text-ink">{c.importContacts}</h2>
        <div className="mt-3 grid gap-3">
          <SecondaryButton onClick={() => importFromDeviceContacts('follow')}><Phone size={16} />Seleccionar desde teléfono</SecondaryButton>
          <Field label="Pegar lista"><textarea className="input min-h-24" value={followImportText} onChange={(event) => setFollowImportText(event.target.value)} /></Field>
          <SecondaryButton onClick={importFollowPaste}><Upload size={16} />Importar para configurar individualmente</SecondaryButton>
        </div>
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
    const pending = tasks.filter((task) => task.memberId === member.id && task.status !== 'Completada').sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`))[0];
    return (
      <button key={member.id} onClick={() => setSelectedMemberId(member.id!)} className="min-w-0 rounded-[1.4rem] border border-slate-100 bg-white p-4 text-left shadow-sm">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="truncate text-lg font-black text-ink">{memberName(member)}</h3><p className="text-sm text-slate-500">{member.phone} · {member.language || 'Español'} · {member.preferredChannel}</p></div>
          <Badge tone={member.programStatus === 'Completado' ? 'good' : 'blue'}>{member.programStatus === 'Completado' ? '100%' : `Día ${Math.min(day ?? 0, 30)} de 30`}</Badge>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} /></div>
        <p className="mt-2 text-sm text-slate-500">{pending ? `${pending.title} · ${shortDate(pending.dueDate, lang)} ${pending.dueTime}` : 'Sin tareas pendientes'}</p>
      </button>
    );
  };

  const renderMemberDetail = (member: Member) => {
    const memberTasks = tasks.filter((task) => task.memberId === member.id).sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`));
    const nextTask = memberTasks.find((task) => task.status !== 'Completada');
    const day = currentProgramDay(member.protocolStartDate);
    const progress = day === null ? 0 : Math.min(100, Math.round((Math.min(day, 30) / 30) * 100));
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-soft px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="mx-auto grid max-w-2xl gap-4">
          <button onClick={() => setSelectedMemberId(null)} className="inline-flex w-fit items-center gap-2 text-sm font-black text-brand"><ChevronLeft size={18} />{c.followUps}</button>
          <Header title={memberName(member)} subtitle={`${member.phone} · ${member.language || 'Español'} · ${member.preferredChannel}`} />
          <Card>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Progreso</p><h2 className="text-3xl font-black text-ink">{member.programStatus === 'Completado' ? '100%' : `${progress}%`}</h2></div><Badge tone="blue">Día {Math.min(day ?? 0, 30)} de 30</Badge></div>
            <div className="mt-3 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} /></div>
            <div className="mt-4 flex flex-wrap gap-2"><SecondaryButton onClick={() => regenerateFollowTasks(member)}><Bell size={16} />Regenerar tareas</SecondaryButton>{member.programStatus === 'Completado' ? <SecondaryButton onClick={() => db.members.update(member.id!, { programStatus: 'Pausado' }).then(() => loadAll('Archivado.'))}>Archivar</SecondaryButton> : null}</div>
          </Card>
          {nextTask ? renderTaskDetail(nextTask) : <Card><p className="text-sm text-slate-500">No hay próxima tarea pendiente.</p></Card>}
          <Card>
            <h2 className="text-lg font-black text-ink">Tareas</h2>
            <div className="mt-3 grid gap-2">{memberTasks.map((task) => <button key={task.id} onClick={() => setSelectedTaskId(task.id || null)} className="rounded-2xl bg-slate-50 p-3 text-left"><strong className="block text-sm text-ink">{task.title}</strong><span className="text-xs text-slate-500">{task.kind} · {shortDate(task.dueDate, lang)} {task.dueTime} · {task.status}</span></button>)}</div>
          </Card>
        </div>
      </div>
    );
  };

  const renderTasks = () => {
    const source = taskGroup === 'Hoy' ? todayTasks : taskGroup === 'Vencidas' ? overdueTasks : taskGroup === 'Próximas' ? upcomingTasks : completedTasks;
    const filtered = source.filter((task) => taskFilter === 'Todas' || taskType(task) === taskFilter);
    return (
      <div className="grid gap-4">
        <Header title={c.tasks} subtitle={c.tasksSub} />
        <div className="flex gap-2 overflow-x-auto pb-1">{taskGroups.map((group) => <button key={group} onClick={() => setTaskGroup(group)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${taskGroup === group ? 'bg-black text-white' : 'bg-white text-slate-600'}`}>{copy.es[group === 'Hoy' ? 'today' : group === 'Vencidas' ? 'overdue' : group === 'Próximas' ? 'upcoming' : 'completed'] || group}</button>)}</div>
        <div className="flex gap-2 overflow-x-auto pb-1">{taskFilters.map((filter) => <button key={filter} onClick={() => setTaskFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${taskFilter === filter ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}>{filter}</button>)}</div>
        <div className="grid gap-3">
          {filtered.map((task) => (
            <button key={`${task.id}-${task.sourceKey}`} onClick={() => setSelectedTaskId(task.id || null)} className="min-w-0 rounded-[1.4rem] border border-slate-100 bg-white p-4 text-left shadow-sm">
              <div className="flex min-w-0 justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-black text-ink">{task.contactName}</h3><p className="text-sm text-slate-500">{task.title}</p></div><Badge tone={task.status === 'Completada' ? 'good' : task.dueDate < todayKey() ? 'bad' : 'warn'}>{task.status}</Badge></div>
              <p className="mt-2 text-sm text-slate-500">{taskType(task)} · {shortDate(task.dueDate, lang)} {task.dueTime} · {task.language || 'Español'} · {task.channel}</p>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{task.message}</p>
            </button>
          ))}
          {!filtered.length ? <Card><p className="text-sm text-slate-500">Sin tareas en esta vista.</p></Card> : null}
        </div>
        {selectedTask ? <div className="fixed inset-0 z-50 overflow-y-auto bg-soft px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]"><div className="mx-auto max-w-2xl">{renderTaskDetail(selectedTask, true)}</div></div> : null}
      </div>
    );
  };

  const renderTaskDetail = (task: FollowUpTask, modal = false) => (
    <Card className="grid gap-4">
      {modal ? <button onClick={() => setSelectedTaskId(null)} className="inline-flex w-fit items-center gap-2 text-sm font-black text-brand"><ChevronLeft size={18} />{c.tasks}</button> : null}
      <div><h2 className="text-xl font-black text-ink">{task.title}</h2><p className="text-sm text-slate-500">{task.contactName} · {task.phone} · {task.language || 'Español'}</p></div>
      <div className="rounded-2xl bg-slate-50 p-3"><p className="whitespace-pre-wrap text-sm text-slate-700">{task.message}</p>{task.meetingLink ? <button onClick={() => window.open(task.meetingLink, '_blank', 'noopener,noreferrer')} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-brand"><ExternalLink size={16} />Zoom</button> : null}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {task.queueItemId ? <PrimaryButton onClick={() => { const item = queue.find((candidate) => candidate.id === task.queueItemId); if (item) { setActiveCampaignId(item.campaignId); setActive('difusion'); setSelectedTaskId(null); } }}><Play size={16} />Abrir cola</PrimaryButton> : null}
        <PrimaryButton onClick={() => openWhatsAppFor(task)}><MessageCircle size={16} />WhatsApp</PrimaryButton>
        <SecondaryButton onClick={() => openSmsFor(task)}><Phone size={16} />SMS</SecondaryButton>
        <SecondaryButton onClick={() => copyMessage(task.message)}><Copy size={16} />Copiar</SecondaryButton>
        <SecondaryButton onClick={() => completeTask(task)}><Check size={16} />Completar</SecondaryButton>
        <SecondaryButton onClick={() => postponeTask(task, '30')}>30 min</SecondaryButton>
        <SecondaryButton onClick={() => postponeTask(task, 'later')}>Más tarde</SecondaryButton>
        <SecondaryButton onClick={() => postponeTask(task, 'tomorrow')}>Mañana 10:00</SecondaryButton>
        <SecondaryButton onClick={() => postponeTask(task, 'custom')}>Elegir fecha</SecondaryButton>
      </div>
    </Card>
  );

  const currentView = active === 'inicio' ? renderHome() : active === 'difusion' ? renderBroadcast() : active === 'seguimiento' ? renderFollowUps() : renderTasks();

  if (!ready) return <div className="theme-golden grid min-h-screen place-items-center bg-black text-white">Cargando Golden Team Connect...</div>;
  if (!settings.sessionActive) return renderEntry();

  return (
    <div className="theme-golden min-h-screen overflow-x-hidden bg-soft text-ink">
      <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)+6.25rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:pb-10">
        {currentView}
        <p className="text-center text-xs text-slate-500">{notice}</p>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActive(item.id)} className={`relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.68rem] font-black leading-tight transition ${active === item.id ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
              {item.icon}
              <span className="max-w-full text-center">{item.label}</span>
              {item.id === 'tareas' && taskBadge ? <span className="absolute right-2 top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[0.65rem] font-black text-black">{taskBadge}</span> : null}
            </button>
          ))}
        </div>
      </nav>
      {accountOpen ? renderAccount() : null}
    </div>
  );
}

export default App;
