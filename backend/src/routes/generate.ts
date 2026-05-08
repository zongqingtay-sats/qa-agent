import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { parseDocument } from '../services/import-service';
import { generateTestCases } from '../services/ai-service';
import { AppError } from '../middleware/error-handler';

const router = Router();

// POST /api/generate/from-requirements
router.post('/from-requirements', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('No file uploaded');
  }

  const parsed = await parseDocument(req.file.buffer, req.file.originalname);
  const testCases = await generateTestCases('requirements', parsed.text);
  res.json({ data: { testCases } });
});

// POST /api/generate/from-text
router.post('/from-text', async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    throw new AppError('Text input is required');
  }

  const testCases = await generateTestCases('natural-language', text);
  res.json({ data: { testCases } });
});

// POST /api/generate/from-source
router.post('/from-source', upload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw new AppError('No source files uploaded');
  }

  // Concatenate all source files with filename headers
  const sourceCode = files.map(f => {
    const content = f.buffer.toString('utf-8');
    return `// === File: ${f.originalname} ===\n${content}`;
  }).join('\n\n');

  const testCases = await generateTestCases('source-code', sourceCode);
  res.json({ data: { testCases } });
});

export default router;
