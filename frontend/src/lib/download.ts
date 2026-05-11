/**
 * Trigger a file download in the browser.
 *
 * Creates a temporary `<a>` element, clicks it, and revokes the object URL
 * to avoid memory leaks.
 *
 * @param blob     - The file content as a Blob.
 * @param filename - The suggested file name for the download.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
