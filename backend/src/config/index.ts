import { config } from 'dotenv';

config();

export const appConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  copilotApiKey: process.env.COPILOT_API_KEY || '',
  copilotApiUrl: process.env.COPILOT_API_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: 20 * 1024 * 1024, // 20MB
};
