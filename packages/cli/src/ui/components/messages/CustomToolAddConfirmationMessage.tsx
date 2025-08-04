/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../../colors.js';
import { CustomToolAddDetails } from '../../types/customTool.js';
import {
  RadioButtonSelect,
  RadioSelectItem,
} from '../shared/RadioButtonSelect.js';

export enum CustomToolConfirmationOutcome {
  Add = 'add',
  Cancel = 'cancel',
  Modify = 'modify'
}

export interface CustomToolAddConfirmationProps {
  toolDetails: CustomToolAddDetails;
  isFocused?: boolean;
  terminalWidth: number;
  onConfirm: (outcome: CustomToolConfirmationOutcome) => void;
}

export const CustomToolAddConfirmationMessage: React.FC<
  CustomToolAddConfirmationProps
> = ({
  toolDetails,
  isFocused = true,
  terminalWidth,
  onConfirm,
}) => {
  const childWidth = terminalWidth - 2; // 2 for padding

  useInput((_, key) => {
    if (!isFocused) return;
    if (key.escape) {
      onConfirm(CustomToolConfirmationOutcome.Cancel);
    }
  });

  const handleSelect = (item: CustomToolConfirmationOutcome) => onConfirm(item);

  const options: Array<RadioSelectItem<CustomToolConfirmationOutcome>> = [
    {
      label: '✅ 添加到工具注册表',
      value: CustomToolConfirmationOutcome.Add,
    },
    {
      label: '✏️  修改工具信息',
      value: CustomToolConfirmationOutcome.Modify,
    },
    {
      label: '❌ 取消添加',
      value: CustomToolConfirmationOutcome.Cancel,
    },
  ];

  const question = '是否要将此自定义工具添加到工具注册表？';

  return (
    <Box
      minWidth="90%"
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      justifyContent="space-around"
      padding={1}
      overflow="hidden"
    >
      {/* 工具详情展示 */}
      <Box flexDirection="column" marginBottom={1} width={childWidth}>
        <Text color={Colors.AccentBlue} bold>
          🔧 新的自定义工具
        </Text>
        
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Box flexDirection="row" marginBottom={1}>
            <Text color={Colors.AccentYellow} bold>名称: </Text>
            <Text>{toolDetails.name}</Text>
          </Box>
          
          <Box flexDirection="row" marginBottom={1}>
            <Text color={Colors.AccentYellow} bold>描述: </Text>
            <Text>{toolDetails.description}</Text>
          </Box>
          
          <Box flexDirection="row" marginBottom={1}>
            <Text color={Colors.AccentYellow} bold>分类: </Text>
            <Text>{toolDetails.category || 'General'}</Text>
          </Box>
          
          {toolDetails.tags && toolDetails.tags.length > 0 && (
            <Box flexDirection="row" marginBottom={1}>
              <Text color={Colors.AccentYellow} bold>标签: </Text>
              <Text>{toolDetails.tags.join(', ')}</Text>
            </Box>
          )}
          
          {toolDetails.examples && toolDetails.examples.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color={Colors.AccentYellow} bold>示例:</Text>
              <Box paddingLeft={2}>
                {toolDetails.examples.slice(0, 2).map((example, index) => (
                  <Text key={index} color={Colors.Gray}>
                    • {example}
                  </Text>
                ))}
              </Box>
            </Box>
          )}
          
          {toolDetails.parameters && Object.keys(toolDetails.parameters).length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color={Colors.AccentYellow} bold>参数:</Text>
              <Box paddingLeft={2}>
                {Object.entries(toolDetails.parameters).slice(0, 3).map(([key, value]) => (
                  <Text key={key} color={Colors.Gray}>
                    • {key}: {JSON.stringify(value)}
                  </Text>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* 问题和选项 */}
      <Box flexDirection="column" width={childWidth}>
        <Box marginBottom={1}>
          <Text color={Colors.AccentGreen} bold>
            {question}
          </Text>
        </Box>

        <RadioButtonSelect
          items={options}
          onSelect={handleSelect}
          isFocused={isFocused}
        />
      </Box>

      {/* 提示信息 */}
      <Box marginTop={1} width={childWidth}>
        <Text color={Colors.Gray} dimColor>
          提示: 使用 ↑↓ 键选择，Enter 确认，Esc 取消
        </Text>
      </Box>
    </Box>
  );
};