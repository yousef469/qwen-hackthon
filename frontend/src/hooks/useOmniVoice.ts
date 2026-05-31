import { useState, useRef, useCallback, useEffect } from 'react';

export interface OmniVoiceState {
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  userTranscript: string;
  assistantTranscript: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  keypointCards: { color: string; title: string; points: string[] }[];
  followUp: string;
  conversationText: string;
  isComplete: boolean;
  error: string | null;
}

export function useOmniVoice() {
  const [state, setState] = useState<OmniVoiceState>({
    isConnected: false,
    isSpeaking: false,
    isListening: false,
    userTranscript: '',
    assistantTranscript: '',
    messages: [],
    keypointCards: [],
    followUp: '',
    conversationText: '',
    isComplete: false,
    error: null,
  });
  const assistantBufRef = useRef('');

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const gainRef = useRef<GainNode | null>(null);

  const playNextChunk = useCallback(async (audioCtx: AudioContext) => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const buffer = playbackQueueRef.current.shift()!;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainRef.current || audioCtx.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      setState(prev => ({ ...prev, isSpeaking: playbackQueueRef.current.length > 0 }));
      playNextChunk(audioCtx);
    };
    source.start();
  }, []);

  const addAudioChunk = useCallback((base64Pcm: string) => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) return;
    try {
      const pcmStr = atob(base64Pcm);
      const pcmBytes = new Uint8Array(pcmStr.length);
      for (let i = 0; i < pcmStr.length; i++) pcmBytes[i] = pcmStr.charCodeAt(i);
      const samples = new Int16Array(pcmBytes.buffer);
      const floatSamples = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) floatSamples[i] = samples[i] / 32768;
      const buffer = audioCtx.createBuffer(1, floatSamples.length, 24000);
      buffer.getChannelData(0).set(floatSamples);
      playbackQueueRef.current.push(buffer);
      setState(prev => ({ ...prev, isSpeaking: true }));
      if (!isPlayingRef.current) playNextChunk(audioCtx);
    } catch { /* */ }
  }, [playNextChunk]);

  const stopPlayback = useCallback(() => {
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const startConversation = useCallback(async () => {
    if (wsRef.current) return;

    assistantBufRef.current = '';
    setState({
      isConnected: false, isSpeaking: false, isListening: false,
      userTranscript: '', assistantTranscript: '',
      messages: [], keypointCards: [], followUp: '', conversationText: '',
      isComplete: false, error: null,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;
      const gain = audioCtx.createGain();
      gain.gain.value = 1;
      gain.connect(audioCtx.destination);
      gainRef.current = gain;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioCtx.destination);

      const ws = new WebSocket(`ws://${window.location.host}/ws/omni`);
      wsRef.current = ws;

      ws.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true, isListening: true }));
      };

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
        }
        const bytes = new Uint8Array(pcm.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        ws.send(JSON.stringify({
          type: 'audio',
          data: btoa(binary),
          sample_rate: audioCtx.sampleRate,
        }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          switch (msg.type) {
            case 'audio':
              addAudioChunk(msg.data);
              break;
            case 'transcript':
              assistantBufRef.current += msg.data;
              setState(prev => ({
                ...prev,
                assistantTranscript: prev.assistantTranscript + msg.data,
              }));
              break;
            case 'response_done':
              if (assistantBufRef.current.trim()) {
                setState(prev => ({
                  ...prev,
                  messages: [...prev.messages, { role: 'assistant' as const, content: assistantBufRef.current }],
                }));
                assistantBufRef.current = '';
              }
              break;
            case 'user_transcript':
              if (msg.data.trim()) {
                setState(prev => ({
                  ...prev,
                  userTranscript: prev.userTranscript + msg.data,
                  messages: [...prev.messages, { role: 'user', content: msg.data }],
                }));
              }
              break;
            case 'done':
              stopPlayback();
              if (assistantBufRef.current.trim()) {
                setState(prev => ({
                  ...prev,
                  messages: [...prev.messages, { role: 'assistant' as const, content: assistantBufRef.current }],
                }));
                assistantBufRef.current = '';
              }
              setState(prev => ({
                ...prev,
                keypointCards: msg.keypoints || [],
                followUp: msg.follow_up || 'Would you like to add anything or make changes?',
                conversationText: msg.conversation || '',
                isComplete: true,
                isConnected: false,
                isListening: false,
              }));
              break;
            case 'error':
              setState(prev => ({ ...prev, error: msg.message }));
              break;
          }
        } catch { /* */ }
      };

      ws.onclose = () => {
        setState(prev => ({ ...prev, isConnected: false, isListening: false }));
      };

      ws.onerror = () => {
        setState(prev => ({ ...prev, error: 'WebSocket connection failed' }));
      };
    } catch (e) {
      setState(prev => ({ ...prev, error: String(e) }));
    }
  }, [addAudioChunk, stopPlayback]);

  const confirmConversation = useCallback(() => {
    // Stop mic capture
    if (processorRef.current && sourceRef.current) {
      sourceRef.current.disconnect(processorRef.current);
      processorRef.current.disconnect();
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    stopPlayback();

    // Send confirm
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'confirm' }));
    }
    setState(prev => ({ ...prev, isListening: false, isSpeaking: false }));
  }, [stopPlayback]);

  const endConversation = useCallback(() => {
    if (processorRef.current && sourceRef.current) {
      sourceRef.current.disconnect(processorRef.current);
      processorRef.current.disconnect();
    }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    stopPlayback();
    setState(prev => ({
      ...prev,
      isConnected: false,
      isListening: false,
      isSpeaking: false,
    }));
  }, [stopPlayback]);

  useEffect(() => {
    return () => {
      if (processorRef.current && sourceRef.current) {
        sourceRef.current.disconnect(processorRef.current);
        processorRef.current.disconnect();
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return {
    ...state,
    startConversation,
    confirmConversation,
    endConversation,
  };
}
