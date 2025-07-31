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
    if (!process.env.UEVO_API_KEY) {
      return 'UEVO_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
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

  // Support additional provider authentication methods (these are used by /api and /model commands)
  // but they are not primary authentication methods for the CLI itself
  if (
    authMethod === AuthType.USE_ANTHROPIC ||
    authMethod === AuthType.USE_DEEPSEEK ||
    authMethod === AuthType.USE_OPENAI ||
    authMethod === AuthType.USE_OPENROUTER ||
    authMethod === AuthType.USE_ALIYUN
  ) {
    // These are valid auth types but not used for primary CLI authentication
    // They are used by the new /api and /model commands for multi-provider support
    return 'This authentication method is not supported for primary CLI authentication. Please use "Login with Google", "Use Gemini API Key", or "Vertex AI" instead.';
  }

  return 'Invalid auth method selected.';
};
