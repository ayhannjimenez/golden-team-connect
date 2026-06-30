import type { BackupFile } from '../types';

export function validateBackup(input: unknown): input is BackupFile {
  if (!input || typeof input !== 'object') return false;
  const value = input as Partial<BackupFile>;
  return (
    value.app === 'difusion-local-privada' &&
    value.version === 1 &&
    Array.isArray(value.contacts) &&
    Array.isArray(value.lists) &&
    Array.isArray(value.templates) &&
    Array.isArray(value.campaigns) &&
    Array.isArray(value.queue) &&
    Boolean(value.settings)
  );
}

export function backupSummary(backup: BackupFile): string {
  return `${backup.contacts.length} contactos, ${backup.members?.length || 0} miembros, ${backup.tasks?.length || 0} tareas, ${backup.campaigns.length} campanas`;
}
