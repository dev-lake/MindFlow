import { ModelConfig, AIMessage } from '../types';

export interface AIResponse {
  content: string;
  thinkingContent?: string;
}

export interface AIProvider {
  sendMessage(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse>;
}

class OpenAIProvider implements AIProvider {
  async sendMessage(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2000,
        stream: !!onChunk,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    // 如果是流式响应
    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullContent += content;
                onChunk(content, 'content');
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      return { content: fullContent };
    }

    // 非流式响应
    const data = await response.json();
    return { content: data.choices[0].message.content };
  }
}

class AnthropicProvider implements AIProvider {
  async sendMessage(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-sonnet-20240229',
        messages,
        max_tokens: config.maxTokens || 2000,
        temperature: config.temperature || 0.7,
        stream: !!onChunk,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    // 如果是流式响应
    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let thinkingContent = '';
      let currentBlockType: 'thinking' | 'text' | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);

              // 检测内容块开始
              if (parsed.type === 'content_block_start') {
                currentBlockType = parsed.content_block?.type === 'thinking' ? 'thinking' : 'text';
              }

              // 处理内容块增量
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                const content = parsed.delta.text;

                if (currentBlockType === 'thinking') {
                  thinkingContent += content;
                  onChunk(content, 'thinking');
                } else {
                  fullContent += content;
                  onChunk(content, 'content');
                }
              }

              // 内容块结束
              if (parsed.type === 'content_block_stop') {
                currentBlockType = null;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      return {
        content: fullContent,
        thinkingContent: thinkingContent || undefined,
      };
    }

    // 非流式响应
    const data = await response.json();
    const textContent = data.content.find((block: any) => block.type === 'text');
    const thinkingBlock = data.content.find((block: any) => block.type === 'thinking');

    return {
      content: textContent?.text || '',
      thinkingContent: thinkingBlock?.thinking || undefined,
    };
  }
}

class DeepSeekProvider implements AIProvider {
  async sendMessage(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    if (!config.apiKey) {
      throw new Error('DeepSeek API key is required');
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'deepseek-chat',
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2000,
        stream: !!onChunk,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    // 如果是流式响应
    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let thinkingContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              const reasoning = parsed.choices[0]?.delta?.reasoning_content;

              if (reasoning) {
                thinkingContent += reasoning;
                onChunk(reasoning, 'thinking');
              }
              if (content) {
                fullContent += content;
                onChunk(content, 'content');
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      return {
        content: fullContent,
        thinkingContent: thinkingContent || undefined,
      };
    }

    // 非流式响应
    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      thinkingContent: data.choices[0].message.reasoning_content || undefined,
    };
  }
}

class LocalProvider implements AIProvider {
  async sendMessage(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const baseURL = config.baseURL || 'http://localhost:11434';

    const response = await fetch(`${baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'llama2',
        messages,
        stream: !!onChunk,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Local model API error: ${response.statusText}`);
    }

    // 如果是流式响应
    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content;
            if (content) {
              fullContent += content;
              onChunk(content, 'content');
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      return { content: fullContent };
    }

    // 非流式响应
    const data = await response.json();
    return { content: data.message.content };
  }
}

class CustomProvider implements AIProvider {
  async sendMessage(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    if (!config.baseURL) {
      throw new Error('自定义服务商需要配置 API 地址');
    }

    const protocol = config.apiProtocol || 'openai';

    // 根据协议类型选择不同的实现
    switch (protocol) {
      case 'openai':
        return this.sendOpenAICompatible(messages, config, onChunk, abortSignal);
      case 'anthropic':
        return this.sendAnthropicCompatible(messages, config, onChunk, abortSignal);
      case 'ollama':
        return this.sendOllamaCompatible(messages, config, onChunk, abortSignal);
      default:
        throw new Error(`不支持的 API 协议: ${protocol}`);
    }
  }

  private async sendOpenAICompatible(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2000,
        stream: !!onChunk,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullContent += content;
                onChunk(content, 'content');
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      return { content: fullContent };
    }

    const data = await response.json();
    return { content: data.choices[0].message.content };
  }

  private async sendAnthropicCompatible(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    const response = await fetch(`${config.baseURL}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens || 2000,
        temperature: config.temperature || 0.7,
        stream: !!onChunk,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let thinkingContent = '';
      let currentBlockType: 'thinking' | 'text' | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content_block_start') {
                currentBlockType = parsed.content_block?.type === 'thinking' ? 'thinking' : 'text';
              }

              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                const content = parsed.delta.text;

                if (currentBlockType === 'thinking') {
                  thinkingContent += content;
                  onChunk(content, 'thinking');
                } else {
                  fullContent += content;
                  onChunk(content, 'content');
                }
              }

              if (parsed.type === 'content_block_stop') {
                currentBlockType = null;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      return {
        content: fullContent,
        thinkingContent: thinkingContent || undefined,
      };
    }

    const data = await response.json();
    const textContent = data.content.find((block: any) => block.type === 'text');
    const thinkingBlock = data.content.find((block: any) => block.type === 'thinking');

    return {
      content: textContent?.text || '',
      thinkingContent: thinkingBlock?.thinking || undefined,
    };
  }

  private async sendOllamaCompatible(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const response = await fetch(`${config.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: !!onChunk,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content;
            if (content) {
              fullContent += content;
              onChunk(content, 'content');
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      return { content: fullContent };
    }

    const data = await response.json();
    return { content: data.message.content };
  }
}

export const aiProviders = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  deepseek: new DeepSeekProvider(),
  local: new LocalProvider(),
  custom: new CustomProvider(),
};

export async function sendAIMessage(
  messages: AIMessage[],
  config: ModelConfig,
  onChunk?: (chunk: string, type?: 'thinking' | 'content') => void,
  abortSignal?: AbortSignal
): Promise<AIResponse> {
  const provider = aiProviders[config.provider];
  if (!provider) {
    throw new Error(`Unknown provider: ${config.provider}`);
  }
  return provider.sendMessage(messages, config, onChunk, abortSignal);
}
