import type { MediaAsset } from '../types';

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_TOKEN_SESSION_KEY = 'golden-team-drive-token';

export interface DriveTokenInfo {
  accessToken: string;
  expiresAt: number;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  url?: string;
}

export function storeDriveToken(token: DriveTokenInfo, storage: Storage = sessionStorage) {
  storage.setItem(DRIVE_TOKEN_SESSION_KEY, JSON.stringify(token));
}

export function readDriveToken(storage: Storage = sessionStorage, now = Date.now()): DriveTokenInfo | null {
  try {
    const raw = storage.getItem(DRIVE_TOKEN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriveTokenInfo;
    if (!parsed.accessToken || !parsed.expiresAt || parsed.expiresAt <= now + 30_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDriveToken(storage: Storage = sessionStorage) {
  storage.removeItem(DRIVE_TOKEN_SESSION_KEY);
}

export function driveTokenFromResponse(response: { access_token?: string; expires_in?: number }, now = Date.now()): DriveTokenInfo | null {
  if (!response.access_token) return null;
  return {
    accessToken: response.access_token,
    expiresAt: now + Math.max(60, response.expires_in || 3600) * 1000
  };
}

export function driveFileToMediaAsset(file: DriveFileMetadata): Omit<MediaAsset, 'id'> {
  const isVideo = file.mimeType.startsWith('video/');
  return {
    name: file.name,
    type: file.mimeType,
    dataUrl: file.thumbnailUrl || '',
    size: 0,
    kind: isVideo ? 'video' : 'image',
    createdAt: new Date().toISOString(),
    source: 'google-drive',
    driveFileId: file.id,
    driveMimeType: file.mimeType,
    driveThumbnail: file.thumbnailUrl,
    driveWebViewLink: file.webViewLink || file.url,
    driveDownloadMetadata: file.url
  };
}
