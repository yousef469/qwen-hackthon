import { useState, useCallback, useRef, useEffect } from 'react';

interface Props {
  onSend: (text: string) => void;
  onVoiceToggle: () => void;
  isRecording: boolean;
  disabled: boolean;
  isSpeaking: boolean;
  isInterviewMode?: boolean;
  onConfirm?: () => void;
  onEndConversation?: () => void;
  onFileUpload?: (file: File) => void;
  isUploading?: boolean;
  onExportPdf?: () => void;
  hasMessages?: boolean;
  initialText?: string;
}

export default function InputBar({ onSend, onVoiceToggle, isRecording, disabled, isSpeaking, isInterviewMode, onConfirm, onEndConversation, onFileUpload, isUploading, onExportPdf, hasMessages, initialText }: Props) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  const handleSend = useCallback(() => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  }, [text, disabled, onSend]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload?.(file);
    e.target.value = '';
  }, [onFileUpload]);

  return (
    <div className="border-t border-slate-200 px-6 py-3.5 bg-white">
      <div className="max-w-4xl mx-auto flex items-center gap-2.5">

        {/* Mic button */}
        <button
          onClick={onVoiceToggle}
          disabled={disabled && !isInterviewMode}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-200 shrink-0 active:scale-95 ${
            isRecording
              ? 'bg-pink-500 text-white shadow-lg shadow-pink-200 animate-pulse'
              : isInterviewMode
                ? 'bg-rose-50 text-rose-500 border border-rose-300 hover:bg-rose-100 hover:scale-105'
                : 'bg-slate-100 text-slate-400 hover:bg-pink-50 hover:text-pink-500 hover:scale-105 border border-slate-200'
          }`}
          title={isRecording ? 'Stop conversation' : 'Start voice conversation'}
        >
          🎤
        </button>

        {/* File upload button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || isRecording}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-200 shrink-0 active:scale-95 ${
            isUploading
              ? 'bg-pink-500 text-white animate-pulse'
              : 'bg-slate-100 text-slate-400 hover:bg-pink-50 hover:text-pink-500 hover:scale-105 border border-slate-200'
          }`}
          title="Upload file (PDF, image, text)"
        >
          📎
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.py,.js,.ts,.html,.css,.json,.csv,.xml" onChange={handleFileChange} className="hidden" />

        {/* Confirm button (during Omni conversation) */}
        {onConfirm && (
          <button
            onClick={onConfirm}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all shrink-0"
            title="Confirm and get keypoints"
          >
            ✓
          </button>
        )}

        {/* End button (during Omni conversation) */}
        {onEndConversation && (
          <button
            onClick={onEndConversation}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs bg-red-400 text-white hover:bg-red-500 transition-all shrink-0"
            title="End conversation"
          >
            ✕
          </button>
        )}

        {/* Text input */}
        <div className="flex-1 relative">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isRecording ? 'Voice conversation active — just speak naturally' : isInterviewMode ? 'Type your answer...' : isUploading ? 'Uploading file...' : 'Type your message...'}
            disabled={disabled || !!isRecording || !!isUploading}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 focus:bg-white transition-all duration-200 disabled:opacity-50"
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm disabled:shadow-none shrink-0 active:scale-95"
        >
          Send
        </button>

        {/* PDF download */}
        {hasMessages && onExportPdf && (
          <button
            onClick={onExportPdf}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-slate-100 text-slate-400 hover:bg-pink-50 hover:text-pink-500 border border-slate-200 transition-all shrink-0"
            title="Download chat as PDF"
          >
            📥
          </button>
        )}

        {/* Speaking indicator */}
        {isSpeaking && (
          <span className="text-[10px] text-emerald-500 font-medium animate-pulse shrink-0">
            Speaking...
          </span>
        )}
      </div>
    </div>
  );
}