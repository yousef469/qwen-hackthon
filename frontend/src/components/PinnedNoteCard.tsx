interface Props {
  number: number;
  keypoints: string[];
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'white';
  title?: string;
}

const themeStyles: Record<string, {
  pin: string; pinStroke: string; pinInner: string;
  badgeBg: string; badgeText: string;
  paperBg: string; border: string; lineColor: string;
}> = {
  blue: {
    pin: '#3B82F6', pinStroke: '#2563EB', pinInner: '#BFDBFE',
    badgeBg: '#EFF6FF', badgeText: '#3B82F6',
    paperBg: '#f0f7ff', border: '#93c5fd', lineColor: '#bfdbfe',
  },
  red: {
    pin: '#F43F5E', pinStroke: '#E11D48', pinInner: '#FECDD3',
    badgeBg: '#FFF1F2', badgeText: '#F43F5E',
    paperBg: '#fff5f5', border: '#fca5a5', lineColor: '#fecaca',
  },
  green: {
    pin: '#10B981', pinStroke: '#059669', pinInner: '#A7F3D0',
    badgeBg: '#ECFDF5', badgeText: '#10B981',
    paperBg: '#f0fdf4', border: '#86efac', lineColor: '#bbf7d0',
  },
  yellow: {
    pin: '#F59E0B', pinStroke: '#D97706', pinInner: '#FDE68A',
    badgeBg: '#FFFBEB', badgeText: '#F59E0B',
    paperBg: '#fefce8', border: '#fcd34d', lineColor: '#fde68a',
  },
  white: {
    pin: '#94A3B8', pinStroke: '#64748B', pinInner: '#E2E8F0',
    badgeBg: '#F8FAFC', badgeText: '#64748B',
    paperBg: '#f8fafc', border: '#cbd5e1', lineColor: '#e2e8f0',
  },
};

const iconShapes: Record<string, string> = {
  blue: '●',
  red: '◆',
  green: '▲',
  yellow: '★',
  white: '▪',
};

export default function PinnedNoteCard({ number, keypoints, color = 'red', title }: Props) {
  const t = themeStyles[color] || themeStyles.red;
  const icon = iconShapes[color] || '•';

  return (
    <div className="relative animate-fade-in h-full">
      {/* Push pin */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
        <svg width="16" height="18" viewBox="0 0 22 24" fill="none">
          <ellipse cx="11" cy="20" rx="4" ry="2.5" fill="#cbd5e1" opacity="0.5" />
          <circle cx="11" cy="8" r="7" fill={t.pin} stroke={t.pinStroke} strokeWidth="1.5" />
          <circle cx="11" cy="8" r="2.5" fill={t.pinInner} />
          <line x1="11" y1="15" x2="11" y2="22" stroke={t.pin} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="11" cy="22" r="1.5" fill={t.pin} />
        </svg>
      </div>

      {/* Card */}
      <div
        className="rounded-lg shadow-sm border pt-4 pb-2 px-3 h-full flex flex-col"
        style={{
          backgroundColor: t.paperBg,
          borderColor: t.border,
          borderTopWidth: '3px',
          borderTopColor: t.pin,
        }}
      >
        {/* Title line */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span style={{ color: t.pin, fontSize: '11px' }}>{icon}</span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded truncate"
            style={{ backgroundColor: t.badgeBg, color: t.badgeText }}
          >
            {title || `Point ${number}`}
          </span>
        </div>

        {/* Keypoints */}
        <div className="space-y-0.5 min-h-0 flex-1">
          {keypoints.map((kp, i) => (
            <div key={i} className="flex items-start gap-1">
              <span className="shrink-0 leading-tight" style={{ color: t.pin, fontSize: '10px', marginTop: '2px' }}>{icon}</span>
              <span
                style={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '10px',
                  color: '#334155',
                  lineHeight: '1.35',
                }}
                className="leading-tight"
              >
                {kp}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
