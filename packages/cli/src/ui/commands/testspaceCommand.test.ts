/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { testspaceCommand } from './testspaceCommand.js';
import { CommandKind } from './types.js';

describe('testspaceCommand', () => {
  it('should have the correct basic properties', () => {
    expect(testspaceCommand.name).toBe('testspace');
    expect(testspaceCommand.altNames).toEqual(['ts', 'workspace']);
    expect(testspaceCommand.description).toBe('管理工具测试空间配置');
    expect(testspaceCommand.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have all expected subcommands', () => {
    expect(testspaceCommand.subCommands).toHaveLength(4);
    
    const subCommandNames = testspaceCommand.subCommands?.map(cmd => cmd.name) || [];
    expect(subCommandNames).toContain('set');
    expect(subCommandNames).toContain('create');
    expect(subCommandNames).toContain('reset');
    expect(subCommandNames).toContain('remove');
  });

  it('should have set subcommand with correct properties', () => {
    const setCommand = testspaceCommand.subCommands?.find(cmd => cmd.name === 'set');
    expect(setCommand).toBeDefined();
    expect(setCommand?.altNames).toEqual(['config', 'path']);
    expect(setCommand?.description).toBe('设置测试空间路径');
  });

  it('should have create subcommand with correct properties', () => {
    const createCommand = testspaceCommand.subCommands?.find(cmd => cmd.name === 'create');
    expect(createCommand).toBeDefined();
    expect(createCommand?.altNames).toEqual(['init', 'mkdir']);
    expect(createCommand?.description).toBe('创建测试空间目录');
  });
});
