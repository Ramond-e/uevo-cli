/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { TodoList, TodoStatus } from '../types/todo.js';

interface TodoListDisplayProps {
  todoList: TodoList | null;
}

export const TodoListDisplay: React.FC<TodoListDisplayProps> = ({ todoList }) => {
  if (!todoList || todoList.items.length === 0) {
    return null;
  }

  return (
    <Box 
      flexDirection="column"
      marginBottom={1}
      paddingX={2}
      paddingY={1}
      borderStyle="round"
      borderColor="cyan"
    >
      {/* 标题 */}
      <Box marginBottom={1}>
        <Gradient colors={['#00FFFF', '#00FF00']}>
          <Text bold>📋 任务清单</Text>
        </Gradient>
      </Box>
      
      {/* TODO列表 */}
      <Box flexDirection="column">
        {todoList.items.map((item, index) => {
          const isCompleted = item.status === TodoStatus.COMPLETED;
          const isInProgress = item.status === TodoStatus.IN_PROGRESS;
          
          return (
            <Box key={item.id} marginBottom={index < todoList.items.length - 1 ? 1 : 0}>
              <Box width={3}>
                <Text color="cyan">{String(item.id).padStart(2, '0')}.</Text>
              </Box>
              
              <Box width={3}>
                {isCompleted ? (
                  <Text color="green">●</Text>  // 实心圆圈
                ) : isInProgress ? (
                  <Text color="yellow">◐</Text> // 半圆表示进行中
                ) : (
                  <Text color="gray">○</Text>   // 空心圆圈
                )}
              </Box>
              
              <Box flexGrow={1}>
                <Text 
                  color={isCompleted ? 'green' : isInProgress ? 'yellow' : 'white'}
                  strikethrough={isCompleted}
                >
                  {item.description}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
      
      {/* 进度统计 */}
      <Box marginTop={1} borderTop borderColor="gray">
        <Box marginTop={1}>
          <Text color="gray">
            进度: {todoList.items.filter(item => item.status === TodoStatus.COMPLETED).length}/{todoList.items.length}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}; 