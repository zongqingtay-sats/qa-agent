import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import { appConfig } from '../config';

const CONTAINER_NAME = 'screenshots';

let containerClient: ContainerClient | null = null;

/**
 * Whether Azure Blob Storage is configured.
 * When false, screenshots remain as inline base64 data URLs (PoC mode).
 */
export function isBlobStorageEnabled(): boolean {
  return !!appConfig.azureBlobConnectionString;
}

/**
 * Initialize the blob container (creates if not exists).
 */
async function getContainerClient(): Promise<ContainerClient> {
  if (containerClient) return containerClient;

  const blobService = BlobServiceClient.fromConnectionString(appConfig.azureBlobConnectionString!);
  containerClient = blobService.getContainerClient(CONTAINER_NAME);
  await containerClient.createIfNotExists({ access: 'blob' }); // public read for images
  return containerClient;
}

/**
 * Upload a base64 data URL screenshot to blob storage.
 * Returns the blob URL, or the original data URL if blob storage is not configured.
 */
export async function uploadScreenshot(dataUrl: string, testRunId: string, stepOrder: number): Promise<string> {
  if (!isBlobStorageEnabled()) return dataUrl;
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;

  try {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return dataUrl;

    const [, format, base64Data] = match;
    const buffer = Buffer.from(base64Data, 'base64');
    const blobName = `${testRunId}/${stepOrder}-${uuidv4().slice(0, 8)}.${format === 'jpeg' ? 'jpg' : format}`;

    const container = await getContainerClient();
    const blockBlob = container.getBlockBlobClient(blobName);
    await blockBlob.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: `image/${format}` },
    });

    return blockBlob.url;
  } catch (err) {
    console.error('Failed to upload screenshot to blob storage:', err);
    // Fall back to inline storage
    return dataUrl;
  }
}

/**
 * Download a blob URL back to a base64 data URL (needed for DOCX/PDF export embedding).
 * If the URL is already a data URL, returns it as-is.
 */
export async function downloadScreenshotAsDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;

  try {
    const response = await fetch(url);
    if (!response.ok) return url;

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('Failed to download screenshot from blob storage:', err);
    return url;
  }
}

/**
 * Delete all screenshots for a test run (cleanup).
 */
export async function deleteScreenshotsForRun(testRunId: string): Promise<void> {
  if (!isBlobStorageEnabled()) return;

  try {
    const container = await getContainerClient();
    const prefix = `${testRunId}/`;
    for await (const blob of container.listBlobsFlat({ prefix })) {
      await container.deleteBlob(blob.name);
    }
  } catch (err) {
    console.error('Failed to delete screenshots for run:', err);
  }
}
