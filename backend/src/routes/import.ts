import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { parseDocument } from '../services/import-service';
import { generateTestCases } from '../services/ai-service';
import { AppError } from '../middleware/error-handler';
import { requirePermission } from '../rbac/middleware';

const router = Router();

// POST /api/import/parse — Parse an uploaded document
router.post('/parse', requirePermission('import:create'), upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('No file uploaded');
  }

  const parsed = await parseDocument(req.file.buffer, req.file.originalname);

  // If JSON, try to parse as test cases directly
  if (parsed.format === 'json') {
    try {
      const data = JSON.parse(parsed.text);
      const testCases = Array.isArray(data) ? data : [data];
      res.json({ data: { testCases, source: 'direct-import', format: parsed.format } });
      return;
    } catch {
      // Not a valid test case JSON, fall through to AI
    }
  }

  // For non-JSON files, use AI to extract test cases
  const testCases = await generateTestCases('requirements', parsed.text);
  res.json({ data: { testCases, source: 'ai-extracted', format: parsed.format } });
});

export default router;
