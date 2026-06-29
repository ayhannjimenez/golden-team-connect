import Papa from 'papaparse';
import type { Contact } from '../types';
import { normalizePhone } from './phone';

export interface CsvImportRow {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  codigo_pais?: string;
  pais?: string;
  categoria?: string;
  lista?: string;
  notas?: string;
  consentimiento?: string;
  canal_preferido?: string;
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
    const name = row.nombre?.trim();
    const phonePreview = normalizePhone(row.telefono || '', row.codigo_pais || defaultCountryCode);
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
    firstName: row.nombre?.trim() || '',
    lastName: row.apellido?.trim() || '',
    phone: row.normalizedPhone,
    countryCode: row.codigo_pais?.trim() || defaultCountryCode,
    country: row.pais?.trim() || defaultCountry,
    category: allowedCategories.includes(row.categoria || '') ? (row.categoria as Contact['category']) : 'Otro',
    listIds,
    tags: [],
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
