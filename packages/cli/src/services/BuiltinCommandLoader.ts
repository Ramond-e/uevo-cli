/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ICommandLoader } from './types.js';
import { SlashCommand } from '../ui/commands/types.js';
import { Config } from '@uevo/uevo-cli-core';
import { aboutCommand } from '../ui/commands/aboutCommand.js';
import { authCommand } from '../ui/commands/authCommand.js';
import { bugCommand } from '../ui/commands/bugCommand.js';
import { chatCommand } from '../ui/commands/chatCommand.js';
import { clearCommand } from '../ui/commands/clearCommand.js';
import { compressCommand } from '../ui/commands/compressCommand.js';
import { copyCommand } from '../ui/commands/copyCommand.js';
import { corgiCommand } from '../ui/commands/corgiCommand.js';
import { docsCommand } from '../ui/commands/docsCommand.js';
import { editorCommand } from '../ui/commands/editorCommand.js';
import { extensionsCommand } from '../ui/commands/extensionsCommand.js';
import { helpCommand } from '../ui/commands/helpCommand.js';
import { ideCommand } from '../ui/commands/ideCommand.js';
import { mcpCommand } from '../ui/commands/mcpCommand.js';
import { memoryCommand } from '../ui/commands/memoryCommand.js';
import { privacyCommand } from '../ui/commands/privacyCommand.js';
import { quitCommand } from '../ui/commands/quitCommand.js';
import { restoreCommand } from '../ui/commands/restoreCommand.js';
import { rulesCommand } from '../ui/commands/rulesCommand.js';
import { statsCommand } from '../ui/commands/statsCommand.js';
import { testspaceCommand } from '../ui/commands/testspaceCommand.js';
import { themeCommand } from '../ui/commands/themeCommand.js';
import { toolsCommand } from '../ui/commands/toolsCommand.js';
import { debugTodoCommand } from '../ui/commands/debugTodoCommand.js';
import { testTodoCommand } from '../ui/commands/testTodoCommand.js';
import { todoCommand } from '../ui/commands/todoCommand.js';
import { apiCommand } from '../ui/commands/apiCommand.js';
import { modelCommand } from '../ui/commands/newModelCommand.js';
import { promptCommand } from '../ui/commands/promptCommand.js';
import { trustCommand } from '../ui/commands/trustCommand.js';

/**
 * Loads the core, hard-coded slash commands that are an integral part
 * of the uEVO CLI application.
 */
export class BuiltinCommandLoader implements ICommandLoader {
  constructor(private config: Config | null) {}

  /**
   * Gathers all raw built-in command definitions, injects dependencies where
   * needed (e.g., config) and filters out any that are not available.
   *
   * @param _signal An AbortSignal (unused for this synchronous loader).
   * @returns A promise that resolves to an array of `SlashCommand` objects.
   */
  async loadCommands(_signal: AbortSignal): Promise<SlashCommand[]> {
    const allDefinitions: Array<SlashCommand | null> = [
      aboutCommand,
      apiCommand,
      authCommand,
      bugCommand,
      chatCommand,
      clearCommand,
      compressCommand,
      copyCommand,
      corgiCommand,
      debugTodoCommand,
      docsCommand,
      editorCommand,
      extensionsCommand,
      helpCommand,
      ideCommand(this.config),
      mcpCommand,
      memoryCommand,
      modelCommand,
      privacyCommand,
      promptCommand,
      quitCommand,
      restoreCommand(this.config),
      rulesCommand,
      statsCommand,
      testspaceCommand,
      testTodoCommand,
      themeCommand,
      todoCommand,
      toolsCommand,
      trustCommand,
    ];

    return allDefinitions.filter((cmd): cmd is SlashCommand => cmd !== null);
  }
}
