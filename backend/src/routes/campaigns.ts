import { Router, Request, Response } from 'express';
import { dataStore as store } from '../db';
import { AppError } from '../middleware/error-handler';
import { requirePermission, requireProjectAccess } from '../rbac/middleware';

const router = Router();

// Helper: filter out deleted test case IDs from a campaign
async function filterValidTestCaseIds(testCaseIds: string[]): Promise<string[]> {
  const results = await Promise.all(testCaseIds.map((id) => store.getTestCase(id)));
  return testCaseIds.filter((_, i) => results[i] !== undefined);
}

// Enrich a campaign record with only valid (non-deleted) test case IDs
async function enrichCampaign<T extends { testCaseIds: string[] }>(campaign: T): Promise<T> {
  return { ...campaign, testCaseIds: await filterValidTestCaseIds(campaign.testCaseIds) };
}

// Resolver: get projectId from campaign
async function resolveProjectFromCampaign(req: Request): Promise<string | undefined> {
  const campaign = await store.getCampaign(req.params.id as string);
  return campaign?.projectId ?? undefined;
}

// GET /api/projects/:projectId/campaigns
router.get('/projects/:projectId/campaigns', requireProjectAccess('testrun:read', async (req) => req.params.projectId as string), async (req: Request, res: Response) => {
  const campaigns = await store.getCampaignsForProject(req.params.projectId as string);
  const enriched = await Promise.all(campaigns.map(enrichCampaign));
  res.json({ data: enriched, total: enriched.length });
});

// POST /api/projects/:projectId/campaigns
router.post('/projects/:projectId/campaigns', requireProjectAccess('testcase:create', async (req) => req.params.projectId as string), async (req: Request, res: Response) => {
  const { name, description, baseUrl, testCaseIds } = req.body;

  if (!name || !Array.isArray(testCaseIds)) {
    throw new AppError('name and testCaseIds (array) are required');
  }

  const campaign = await store.createCampaign({
    projectId: req.params.projectId as string,
    name,
    description: description || undefined,
    baseUrl: baseUrl || undefined,
    testCaseIds,
    createdBy: req.user?.id || undefined,
    createdByName: req.user?.name || undefined,
  });

  res.status(201).json({ data: campaign });
});

// GET /api/campaigns/:id
router.get('/campaigns/:id', requireProjectAccess('testrun:read', resolveProjectFromCampaign), async (req: Request, res: Response) => {
  const campaign = await store.getCampaign(req.params.id as string);
  if (!campaign) throw new AppError('Campaign not found', 404);
  res.json({ data: await enrichCampaign(campaign) });
});

// PUT /api/campaigns/:id
router.put('/campaigns/:id', requireProjectAccess('testcase:create', resolveProjectFromCampaign), async (req: Request, res: Response) => {
  const { name, description, baseUrl, testCaseIds } = req.body;
  const updated = await store.updateCampaign(req.params.id as string, { name, description, baseUrl, testCaseIds });
  if (!updated) throw new AppError('Campaign not found', 404);
  res.json({ data: updated });
});

// DELETE /api/campaigns/:id
router.delete('/campaigns/:id', requireProjectAccess('testcase:create', resolveProjectFromCampaign), async (req: Request, res: Response) => {
  const deleted = await store.deleteCampaign(req.params.id as string);
  if (!deleted) throw new AppError('Campaign not found', 404);
  res.json({ message: 'Campaign deleted' });
});

// POST /api/campaigns/:id/run — start a campaign run
router.post('/campaigns/:id/run', requireProjectAccess('testrun:create', resolveProjectFromCampaign), async (req: Request, res: Response) => {
  const campaign = await store.getCampaign(req.params.id as string);
  if (!campaign) throw new AppError('Campaign not found', 404);

  const { baseUrl } = req.body; // optional override
  const validTestCaseIds = await filterValidTestCaseIds(campaign.testCaseIds);

  const campaignRun = await store.createCampaignRun({
    campaignId: campaign.id,
    status: 'running',
    baseUrl: baseUrl || campaign.baseUrl || undefined,
    totalCases: validTestCaseIds.length,
    passedCases: 0,
    failedCases: 0,
    testRunIds: {},
  });

  res.status(201).json({ data: campaignRun });
});

// GET /api/campaign-runs/:id
router.get('/campaign-runs/:id', async (req: Request, res: Response) => {
  const run = await store.getCampaignRun(req.params.id as string);
  if (!run) throw new AppError('Campaign run not found', 404);

  // Enrich with campaign info
  const campaign = await store.getCampaign(run.campaignId);

  res.json({ data: { ...run, campaignName: campaign?.name } });
});

// PUT /api/campaign-runs/:id
router.put('/campaign-runs/:id', async (req: Request, res: Response) => {
  const updated = await store.updateCampaignRun(req.params.id as string, req.body);
  if (!updated) throw new AppError('Campaign run not found', 404);
  res.json({ data: updated });
});

// GET /api/campaigns/:id/runs
router.get('/campaigns/:id/runs', requireProjectAccess('testrun:read', resolveProjectFromCampaign), async (req: Request, res: Response) => {
  const runs = await store.getCampaignRunsForCampaign(req.params.id as string);
  res.json({ data: runs, total: runs.length });
});

export default router;
