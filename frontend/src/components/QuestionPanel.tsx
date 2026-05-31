import { useState, useCallback } from 'react';

interface Props {
  question: string;
  options: string[];
  number: number;
  total: number;
  onAnswer: (answer: string) => void;
}

export default function QuestionPanel({ question, options, number, total, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');

  const handleConfirm = useCallback(() => {
    const answer = selected === '__custom__' ? custom.trim() : (selected || custom.trim());
    if (!answer) return;
    onAnswer(answer);
    setSelected(null);
    setCustom('');
  }, [selected, custom, onAnswer]);

  return (
    <div className="w-full max-w-lg mx-auto my-4 animate-fade-in">
      {/* Pink/white panel */}
      <div className="rounded-xl shadow-md border border-pink-200 overflow-hidden bg-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
              Question {number} of {total}
            </span>
            <span className="text-[10px] font-bold text-white/60">
              {Math.round((number / total) * 100)}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${(number / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm text-slate-800 font-medium leading-relaxed">{question}</p>
        </div>

        {/* Options */}
        <div className="px-4 pb-3 space-y-2">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => { setSelected(opt); setCustom(''); }}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border ${
                selected === opt
                  ? 'bg-pink-50 border-pink-400 text-pink-700 font-medium shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-pink-50/50'
              }`}
            >
              {opt}
            </button>
          ))}

          {/* Custom answer */}
          <div className={`rounded-lg border transition-all ${
            selected === '__custom__' ? 'border-pink-400 bg-pink-50' : 'border-slate-200'
          }`}>
            <button
              onClick={() => setSelected('__custom__')}
              className="w-full text-left px-4 py-2 text-xs text-slate-400 hover:text-pink-500 transition-colors"
            >
              {selected === '__custom__' ? 'Custom answer' : '✏️  Or type your own answer...'}
            </button>
            {selected === '__custom__' && (
              <div className="px-3 pb-3">
                <input
                  autoFocus
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                />
              </div>
            )}
          </div>
        </div>

        {/* Confirm button */}
        <div className="px-4 pb-4">
          <button
            onClick={handleConfirm}
            disabled={!selected && !custom.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-slate-200 disabled:to-slate-200 text-white text-sm font-semibold rounded-lg transition-all shadow-sm disabled:shadow-none disabled:text-slate-400"
          >
            {number < total ? 'Confirm & Continue →' : 'Confirm & Finish'}
          </button>
        </div>
      </div>
    </div>
  );
}
