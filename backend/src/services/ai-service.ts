import { appConfig } from '../config';

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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

Return ONLY a JSON array, no markdown code fences, no explanation text.`;

function buildPrompt(mode: 'requirements' | 'natural-language' | 'source-code', input: string): AIMessage[] {
  const messages: AIMessage[] = [
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

  // If no API key configured, return mock data for PoC development
  if (!appConfig.copilotApiKey || !appConfig.copilotApiUrl) {
    console.log('No AI API configured, returning mock test cases');
    return getMockTestCases(mode, input);
  }

  const response = await fetch(appConfig.copilotApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${appConfig.copilotApiKey}`,
    },
    body: JSON.stringify({
      messages,
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} ${errorText}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in AI response');
  }

  // Parse the response - strip markdown fences if present
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const testCases: GeneratedTestCase[] = JSON.parse(jsonStr);
  return testCases;
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
