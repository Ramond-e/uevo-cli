/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CustomToolInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  lastModified: string;
  version: string;
  category: string;
  tags: string[];
  parameters?: Record<string, any>;
  examples?: string[];
  dependencies?: string[];
  status: 'active' | 'inactive' | 'deprecated';
}

export interface CustomToolRegistry {
  version: string;
  lastUpdated: string;
  tools: CustomToolInfo[];
}

export interface CustomToolCommand {
  type: 'custom_tool_add';
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  examples?: string[];
  parameters?: Record<string, any>;
}

export interface CustomToolAddDetails {
  name: string;
  description: string;
  category: string;
  tags: string[];
  examples: string[];
  parameters?: Record<string, any>;
}