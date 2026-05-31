import { useState, useCallback, useRef } from 'react';
import type { StreamEvent } from '../types';

const SESSION_ID = 'interview_' + Math.random().toString(36).substring(2, 10);

export interface InterviewState {
  isActive: boolean;
  topic: string;
  round: number;
  maxRounds: number;
  currentQuestion: string;
  keypointCards: { number: number; keypoints: string[] }[];
  designDoc: string | null;
  isComplete: boolean;
}

function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      fetch('/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 600) }),
      })
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play().catch(resolve);
        })
        .catch(resolve);
    } catch { resolve(); }
  });
}

export function useDesignInterview() {
  const [state, setState] = useState<InterviewState>({
    isActive: false,
    topic: '',
    round: 0,
    maxRounds: 5,
    currentQuestion: '',
    keypointCards: [],
    designDoc: null,
    isComplete: false,
  });
  const isSpeakingRef = useRef(false);
  const isLoadingRef = useRef(false);

  const startInterview = useCallback(async (topic: string) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    setState({
      isActive: true,
      topic,
      round: 0,
      maxRounds: 5,
      currentQuestion: '',
      keypointCards: [],
      designDoc: null,
      isComplete: false,
    });

    try {
      const res = await fetch('/design-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, message: topic }),
      });
      if (!res.body) throw new Error('No body');

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
            if (ev.type === 'question' && ev.text) {
              setState(prev => ({
                ...prev,
                currentQuestion: ev.text || '',
                round: ev.number || prev.round,
                maxRounds: ev.total || 5,
              }));
              isSpeakingRef.current = true;
              await speakText(ev.text);
              isSpeakingRef.current = false;
            }
          } catch { /* */ }
        }
      }
    } catch { /* */ }

    isLoadingRef.current = false;
  }, []);

  const sendAnswer = useCallback(async (answer: string) => {
    if (isLoadingRef.current || !answer.trim()) return;
    isLoadingRef.current = true;

    try {
      const res = await fetch('/design-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, message: answer }),
      });
      if (!res.body) throw new Error('No body');

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
            switch (ev.type) {
              case 'keypoint':
                if (ev.keypoints && Array.isArray(ev.keypoints)) {
                  setState(prev => ({
                    ...prev,
                    keypointCards: [...prev.keypointCards, { number: ev.number || prev.keypointCards.length + 1, keypoints: ev.keypoints as string[] }],
                  }));
                }
                break;

              case 'question':
                if (ev.text) {
                  setState(prev => ({
                    ...prev,
                    currentQuestion: ev.text || '',
                    round: ev.number || prev.round,
                  }));
                  isSpeakingRef.current = true;
                  await speakText(ev.text);
                  isSpeakingRef.current = false;
                }
                break;

              case 'mode_switch':
                break;

              case 'design_doc':
                if (ev.text) {
                  setState(prev => ({
                    ...prev,
                    designDoc: ev.text || null,
                    isComplete: true,
                    isActive: false,
                  }));
                  isSpeakingRef.current = true;
                  await speakText('The design document is ready. Switching to text mode.');
                  isSpeakingRef.current = false;
                }
                break;
            }
          } catch { /* */ }
        }
      }
    } catch { /* */ }

    isLoadingRef.current = false;
  }, []);

  const reset = useCallback(() => {
    setState({
      isActive: false,
      topic: '',
      round: 0,
      maxRounds: 5,
      currentQuestion: '',
      keypointCards: [],
      designDoc: null,
      isComplete: false,
    });
  }, []);

  return { ...state, startInterview, sendAnswer, reset, isLoading: isLoadingRef.current, isSpeaking: isSpeakingRef.current, sessionId: SESSION_ID };
}
