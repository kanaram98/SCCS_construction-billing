import { IMAGE_UPLOAD } from '../config/app.js';

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('The selected file is not a readable image.'));
    image.onload = () => resolve(image);
    image.src = source;
  });
}

/**
 * Validates a PNG/JPG upload and resizes it into a compact data URL that fits
 * in local storage.
 * @returns {Promise<string>}
 */
export async function optimizeImage(file) {
  if (!IMAGE_UPLOAD.acceptedTypes.includes(file.type)) throw new Error('Choose a PNG or JPG image.');
  if (file.size > IMAGE_UPLOAD.maxFileBytes) throw new Error('Choose an image smaller than 5 MB.');

  const image = await loadImage(await readAsDataUrl(file));
  const scale = Math.min(1, IMAGE_UPLOAD.maxWidth / image.width, IMAGE_UPLOAD.maxHeight / image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable in this browser.');

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL(file.type, file.type === 'image/jpeg' ? IMAGE_UPLOAD.jpegQuality : undefined);
  if (dataUrl.length > IMAGE_UPLOAD.maxDataUrlLength) {
    throw new Error('The resized image is still too large. Choose a smaller image.');
  }
  return dataUrl;
}
