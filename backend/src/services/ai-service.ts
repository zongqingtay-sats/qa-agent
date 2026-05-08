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
  copilotClient = new CopilotClient({ token: appConfig.copilotToken });
  return copilotClient;
}

const SYSTEM_PROMPT = `You are a QA test case generation assistant. You generate structured test cases for web applications.
Always return valid JSON arrays of test cases. Each test case should have:
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

Return ONLY a JSON array, no markdown code fences, no explanation text.
All string values must be plain literal strings. NEVER use JavaScript expressions like .repeat(), + concatenation, or template literals inside JSON values.
For example, write "aaaaaaaaaa" instead of "a".repeat(10).
The JSON array must be absolutely parseable by JSON.parse() without errors.`;

function buildPrompt(mode: 'requirements' | 'natural-language' | 'source-code', input: string): ChatMessage[] {
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
    case 'natural-language':
      messages.push({
        role: 'user',
        content: `Based on the following description, generate detailed test cases for a web application. Include positive, negative, and edge case scenarios.\n\nDescription:\n${input}`,
      });
      break;
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
  input: string
): Promise<GeneratedTestCase[]> {
  const messages = buildPrompt(mode, input);

  const client = getClient();
  if (!client) {
    console.log('No Copilot API token configured, returning mock test cases');
    return getMockTestCases(mode, input);
  }

  const content = await client.chat(messages, { temperature: 0.3, maxTokens: 4096 });

  if (!content) {
    throw new Error('No content in AI response');
  }

  // Parse the response - strip markdown fences if present
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Sanitize JS expressions that the model may inject into JSON string values
  jsonStr = sanitizeJsExpressions(jsonStr);

  const testCases: GeneratedTestCase[] = JSON.parse(jsonStr);
  return testCases;
}

/**
 * Replace common JavaScript string expressions in JSON with their evaluated literal values.
 * The LLM sometimes outputs JS expressions instead of plain JSON strings.
 */
function sanitizeJsExpressions(json: string): string {
  // "str".repeat(n) → repeated string
  json = json.replace(/"([^"]*)"\.repeat\((\d+)\)/g, (_, str, n) => {
    const count = Math.min(Number(n), 1000);
    return JSON.stringify(str.repeat(count));
  });

  // "str".padStart(n, "ch") / .padEnd(n, "ch")
  json = json.replace(/"([^"]*)"\.pad(Start|End)\((\d+),\s*"([^"]*)"\)/g, (_, str, dir, n, ch) => {
    const len = Math.min(Number(n), 1000);
    return JSON.stringify(dir === 'Start' ? str.padStart(len, ch) : str.padEnd(len, ch));
  });

  // "str".toUpperCase() / .toLowerCase()
  json = json.replace(/"([^"]*)"\.toUpperCase\(\)/g, (_, str) => JSON.stringify(str.toUpperCase()));
  json = json.replace(/"([^"]*)"\.toLowerCase\(\)/g, (_, str) => JSON.stringify(str.toLowerCase()));

  // "str".trim()
  json = json.replace(/"([^"]*)"\.trim\(\)/g, (_, str) => JSON.stringify(str.trim()));

  // "str".slice(start, end) / .substring(start, end)
  json = json.replace(/"([^"]*)"\.(slice|substring)\((\d+),\s*(\d+)\)/g, (_, str, _method, s, e) =>
    JSON.stringify(str.slice(Number(s), Number(e)))
  );

  // "str".replace("old", "new")
  json = json.replace(/"([^"]*)"\.replace\("([^"]*)",\s*"([^"]*)"\)/g, (_, str, old, rep) =>
    JSON.stringify(str.replace(old, rep))
  );

  // "str".concat("other")
  json = json.replace(/"([^"]*)"\.concat\("([^"]*)"\)/g, (_, a, b) => JSON.stringify(a + b));

  // Array(n).join("ch")
  json = json.replace(/Array\((\d+)\)\.join\("([^"]*)"\)/g, (_, n, ch) => {
    const count = Math.min(Number(n), 1000);
    return JSON.stringify(Array(count).join(ch));
  });

  // "foo" + "bar" (string concatenation, run last to avoid interfering with above)
  json = json.replace(/"([^"]*)"\s*\+\s*"([^"]*)"/g, (_, a, b) => JSON.stringify(a + b));

  return json;
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
