import { Router, Request, Response } from 'express';
import { eventBus } from './event-bus';

const router = Router();

/**
 * GET /api/events
 * Server-Sent Events endpoint.
 * Query params:
 *   channels - comma-separated list of channels to subscribe to (optional)
 */
router.get('/', (req: Request, res: Response) => {
  const channels = req.query.channels
    ? (req.query.channels as string).split(',').map(c => c.trim())
    : undefined;

  // Set SSE headers (use setHeader to preserve CORS headers from middleware)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Register client
  const clientId = eventBus.addClient(res, channels);

  // Keep-alive heartbeat every 30s
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.removeClient(clientId);
  });
});

export default router;
