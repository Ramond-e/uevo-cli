/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'uevo-cli';

export const EVENT_USER_PROMPT = 'uevo_cli.user_prompt';
export const EVENT_TOOL_CALL = 'uevo_cli.tool_call';
export const EVENT_API_REQUEST = 'uevo_cli.api_request';
export const EVENT_API_ERROR = 'uevo_cli.api_error';
export const EVENT_API_RESPONSE = 'uevo_cli.api_response';
export const EVENT_CLI_CONFIG = 'uevo_cli.config';
export const EVENT_FLASH_FALLBACK = 'uevo_cli.flash_fallback';
export const EVENT_FLASH_DECIDED_TO_CONTINUE =
  'uevo_cli.flash_decided_to_continue';

export const METRIC_TOOL_CALL_COUNT = 'uevo_cli.tool.call.count';
export const METRIC_TOOL_CALL_LATENCY = 'uevo_cli.tool.call.latency';
export const METRIC_API_REQUEST_COUNT = 'uevo_cli.api.request.count';
export const METRIC_API_REQUEST_LATENCY = 'uevo_cli.api.request.latency';
export const METRIC_TOKEN_USAGE = 'uevo_cli.token.usage';
export const METRIC_SESSION_COUNT = 'uevo_cli.session.count';
export const METRIC_FILE_OPERATION_COUNT = 'uevo_cli.file.operation.count';
