interface Props {
  keypoints: string[];
  interimText: string;
  isRecording: boolean;
}

export default function NotesPanel({ keypoints, interimText, isRecording }: Props) {
  return (
    <aside className="w-56 border-l border-slate-200 p-4 flex flex-col gap-2 overflow-y-auto shrink-0 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📝</span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</span>
      </div>

      {isRecording && interimText && (
        <div className="bg-pink-50 border border-pink-200 rounded-lg px-3 py-2 text-xs text-pink-600 italic animate-fade-in">
          {interimText}
        </div>
      )}

      {keypoints.length === 0 ? (
        <div className="text-xs text-slate-300 italic mt-6 text-center leading-relaxed">
          Notes from your<br />conversation appear here
        </div>
      ) : (
        keypoints.map((kp, i) => (
          <div key={i} className="bg-purple-50 border-l-2 border-pink-400 rounded-lg px-3 py-2.5 text-xs text-slate-600 leading-relaxed animate-fade-in">
            <span className="text-pink-500 font-bold mr-1.5">#{i + 1}</span>
            {kp}
          </div>
        ))
      )}
    </aside>
  );
}
