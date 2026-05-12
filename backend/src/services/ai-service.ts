import yaml from 'js-yaml';
import { appConfig } from '../config';
import CopilotClient from '../copilot/client';
import { ChatMessage } from '../copilot/types';

interface GeneratedTestCase {
  name: string;
  description: string;
  preconditions?: string;
  passingCriteria?: string;
  steps: {
    order: number;
    action: string;
    target?: string;
    value?: string;
    description: string;
  }[];
}

// Lazily initialized CopilotClient singleton
let copilotClient: CopilotClient | null = null;

function getClient(): CopilotClient | null {
  if (copilotClient) return copilotClient;
  if (!appConfig.copilotToken) return null;
  copilotClient = new CopilotClient({
    token: appConfig.copilotToken,
    model: appConfig.copilotModel,
  });
  return copilotClient;
}

const SYSTEM_PROMPT = `You are a QA test case generation assistant. You generate structured test cases for web applications.
Always return valid YAML arrays of test cases. Each test case should have:
- name: descriptive name
- description: what the test verifies
- preconditions: any setup needed (optional)
- passingCriteria: what determines pass/fail
- steps: array of steps, each with:
  - order: step number (1-based)
  - action: one of "navigate", "click", "type", "select", "hover", "scroll", "wait", "assert", "screenshot"
  - target: CSS selector or URL (when applicable)
  - value: input value or expected value (when applicable)
  - description: human-readable description of the step

IMPORTANT: The first step of every test case MUST be a "navigate" action with the full target URL. This is mandatory — there is no implicit navigation. Every test must explicitly navigate to its starting page.

When page HTML is provided, use it to:
1. Determine the correct CSS selectors for elements (prefer id, name, data-testid, or unique class selectors)
2. Identify input types accurately (text input, dropdown/select, date picker, radio buttons, checkboxes, etc.)
3. Use the actual button text and labels from the page
4. Generate selectors that match the real DOM structure

Return ONLY a YAML array, no markdown code fences, no explanation text.
All string values must be plain literal strings.`;

function buildPrompt(mode: 'requirements' | 'natural-language' | 'source-code', input: string, options?: { targetUrl?: string; pageHtml?: string }): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  switch (mode) {
    case 'requirements':
      messages.push({
        role: 'user',
        content: `Analyze the following business requirements document and generate comprehensive test cases that cover each requirement. Include both positive and negative test scenarios.\n\nRequirements:\n${input}`,
      });
      break;
    case 'natural-language': {
      let content = `Based on the following description, generate detailed test cases for a web application. Include positive, negative, and edge case scenarios.\n\nDescription:\n${input}`;
      if (options?.targetUrl) {
        content += `\n\nTarget URL: ${options.targetUrl}\nUse this URL as the base URL in the start/navigate steps.`;
      }
      if (options?.pageHtml) {
        // Trim HTML to avoid exceeding token limits
        const trimmedHtml = options.pageHtml.substring(0, 80000);
        content += `\n\nBelow is the actual HTML of the target web page. Use this to determine the correct CSS selectors, input types (text, dropdown, date picker, etc.), button labels, and form structure. Generate test steps that use accurate selectors matching the real page elements.\n\n<page-html>\n${trimmedHtml}\n</page-html>`;
      }
      messages.push({ role: 'user', content });
      break;
    }
    case 'source-code':
      messages.push({
        role: 'user',
        content: `Analyze the following source code and generate test cases that cover UI interactions, form submissions, navigation, validations, and edge cases visible in the code.\n\nSource Code:\n${input}`,
      });
      break;
  }

  return messages;
}

export async function generateTestCases(
  mode: 'requirements' | 'natural-language' | 'source-code',
  input: string,
  options?: { targetUrl?: string; pageHtml?: string }
): Promise<GeneratedTestCase[]> {
  const messages = buildPrompt(mode, input, options);

  const client = getClient();
  if (!client) {
    console.log('No Copilot API token configured, returning mock test cases');
    return getMockTestCases(mode, input);
  }

  const content = await client.chat(messages, { temperature: 0.3, maxTokens: options?.pageHtml ? 8192 : 4096 });

  if (!content) {
    throw new Error('No content in AI response');
  }

  // Parse the response - strip markdown fences if present
  let yamlStr = content.trim();
  if (yamlStr.startsWith('```')) {
    yamlStr = yamlStr.replace(/^```(?:ya?ml)?\n?/, '').replace(/\n?```$/, '');
  }

  const testCases = yaml.load(yamlStr) as GeneratedTestCase[];
  return testCases;
}

/**
 * Refine previously-generated test cases with additional page HTML.
 * When test steps navigate to new pages/views, we scrape those pages and
 * ask the AI to update selectors and add/adjust steps using the real DOM.
 */
export async function refineTestCases(
  testCases: GeneratedTestCase[],
  pageContexts: { url: string; html: string }[],
  options?: { targetUrl?: string }
): Promise<GeneratedTestCase[]> {
  const client = getClient();
  if (!client) {
    // No AI available — return test cases unmodified
    return testCases;
  }

  const pagesBlock = pageContexts.map((p, i) => {
    const trimmedHtml = p.html.substring(0, 40000);
    return `<page url="${p.url}" index="${i + 1}">\n${trimmedHtml}\n</page>`;
  }).join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `I have a set of previously-generated test cases for a web application${options?.targetUrl ? ` (target: ${options.targetUrl})` : ''}.
Some test steps navigate to different pages or views. I have now scraped those additional pages. Please refine the test cases:
1. Update CSS selectors for steps that interact with elements on the newly-scraped pages, using accurate selectors from the real DOM.
2. Add any missing intermediate steps that become apparent from the actual page structure (e.g. modals, loading states, confirmation dialogs).
3. Fix any target/value mismatches based on the real page elements.
4. Keep the overall test intent and structure intact — only improve accuracy.

Here are the current test cases:
${yaml.dump(testCases)}

Here is the HTML of the additional pages that were navigated to:
${pagesBlock}

Return the COMPLETE refined test cases as a YAML array (same format as input). Return ALL test cases, not just the modified ones.`,
    },
  ];

  const content = await client.chat(messages, { temperature: 0.2, maxTokens: 8192 });
  if (!content) return testCases;

  let yamlStr = content.trim();
  if (yamlStr.startsWith('```')) {
    yamlStr = yamlStr.replace(/^```(?:ya?ml)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return yaml.load(yamlStr) as GeneratedTestCase[];
  } catch {
    // If parsing fails, return original test cases
    return testCases;
  }
}

function getMockTestCases(_mode: string, input: string): GeneratedTestCase[] {
  const preview = input.substring(0, 50);
  return [
    {
      name: `Login form validation test`,
      description: `Verify that the login form validates user input correctly. Generated from: "${preview}..."`,
      preconditions: 'Application is accessible and login page is loaded',
      passingCriteria: 'Form shows appropriate validation messages for invalid inputs and allows submission with valid inputs',
      steps: [
        { order: 1, action: 'navigate', target: '/login', description: 'Open the login page' },
        { order: 2, action: 'assert', target: 'form', value: 'element-exists', description: 'Verify login form is present' },
        { order: 3, action: 'click', target: 'button[type="submit"]', description: 'Click submit without entering credentials' },
        { order: 4, action: 'assert', target: '.error-message', value: 'text-contains:required', description: 'Verify validation error is shown' },
        { order: 5, action: 'type', target: 'input[name="email"]', value: 'test@example.com', description: 'Enter valid email' },
        { order: 6, action: 'type', target: 'input[name="password"]', value: 'Password123', description: 'Enter valid password' },
        { order: 7, action: 'click', target: 'button[type="submit"]', description: 'Submit the form' },
        { order: 8, action: 'assert', target: 'body', value: 'url-matches:/dashboard', description: 'Verify redirect to dashboard' },
      ],
    },
    {
      name: `Page navigation test`,
      description: `Verify that primary navigation links work correctly. Generated from: "${preview}..."`,
      preconditions: 'User is logged in',
      passingCriteria: 'All navigation links lead to the correct pages',
      steps: [
        { order: 1, action: 'navigate', target: '/', description: 'Open the home page' },
        { order: 2, action: 'assert', target: 'nav', value: 'element-exists', description: 'Verify navigation bar is present' },
        { order: 3, action: 'click', target: 'nav a[href="/about"]', description: 'Click the About link' },
        { order: 4, action: 'assert', target: 'body', value: 'url-matches:/about', description: 'Verify URL is /about' },
        { order: 5, action: 'screenshot', description: 'Capture the About page' },
      ],
    },
  ];
}
