import Papa from 'papaparse';
import type { Contact } from '../types';
import { normalizePhone } from './phone';

export interface CsvImportRow {
  nombre?: string;
  first_name?: string;
  apellido?: string;
  last_name?: string;
  telefono?: string;
  phone?: string;
  codigo_pais?: string;
  pais?: string;
  categoria?: string;
  lista?: string;
  notas?: string;
  consentimiento?: string;
  canal_preferido?: string;
  email?: string;
  ubicacion?: string;
  location?: string;
  idioma?: string;
  language?: string;
  fecha?: string;
  date?: string;
}

export interface CsvPreview {
  valid: Array<CsvImportRow & { normalizedPhone: string }>;
  invalid: Array<{ row: CsvImportRow; reason: string }>;
  duplicates: Array<CsvImportRow & { normalizedPhone: string }>;
}

const allowedCategories = ['Miembro', 'Cliente', 'Distribuidor', 'Lider', 'Prospecto', 'Otro'];
const allowedChannels = ['WhatsApp', 'SMS', 'Ambos'];

export function parseContactsCsv(csv: string, existingPhones: string[] = [], defaultCountryCode = '1'): CsvPreview {
  const parsed = Papa.parse<CsvImportRow>(csv, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  const seen = new Set(existingPhones);
  const valid: CsvPreview['valid'] = [];
  const invalid: CsvPreview['invalid'] = [];
  const duplicates: CsvPreview['duplicates'] = [];

  parsed.data.forEach((row) => {
    const name = (row.nombre || row.first_name || '').trim();
    const phonePreview = normalizePhone(row.telefono || row.phone || '', row.codigo_pais || defaultCountryCode);
    if (!name) {
      invalid.push({ row, reason: 'Falta el nombre.' });
      return;
    }
    if (!phonePreview.valid) {
      invalid.push({ row, reason: phonePreview.message });
      return;
    }
    if (seen.has(phonePreview.normalized)) {
      duplicates.push({ ...row, normalizedPhone: phonePreview.normalized });
      return;
    }
    seen.add(phonePreview.normalized);
    valid.push({ ...row, normalizedPhone: phonePreview.normalized });
  });

  return { valid, invalid, duplicates };
}

export function csvRowToContact(
  row: CsvImportRow & { normalizedPhone: string },
  listIds: number[],
  defaultCountryCode = '1',
  defaultCountry = 'Estados Unidos'
): Contact {
  return {
    firstName: (row.nombre || row.first_name || '').trim(),
    lastName: (row.apellido || row.last_name || '').trim(),
    phone: row.normalizedPhone,
    countryCode: row.codigo_pais?.trim() || defaultCountryCode,
    country: row.pais?.trim() || defaultCountry,
    email: row.email || '',
    category: allowedCategories.includes(row.categoria || '') ? (row.categoria as Contact['category']) : 'Prospecto',
    listIds,
    tags: [row.ubicacion || row.location ? `Gimnasio:${row.ubicacion || row.location}` : '', row.idioma || row.language ? `Idioma:${row.idioma || row.language}` : '', 'Primer mensaje pendiente'].filter(Boolean),
    notes: row.notas || '',
    createdAt: new Date().toISOString(),
    status: 'Activo',
    preferredChannel: allowedChannels.includes(row.canal_preferido || '') ? (row.canal_preferido as Contact['preferredChannel']) : 'WhatsApp',
    consent: ['si', 'sí', 'true', '1', 'yes'].includes((row.consentimiento || '').toLowerCase()),
    consentDate: ['si', 'sí', 'true', '1', 'yes'].includes((row.consentimiento || '').toLowerCase()) ? new Date().toISOString() : undefined
  };
}

export function exportContactsCsv(contacts: Contact[]): string {
  return Papa.unparse(
    contacts.map((contact) => ({
      nombre: contact.firstName,
      apellido: contact.lastName,
      telefono: contact.phone,
      codigo_pais: contact.countryCode,
      pais: contact.country,
      categoria: contact.category,
      listas: contact.listIds.join('|'),
      notas: contact.notes || '',
      consentimiento: contact.consent ? 'si' : 'no',
      canal_preferido: contact.preferredChannel,
      estado: contact.status
    }))
  );
}
