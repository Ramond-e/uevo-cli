/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeminiClient } from './client.js';
import { Config } from '../config/config.js';
import { AIClientFactory } from './aiClientFactory.js';
import { getProviderForModel, getEnvVarForProvider, AIProvider } from './modelProviderMapping.js';
import { AIMessage, AIClientConfig } from './aiClient.js';
import { Content, Part, GenerateContentResponse } from '@google/genai';

/**
 * 智能AI客户端路由器
 * 根据当前模型自动选择正确的AI提供商，但保持与GeminiClient的接口兼容性
 */
export class SmartAIClient {
  private config: Config;
  private geminiClient: GeminiClient;
  private currentAIClient: any = null;
  private currentModel: string = '';

  constructor(config: Config) {
    // console.log('[SmartAI] SmartAIClient 构造函数被调用');
    this.config = config;
    this.geminiClient = new GeminiClient(config);
    this.currentAIClient = this.geminiClient; // 默认使用GeminiClient
    // console.log('[SmartAI] SmartAIClient 初始化完成');
  }
  
  /**
   * 初始化客户端
   */
  async initialize(contentGeneratorConfig?: any): Promise<void> {
    // console.log('[SmartAI] 初始化 SmartAIClient...');
    // 初始化内部的 GeminiClient
    if (this.geminiClient && typeof this.geminiClient.initialize === 'function') {
      const generatorConfig = contentGeneratorConfig || this.config.getContentGeneratorConfig();
      if (generatorConfig) {
        await this.geminiClient.initialize(generatorConfig);
      }
    }
    // console.log('[SmartAI] SmartAIClient 初始化完成');
  }

  /**
   * 检查是否需要使用非Gemini提供商
   */
  private shouldUseAlternativeProvider(): { useAlternative: boolean; provider?: AIProvider; apiKey?: string } {
    const model = this.config.getModel();
    const provider = getProviderForModel(model);
    
    // 如果是Gemini模型，使用原有的GeminiClient
    if (provider === AIProvider.GEMINI) {
      return { useAlternative: false };
    }

    // 检查是否配置了对应提供商的API密钥
    const envVar = getEnvVarForProvider(provider);
    const apiKey = process.env[envVar];
    
    if (!apiKey) {
      // 静默回退到Gemini，避免在UI中显示警告
      return { useAlternative: false };
    }

    return { useAlternative: true, provider, apiKey };
  }

  /**
   * 转换查询格式为AIMessage[]
   */
  private convertQueryToMessages(queryToSend: any): AIMessage[] {
    if (typeof queryToSend === 'string') {
      return [{ role: 'user', content: queryToSend }];
    }

    if (Array.isArray(queryToSend)) {
      // 如果是Part数组，转换为消息
      const content = queryToSend.map((part: Part) => {
        if (typeof part === 'string') return part;
        if (part.text) return part.text;
        return '';
      }).join('');
      
      return [{ role: 'user', content }];
    }

    // 默认情况
    return [{ role: 'user', content: String(queryToSend) }];
  }

  /**
   * 转换AIClient的流格式为GeminiClient兼容格式
   */
  private async *convertStreamToGeminiFormat(streamGenerator: AsyncGenerator<any>) {
    try {
      console.log('[SmartAI] 开始转换流格式');
      let hasContent = false;
      
      for await (const chunk of streamGenerator) {
        console.log('[SmartAI] 收到chunk:', chunk);
        
        switch (chunk.type) {
          case 'content':
            if (chunk.content && chunk.content.length > 0) {
              hasContent = true;
              const geminiChunk = {
                candidates: [{
                  content: {
                    parts: [{ text: chunk.content }],
                    role: 'model'
                  },
                  finishReason: undefined,
                  safetyRatings: []
                }],
                usageMetadata: undefined,
                modelVersion: this.config.getModel()
              };
              console.log('[SmartAI] 发送Gemini格式chunk:', geminiChunk);
              yield geminiChunk;
            }
            break;
            
          case 'done':
            console.log('[SmartAI] 流结束');
            // 确保至少发送一个空内容，以触发流结束
            if (!hasContent) {
              yield {
                candidates: [{
                  content: {
                    parts: [{ text: '' }],
                    role: 'model'
                  },
                  finishReason: 'STOP',
                  safetyRatings: []
                }],
                usageMetadata: undefined,
                modelVersion: this.config.getModel()
              };
            }
            return;
            
          case 'error':
            console.warn('[SmartAI] 流错误:', chunk.error);
            // 发送错误作为内容，让上层处理
            yield {
              candidates: [{
                content: {
                  parts: [{ text: `Error: ${chunk.error}` }],
                  role: 'model'
                },
                finishReason: 'OTHER',
                safetyRatings: []
              }],
              usageMetadata: undefined,
              modelVersion: this.config.getModel()
            };
            throw new Error(chunk.error);
            
          default:
            console.warn('[SmartAI] 未知chunk类型:', chunk.type);
        }
      }
      
      // 如果流意外结束，确保发送结束信号
      console.log('[SmartAI] 流意外结束，发送结束信号');
      if (!hasContent) {
        yield {
          candidates: [{
            content: {
              parts: [{ text: '' }],
              role: 'model'
            },
            finishReason: 'STOP',
            safetyRatings: []
          }],
          usageMetadata: undefined,
          modelVersion: this.config.getModel()
        };
      }
      
    } catch (error) {
      console.warn('[SmartAI] 流转换错误:', error);
      // 确保错误能被上层捕获
      throw error;
    }
  }

  // 智能路由的sendMessageStream方法
  sendMessageStream(queryToSend: any, abortSignal: AbortSignal, promptId: string) {
    console.log('[SmartAI] sendMessageStream 被调用');
    const { useAlternative, provider, apiKey } = this.shouldUseAlternativeProvider();
    
    console.log(`[SmartAI] 模型: ${this.config.getModel()}, 使用替代提供商: ${useAlternative}, 提供商: ${provider}`);
    
    if (!useAlternative) {
      // 使用原有的GeminiClient
      console.log('[SmartAI] 使用Gemini客户端');
      return this.geminiClient.sendMessageStream(queryToSend, abortSignal, promptId);
    }

    // 返回一个异步生成器函数
    const self = this;
    console.log(`[SmartAI] 使用${provider}提供商`);
    
    return (async function* () {
      try {
        // 使用替代提供商
        const model = self.config.getModel();
        const clientConfig: AIClientConfig = {
          provider: provider!,
          apiKey: apiKey!,
          model,
        };
        
        console.log('[SmartAI] 创建AI客户端配置:', { provider: provider, model });
        const aiClient = AIClientFactory.create(clientConfig, self.config);
        
        // 转换查询格式
        const messages = self.convertQueryToMessages(queryToSend);
        console.log('[SmartAI] 转换后的消息数量:', messages.length);
        
        // 使用AIClient的流式方法
        console.log('[SmartAI] 开始生成流式响应...');
        const streamGenerator = aiClient.generateContentStream(messages);
        
        // 转换流格式以兼容GeminiClient
        let hasYielded = false;
        for await (const chunk of self.convertStreamToGeminiFormat(streamGenerator)) {
          hasYielded = true;
          yield chunk;
        }
        
        // 如果没有产生任何内容，发送一个空响应
        if (!hasYielded) {
          console.log('[SmartAI] 流没有产生任何内容，发送空响应');
          yield {
            candidates: [{
              content: {
                parts: [{ text: '' }],
                role: 'model'
              },
              finishReason: 'STOP',
              safetyRatings: []
            }],
            usageMetadata: undefined,
            modelVersion: self.config.getModel()
          };
        }
        
        console.log('[SmartAI] 流式响应完成');
      } catch (error) {
        console.warn('[SmartAI] 错误:', error);
        // 如果是因为API密钥问题，给出更明确的错误信息
        if (error instanceof Error && error.message.includes('API')) {
          yield {
            candidates: [{
              content: {
                parts: [{ text: `Error: ${error.message}. Please check your ${provider} API key configuration.` }],
                role: 'model'
              },
              finishReason: 'OTHER',
              safetyRatings: []
            }],
            usageMetadata: undefined,
            modelVersion: self.config.getModel()
          };
        } else {
          // 其他错误静默回退到Gemini
          console.log('[SmartAI] 回退到Gemini客户端');
          yield* self.geminiClient.sendMessageStream(queryToSend, abortSignal, promptId);
        }
      }
    })();
  }

  // 所有其他方法直接代理到GeminiClient
  getHistory() {
    return this.geminiClient.getHistory();
  }

  addHistory(content: any) {
    return this.geminiClient.addHistory(content);
  }

  async startChat() {
    // console.log('[SmartAI] startChat 被调用');
    
    // 无论使用哪个提供商，都要确保 geminiClient 被初始化
    // 因为它管理着聊天历史和会话状态
    if (!this.geminiClient.isInitialized()) {
      // console.log('[SmartAI] 初始化 geminiClient...');
      const generatorConfig = this.config.getContentGeneratorConfig();
      if (generatorConfig) {
        await this.geminiClient.initialize(generatorConfig);
      }
    }
    
    // 始终使用 geminiClient 的 startChat
    // 即使使用其他提供商，我们仍然需要 GeminiChat 来管理会话
    const chat = await this.geminiClient.startChat();
    // console.log('[SmartAI] startChat 完成');
    return chat;
  }

  getChat() {
    // console.log('[SmartAI] getChat 被调用');
    // 确保chat已经初始化
    try {
      const chat = this.geminiClient.getChat();
      // console.log('[SmartAI] getChat 成功返回chat');
      return chat;
    } catch (error) {
      console.warn('[SmartAI] getChat 失败:', error);
      // 如果chat未初始化，抛出错误让调用者处理
      throw error;
    }
  }

  getUserTier() {
    return this.geminiClient.getUserTier();
  }

  isInitialized() {
    const initialized = this.geminiClient.isInitialized();
    console.log('[SmartAI] isInitialized 被调用，结果:', initialized);
    return initialized;
  }
}
