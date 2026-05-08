// npx tsx scripts/get-session-token.ts 

import * as fs from "fs";
import path from "path";

export async function getSessionToken() {
  // Read the access token saved by get-access-token.ts
  const accessToken = fs.readFileSync(path.join(__dirname, ".copilot-token"), "utf-8").trim();

  // Exchange the access token for a short-lived Copilot session token
  const resp = await fetch(
    "https://api.github.com/copilot_internal/v2/token",
    {
      headers: {
        authorization: `token ${accessToken}`,
        "editor-version": "Neovim/0.6.1",
        "editor-plugin-version": "copilot.vim/1.16.0",
        "user-agent": "GithubCopilot/1.155.0",
      },
    }
  );

  const respJson = await resp.json();
  const token = respJson.token;

  if (token) {
    return token;
  } else {
    console.error("Failed to get session token:", respJson);
  }
}

const token = getSessionToken();