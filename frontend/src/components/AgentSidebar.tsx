interface Props {
  agentActive: string;
  sessionId: string;
}

const AGENTS = [
  { id: 'orchestrator', label: 'Orchestrator' },
  { id: 'triage', label: 'Triage' },
  { id: 'resolver', label: 'Resolver' },
  { id: 'writer', label: 'Writer' },
  { id: 'quality', label: 'Quality' },
];

export default function AgentSidebar({ agentActive, sessionId }: Props) {
  return (
    <aside className="w-56 border-r border-slate-800 p-3 flex flex-col gap-1 shrink-0">
      <h3 className="text-[10px] uppercase tracking-widest text-slate-600 mt-3 mb-2 font-semibold">
        Agent Society
      </h3>
      {AGENTS.map(a => (
        <div
          key={a.id}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors ${
            agentActive === a.id
              ? 'bg-slate-800/80 border-l-2 border-blue-500 text-blue-300'
              : 'text-slate-400 border-l-2 border-transparent'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              agentActive === a.id ? 'bg-blue-500' : 'bg-slate-700'
            }`}
          />
          {a.label}
        </div>
      ))}
      <div className="mt-auto pt-4 text-[10px] text-slate-600 truncate">
        {sessionId}
      </div>
    </aside>
  );
}
