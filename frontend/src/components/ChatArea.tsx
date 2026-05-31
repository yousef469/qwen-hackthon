import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Message, WorkflowState } from '../types';
import PinnedNoteCard from './PinnedNoteCard';
import ImageDisplay from './ImageDisplay';

interface KeypointCard {
  number: number;
  keypoints: string[];
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'white';
  title?: string;
}

interface InterviewView {
  isActive: boolean;
  isComplete: boolean;
  keypointCards: KeypointCard[];
  siCards: KeypointCard[];
}

interface Props {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  liveThinking: string;
  workflow: WorkflowState | null;
  onApprove: () => void;
  onReject: () => void;
  interview: InterviewView;
  children?: ReactNode;
  onFileDrop?: (file: File) => void;
}

function ToolBadge({ tools }: { tools: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-1">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-[10px] text-pink-400 hover:text-pink-500 transition-colors">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        <span>{expanded ? 'Hide tools' : 'Show tools'}</span>
        <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded">{tools}</span>
      </button>
      {expanded && (
        <div className="mt-1 p-2 bg-pink-50 rounded-lg border border-pink-200 text-[10px] text-pink-600 font-mono whitespace-pre-wrap animate-fade-in">
          {tools}
        </div>
      )}
    </div>
  );
}

function ThinkingBadge({ thinking, isStreaming }: { thinking: string; isStreaming: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (!thinking && !isStreaming) return null;
  return (
    <div className="mb-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-500 transition-colors">
        <svg className={`w-3.5 h-3.5 ${isStreaming ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <span>{isStreaming ? 'Reasoning...' : expanded ? 'Hide reasoning' : 'Show reasoning'}</span>
      </button>
      {expanded && thinking && (
        <div className="mt-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 leading-relaxed whitespace-pre-wrap font-mono animate-fade-in">
          {thinking}
        </div>
      )}
    </div>
  );
}

function WorkflowProgress({ workflow, onApprove, onReject }: {
  workflow: WorkflowState;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="text-xs font-semibold text-pink-700 uppercase tracking-wider">
          {workflow.isAwaitingApproval ? 'Awaiting Approval' : 'Workflow in Progress'}
        </span>
        {workflow.isAwaitingApproval && <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
      </div>
      <div className="flex items-center gap-2">
        {workflow.steps.map((step, i) => {
          let bgColor = 'bg-slate-200';
          let textColor = 'text-slate-400';
          let lineColor = 'bg-slate-200';
          if (step.status === 'completed') {
            bgColor = 'bg-emerald-400';
            textColor = 'text-white';
            lineColor = 'bg-emerald-400';
          } else if (workflow.isAwaitingApproval && i === workflow.currentStepIndex + 1) {
            bgColor = 'bg-amber-400';
            textColor = 'text-white';
            lineColor = 'bg-amber-300';
          }
          return (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${bgColor} ${textColor}`}>
                  {step.status === 'completed' ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : <span>{step.icon}</span>}
                </div>
                <span className={`text-[11px] font-medium truncate max-w-[60px] ${step.status === 'completed' ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {step.label.split(' ')[0]}
                </span>
              </div>
              {i < workflow.steps.length - 1 && <div className={`h-0.5 flex-1 ${lineColor}`} />}
            </div>
          );
        })}
      </div>
      {workflow.isAwaitingApproval && (
        <div className="mt-4 pt-3 border-t border-pink-100 flex items-center gap-2">
          <span className="text-xs text-slate-500 flex-1">{workflow.approvalReason || 'Review and approve or reject.'}</span>
          <button onClick={onApprove} className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all">Approve ✓</button>
          <button onClick={onReject} className="px-4 py-1.5 bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all">Reject ✕</button>
        </div>
      )}
    </div>
  );
}

function CardGrid({ cards, label }: { cards: KeypointCard[]; label: string }) {
  if (cards.length === 0) return null;
  const row1 = cards.slice(0, 3);
  const row2 = cards.slice(3, 5);
  return (
    <div className="px-6 py-4">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-3">{label}</p>
      {/* Row 1: 3 cards */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {row1.map(card => (
          <PinnedNoteCard
            key={card.number}
            number={card.number}
            keypoints={card.keypoints}
            color={card.color}
            title={card.title}
          />
        ))}
      </div>
      {/* Row 2: 2 cards (centered in a 3-column grid) */}
      {row2.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div /> {/* spacer */}
          {row2.map(card => (
            <PinnedNoteCard
              key={card.number}
              number={card.number}
              keypoints={card.keypoints}
              color={card.color}
              title={card.title}
            />
          ))}
          {row2.length < 2 && <div />} {/* trailing spacer if only 1 */}
        </div>
      )}
    </div>
  );
}

export default function ChatArea({ messages, isLoading, isStreaming, liveThinking, workflow, onApprove, onReject, interview, children, onFileDrop }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveThinking]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const files = e.dataTransfer.files;
    if (files.length > 0 && onFileDrop) {
      onFileDrop(files[0]);
    }
  };

  return (
    <div
      className="flex-1 overflow-y-auto scrollbar-thin space-y-4 relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-pink-50/80 backdrop-blur-sm border-2 border-dashed border-pink-400 rounded-2xl m-2">
          <div className="text-center space-y-2">
            <div className="text-4xl">📄</div>
            <p className="text-sm text-pink-600 font-medium">Drop file here</p>
            <p className="text-[11px] text-pink-400">PDF, images, or text files</p>
          </div>
        </div>
      )}
      {/* Voice conversation indicator */}
      {interview.isActive && (
        <div className="flex justify-center px-6 pt-5 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-600 font-medium">Voice conversation active</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={`px-6 pb-5 space-y-4 ${messages.length === 0 ? 'flex items-center justify-center min-h-[300px]' : ''}`}>
        {messages.length === 0 ? (
          <div className="text-center space-y-4 animate-float-up">
            <div className="inline-flex w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-100 to-purple-100 items-center justify-center text-4xl shadow-sm shadow-pink-100">
              <span className="animate-pulse-glow inline-block">🤖</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Qwen Agent</h2>
              <p className="text-slate-400 text-sm">Upload a file or type a message to get started</p>
            </div>
            <div className="flex gap-2 justify-center">
              <span className="text-[11px] px-3 py-1.5 rounded-full bg-pink-50 text-pink-600 border border-pink-100 font-medium">📎 PDF</span>
              <span className="text-[11px] px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 font-medium">🎤 Voice</span>
              <span className="text-[11px] px-3 py-1.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 font-medium">💬 Chat</span>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} ${m.role === 'user' ? 'message-user' : 'message-assistant'}`} style={{ animationDelay: `${i * 0.02}s` }}>
              <div className={`max-w-[75%] ${m.role === 'assistant' ? 'flex items-start gap-3' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm">Q</div>
                )}
                  <div>
                    {m.role === 'assistant' && m.tools && (
                      <ToolBadge tools={m.tools} />
                    )}
                    {m.role === 'assistant' && (m.thinking || m.content) && (
                      <ThinkingBadge thinking={m.thinking || ''} isStreaming={isStreaming && m.id === messages[messages.length - 1]?.id} />
                    )}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap transition-shadow duration-200 ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-tr-sm shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-700 rounded-tl-sm hover:shadow-sm'
                  }`}>
                    <div>
                      {m.msgType === 'video' && m.fileData?.videoUrl ? (
                        <div className="space-y-2">
                          <video src={m.fileData.videoUrl} controls className="w-full max-w-md rounded-2xl" autoPlay>
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      ) : m.msgType === 'image' && m.imageData ? (
                        <ImageDisplay svg={m.imageData.svg} imageB64={m.imageData.image_b64} mime={m.imageData.mime} prompt={m.imageData.prompt} isGenerating={m.isGenerating} />
                      ) : m.msgType === 'file' && m.fileData ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>📄</span>
                            <span className="font-medium text-slate-700">{m.fileData.filename}</span>
                            <span className="text-[10px] text-slate-400 uppercase">(.{m.fileData.type})</span>
                          </div>
                          {m.fileData.b64 && m.fileData.mime && (
                            <img src={`data:${m.fileData.mime};base64,${m.fileData.b64}`} alt={m.fileData.filename} className="max-w-[200px] max-h-[200px] rounded-lg border border-slate-200" />
                          )}
                          {m.fileData.description && (
                            <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg">🔍 {m.fileData.description}</div>
                          )}
                          {m.fileData.text && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-pink-500 hover:text-pink-600 font-medium">Show extracted text</summary>
                              <pre className="mt-1 p-2 bg-slate-50 rounded text-[10px] text-slate-600 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">{m.fileData.text}</pre>
                            </details>
                          )}
                        </div>
                      ) : (
                        m.content
                      )}
                      {isStreaming && m.id === messages[messages.length - 1]?.id && m.role === 'assistant' && (
                        <span className="inline-block w-1.5 h-4 bg-pink-500 ml-0.5 animate-blink" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {isLoading && !isStreaming && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">Q</div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-pink-400 rounded-full thinking-dot" style={{ animationDelay: '0s' }} />
                <span className="w-1.5 h-1.5 bg-pink-400 rounded-full thinking-dot" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 bg-pink-400 rounded-full thinking-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        {/* Colored pinned note cards */}
        <CardGrid cards={interview.keypointCards} label="Key Points" />
        <CardGrid cards={interview.siCards} label="Design Key Points" />

        {/* Workflow */}
        {workflow && workflow.isActive && (
          <div>
            <WorkflowProgress workflow={workflow} onApprove={onApprove} onReject={onReject} />
          </div>
        )}

        {children}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
