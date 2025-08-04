/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CustomToolParser } from './customToolParser.js';

describe('CustomToolParser', () => {
  describe('parseResponse with search functionality', () => {
    it('should detect search_custom_tools request', () => {
      const content = 'Let me search for tools: <search_custom_tools>';
      const result = CustomToolParser.parseResponse(content);
      
      expect(result.hasSearchRequest).toBe(true);
      expect(result.commands).toHaveLength(0);
    });

    it('should detect both search and add commands', () => {
      const content = `
        First let me search: <search_custom_tools>
        
        Now let me add a tool:
        <custom_tool_add>
        {
          "name": "Test Tool",
          "description": "A test tool"
        }
        </custom_tool_add>
      `;
      
      const result = CustomToolParser.parseResponse(content);
      
      expect(result.hasSearchRequest).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].name).toBe('Test Tool');
    });

    it('should handle self-closing search tag', () => {
      const content = 'Search tools: <search_custom_tools/>';
      const result = CustomToolParser.parseResponse(content);
      
      expect(result.hasSearchRequest).toBe(true);
    });

    it('should not detect search when not present', () => {
      const content = 'Just regular content here';
      const result = CustomToolParser.parseResponse(content);
      
      expect(result.hasSearchRequest).toBe(false);
      expect(result.commands).toHaveLength(0);
    });
  });

  describe('cleanResponse with search functionality', () => {
    it('should remove search_custom_tools tags', () => {
      const content = 'Before <search_custom_tools> After';
      const cleaned = CustomToolParser.cleanResponse(content);
      
      expect(cleaned).toBe('Before  After');
    });

    it('should remove self-closing search tags', () => {
      const content = 'Before <search_custom_tools/> After';
      const cleaned = CustomToolParser.cleanResponse(content);
      
      expect(cleaned).toBe('Before  After');
    });

    it('should remove both search and add tags', () => {
      const content = `
        Search: <search_custom_tools>
        Add: <custom_tool_add>{"name": "test"}</custom_tool_add>
        Done.
      `;
      
      const cleaned = CustomToolParser.cleanResponse(content);
      
      expect(cleaned).not.toContain('<search_custom_tools>');
      expect(cleaned).not.toContain('<custom_tool_add>');
      expect(cleaned).toContain('Search:');
      expect(cleaned).toContain('Add:');
      expect(cleaned).toContain('Done.');
    });
  });
});