/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promptCommand } from './promptCommand.js';
import { CommandKind } from './types.js';

describe('promptCommand', () => {
  it('should have the correct basic properties', () => {
    expect(promptCommand.name).toBe('prompt');
    expect(promptCommand.altNames).toEqual(['p']);
    expect(promptCommand.description).toBe('查看AI实际收到的prompt信息');
    expect(promptCommand.kind).toBe(CommandKind.BUILT_IN);
    expect(promptCommand.action).toBeDefined();
  });

  it('should have all expected subcommands', () => {
    expect(promptCommand.subCommands).toHaveLength(6);
    
    const subCommandNames = promptCommand.subCommands?.map(cmd => cmd.name) || [];
    expect(subCommandNames).toContain('current');
    expect(subCommandNames).toContain('system');
    expect(subCommandNames).toContain('template');
    expect(subCommandNames).toContain('history');
    expect(subCommandNames).toContain('compression');
    expect(subCommandNames).toContain('help');
  });

  it('should have current subcommand with correct properties', () => {
    const currentCommand = promptCommand.subCommands?.find(cmd => cmd.name === 'current');
    expect(currentCommand).toBeDefined();
    expect(currentCommand?.altNames).toEqual(['show', 'info']);
    expect(currentCommand?.description).toBe('显示当前完整的prompt构建信息');
    expect(currentCommand?.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have system subcommand with correct properties', () => {
    const systemCommand = promptCommand.subCommands?.find(cmd => cmd.name === 'system');
    expect(systemCommand).toBeDefined();
    expect(systemCommand?.altNames).toEqual(['sys']);
    expect(systemCommand?.description).toBe('显示完整的系统提示词内容');
    expect(systemCommand?.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have template subcommand with correct properties', () => {
    const templateCommand = promptCommand.subCommands?.find(cmd => cmd.name === 'template');
    expect(templateCommand).toBeDefined();
    expect(templateCommand?.altNames).toEqual(['tpl', 'templates']);
    expect(templateCommand?.description).toBe('显示当前使用的提示词模板信息');
    expect(templateCommand?.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have history subcommand with correct properties', () => {
    const historyCommand = promptCommand.subCommands?.find(cmd => cmd.name === 'history');
    expect(historyCommand).toBeDefined();
    expect(historyCommand?.altNames).toEqual(['hist', 'h']);
    expect(historyCommand?.description).toBe('显示对话历史信息');
    expect(historyCommand?.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have compression subcommand with correct properties', () => {
    const compressionCommand = promptCommand.subCommands?.find(cmd => cmd.name === 'compression');
    expect(compressionCommand).toBeDefined();
    expect(compressionCommand?.altNames).toEqual(['compress', 'comp']);
    expect(compressionCommand?.description).toBe('显示历史压缩提示词');
    expect(compressionCommand?.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have help subcommand with correct properties', () => {
    const helpCommand = promptCommand.subCommands?.find(cmd => cmd.name === 'help');
    expect(helpCommand).toBeDefined();
    expect(helpCommand?.altNames).toEqual(['?']);
    expect(helpCommand?.description).toBe('显示prompt命令的帮助信息');
    expect(helpCommand?.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have all subcommands with defined actions', () => {
    promptCommand.subCommands?.forEach(subCommand => {
      expect(subCommand.action).toBeDefined();
      expect(typeof subCommand.action).toBe('function');
    });
  });
});