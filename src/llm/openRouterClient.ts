import * as vscode from 'vscode';
import { OPENROUTER_BASE_URL, HTTP_REFERER, APP_TITLE, LLM_RETRY_DELAYS, DEFAULT_MODEL } from '../utils/constants';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function testConnectivity(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': HTTP_REFERER,
          'X-Title': APP_TITLE,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 401) {
      return { ok: false, error: 'Invalid API key. Check it at openrouter.ai/keys' };
    }
    if (response.status === 403) {
      return { ok: false, error: 'API key lacks permission. Generate a new key at openrouter.ai/keys' };
    }
    if (!response.ok) {
      return { ok: false, error: `OpenRouter returned ${response.status}. Try again later.` };
    }
    return { ok: true };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out. Check your internet or firewall.' };
    }
    if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
      return { ok: false, error: 'Cannot reach openrouter.ai. Check your internet connection.' };
    }
    return { ok: false, error: `Connection failed: ${e.message}` };
  }
}

export class OpenRouterClient {
  async chatCompletion(messages: ChatMessage[], config: OpenRouterConfig): Promise<string> {
    const model = config.model ?? DEFAULT_MODEL;
    const maxTokens = config.maxTokens ?? 2000;
    const temperature = config.temperature ?? 0.3;

    for (let attempt = 0; attempt <= LLM_RETRY_DELAYS.length; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let response: Response;
        try {
          response = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': HTTP_REFERER,
              'X-Title': APP_TITLE,
            },
            body: JSON.stringify({
              model,
              messages,
              max_tokens: maxTokens,
              temperature,
              response_format: { type: 'json_object' },
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (response.status === 429) {
          if (attempt < LLM_RETRY_DELAYS.length) {
            const delay = LLM_RETRY_DELAYS[attempt];
            vscode.window.showInformationMessage(`VibeAudit: Rate limited, retrying in ${delay / 1000}s...`);
            await sleep(delay);
            continue;
          }
          throw new Error('Rate limit exceeded. Please wait and try again.');
        }

        if (response.status >= 500 && attempt < 1) {
          await sleep(LLM_RETRY_DELAYS[0]);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
          const errorCode = errorBody?.error?.code ?? '';
          const errorMessage = errorBody?.error?.message ?? '';

          if (response.status === 404 || errorCode === 'model_not_found' || errorMessage.includes('not found')) {
            const choice = await vscode.window.showErrorMessage(
              `VibeAudit: Model "${model}" not found on OpenRouter. It may have been removed.`,
              'Open Settings',
              'Browse Free Models'
            );
            if (choice === 'Open Settings') {
              await vscode.commands.executeCommand('workbench.action.openSettings', 'vibeaudit.llmModel');
            } else if (choice === 'Browse Free Models') {
              await vscode.env.openExternal(vscode.Uri.parse('https://openrouter.ai/models?q=free'));
            }
            throw new Error(`Model not found: ${model}`);
          }

          if (response.status === 401) {
            const choice = await vscode.window.showErrorMessage(
              'VibeAudit: Invalid OpenRouter API key.',
              'Update API Key'
            );
            if (choice === 'Update API Key') {
              await vscode.commands.executeCommand('vibeaudit.setApiKey');
            }
            throw new Error('Invalid API key');
          }

          throw new Error(`OpenRouter API error ${response.status}: ${errorMessage || response.statusText}`);
        }

        const data = await response.json() as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from LLM.');
        }
        return content;

      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds.');
        }
        if (attempt >= LLM_RETRY_DELAYS.length) {
          throw err;
        }
      }
    }

    throw new Error('All retry attempts failed.');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
