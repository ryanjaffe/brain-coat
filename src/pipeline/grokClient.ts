import OpenAI from "openai";

export interface GrokClientOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export class GrokClient {
  private client: OpenAI;
  readonly model: string;
  public approxPromptTokens = 0;
  public approxCompletionTokens = 0;
  public callCount = 0;

  constructor(opts: GrokClientOptions) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? "https://api.x.ai/v1",
      dangerouslyAllowBrowser: false,
    });
    this.model = opts.model ?? "grok-4-3";
  }

  /**
   * Chat completion with automatic retry/backoff. Returns the assistant text.
   */
  async chat(args: {
    system: string;
    user: string;
    temperature: number;
    maxTokens?: number;
    retries?: number;
  }): Promise<string> {
    const { system, user, temperature, maxTokens = 4096, retries = 3 } = args;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await this.client.chat.completions.create({
          model: this.model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        });
        this.callCount += 1;
        if (res.usage) {
          this.approxPromptTokens += res.usage.prompt_tokens ?? 0;
          this.approxCompletionTokens += res.usage.completion_tokens ?? 0;
        }
        const content = res.choices[0]?.message?.content ?? "";
        return content;
      } catch (err) {
        lastErr = err;
        if (attempt === retries) break;
        const wait = 2000 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastErr;
  }
}

/**
 * Parse a JSON array out of a model response that may include prose or fences.
 */
export function parseJsonArray<T>(text: string): T[] {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array in response");
  const slice = candidate.slice(start, end + 1);
  return JSON.parse(slice) as T[];
}
