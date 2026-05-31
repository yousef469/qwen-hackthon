import { useState, useCallback, useRef } from 'react';
import type { Message, StreamEvent, WorkflowState, WorkflowStep } from '../types';

let SESSION_ID = 'session_' + Math.random().toString(36).substring(2, 10);
let abortController: AbortController | null = null;

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
  limit: number;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeAgent, setActiveAgent] = useState('orchestrator');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [keypoints, setKeypoints] = useState<string[]>([]);
  const [liveThinking, setLiveThinking] = useState('');
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ prompt: 0, completion: 0, total: 0, limit: 32768 });
  const streamAbortedRef = useRef(false);

  const resetSession = useCallback(() => {
    SESSION_ID = 'session_' + Math.random().toString(36).substring(2, 10);
    setMessages([]);
    setWorkflow(null);
    setKeypoints([]);
    setLiveThinking('');
    setTokenUsage({ prompt: 0, completion: 0, total: 0, limit: 32768 });
    setActiveAgent('orchestrator');
    setIsLoading(false);
    setIsStreaming(false);
    fetch(`/api/reset-session/${SESSION_ID}`, { method: 'POST' }).catch(() => {});
  }, []);

  const sessionId = SESSION_ID;

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // If currently streaming, abort and prepare for new message
    if (isLoading || isStreaming) {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      streamAbortedRef.current = true;
      setIsLoading(false);
      setIsStreaming(false);
      setLiveThinking('');
    }

    const userMsg: Message = { id: 'u-' + Date.now(), role: 'user', content: text.trim() };
    const streamId = 's-' + Date.now();
    const streamMsg: Message = { id: streamId, role: 'assistant', content: '', thinking: '' };

    setMessages(prev => [...prev, userMsg, streamMsg]);
    setWorkflow(null);
    setIsLoading(true);
    setIsStreaming(true);
    setLiveThinking('');
    streamAbortedRef.current = false;

    let replyText = '';
    let thinkText = '';
    let usedTools = '';
    let pendingImage: { image_b64: string; mime: string; prompt: string } | null = null;
    let pendingVideo: { task_id: string; status: string } | null = null;
    let generatingImageMsgId: string | null = null;

    abortController = new AbortController();

    try {
      const res = await fetch('/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, message: text.trim() }),
        signal: abortController.signal,
      });
      if (!res.body) throw new Error('No body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      let workflowSteps: WorkflowStep[] = [];

      while (!streamAbortedRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        if (streamAbortedRef.current) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const ev: StreamEvent = JSON.parse(raw);
            switch (ev.type) {
              case 'token':
                replyText += ev.content || '';
                setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: replyText, thinking: thinkText || undefined, tools: usedTools || undefined } : m));
                break;
              case 'reasoning':
                thinkText += ev.content || '';
                setLiveThinking(thinkText);
                setMessages(prev => prev.map(m => m.id === streamId ? { ...m, thinking: thinkText, content: replyText, tools: usedTools || undefined } : m));
                break;
              case 'usage':
                if (ev.usage) {
                  setTokenUsage(ev.usage as TokenUsage);
                }
                break;
              case 'tool_call':
                setActiveAgent(ev.name || 'tool');
                usedTools = usedTools ? usedTools + ', ' + ev.name : '🔧 ' + ev.name;
                // Show generating animation for image/video tools immediately
                if (ev.name === 'generate_image') {
                  const imgId = 'gen-' + Date.now();
                  generatingImageMsgId = imgId;
                  setMessages(prev => [...prev, { id: imgId, role: 'assistant', content: '', msgType: 'image', isGenerating: true, imageData: { svg: '', prompt: ev.args || '' } }]);
                }
                if (ev.name === 'generate_video') {
                  const vidId = 'gen-vid-' + Date.now();
                  setMessages(prev => [...prev, { id: vidId, role: 'assistant', content: '🎬 Generating video...', msgType: 'video', fileData: { type: 'video', filename: 'generating...' } }]);
                }
                break;
              case 'tool_result':
                setActiveAgent('orchestrator');
                if (ev.name === 'generate_image') {
                  const result = (ev.result as any)?.result;
                  if (result?.image_b64) {
                    pendingImage = {
                      image_b64: result.image_b64,
                      mime: result.mime || 'image/png',
                      prompt: result.prompt || '',
                    };
                    if (generatingImageMsgId) {
                      setMessages(prev => prev.map(m => m.id === generatingImageMsgId ? { ...m, isGenerating: false, imageData: { svg: '', ...pendingImage! } } : m));
                      generatingImageMsgId = null;
                    }
                  } else if (generatingImageMsgId) {
                    setMessages(prev => prev.map(m => m.id === generatingImageMsgId ? { ...m, content: '❌ Image generation failed', msgType: undefined, imageData: undefined } : m));
                    generatingImageMsgId = null;
                  }
                }
                if (ev.name === 'generate_video' && (ev.result as any)?.result?.task_id) {
                  pendingVideo = {
                    task_id: (ev.result as any).result.task_id,
                    status: (ev.result as any).result.status || 'PENDING',
                  };
                }
                break;
              case 'workflow_start':
                if (ev.workflow_type) {
                  setActiveAgent('workflow');
                }
                break;
              case 'workflow_step':
                if (ev.step && ev.label && ev.icon && ev.step_number !== undefined && ev.total_steps) {
                  const idx = ev.step_number as number;
                  if (workflowSteps.length === 0) {
                    workflowSteps = Array.from({ length: ev.total_steps as number }, () => {
                      return { name: '', label: '...', icon: '📌', status: 'pending' as const };
                    });
                  }
                  const stepResult = ev.result as { output?: string; status?: string } | undefined;
                  workflowSteps[idx] = {
                    name: ev.step,
                    label: ev.label,
                    icon: ev.icon,
                    status: 'completed',
                    result: stepResult?.output?.slice(0, 200),
                  };
                  setWorkflow(prev => prev ? { ...prev, steps: [...workflowSteps], currentStepIndex: idx } : null);
                }
                break;
              case 'approval_request':
                if (workflowSteps.length > 0) {
                  setWorkflow(prev => prev ? {
                    ...prev,
                    isAwaitingApproval: true,
                    approvalReason: ev.reason,
                  } : null);
                }
                break;
              case 'workflow_complete':
                setActiveAgent('orchestrator');
                setWorkflow(prev => prev ? { ...prev, isActive: false, isAwaitingApproval: false } : null);
                break;
            }
          } catch { /* skip */ }
        }
      }

      if (streamAbortedRef.current) {
        setIsStreaming(false);
        setIsLoading(false);
        setLiveThinking('');
        return;
      }

      setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: replyText, thinking: thinkText || undefined, tools: usedTools || undefined } : m));
      setIsStreaming(false);
      setIsLoading(false);
      setLiveThinking('');

      if (pendingVideo) {
        const vidId = 'vid-' + Date.now();
        const videoMsg: Message = { id: vidId, role: 'assistant', content: '🎬 Generating video...', msgType: 'video', fileData: { type: 'video', filename: pendingVideo.task_id } };
        setMessages(prev => [...prev, videoMsg]);
        const poll = async () => {
          for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise(r => setTimeout(r, 10000));
            try {
              if (!pendingVideo) return;
              const res = await fetch(`/api/video-status/${pendingVideo.task_id}`);
              const data = await res.json();
              if (data.status === 'SUCCEEDED' && data.video_url) {
                setMessages(prev => prev.map(m => m.id === vidId ? { ...m, content: `🎬 Your video is ready!`, fileData: { ...m.fileData!, videoUrl: data.video_url } } : m));
                return;
              } else if (data.status === 'FAILED') {
                setMessages(prev => prev.map(m => m.id === vidId ? { ...m, content: '❌ Video generation failed.' } : m));
                return;
              }
            } catch { /* retry */ }
          }
          setMessages(prev => prev.map(m => m.id === vidId ? { ...m, content: '⏱ Video generation timed out.' } : m));
        };
        poll();
      }

      if (workflowSteps.length > 0) {
        setWorkflow({
          workflow_id: SESSION_ID,
          workflow_type: '',
          isActive: true,
          isAwaitingApproval: false,
          steps: workflowSteps,
          currentStepIndex: 0,
          totalSteps: workflowSteps.length,
        });
      }

      if (replyText.length > 20) {
        try {
          const kp = await fetch('/extract-keypoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: SESSION_ID, message: replyText }),
          });
          const kd = await kp.json();
          if (kd.keypoints) setKeypoints(kd.keypoints);
        } catch { /* */ }
      }

    } catch {
      setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: '[Connection error]' } : m));
      setIsStreaming(false);
      setIsLoading(false);
      setLiveThinking('');
    }
  }, [isLoading]);

  const approveWorkflow = useCallback(async () => {
    if (!workflow?.isAwaitingApproval) return;
    try {
      await fetch(`/workflow/${SESSION_ID}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      setWorkflow(prev => prev ? { ...prev, isAwaitingApproval: false } : null);
      const res = await fetch(`/workflow/${SESSION_ID}/stream`);
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const ev: StreamEvent = JSON.parse(raw);
            if (ev.type === 'workflow_step' && ev.step_number !== undefined) {
              const stepIdx = ev.step_number as number;
              setWorkflow(prev => {
                if (!prev) return null;
                const steps = [...prev.steps];
                if (stepIdx < steps.length) {
                  const stepResult = ev.result as { output?: string; status?: string } | undefined;
                  steps[stepIdx] = {
                    ...steps[stepIdx],
                    status: 'completed' as const,
                    result: stepResult?.output?.slice(0, 200),
                  };
                }
                return { ...prev, steps, currentStepIndex: stepIdx };
              });
            }
            if (ev.type === 'approval_request') {
              setWorkflow(prev => prev ? { ...prev, isAwaitingApproval: true } : null);
            }
            if (ev.type === 'workflow_complete') {
              setActiveAgent('orchestrator');
              setWorkflow(prev => prev ? { ...prev, isActive: false, isAwaitingApproval: false } : null);
            }
          } catch { /* */ }
        }
      }
    } catch { /* */ }
  }, [workflow]);

  const rejectWorkflow = useCallback(async (reason?: string) => {
    if (!workflow?.isAwaitingApproval) return;
    try {
      await fetch(`/workflow/${SESSION_ID}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, reason: reason || '' }),
      });
      setWorkflow(prev => prev ? { ...prev, isAwaitingApproval: false, isActive: false } : null);
      setActiveAgent('orchestrator');
    } catch { /* */ }
  }, [workflow]);

  const clearKeypoints = useCallback(() => setKeypoints([]), []);

  return {
    messages, setMessages, activeAgent, isLoading, isStreaming,
    keypoints, liveThinking, workflow, tokenUsage,
    send, setActiveAgent, clearKeypoints, sessionId,
    approveWorkflow, rejectWorkflow, resetSession,
  };
}