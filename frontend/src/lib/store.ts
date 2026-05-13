import { create } from 'zustand';

// Re-export flow types from the central type definitions
export type { BlockData, FlowNode, FlowEdge } from '@/types/api';

// ---- Execution Store ----

/** Lightweight step result for local execution tracking (subset of API StepResult). */
export interface StepResult {
  id: string;
  stepOrder: number;
  blockId: string;
  blockType: string;
  description?: string;
  target?: string;
  expectedResult?: string;
  actualResult?: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  screenshotDataUrl?: string;
  errorMessage?: string;
  durationMs?: number;
}

interface ExecutionState {
  status: 'idle' | 'connecting' | 'running' | 'completed' | 'error';
  currentBlockId: string | null;
  stepResults: StepResult[];
  extensionConnected: boolean;
  testRunId: string | null;

  setStatus: (status: ExecutionState['status']) => void;
  setCurrentBlock: (blockId: string | null) => void;
  addStepResult: (result: StepResult) => void;
  setExtensionConnected: (connected: boolean) => void;
  setTestRunId: (id: string | null) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  status: 'idle',
  currentBlockId: null,
  stepResults: [],
  extensionConnected: false,
  testRunId: null,

  setStatus: (status) => set({ status }),
  setCurrentBlock: (blockId) => set({ currentBlockId: blockId }),
  addStepResult: (result) => set((state) => ({ stepResults: [...state.stepResults, result] })),
  setExtensionConnected: (connected) => set({ extensionConnected: connected }),
  setTestRunId: (id) => set({ testRunId: id }),
  reset: () => set({
    status: 'idle',
    currentBlockId: null,
    stepResults: [],
    testRunId: null,
  }),
}));
