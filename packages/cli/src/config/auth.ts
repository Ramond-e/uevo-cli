/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@uevo/uevo-cli-core';
import { loadEnvironment } from './settings.js';

export const validateAuthMethod = (authMethod: string): string | null => {
  loadEnvironment();
  if (
    authMethod === AuthType.LOGIN_WITH_GOOGLE ||
    authMethod === AuthType.CLOUD_SHELL
  ) {
    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    if (!process.env.GEMINI_API_KEY) {
      return 'GEMINI_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const hasVertexProjectLocationConfig =
      !!process.env.GOOGLE_CLOUD_PROJECT && !!process.env.GOOGLE_CLOUD_LOCATION;
    const hasGoogleApiKey = !!process.env.GOOGLE_API_KEY;
    if (!hasVertexProjectLocationConfig && !hasGoogleApiKey) {
      return (
        'When using Vertex AI, you must specify either:\n' +
        '�?GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '�?GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  if (authMethod === AuthType.USE_ALIYUN) {
    if (!process.env.DASHSCOPE_API_KEY) {
      return 'DASHSCOPE_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    return null;
  }

  if (authMethod === AuthType.USE_ANTHROPIC) {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return 'ANTHROPIC_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    
    // 验证 API 密钥格式
    if (!anthropicApiKey.startsWith('sk-ant-')) {
      return 'Invalid ANTHROPIC_API_KEY format. The key should start with "sk-ant-".';
    }
    
    console.log(`[Auth] ✅ Anthropic API密钥格式验证通过，长度: ${anthropicApiKey.length}`);
    return null;
  }

  // Support additional provider authentication methods (these are used by /api and /model commands)
  // but they are not primary authentication methods for the CLI itself
  if (
    authMethod === AuthType.USE_DEEPSEEK ||
    authMethod === AuthType.USE_OPENAI ||
    authMethod === AuthType.USE_OPENROUTER
  ) {
    // These are valid auth types but not used for primary CLI authentication
    // They are used by the new /api and /model commands for multi-provider support
    return 'This authentication method is not supported for primary CLI authentication. Please use "Login with Google", "Use Gemini API Key", "Vertex AI", "Anthropic API Key", or "Aliyun DashScope API Key" instead.';
  }

  return 'Invalid auth method selected.';
};
