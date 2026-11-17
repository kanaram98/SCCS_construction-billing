/**
 * Hands a file to the user: the native share sheet on phones (WhatsApp, Drive,
 * Files…), otherwise a normal download. `text` is sent along as the message.
 * @returns {Promise<'shared'|'downloaded'>}
 */
export async function deliverFile(file, { text } = {}) {
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ title: file.name, files: [file], ...(text ? { text } : {}) });
    return 'shared';
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** True when the user dismissed the share sheet (not an error worth reporting). */
export function isShareCancelled(error) {
  return error?.name === 'AbortError';
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}

/** Whether this device can share a PDF through the native share sheet (phones). */
export function canSharePdfFiles() {
  try {
    return Boolean(navigator.share && navigator.canShare?.({ files: [new File([''], 'bill.pdf', { type: 'application/pdf' })] }));
  } catch {
    return false;
  }
}
