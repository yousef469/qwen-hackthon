import { useState, useCallback, useRef } from 'react';

export interface StructuredQuestion {
  number: number;
  text: string;
  options: string[];
}

export interface KeypointCard {
  color: string;
  title: string;
  points: string[];
}

export interface StructuredInterviewState {
  isActive: boolean;
  topic: string;
  currentQuestion: StructuredQuestion | null;
  totalQuestions: number;
  answers: string[];
  reasoning: string;
  keypointCards: KeypointCard[];
  followUp: string;
  isComplete: boolean;
  isGenerating: boolean;
  error: string | null;
}

export function useStructuredInterview() {
  const [state, setState] = useState<StructuredInterviewState>({
    isActive: false,
    topic: '',
    currentQuestion: null,
    totalQuestions: 5,
    answers: [],
    reasoning: '',
    keypointCards: [],
    followUp: '',
    isComplete: false,
    isGenerating: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef('');

  const startInterview = useCallback((topic: string) => {
    if (!topic.trim()) return;
    setState({
      isActive: true, topic, currentQuestion: null, totalQuestions: 5,
      answers: [], reasoning: '', keypointCards: [], followUp: '',
      isComplete: false, isGenerating: true, error: null,
    });

    const sid = 'si_' + Math.random().toString(36).substring(2, 10);
    sessionIdRef.current = sid;
    const abort = new AbortController();
    abortRef.current = abort;

    fetch('/structured-interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, message: topic }),
      signal: abort.signal,
    }).then(async res => {
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
            const ev = JSON.parse(raw);
            switch (ev.type) {
              case 'reasoning':
                setState(prev => ({ ...prev, reasoning: prev.reasoning + (ev.content || '') }));
                break;
              case 'question':
                setState(prev => ({
                  ...prev,
                  currentQuestion: { number: ev.number, text: ev.text, options: ev.options || [] },
                  totalQuestions: ev.total || 5,
                  isGenerating: false,
                }));
                break;
              case 'done':
                setState(prev => ({
                  ...prev,
                  keypointCards: ev.keypoints || [],
                  followUp: ev.follow_up || '',
                  isComplete: true,
                  isGenerating: false,
                  isActive: false,
                }));
                break;
            }
          } catch { /* */ }
        }
      }
    }).catch(() => {
      setState(prev => ({ ...prev, error: 'Connection failed', isGenerating: false }));
    });
  }, []);

  const sendAnswer = useCallback((answer: string) => {
    if (!answer.trim() || !sessionIdRef.current) return;
    setState(prev => ({
      ...prev,
      answers: [...prev.answers, answer],
      currentQuestion: null,
      isGenerating: true,
    }));

    fetch('/structured-interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionIdRef.current, message: answer }),
    }).then(async res => {
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
            const ev = JSON.parse(raw);
            switch (ev.type) {
              case 'reasoning':
                setState(prev => ({ ...prev, reasoning: prev.reasoning + (ev.content || '') }));
                break;
              case 'question':
                setState(prev => ({
                  ...prev,
                  currentQuestion: { number: ev.number, text: ev.text, options: ev.options || [] },
                  isGenerating: false,
                }));
                break;
              case 'done':
                setState(prev => ({
                  ...prev,
                  keypointCards: ev.keypoints || [],
                  followUp: ev.follow_up || '',
                  isComplete: true,
                  isGenerating: false,
                  isActive: false,
                }));
                break;
            }
          } catch { /* */ }
        }
      }
    }).catch(() => {
      setState(prev => ({ ...prev, error: 'Connection failed', isGenerating: false }));
    });
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState({
      isActive: false, topic: '', currentQuestion: null, totalQuestions: 5,
      answers: [], reasoning: '', keypointCards: [], followUp: '',
      isComplete: false, isGenerating: false, error: null,
    });
  }, []);

  return { ...state, startInterview, sendAnswer, reset };
}
