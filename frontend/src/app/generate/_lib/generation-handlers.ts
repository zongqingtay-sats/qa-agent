/**
 * Post-generation refinement handler.
 *
 * After AI generates initial test cases, this module finds navigate-target
 * URLs, scrapes those pages via the browser extension, and sends the
 * extra DOM context back to the AI for a second refinement pass.
 */

import { toast } from "sonner";
import { generateApi } from "@/lib/api";
import type { GeneratedTestCase } from "@/types/api";
import { getExtensionId, scrapePageViaExtension } from "@/lib/extension";

/**
 * Scrape pages referenced by navigate steps and refine test cases with
 * the additional DOM context.
 *
 * @param cases   - The initial set of generated test cases.
 * @param baseUrl - The primary entry-point URL (already scraped).
 * @param setScraping - State setter for the "scraping" UI flag.
 * @returns The refined test cases, or the original if refinement fails
 *          or no additional pages were found.
 */
export async function refineWithNavigationPages(
  cases: GeneratedTestCase[],
  baseUrl: string | undefined,
  setScraping: (v: boolean) => void
): Promise<GeneratedTestCase[]> {
  const extensionId = getExtensionId();
  if (!extensionId) return cases;

  // Collect unique URLs from navigate actions
  const navUrls = new Set<string>();
  for (const tc of cases) {
    for (const step of tc.steps || []) {
      if (step.action === "navigate" && step.target) {
        try {
          navUrls.add(new URL(step.target, baseUrl || undefined).href);
        } catch {
          /* relative path without base — skip */
        }
      }
    }
  }

  // Remove the initial URL (already scraped during generation)
  if (baseUrl) navUrls.delete(baseUrl);
  if (navUrls.size === 0) return cases;

  toast.info(`Scraping ${navUrls.size} additional page(s) for refinement...`);
  setScraping(true);

  const pageContexts: { url: string; html: string }[] = [];
  for (const url of navUrls) {
    try {
      const result = await scrapePageViaExtension(extensionId, url);
      if (result.html) pageContexts.push({ url, html: result.html });
    } catch {
      /* skip failed scrapes */
    }
  }

  setScraping(false);
  if (pageContexts.length === 0) return cases;

  toast.info(`Refining test cases with ${pageContexts.length} additional page(s)...`);
  try {
    const res = await generateApi.refine(cases, pageContexts, baseUrl);
    const refined = res.data.testCases || cases;
    toast.success(`Refined test cases with ${pageContexts.length} additional page context(s)`);
    return refined;
  } catch {
    toast.warning("Refinement failed — using initial test cases");
    return cases;
  }
}
