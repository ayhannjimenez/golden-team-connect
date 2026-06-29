export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File, maxWidth = 1600, quality = 0.82): Promise<{ dataUrl: string; size: number }> {
  const rawDataUrl = await fileToDataUrl(file);
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen valida.');
  if (file.size < 900_000) return { dataUrl: rawDataUrl, size: file.size };

  const image = new Image();
  image.src = rawDataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
  });

  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite comprimir esta imagen.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
  return { dataUrl, size: Math.round((dataUrl.length * 3) / 4) };
}

export async function shareImage(dataUrl: string, name: string, type: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], name, { type });
  const shareData = { files: [file], title: name };
  if (navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return 'Imagen compartida.';
  }
  return 'Este navegador no permite compartir archivos. Puedes descargar la imagen como alternativa.';
}
