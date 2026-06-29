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
  FileImage,
  Home,
  Import,
  ListChecks,
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
  Users,
  X
} from 'lucide-react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { clearAllData, db, defaultSettings, ensureSettings } from './db';
import { removeDemoData, seedDemoData } from './demoData';
import type { AppSettings, Campaign, CampaignImage, CampaignPreview, Channel, Contact, ContactStatus, InternalList, MessageTemplate, QueueItem, QueueStatus } from './types';
import { backupSummary, validateBackup } from './utils/backup';
import { csvRowToContact, exportContactsCsv, parseContactsCsv } from './utils/csv';
import { compressImage, shareImage } from './utils/image';
import { bestQueueIndex, buildSmsLink, buildWhatsAppLink, personalizeMessage, smsSegments } from './utils/messages';
import { isDuplicatePhone, normalizePhone } from './utils/phone';

type MainSection = 'inicio' | 'personas' | 'enviar' | 'seguimiento';
type ConfigPanel = 'listas' | 'mensajes' | 'csv' | 'copias' | 'demo' | 'preferencias' | 'tecnica';
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

const mainSections: Array<{ id: MainSection; label: string; icon: ReactNode }> = [
  { id: 'inicio', label: 'Inicio', icon: <Home size={20} /> },
  { id: 'personas', label: 'Personas', icon: <Users size={20} /> },
  { id: 'enviar', label: 'Enviar', icon: <Send size={20} /> },
  { id: 'seguimiento', label: 'Seguimiento', icon: <Bell size={20} /> }
];

const configPanels: Array<{ id: ConfigPanel; label: string; icon: ReactNode }> = [
  { id: 'listas', label: 'Administrar listas', icon: <ListChecks size={18} /> },
  { id: 'mensajes', label: 'Mensajes guardados', icon: <Clipboard size={18} /> },
  { id: 'csv', label: 'Importar y exportar CSV', icon: <Import size={18} /> },
  { id: 'copias', label: 'Copias de seguridad', icon: <Database size={18} /> },
  { id: 'demo', label: 'Datos de demostracion', icon: <RefreshCw size={18} /> },
  { id: 'preferencias', label: 'Preferencias', icon: <Settings size={18} /> },
  { id: 'tecnica', label: 'Informacion tecnica', icon: <CircleAlert size={18} /> }
];

const categories: Contact['category'][] = ['Miembro', 'Cliente', 'Distribuidor', 'Lider', 'Prospecto', 'Otro'];
const statuses: ContactStatus[] = ['Activo', 'Pausado', 'Dado de baja'];
const channels: Channel[] = ['WhatsApp', 'SMS', 'Ambos'];
const queueStatuses: QueueStatus[] = ['Pendiente', 'Abierto', 'Enviado', 'Omitido', 'Fallido'];
const businessStatuses: BusinessStatus[] = ['Nuevo', 'Mensaje pendiente', 'Contactado', 'Respondio', 'Interesado', 'Requiere llamada', 'Seguimiento', 'Cerrado', 'No respondio', 'No interesado', 'Dado de baja'];
const peopleFilters: PeopleFilter[] = ['Todos', 'Nuevos', 'Contactados', 'Respondieron', 'Seguimiento', 'Cerrados'];
const laLocations = ['Junction', 'Maitland', 'Otra ubicacion'];
const languages = ['Espanol', 'Ingles'];

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
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [notice, setNotice] = useState('Listo.');
  const [configOpen, setConfigOpen] = useState(false);
  const [configPanel, setConfigPanel] = useState<ConfigPanel>('listas');
  const [laMode, setLaMode] = useState(false);
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
    const [loadedSettings, loadedContacts, loadedLists, loadedTemplates, loadedCampaigns, loadedQueue] = await Promise.all([
      ensureSettings(),
      db.contacts.orderBy('firstName').toArray(),
      db.lists.orderBy('name').toArray(),
      db.templates.orderBy('name').toArray(),
      db.campaigns.orderBy('createdAt').reverse().toArray(),
      db.queue.orderBy('id').toArray()
    ]);
    setSettings(loadedSettings);
    setContacts(loadedContacts);
    setLists(loadedLists);
    setTemplates(loadedTemplates);
    setCampaigns(loadedCampaigns);
    setQueue(loadedQueue);
    if (!activeCampaignId && loadedCampaigns[0]?.id) setActiveCampaignId(loadedCampaigns[0].id);
    if (message) setNotice(message);
  }

  useEffect(() => {
    const boot = async () => {
      await seedDemoData();
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
  const phonePreview = useMemo(() => normalizePhone(contactForm.phone, contactForm.countryCode || settings.defaultCountryCode), [contactForm.countryCode, contactForm.phone, settings.defaultCountryCode]);
  const phoneDuplicate = useMemo(() => isDuplicatePhone(phonePreview.normalized, contacts.map((contact) => contact.phone), editingContactId ? contacts.find((contact) => contact.id === editingContactId)?.phone : undefined), [contacts, editingContactId, phonePreview.normalized]);

  const todayContacts = useMemo(() => contacts.filter((contact) => contact.createdAt?.slice(0, 10) === todayKey()), [contacts]);
  const laFitnessContacts = useMemo(() => contacts.filter((contact) => tagValue(contact, 'Gimnasio', '').includes('Junction') || tagValue(contact, 'Gimnasio', '').includes('Maitland') || contact.listIds.some((id) => lists.find((list) => list.id === id)?.name.toLowerCase().includes('fitness'))), [contacts, lists]);

  const attention = useMemo(() => {
    const byBusiness = (values: BusinessStatus[]) => contacts.filter((contact) => values.includes(commercialStatus(contact)));
    return {
      newPeople: byBusiness(['Nuevo']),
      pendingMessages: queue.filter((item) => item.status === 'Pendiente'),
      responded: byBusiness(['Respondio', 'Interesado']),
      followUp: byBusiness(['Requiere llamada', 'Seguimiento', 'No respondio']),
      closable: byBusiness(['Interesado'])
    };
  }, [contacts, queue]);

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
    if (recipientMode === 'Ubicacion especifica') contacts.filter((contact) => tagValue(contact, 'Gimnasio', '') === contactGym).forEach(add);
    if (recipientMode === 'Personas de hoy') todayContacts.forEach(add);
    if (recipientMode === 'Nuevos miembros') contacts.filter((contact) => commercialStatus(contact) === 'Nuevo').forEach(add);
    if (recipientMode === 'Personas que no respondieron') contacts.filter((contact) => commercialStatus(contact) === 'No respondio').forEach(add);
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

  function resetContactForm() {
    setContactForm({ ...blankContact, countryCode: settings.defaultCountryCode, country: settings.defaultCountry });
    setEditingContactId(null);
    setContactLanguage('Espanol');
    setContactGym('Junction');
    setContactProduct('');
    setContactNextAction('Enviar mensaje');
    setContactBusinessStatus('Nuevo');
  }

  function editContact(contact: Contact) {
    setContactForm(contact);
    setEditingContactId(contact.id || null);
    setContactLanguage(tagValue(contact, 'Idioma', 'Espanol'));
    setContactGym(tagValue(contact, 'Gimnasio', 'Junction'));
    setContactProduct(tagValue(contact, 'Muestra', ''));
    setContactNextAction(tagValue(contact, 'Proxima', 'Enviar mensaje'));
    setContactBusinessStatus(commercialStatus(contact));
    setActive('personas');
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
        personalizedMessage: personalizeMessage(campaign.message, contact, names[0] || ''),
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
      await db.transaction('rw', [db.contacts, db.lists, db.templates, db.campaigns, db.queue, db.settings], async () => {
        await Promise.all([db.contacts.clear(), db.lists.clear(), db.templates.clear(), db.campaigns.clear(), db.queue.clear()]);
        await db.contacts.bulkPut(parsed.contacts);
        await db.lists.bulkPut(parsed.lists);
        await db.templates.bulkPut(parsed.templates);
        await db.campaigns.bulkPut(parsed.campaigns);
        await db.queue.bulkPut(parsed.queue);
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
    }
    setBackupText('');
    await loadAll('Backup restaurado.');
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const normalizedPersonal = normalizePhone(settings.personalNumber, settings.defaultCountryCode);
    await db.settings.put({ ...settings, personalNumber: normalizedPersonal.valid ? normalizedPersonal.normalized : settings.personalNumber });
    await loadAll('Preferencias guardadas.');
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
    setActive('enviar');
    await loadAll('Envio duplicado.');
  }

  async function retryFailed(campaign: Campaign) {
    const failed = queue.filter((item) => item.campaignId === campaign.id && item.status === 'Fallido');
    if (!failed.length) return setNotice('No hay fallidos para reintentar.');
    await Promise.all(failed.map((item) => db.queue.update(item.id!, { status: 'Pendiente', completedAt: undefined })));
    setActiveCampaignId(campaign.id!);
    setActive('enviar');
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
          <span className="grid h-12 w-12 place-items-center rounded-3xl bg-brand text-white"><MessageCircle /></span>
          <div>
            <p className="text-lg font-black text-ink">Golden Team Connect</p>
            <p className="text-xs leading-tight text-slate-500">Herramienta independiente para organizacion y seguimiento</p>
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

  const renderHome = () => (
    <SectionShell>
      <div className="rounded-[2rem] bg-gradient-to-br from-brand to-brandDark p-6 text-white shadow-soft">
        <p className="text-sm font-semibold text-sky-100">Golden Team Connect</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Hola, Ayhann</h1>
        <p className="mt-1 max-w-xl text-sky-100">Herramienta independiente para organizacion y seguimiento</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone={online ? 'good' : 'warn'}>{online ? 'En linea' : 'Modo sin conexion'}</Badge>
          <Badge tone="blue">{notice}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <SectionTitle title="Que necesita mi atencion hoy?" subtitle="Acciones de hoy" />
          <div className="mt-4 grid gap-3">
            {[
              { label: 'Nuevas personas', count: attention.newPeople.length, icon: <Users />, target: 'personas' as MainSection },
              { label: 'Mensajes pendientes', count: attention.pendingMessages.length, icon: <MessageCircle />, target: 'enviar' as MainSection },
              { label: 'Respondieron', count: attention.responded.length, icon: <Bell />, target: 'seguimiento' as MainSection },
              { label: 'Requieren seguimiento', count: attention.followUp.length, icon: <CalendarClock />, target: 'seguimiento' as MainSection }
            ].map((item) => (
              <button key={item.label} onClick={() => setActive(item.target)} className="flex items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4 text-left transition hover:bg-sky-50">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brandLight/15 text-brand">{item.icon}</span>
                  <span className="min-w-0 text-sm font-bold leading-tight text-ink sm:text-base">{item.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-brand"><strong className="text-2xl">{item.count}</strong><ArrowRight size={20} /></span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="bg-white">
          <SectionTitle title="LA Fitness" subtitle="Modo rapido para activaciones" action={<Badge tone="blue">Personas por cerrar: {attention.closable.length}</Badge>} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Registrados hoy</p><strong className="text-3xl text-ink">{todayContacts.length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Contactados</p><strong className="text-3xl text-ink">{contacts.filter((contact) => commercialStatus(contact) === 'Contactado').length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Respondieron</p><strong className="text-3xl text-ink">{attention.responded.length}</strong></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Requieren llamada</p><strong className="text-3xl text-ink">{contacts.filter((contact) => commercialStatus(contact) === 'Requiere llamada').length}</strong></div>
          </div>
          <div className="mt-5 grid gap-2">
            <PrimaryButton onClick={() => { resetContactForm(); setLaMode(true); }}><Plus size={18} />Anadir persona</PrimaryButton>
            <SecondaryButton onClick={() => setActive('enviar')}><Send size={18} />Enviar mensaje</SecondaryButton>
            <SecondaryButton onClick={() => setActive('seguimiento')}><Bell size={18} />Continuar seguimiento</SecondaryButton>
          </div>
        </Card>
      </div>
    </SectionShell>
  );

  const renderPeople = () => (
    <SectionShell>
      <Card>
        <SectionTitle title="Personas" subtitle="Lista sencilla de contactos y proximas acciones" action={<PrimaryButton onClick={() => { resetContactForm(); setLaMode(false); }}><Plus size={18} />Anadir</PrimaryButton>} />
        <div className="mt-4 grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={20} />
            <input className="input pl-12" placeholder="Buscar por nombre, telefono o gimnasio" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} />
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
          <SectionTitle title={editingContactId ? 'Editar persona' : 'Nueva persona'} subtitle="Formulario corto para una mano" />
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
            <Field label="Estado de relacion"><select className="input" value={contactBusinessStatus} onChange={(event) => setContactBusinessStatus(event.target.value as BusinessStatus)}>{businessStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Proxima accion"><input className="input" value={contactNextAction} onChange={(event) => setContactNextAction(event.target.value)} /></Field>
            <Field label="Formula o muestra probada"><input className="input" value={contactProduct} onChange={(event) => setContactProduct(event.target.value)} /></Field>
            <Field label="Notas"><textarea className="input min-h-28" value={contactForm.notes || ''} onChange={(event) => setContactForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
            <label className="flex items-start gap-3 rounded-3xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" className="mt-1 h-5 w-5" checked={contactForm.consent} onChange={(event) => setContactForm((current) => ({ ...current, consent: event.target.checked }))} />Acepto recibir comunicaciones por WhatsApp o SMS.</label>
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
        <SectionTitle title="Enviar" subtitle="Tres pasos simples. Cada mensaje se confirma manualmente." action={<Badge tone="blue">Paso {sendStep} de 3</Badge>} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((step) => <button key={step} onClick={() => setSendStep(step as SendStep)} className={`rounded-2xl py-3 text-sm font-black ${sendStep === step ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'}`}>{step === 1 ? 'Destinatarios' : step === 2 ? 'Mensaje' : 'Revisar'}</button>)}
        </div>
      </Card>

      {sendStep === 1 ? (
        <Card>
          <SectionTitle title="Destinatarios" subtitle="Elige un grupo sencillo o personas individuales" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {['LA Fitness', 'Ubicacion especifica', 'Personas de hoy', 'Nuevos miembros', 'Personas que no respondieron', 'Contactos individuales'].map((mode) => (
              <button key={mode} onClick={() => setRecipientMode(mode)} className={`rounded-3xl border p-4 text-left font-bold ${recipientMode === mode ? 'border-brand bg-sky-50 text-brand' : 'border-slate-100 bg-white text-ink'}`}>{mode}</button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Ubicacion"><select className="input" value={contactGym} onChange={(event) => setContactGym(event.target.value)}>{laLocations.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Contactos individuales"><select multiple className="input min-h-32" value={campaignForm.contactIds.map(String)} onChange={(event) => setCampaignForm((current) => ({ ...current, contactIds: Array.from(event.target.selectedOptions).map((option) => Number(option.value)) }))}>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select></Field>
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
          <SectionTitle title="Mensaje" subtitle="Puedes usar {{nombre}} para personalizar" />
          <div className="mt-4 grid gap-3">
            <Field label="Mensaje guardado"><select className="input" value={campaignForm.templateId || ''} onChange={(event) => selectTemplate(event.target.value)}><option value="">Sin mensaje guardado</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Idioma"><select className="input" value={sendLanguage} onChange={(event) => setSendLanguage(event.target.value)}>{languages.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Canal"><select className="input" value={campaignForm.channel} onChange={(event) => setCampaignForm((current) => ({ ...current, channel: event.target.value as Channel }))}>{channels.map((item) => <option key={item}>{item}</option>)}</select></Field>
            </div>
            <Field label="Texto"><textarea className="input min-h-44" value={campaignForm.message} onChange={(event) => setCampaignForm((current) => ({ ...current, message: event.target.value }))} placeholder="Hola {{nombre}}, ..." /></Field>
            <p className="text-sm text-slate-500">{campaignForm.message.length} caracteres · {smsSegments(campaignForm.message)} segmento(s) SMS</p>
            <div className="rounded-3xl border border-slate-100 p-4">
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImage} />
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => fileInputRef.current?.click()}><FileImage size={17} />Imagen opcional</SecondaryButton>
                {campaignImage ? <SecondaryButton onClick={() => setCampaignImage(undefined)}><Trash2 size={17} />Quitar</SecondaryButton> : null}
              </div>
              {campaignImage ? <img src={campaignImage.dataUrl} alt="Vista previa" className="mt-3 max-h-64 rounded-3xl object-cover" /> : <p className="mt-2 text-sm text-slate-500">La imagen se comparte o descarga manualmente. No se adjunta automaticamente.</p>}
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="font-bold">Vista previa</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{campaignPreview.contacts[0] ? personalizeMessage(campaignForm.message, campaignPreview.contacts[0], listNames(campaignPreview.contacts[0].listIds).split(', ')[0] || '') : 'Selecciona destinatarios.'}</p>
            </div>
            <PrimaryButton onClick={() => setSendStep(3)}>Revisar<ChevronRight size={18} /></PrimaryButton>
          </div>
        </Card>
      ) : null}

      {sendStep === 3 ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
          <Card>
            <SectionTitle title="Revisar" subtitle="No se envia automaticamente" />
            <div className="mt-4 grid gap-3">
              <Badge tone="blue">{campaignPreview.contacts.length} destinatarios</Badge>
              <Badge tone={campaignPreview.excluded.length ? 'warn' : 'good'}>{campaignPreview.excluded.length} excluidos</Badge>
              <Badge tone="neutral">Canal: {campaignForm.channel}</Badge>
              <div className="rounded-3xl bg-slate-50 p-4"><p className="whitespace-pre-wrap text-sm">{campaignForm.message || 'Sin mensaje.'}</p></div>
              {campaignImage ? <img src={campaignImage.dataUrl} alt="Imagen" className="max-h-56 rounded-3xl object-cover" /> : null}
              {campaignPreview.excluded.map(({ contact, reason }) => <p key={contact.id} className="text-sm text-slate-500">{contact.firstName} {contact.lastName}: {reason}</p>)}
              <PrimaryButton onClick={() => createCampaign()}>Comenzar envios</PrimaryButton>
            </div>
          </Card>
          <Card>
            <SectionTitle title="Personas pendientes" subtitle={activeCampaign ? activeCampaign.name : 'Selecciona o comienza un envio'} />
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
                  <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Enviado')}><Check size={17} />Enviado</SecondaryButton>
                  <PrimaryButton onClick={() => setQueueStatus(currentQueueItem, 'Enviado', true)}><ChevronRight size={17} />Avanzar</PrimaryButton>
                  <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Omitido')}><X size={17} />Omitido</SecondaryButton>
                  <SecondaryButton onClick={() => setQueueStatus(currentQueueItem, 'Fallido')}><CircleAlert size={17} />Fallido</SecondaryButton>
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

  const followGroup = (title: string, items: Contact[]) => (
    <Card>
      <SectionTitle title={title} subtitle={`${items.length} personas`} />
      <div className="mt-4 grid gap-3">
        {items.map((contact) => {
          const lastQueue = [...queue].reverse().find((item) => item.contactId === contact.id);
          return (
            <article key={contact.id} className="rounded-3xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{contact.firstName} {contact.lastName}</h3>
                  <p className="text-sm text-slate-500">{lastQueue?.personalizedMessage.slice(0, 80) || 'Sin mensaje registrado'}</p>
                  <p className="mt-1 text-xs text-slate-500">Ultima interaccion: {shortDate(lastQueue?.openedAt || lastQueue?.completedAt || lastQueue?.createdAt)} · Proxima: {tagValue(contact, 'Proxima', 'Seguimiento manual')}</p>
                </div>
                <Badge tone={statusTone(commercialStatus(contact))}>{commercialStatus(contact)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SecondaryButton onClick={() => openWhatsApp(contact, `Hola ${contact.firstName}`)}><MessageCircle size={16} />WhatsApp</SecondaryButton>
                <SecondaryButton onClick={() => openSms(contact, `Hola ${contact.firstName}`)}><Smartphone size={16} />SMS</SecondaryButton>
                <SecondaryButton onClick={() => callContact(contact)}><Phone size={16} />Llamar</SecondaryButton>
                <SecondaryButton onClick={() => addNote(contact)}><Plus size={16} />Nota</SecondaryButton>
                <SecondaryButton onClick={() => setBusinessStatus(contact, 'Cerrado')}><Check size={16} />Cerrar</SecondaryButton>
                <SecondaryButton onClick={() => setBusinessStatus(contact, 'Seguimiento')}><CalendarClock size={16} />Programar</SecondaryButton>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );

  const renderFollowUp = () => {
    const responded = contacts.filter((contact) => ['Respondio', 'Interesado'].includes(commercialStatus(contact)));
    const calls = contacts.filter((contact) => commercialStatus(contact) === 'Requiere llamada');
    const pending = contacts.filter((contact) => ['Seguimiento', 'No respondio'].includes(commercialStatus(contact)));
    const closable = contacts.filter((contact) => commercialStatus(contact) === 'Interesado');
    const completed = contacts.filter((contact) => ['Cerrado', 'No interesado', 'Dado de baja'].includes(commercialStatus(contact)));
    return (
      <SectionShell>
        <Card>
          <SectionTitle title="Seguimiento" subtitle="Enfocado en conversaciones y cierres" />
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          {followGroup('Respondieron', responded)}
          {followGroup('Requieren llamada', calls)}
          {followGroup('Seguimiento pendiente', pending)}
          {followGroup('Por cerrar', closable)}
        </div>
        <Card className="opacity-80">
          <SectionTitle title="Historial completado" subtitle={`${completed.length} personas`} />
          <div className="mt-3 flex flex-wrap gap-2">{completed.map((contact) => <Badge key={contact.id}>{contact.firstName} {contact.lastName} · {commercialStatus(contact)}</Badge>)}</div>
        </Card>
      </SectionShell>
    );
  };

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
          {configPanel === 'listas' ? (
            <div className="grid gap-4">
              <SectionTitle title="Administrar listas" subtitle="Categorias internas, no grupos reales" />
              <form className="flex gap-2" onSubmit={saveList}><input className="input" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Nombre de lista" /><PrimaryButton type="submit"><Check size={17} /></PrimaryButton></form>
              <div className="grid gap-3 md:grid-cols-2">
                {lists.map((list) => {
                  const members = contacts.filter((contact) => contact.listIds.includes(list.id!));
                  return <article key={list.id} className="rounded-3xl border border-slate-100 p-4"><h3 className="font-black">{list.name}</h3><p className="text-sm text-slate-500">{members.length} personas</p><div className="mt-3 flex flex-wrap gap-2"><SecondaryButton onClick={() => { setListName(list.name); setEditingListId(list.id!); }}><Edit3 size={16} />Editar</SecondaryButton><SecondaryButton onClick={() => duplicateList(list)}><Copy size={16} />Duplicar</SecondaryButton><SecondaryButton onClick={() => downloadFile(exportContactsCsv(members), `${list.name}.csv`, 'text/csv')}><Download size={16} />CSV</SecondaryButton><SecondaryButton onClick={() => deleteList(list.id)}><Trash2 size={16} />Eliminar</SecondaryButton></div></article>;
                })}
              </div>
            </div>
          ) : null}

          {configPanel === 'mensajes' ? (
            <div className="grid gap-4">
              <SectionTitle title="Mensajes guardados" subtitle="Antes llamados plantillas" />
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
                return <article key={template.id} className="rounded-3xl border border-slate-100 p-4"><h3 className="font-black">{template.name}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{previewContact ? personalizeMessage(template.body, previewContact, listNames(previewContact.listIds).split(', ')[0] || '') : template.body}</p><div className="mt-3 flex flex-wrap gap-2"><SecondaryButton onClick={() => { setTemplateForm(template); setEditingTemplateId(template.id!); }}><Edit3 size={16} />Editar</SecondaryButton><SecondaryButton onClick={() => db.templates.add({ name: `${template.name} copia`, body: template.body, createdAt: todayIso() }).then(() => loadAll('Mensaje duplicado.'))}><Copy size={16} />Duplicar</SecondaryButton><SecondaryButton onClick={() => deleteTemplate(template.id)}><Trash2 size={16} />Eliminar</SecondaryButton></div></article>;
              })}
            </div>
          ) : null}

          {configPanel === 'csv' ? (
            <div className="grid gap-4">
              <SectionTitle title="Importar y exportar CSV" subtitle="Para mover personas desde hojas de calculo" />
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
              {campaigns.map((campaign) => <article key={campaign.id} className="rounded-3xl border border-slate-100 p-4"><h3 className="font-black">{campaign.name}</h3><p className="text-sm text-slate-500">{queue.filter((item) => item.campaignId === campaign.id).length} personas</p><div className="mt-3 flex flex-wrap gap-2"><SecondaryButton onClick={() => { setActiveCampaignId(campaign.id!); setActive('enviar'); setSendStep(3); setConfigOpen(false); }}>Abrir</SecondaryButton><SecondaryButton onClick={() => duplicateCampaign(campaign)}><Copy size={16} />Duplicar</SecondaryButton><SecondaryButton onClick={() => retryFailed(campaign)}><RefreshCw size={16} />Fallidos</SecondaryButton><SecondaryButton onClick={() => exportCampaignSummary(campaign)}><Download size={16} />Resumen</SecondaryButton><SecondaryButton onClick={() => confirm('Eliminar este envio y sus personas pendientes?') && db.transaction('rw', db.campaigns, db.queue, async () => { await db.campaigns.delete(campaign.id!); await db.queue.where('campaignId').equals(campaign.id!).delete(); }).then(() => loadAll('Envio eliminado.'))}><Trash2 size={16} />Eliminar</SecondaryButton></div></article>)}
            </div>
          ) : null}

          {configPanel === 'demo' ? (
            <div className="grid gap-4">
              <SectionTitle title="Datos de demostracion" subtitle="Para probar la app sin numeros reales" />
              <div className="flex flex-wrap gap-2"><PrimaryButton onClick={() => seedDemoData().then(() => loadAll('Datos demo listos.'))}><Plus size={17} />Anadir demo</PrimaryButton><SecondaryButton onClick={() => removeDemoData().then(() => loadAll('Datos demo eliminados.'))}><Trash2 size={17} />Eliminar demo</SecondaryButton></div>
            </div>
          ) : null}

          {configPanel === 'preferencias' ? (
            <form className="grid gap-3" onSubmit={saveSettings}>
              <SectionTitle title="Preferencias" subtitle="Datos del propietario y comportamiento" />
              <Field label="Nombre"><input className="input" value={settings.ownerName} onChange={(event) => setSettings((current) => ({ ...current, ownerName: event.target.value }))} /></Field>
              <Field label="Numero personal"><input className="input" value={settings.personalNumber} onChange={(event) => setSettings((current) => ({ ...current, personalNumber: event.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Codigo"><input className="input" value={settings.defaultCountryCode} onChange={(event) => setSettings((current) => ({ ...current, defaultCountryCode: event.target.value }))} /></Field><Field label="Pais"><input className="input" value={settings.defaultCountry} onChange={(event) => setSettings((current) => ({ ...current, defaultCountry: event.target.value }))} /></Field></div>
              <Field label="Canal preferido"><select className="input" value={settings.preferredChannel} onChange={(event) => setSettings((current) => ({ ...current, preferredChannel: event.target.value as Channel }))}>{channels.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <PrimaryButton type="submit"><Check size={17} />Guardar</PrimaryButton>
              <div className="rounded-3xl border border-red-200 bg-red-50 p-4"><p className="font-black text-red-800">Borrar todos los datos</p><input className="input mt-2" value={doubleDelete} onChange={(event) => setDoubleDelete(event.target.value)} placeholder="Escribe BORRAR" /><SecondaryButton className="mt-2" onClick={deleteAllData}><Trash2 size={17} />Borrar datos locales</SecondaryButton></div>
            </form>
          ) : null}

          {configPanel === 'tecnica' ? (
            <div className="grid gap-4 text-sm text-slate-600">
              <SectionTitle title="Informacion tecnica" subtitle="Oculta del flujo normal" />
              <p>Los datos se guardan localmente en IndexedDB. La app funciona sin backend y no usa servicios pagados.</p>
              <p>WhatsApp y SMS se abren manualmente por persona. No se crean grupos ni envios automaticos.</p>
              <p>La arquitectura mantiene el flujo de preparacion separado de la apertura manual, para poder sustituir esta salida por una integracion oficial futura sin reconstruir toda la experiencia.</p>
              <p>Contactos: {contacts.length}. Listas: {lists.length}. Mensajes guardados: {templates.length}. Envios: {campaigns.length}. Personas pendientes: {queue.length}.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderLaMode = () => (
    <div className="fixed inset-0 z-40 bg-brand/45 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm" onClick={() => setLaMode(false)}>
      <div className="mx-auto max-h-[92vh] max-w-2xl overflow-auto rounded-[2rem] bg-white p-5 shadow-soft" onClick={(event) => event.stopPropagation()}>
        <SectionTitle title="Modo LA Fitness" subtitle="Registro rapido para activaciones" action={<IconButton label="Cerrar" onClick={() => setLaMode(false)}><X /></IconButton>} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Personas de hoy</p><strong className="text-3xl">{todayContacts.length}</strong></div>
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Respondieron hoy</p><strong className="text-3xl">{attention.responded.filter((contact) => contact.createdAt?.slice(0, 10) === todayKey()).length}</strong></div>
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Pendientes</p><strong className="text-3xl">{attention.pendingMessages.length}</strong></div>
          <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Seguimiento</p><strong className="text-3xl">{attention.followUp.length}</strong></div>
        </div>
        {renderPeople()}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-soft text-ink lg:flex">
      {nav}
      <main className="w-full px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-[calc(env(safe-area-inset-top)+1rem)] lg:px-8 lg:pb-8">
        <header className="mx-auto mb-5 flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0 lg:hidden">
            <p className="text-xs font-bold text-brand">Golden Team Connect</p>
            <p className="truncate text-sm text-slate-500">Herramienta independiente para organizacion y seguimiento</p>
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-brand">Golden Team Connect</p>
            <h1 className="text-3xl font-black tracking-normal">{mainSections.find((section) => section.id === active)?.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => setLaMode(true)} className="hidden sm:inline-flex"><MapPin size={17} />Modo LA Fitness</SecondaryButton>
            <IconButton label="Configuracion" onClick={() => setConfigOpen(true)}><Settings /></IconButton>
          </div>
        </header>

        {active === 'inicio' ? renderHome() : null}
        {active === 'personas' ? renderPeople() : null}
        {active === 'enviar' ? renderSend() : null}
        {active === 'seguimiento' ? renderFollowUp() : null}
      </main>
      {configOpen ? renderConfig() : null}
      {laMode ? renderLaMode() : null}
    </div>
  );
}

export default App;
