interface Props {
  activeAgent: string;
  sessionId: string;
}

export default function Sidebar({ activeAgent, sessionId }: Props) {
  return (
    <aside className="w-52 border-r border-slate-200 p-4 flex flex-col gap-4 shrink-0 bg-white">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-sm shadow-pink-200">
          Q
        </div>
        <div>
          <span className="text-sm font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Qwen Agent
          </span>
          <span className="block text-[10px] text-slate-400 font-medium">AI Platform</span>
        </div>
      </div>

      <div className="flex-1">
        {activeAgent && activeAgent !== 'orchestrator' && (
          <div className="px-3 py-2 rounded-lg bg-pink-50 border border-pink-100">
            <div className="text-[10px] text-pink-500 font-semibold uppercase tracking-wider mb-0.5">Active Tool</div>
            <div className="text-sm text-pink-700 font-medium truncate">{activeAgent.replace(/_/g, ' ')}</div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <div className="text-[10px] text-slate-400 font-medium mb-1">Session</div>
        <div className="text-[10px] text-slate-300 font-mono truncate" title={sessionId}>
          {sessionId}
        </div>
      </div>
    </aside>
  );
}
