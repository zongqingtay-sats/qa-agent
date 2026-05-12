import { config } from 'dotenv';

config();

export const appConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  copilotToken: process.env.COPILOT_TOKEN || '',
  copilotModel: process.env.COPILOT_MODEL,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: 20 * 1024 * 1024, // 20MB
  azureBlobConnectionString: process.env.AZURE_BLOB_CONNECTION_STRING || '',
  databaseUrl: process.env.DATABASE_URL || '',
  // Azure Entra ID auth
  azureAdTenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT || '',
  azureAdClientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID || '',
  authDisabled: process.env.AUTH_DISABLED === 'true',
};
