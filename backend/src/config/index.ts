import { config } from 'dotenv';

config();

export const appConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  copilotToken: process.env.COPILOT_TOKEN || '',
  copilotModel: process.env.COPILOT_MODEL,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: 20 * 1024 * 1024, // 20MB
};
