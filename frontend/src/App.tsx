import { useEffect, useRef, useState, useCallback } from 'react';
import { useChat } from './hooks/useChat';
import { useOmniVoice } from './hooks/useOmniVoice';
import { useStructuredInterview } from './hooks/useStructuredInterview';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputBar from './components/InputBar';
import QuestionPanel from './components/QuestionPanel';
import VoiceOverlay from './components/VoiceOverlay';
import type { FileData as FileDataType } from './types';
const PLAN_PATTERN = /(?:let's|lets|i want to|plan|build|create|design|make|start|develop|launch)\s+(?:a|an|the|my|our)?\s*(?:\w+\s+)*(?:project|app|website|platform|tool|system|service|product)/i;

export default function App() {
  const chat = useChat();
  const omni = useOmniVoice();
  const si = useStructuredInterview();
  const [showOverlay, setShowOverlay] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [pendingFileData, setPendingFileData] = useState<{ data: string; mime: string; filename: string } | null>(null);
  const interimRef = useRef('');
  const lastQuestionRef = useRef('');

  useEffect(() => {
    setShowOverlay(omni.isListening || omni.isSpeaking);
  }, [omni.isListening, omni.isSpeaking]);

  useEffect(() => {
    if (omni.userTranscript && omni.userTranscript !== interimRef.current) {
      interimRef.current = omni.userTranscript;
    }
  }, [omni.userTranscript]);

  useEffect(() => {
    if (omni.messages.length === 0) return;
    const lastMsg = omni.messages[omni.messages.length - 1];
    chat.setMessages(prev => {
      const msgId = 'omni-' + omni.messages.length + '-' + lastMsg.role;
      if (prev.find(m => m.id === msgId)) return prev;
      return [...prev, { id: msgId, role: lastMsg.role, content: lastMsg.content }];
    });
  }, [omni.messages]);

  useEffect(() => {
    if (omni.isComplete && omni.keypointCards.length > 0) {
      chat.setMessages(prev => {
        if (prev.find(m => m.id === 'omni-followup')) return prev;
        return [...prev, { id: 'omni-followup', role: 'assistant', content: omni.followUp }];
      });
    }
  }, [omni.isComplete]);

  // Add interview question as assistant message
  useEffect(() => {
    if (si.currentQuestion && si.currentQuestion.text !== lastQuestionRef.current) {
      lastQuestionRef.current = si.currentQuestion.text;
      chat.setMessages(prev => {
        const qId = 'si-q-' + si.currentQuestion!.number;
        if (prev.find(m => m.id === qId)) return prev;
        return [...prev, { id: qId, role: 'assistant', content: si.currentQuestion!.text }];
      });
    }
  }, [si.currentQuestion]);

  // Add cards + follow-up when interview completes
  useEffect(() => {
    if (si.isComplete && si.keypointCards.length > 0) {
      chat.setMessages(prev => {
        if (prev.find(m => m.id === 'si-followup')) return prev;
        return [...prev, { id: 'si-followup', role: 'assistant', content: si.followUp }];
      });
    }
  }, [si.isComplete]);

  const handleOmniStart = () => {
    interimRef.current = '';
    omni.startConversation();
  };

  const handleOmniConfirm = () => omni.confirmConversation();
  const handleOmniEnd = () => omni.endConversation();

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setPendingPrompt('');
    setPendingFileData(null);
    const formData = new FormData();
    formData.append('file', file);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data: FileDataType & { error?: string } = await res.json();
      if (data.error) throw new Error(data.error);
      if (isImage && data.b64 && data.mime) {
        setPendingFileData({ data: data.b64, mime: data.mime, filename: file.name });
        setPendingPrompt('What can you tell me about this image?');
      } else if (data.text) {
        const txt = data.text as string;
        setPendingFileData({ data: txt, mime: 'text/plain', filename: file.name });
        setPendingPrompt('What does this document contain?');
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Upload failed';
      setPendingPrompt(`Upload failed: ${errMsg}`);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const clearPendingFile = useCallback(() => {
    setPendingFileData(null);
  }, []);

  const handleExportPdf = useCallback(() => {
    const msgs = chat.messages.map(m => ({ role: m.role, content: m.content }));
    fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs }),
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-export.pdf';
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => {});
  }, [chat.messages]);

  const handleTextSend = useCallback((text: string) => {
    setPendingPrompt('');
    const fd = pendingFileData;
    setPendingFileData(null);
    if (si.isActive) {
      chat.setMessages(prev => [...prev, { id: 'si-ans-' + Date.now(), role: 'user', content: text }]);
      si.sendAnswer(text);
      return;
    }
    if (si.isComplete) {
      si.reset();
      chat.send(text, fd || undefined);
      return;
    }
    if (PLAN_PATTERN.test(text) && !fd) {
      chat.setMessages(prev => [...prev, { id: 'si-start-' + Date.now(), role: 'user', content: text }]);
      si.startInterview(text);
      return;
    }
    chat.send(text, fd || undefined);
  }, [si.isActive, si.isComplete, si.sendAnswer, si.startInterview, si.reset, chat, pendingFileData]);

  const handleSiAnswer = useCallback((answer: string) => {
    chat.setMessages(prev => [...prev, { id: 'si-ans-' + Date.now(), role: 'user', content: answer }]);
    si.sendAnswer(answer);
  }, [si.sendAnswer]);

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="h-14 px-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent tracking-tight">
            Qwen Agent Platform
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline font-medium">
            MemoryAgent
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Token counter */}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            chat.tokenUsage.total > 0
              ? (chat.tokenUsage.total / chat.tokenUsage.limit) > 0.8
                ? 'bg-red-50 text-red-500 border-red-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
              : 'text-slate-300 border-slate-100'
          }`}>
            {chat.tokenUsage.total > 0
              ? `${(chat.tokenUsage.total / 1000).toFixed(0)}k / ${(chat.tokenUsage.limit / 1000).toFixed(0)}k (${Math.round(chat.tokenUsage.total / chat.tokenUsage.limit * 100)}%)`
              : '— / 32k'}
          </span>

          {omni.isConnected && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 animate-pulse">Voice</span>
          )}
          {si.isActive && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-100 text-pink-600">
              Q{si.currentQuestion?.number || 1}/{si.totalQuestions}
            </span>
          )}
          {isUploading && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 animate-pulse">
              ⏫ Uploading
            </span>
          )}

          {/* New Session button */}
          <button
            onClick={chat.resetSession}
            className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all duration-200 border border-slate-200 active:scale-95"
            title="Start a new session"
          >
            ✦ New
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeAgent={chat.activeAgent} sessionId={chat.sessionId} />

        <main className="flex-1 flex flex-col min-w-0 bg-white">
          <ChatArea
            messages={chat.messages}
            isLoading={chat.isLoading}
            isStreaming={chat.isStreaming}
            liveThinking={chat.liveThinking}
            workflow={chat.workflow}
            onApprove={chat.approveWorkflow}
            onReject={chat.rejectWorkflow}
            interview={{
              isActive: omni.isConnected,
              isComplete: omni.isComplete,
              keypointCards: omni.keypointCards.map((c, i) => ({
                number: i + 1, keypoints: c.points,
                color: c.color as 'blue' | 'red' | 'green' | 'yellow' | 'white',
                title: c.title,
              })),
              siCards: si.isComplete ? si.keypointCards.map((c, i) => ({
                number: i + 1, keypoints: c.points,
                color: c.color as 'blue' | 'red' | 'green' | 'yellow' | 'white',
                title: c.title,
              })) : [],
            }}
            onFileDrop={handleFileUpload}
          >
            {/* Question options panel when interview is active */}
            {si.isActive && si.currentQuestion && (
              <div className="px-6 pb-2">
                <QuestionPanel
                  question={si.currentQuestion.text}
                  options={si.currentQuestion.options}
                  number={si.currentQuestion.number}
                  total={si.totalQuestions}
                  onAnswer={handleSiAnswer}
                />
              </div>
            )}

            {/* Generating indicator */}
            {si.isActive && si.isGenerating && !si.currentQuestion && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-pink-50 border border-pink-200 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                  <span className="text-xs text-pink-600 font-medium">Generating questions...</span>
                </div>
              </div>
            )}
          </ChatArea>

          <InputBar
            onSend={handleTextSend}
            onVoiceToggle={handleOmniStart}
            isRecording={omni.isConnected}
            disabled={chat.isLoading || (chat.workflow?.isAwaitingApproval ?? false) || (si.isActive && si.isGenerating) || isUploading}
            isSpeaking={omni.isSpeaking}
            isInterviewMode={omni.isConnected || si.isActive}
            onConfirm={omni.isConnected ? handleOmniConfirm : undefined}
            onEndConversation={omni.isConnected ? handleOmniEnd : undefined}
            onFileUpload={handleFileUpload}
            isUploading={isUploading}
            onExportPdf={handleExportPdf}
            hasMessages={chat.messages.length > 0}
            initialText={pendingPrompt}
            pendingFile={pendingFileData}
            onClearPendingFile={clearPendingFile}
          />
        </main>
      </div>

      {showOverlay && (
        <VoiceOverlay
          isRecording={omni.isListening}
          interimText={omni.userTranscript}
          onStop={handleOmniEnd}
        />
      )}
    </div>
  );
}
