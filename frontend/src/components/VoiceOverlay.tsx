import { useEffect, useState } from 'react';

interface Props {
  isRecording: boolean;
  interimText: string;
  onStop: () => void;
}

export default function VoiceOverlay({ isRecording, interimText, onStop }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (isRecording) setText('');
  }, [isRecording]);

  useEffect(() => {
    if (interimText && !text.includes(interimText)) {
      setText(prev => prev + ' ' + interimText);
    }
  }, [interimText, text]);

  if (!isRecording) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-50">
      <div className="bg-white border border-pink-200 rounded-2xl p-5 shadow-xl shadow-pink-100/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500" />
            </span>
            <span className="text-sm font-medium text-pink-600">Listening...</span>
          </div>
          <button
            onClick={onStop}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>

        <div className="text-sm text-slate-700 min-h-[24px] leading-relaxed">
          {text.trim() || interimText || <span className="text-slate-300 italic">Speak now...</span>}
        </div>

        {interimText && (
          <div className="text-xs text-slate-400 italic mt-1.5">{interimText}</div>
        )}

        <div className="flex gap-1 mt-3">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full bg-pink-100 overflow-hidden"
            >
              <div
                className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full transition-all"
                style={{
                  width: `${40 + Math.random() * 60}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
