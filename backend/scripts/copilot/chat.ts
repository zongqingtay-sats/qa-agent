// npx tsx scripts/chat.ts [model]

import * as readline from "readline";
import { getSessionToken } from "./get-session-token"

const model = process.argv[2] || "gpt-4o";

async function prompt(
  promptText: string,
): Promise<string> {
  const token = await getSessionToken();
  let resp: Response;
  try {
    resp = await fetch(
      "https://api.githubcopilot.com/chat/completions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Editor-Version': 'vscode/1.95.3',
          'Editor-Plugin-Version': 'copilot-chat/0.22.4',
          'Openai-Intent': 'conversation-panel',
          'X-Github-Api-Version': '2023-07-07'
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: promptText,
            }
          ],
          model,
          max_tokens: 1000,
          temperature: 0,
          n: 1,
          stream: true,
        }),
      }
    );
  } catch (e) {
    console.log(e);
    return "";
  }

  if (resp.status !== 200) {
    console.error("Error from API:", await resp.text());
  }

  const respText = await resp.text();
  let result = "";

  // Parse the SSE response, extracting completions from each data line
  for (const line of respText.split("\n")) {
    if (!line) continue;
    try {
      if (line.startsWith("data: ")) {
        const jsonData = JSON.parse(line.slice(6));
        if (jsonData.choices) {
          const completion = jsonData.choices[0]?.delta?.content ?? "";
          if (completion) {
            result += completion;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return result;
}

// Interactive chat loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`Copilot Chat [${model}] (type 'exit' to quit)\n`);

function ask() {
  rl.question("You: ", async (input) => {
    const trimmed = input.trim();
    if (trimmed.toLowerCase() === "exit") {
      rl.close();
      return;
    }
    if (!trimmed) {
      ask();
      return;
    }

    const response = await prompt(trimmed);
    console.log(`Copilot: ${response}\n`);
    ask();
  });
}

ask();