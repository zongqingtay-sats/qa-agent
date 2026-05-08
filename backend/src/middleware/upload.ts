import multer from 'multer';
import path from 'path';
import { appConfig } from '../config';

const ALLOWED_EXTENSIONS = ['.docx', '.pdf', '.txt', '.json', '.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.java', '.cs'];
const ALLOWED_MIMETYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'text/plain',
  'application/json',
  'text/javascript',
  'application/javascript',
  'text/x-typescript',
  'text/x-python',
  'text/x-java-source',
  'text/x-csharp',
  'application/octet-stream', // fallback for some source files
];

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: appConfig.maxFileSize,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext}`));
    }
  },
});
