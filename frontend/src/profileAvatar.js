// Profile photos live in localStorage with the profile list, which browsers cap at about 5 MB per
// origin. A photo is therefore cut to a small square avatar before it is stored (issue #29).

/** Edge length of the stored avatar in pixels. */
export const kAvatarSize = 256;
/** Photos larger than this are refused before decoding. */
export const kMaxPhotoBytes = 20 * 1024 * 1024;
/** A stored avatar data URL never exceeds this many characters. */
export const kMaxAvatarChars = 200_000;

export class AvatarError extends Error {}

/** Throws AvatarError when a picked file can't be used as a profile photo. */
export function checkPhotoFile(file) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    throw new AvatarError('Choose an image file for the profile photo.');
  }
  if (file.size > kMaxPhotoBytes) {
    throw new AvatarError(`That photo is too large. Choose one under ${kMaxPhotoBytes / 1024 / 1024} MB.`);
  }
}

/** Centered square crop of a width × height image, as canvas drawImage source coordinates. */
export function coverCrop(width, height) {
  const side = Math.min(width, height);
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side };
}

/** Decodes a picked photo and returns a small square WebP (or JPEG) data URL suitable for localStorage. */
export async function avatarDataUrl(file, { size = kAvatarSize } = {}) {
  checkPhotoFile(file);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError('That image could not be read. Try a PNG, JPEG or WebP photo.');
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const { sx, sy, side } = coverCrop(bitmap.width, bitmap.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    let url = canvas.toDataURL('image/webp', 0.85);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.85);
    if (url.length > kMaxAvatarChars) throw new AvatarError('That photo could not be made small enough to save.');
    return url;
  } finally {
    bitmap.close?.();
  }
}
