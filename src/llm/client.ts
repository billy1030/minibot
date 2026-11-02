import OpenAI from "openai";
import { LLMConfig } from "../config/schema.js";

export class LLMClient {
  private openai: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.openai = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey || "dummy-key",
    });
  }

  async createChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
    options?: OpenAI.RequestOptions
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
      params.tool_choice = "auto";
    }

    return await this.openai.chat.completions.create(params, options);
  }
}
