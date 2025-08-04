/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, ReactNode, useState } from 'react';
import { CustomToolAddDetails } from '../types/customTool.js';
import { CustomToolConfirmationOutcome } from '../components/messages/CustomToolAddConfirmationMessage.js';

interface CustomToolContextType {
  pendingToolAdd: CustomToolAddDetails | null;
  showConfirmation: boolean;
  setPendingToolAdd: (tool: CustomToolAddDetails | null) => void;
  setShowConfirmation: (show: boolean) => void;
  handleConfirmation: (outcome: CustomToolConfirmationOutcome) => void;
}

const CustomToolContext = createContext<CustomToolContextType | undefined>(undefined);

interface CustomToolProviderProps {
  children: ReactNode;
}

export function CustomToolProvider({ children }: CustomToolProviderProps) {
  const [pendingToolAdd, setPendingToolAdd] = useState<CustomToolAddDetails | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleConfirmation = (outcome: CustomToolConfirmationOutcome) => {
    // This will be handled by the useCustomToolIntegration hook
    console.log('CustomToolContext: Confirmation handled:', outcome);
    setShowConfirmation(false);
    setPendingToolAdd(null);
  };

  const contextValue: CustomToolContextType = {
    pendingToolAdd,
    showConfirmation,
    setPendingToolAdd,
    setShowConfirmation,
    handleConfirmation,
  };

  return (
    <CustomToolContext.Provider value={contextValue}>
      {children}
    </CustomToolContext.Provider>
  );
}

export function useCustomTool(): CustomToolContextType {
  const context = useContext(CustomToolContext);
  if (context === undefined) {
    throw new Error('useCustomTool must be used within a CustomToolProvider');
  }
  return context;
}