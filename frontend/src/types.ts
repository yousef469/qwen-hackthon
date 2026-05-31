export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
  limit: number;
}

export interface StreamEvent {
  type: 'token' | 'reasoning' | 'tool_call' | 'tool_result' | 'tools_start' | 'tools_end' | 'done' | 'usage' | 'workflow_start' | 'workflow_step' | 'approval_request' | 'workflow_complete' | 'workflow_idle' | 'question' | 'keypoint' | 'transcript' | 'mode_switch' | 'design_doc';
  content?: string;
  name?: string;
  args?: string;
  result?: unknown;
  step?: string;
  label?: string;
  icon?: string;
  step_number?: number;
  total_steps?: number;
  workflow_id?: string;
  workflow_type?: string;
  reason?: string;
  data?: unknown;
  text?: string;
  number?: number;
  total?: number;
  reasoning?: string;
  keypoints?: string[];
  mode?: string;
  topic?: string;
  usage?: TokenUsage;
}

export interface ImageResult {
  image_b64?: string;
  mime?: string;
  svg?: string;
  prompt: string;
}

export interface FileData {
  type: string;
  filename: string;
  text?: string;
  description?: string;
  b64?: string;
  mime?: string;
  videoUrl?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  tools?: string;
  msgType?: 'text' | 'image' | 'file' | 'video';
  imageData?: ImageResult;
  fileData?: FileData;
  isGenerating?: boolean;
}

export interface WorkflowStep {
  name: string;
  label: string;
  icon: string;
  status: 'pending' | 'in_progress' | 'completed' | 'awaiting_approval' | 'rejected' | 'auto' | 'error';
  result?: string;
}

export interface WorkflowState {
  workflow_id: string;
  workflow_type: string;
  isActive: boolean;
  isAwaitingApproval: boolean;
  steps: WorkflowStep[];
  currentStepIndex: number;
  totalSteps: number;
  approvalReason?: string;
}
