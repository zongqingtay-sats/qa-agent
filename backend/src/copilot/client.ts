import { ChatMessage, ChatOptions } from './types';

interface CopilotClientOptions {
  token: string;
  model?: string;
}

interface SessionToken {
  token: string;
  expires_at: number;
}

/**
 * Client for interacting with GitHub Copilot Chat API.
 */
export default class CopilotClient {
  private accessToken: string;
  private sessionToken: SessionToken | null = null;
  private model: string;
  private baseUrl = 'https://api.githubcopilot.com';

  constructor({ token, model }: CopilotClientOptions) {
    this.accessToken = token;
    this.model = model || 'gpt-4o';
  }

  /**
   * Check if the cached session token is expired or about to expire (30s buffer).
   */
  private isTokenExpired(): boolean {
    if (!this.sessionToken) return true;
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= this.sessionToken.expires_at - 30;
  }

  /**
   * Fetch a short-lived Copilot session token from the access token.
   * Caches the result and auto-refreshes when expired (with a 30s buffer).
   */
  private async getSessionToken(): Promise<string> {
    if (this.sessionToken?.token && !this.isTokenExpired()) {
      return this.sessionToken.token;
    }

    console.debug('Fetching new Copilot session token...');

    const resp = await fetch('https://api.github.com/copilot_internal/v2/token', {
      headers: {
        authorization: `token ${this.accessToken}`,
        'editor-version': 'Neovim/0.6.1',
        'editor-plugin-version': 'copilot.vim/1.16.0',
        'user-agent': 'GithubCopilot/1.155.0',
      },
    });

    const respJson = await resp.json() as SessionToken;
    if (!respJson.token) {
      throw new Error(`Failed to get session token: ${JSON.stringify(respJson)}`);
    }

    this.sessionToken = respJson;
    return this.sessionToken.token;
  }

  /**
   * Send a chat completion request with automatic endpoint fallback.
   * Tries the Copilot API first, then the GitHub Models API.
   * @param messages - The conversation messages to send.
   * @param options - Optional temperature and max token overrides.
   * @returns The assistant's response content.
   * @throws If all API endpoints fail.
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const body = {
      model: this.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      n: 1,
      stream: true,
    };

    const sessionToken = await this.getSessionToken();

    const endpoint = {
      url: `${this.baseUrl}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Editor-Version': 'vscode/1.95.3',
        'Editor-Plugin-Version': 'copilot-chat/0.22.4',
        'Openai-Intent': 'conversation-panel',
        'X-Github-Api-Version': '2023-07-07'
      },
    };

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: endpoint.headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.debug(`Endpoint ${endpoint.url} returned ${response.status}: ${errorText}`);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const respText = await response.text();
      let result = "";

      // Parse the SSE response, extracting completions from each data line
      for (const line of respText.split("\n")) {
        if (!line) continue;
        try {
          if (line.startsWith("data: ")) {
            let jsonData;
            try {
              jsonData = JSON.parse(line.slice(6));
            } catch (e) {
              if (line.slice(6).trim() === "[DONE]") {
                console.debug('Stream completed with [DONE] signal.');
                break;
              }
              console.debug(`Failed to parse line as JSON: ${line}`);
              continue;
            }
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
    } catch (err) {
      console.debug(`Endpoint ${endpoint.url} failed: ${(err as Error).message}`);
      throw err as Error;
    }
  }
}
