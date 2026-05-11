import { Router, Request, Response } from 'express';
import { getBlobStream } from '../services/blob-storage.js';

const router = Router();

/**
 * GET /api/blob/:container/*
 * Proxies blob storage requests so Azure blob URLs are never exposed to the frontend.
 */
router.get('/:container/{*blobName}', async (req: Request, res: Response) => {
  const container = req.params.container;
  const blobName = Array.isArray(req.params.blobName)
    ? req.params.blobName.join('/')
    : req.params.blobName;

  if (!container || !blobName) {
    res.status(400).json({ error: 'Missing container or blob path' });
    return;
  }

  const blobPath = blobName;
  const result = await getBlobStream(blobPath);

  if (!result || !result.stream) {
    res.status(404).json({ error: 'Blob not found' });
    return;
  }

  res.setHeader('Content-Type', result.contentType);
  if (result.contentLength) {
    res.setHeader('Content-Length', result.contentLength);
  }
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

  (result.stream as NodeJS.ReadableStream).pipe(res);
});

export default router;
