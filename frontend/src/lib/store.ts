import { create } from 'zustand';

// ---- Flow Editor Store ----

export interface BlockData {
  label: string;
  blockType: string;
  description?: string;
  baseUrl?: string;
  url?: string;
  selector?: string;
  clickType?: string;
  value?: string;
  clearFirst?: boolean;
  selectValue?: string;
  scrollDirection?: string;
  scrollDistance?: number;
  waitType?: string;
  timeout?: number;
  assertionType?: string;
  expectedValue?: string;
  conditionType?: string;
  conditionSelector?: string;
  conditionValue?: string;
  screenshotLabel?: string;
  passingCriteria?: string;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: BlockData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

// ---- Execution Store ----

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
