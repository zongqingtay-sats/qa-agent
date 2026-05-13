import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { appConfig } from './config';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { loadUserRole } from './rbac/middleware';
import testCasesRouter from './routes/test-cases';
import testRunsRouter from './routes/test-runs';
import importRouter from './routes/import';
import generateRouter from './routes/generate';
import exportRouter from './routes/export';
import blobRouter from './routes/blob';
import projectsRouter from './routes/projects';
import testCaseDetailsRouter from './routes/test-case-details';
import usersRouter from './routes/users';
import adminRouter from './routes/admin';
import sseRouter from './sse/router';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: appConfig.corsOrigin,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check (unauthenticated)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup status (unauthenticated) — checks if initial configuration is done
app.get('/api/setup/status', async (_req, res) => {
  try {
    const { getPrismaClient } = await import('./db/prisma');
    const prisma = getPrismaClient();
    const [userCount, roleCount, projectCount] = await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.project.count(),
    ]);
    const hasAdminRole = roleCount > 0 ? await prisma.role.findFirst({ where: { isAdmin: true } }) : null;
    res.json({
      database: true,
      users: userCount,
      roles: roleCount,
      projects: projectCount,
      hasAdminRole: !!hasAdminRole,
      isConfigured: userCount > 0 && roleCount > 0 && !!hasAdminRole,
    });
  } catch (err: any) {
    res.json({
      database: false,
      error: err.message || 'Database connection failed',
      users: 0,
      roles: 0,
      projects: 0,
      hasAdminRole: false,
      isConfigured: false,
    });
  }
});

// Auth middleware (applied to all routes below)
app.use('/api', authMiddleware);
app.use('/api', loadUserRole);

// Routes
app.use('/api/test-cases', testCasesRouter);
app.use('/api/test-cases', testCaseDetailsRouter);
app.use('/api/test-runs', testRunsRouter);
app.use('/api/import', importRouter);
app.use('/api/generate', generateRouter);
app.use('/api/export', exportRouter);
app.use('/api/blob', blobRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/events', sseRouter);

// Error handler (must be last)
app.use(errorHandler);

app.listen(appConfig.port, () => {
  console.log(`QA Agent API server running on port ${appConfig.port}`);
  console.log(`CORS origin: ${appConfig.corsOrigin}`);
});

export default app;
