// npx tsx scripts/get-access-token.ts 

import * as fs from "fs";
import path from "path";

// Headers that mimic an official Copilot editor plugin request
const HEADERS = {
  accept: "application/json",
  "editor-version": "Neovim/0.6.1",
  "editor-plugin-version": "copilot.vim/1.16.0",
  "content-type": "application/json",
  "user-agent": "GithubCopilot/1.155.0",
  "accept-encoding": "gzip,deflate,br",
};

// Public OAuth client ID used by GitHub Copilot's editor plugins for device auth
const CLIENT_ID = "Iv1.b507a08c87ecfe98";

async function getAccessToken() {
  // Step 1: Initiate the OAuth device flow to get a device code and user code
  const resp = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ client_id: CLIENT_ID, scope: "read:user" }),
  });

  const respJson = await resp.json();
  const deviceCode = respJson.device_code; // Unique code identifying this auth session
  const userCode = respJson.user_code; // Short code the user enters in the browser
  const verificationUri = respJson.verification_uri; // URL where the user enters the code

  // Step 2: Prompt the user to visit the URL and enter the code
  console.log(
    `Please visit ${verificationUri} and enter code ${userCode} to authenticate.`
  );

  // Step 3: Poll GitHub every 5 seconds until the user completes authentication
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Exchange the device code for an access token
    const tokenResp = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      }
    );

    const tokenJson = await tokenResp.json();
    const accessToken = tokenJson.access_token;

    // If the user has authorized, we receive an access token
    if (accessToken) {
      // Save the token to a local file for later use by the Copilot API
      fs.writeFileSync(path.join(__dirname, ".copilot-token"), accessToken);
      console.log("Authentication success!", accessToken);
      break;
    }
  }
}

getAccessToken();
