/**
 * Screenshots for the Assistant: shrunk in the browser (long side at most
 * 1568 px, which Claude reads at full detail) so a phone screenshot costs
 * fewer tokens and uploads quickly. Nothing is stored.
 */
export interface PreparedImage {
  data: string; // base64, no data: prefix
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  preview: string; // small data URL for the chat bubble
}

const MAX_SIDE = 1568;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const isAcceptedImage = (type: string): type is PreparedImage['mediaType'] => (ACCEPTED as readonly string[]).includes(type);

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  if (!isAcceptedImage(file.type)) throw new Error('Use a PNG, JPEG, WebP or GIF screenshot.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser can’t read the screenshot.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL('image/jpeg', 0.88);
  const thumb = document.createElement('canvas');
  const t = Math.min(1, 240 / Math.max(canvas.width, canvas.height));
  thumb.width = Math.round(canvas.width * t);
  thumb.height = Math.round(canvas.height * t);
  thumb.getContext('2d')?.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return { data: url.slice(url.indexOf(',') + 1), mediaType: 'image/jpeg', preview: thumb.toDataURL('image/jpeg', 0.7) };
}
