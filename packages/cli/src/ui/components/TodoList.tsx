/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTodo } from '../contexts/TodoContext.js';
import { TodoStatus } from '../types/todo.js';
import { themeManager } from '../themes/theme-manager.js';
import { Colors } from '../colors.js';

/**
 * TODO任务项组件
 */
interface TodoItemProps {
  id: number;
  content: string;
  status: TodoStatus;
}

const TodoItem: React.FC<TodoItemProps> = ({ id, content, status }) => {
  const isCompleted = status === TodoStatus.COMPLETED;
  
  // 状态图标
  const statusIcon = isCompleted ? '●' : '○';
  const statusColor = isCompleted ? Colors.AccentGreen : Colors.Gray;
  
  // 任务内容样式
  const contentStyle = isCompleted 
    ? { 
        color: Colors.Gray,
        strikethrough: true 
      }
    : { 
        color: Colors.Foreground 
      };

  return (
    <Box flexDirection="row" marginBottom={0}>
      <Box width={4}>
        <Text color={Colors.Gray}>{id}.</Text>
      </Box>
      <Box width={2}>
        <Text color={statusColor}>{statusIcon}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text {...contentStyle}>{content}</Text>
      </Box>
    </Box>
  );
};

/**
 * TODO列表组件属性
 */
interface TodoListProps {
  terminalWidth: number;
  maxHeight?: number;
}

/**
 * TODO任务清单UI组件
 */
export const TodoList: React.FC<TodoListProps> = ({ 
  terminalWidth, 
  maxHeight = 10 
}) => {
  const { state, getTodoList } = useTodo();
  
  // 强制显示调试信息
  console.log('TodoList render debug:', {
    isVisible: state.isVisible,
    tasksLength: state.tasks.length,
    tasks: state.tasks,
    terminalWidth,
    maxHeight
  });
  
  // 始终显示TODO列表，即使没有任务时也显示
  console.log('TODO List IS rendering - always visible');
  
  const tasks = getTodoList();
  const borderColor = Colors.AccentCyan;
  const titleColor = Colors.Foreground;
  
  // 计算可用宽度（减去边框和padding）
  const contentWidth = Math.max(terminalWidth - 4, 40);
  
  // 限制显示的任务数量
  const visibleTasks = tasks.slice(0, maxHeight - 3); // 减去标题和边框行数
  const hasMore = tasks.length > visibleTasks.length;
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      marginBottom={1}
      width={contentWidth}
    >
      {/* 标题栏 */}
      <Box marginBottom={0}>
        <Text color={titleColor} bold>
          📝 TODO任务清单 ({tasks.length})
        </Text>
      </Box>
      
      {/* 任务列表 */}
      <Box flexDirection="column">
        {tasks.length === 0 ? (
          <Box marginY={0}>
            <Text color={Colors.Gray} italic>
              暂无任务 - 使用 /todo 命令或等待AI创建任务
            </Text>
          </Box>
        ) : (
          <>
            {visibleTasks.map((task) => (
              <TodoItem
                key={task.id}
                id={task.id}
                content={task.content}
                status={task.status}
              />
            ))}
            
            {/* 显示更多提示 */}
            {hasMore && (
              <Box marginTop={0}>
                <Text color={Colors.Gray} italic>
                  ... 还有 {tasks.length - visibleTasks.length} 个任务
                </Text>
              </Box>
            )}
          </>
        )}
      </Box>
      
      {/* 统计信息 */}
      <Box marginTop={0} borderTop>
        <Text color={Colors.Gray} dimColor>
          已完成: {tasks.filter(t => t.status === TodoStatus.COMPLETED).length} / {tasks.length}
        </Text>
      </Box>
    </Box>
  );
};