import { useCallback } from 'react';

interface Props {
  svg?: string;
  imageB64?: string;
  mime?: string;
  prompt: string;
  isGenerating?: boolean;
}

export default function ImageDisplay({ svg, imageB64, mime, prompt, isGenerating }: Props) {
  const handleDownload = useCallback(() => {
    if (imageB64 && mime) {
      const byteStr = atob(imageB64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (prompt.slice(0, 30) || 'image').replace(/[^a-zA-Z0-9]/g, '_') + '.png';
      a.click();
      URL.revokeObjectURL(url);
    } else if (svg) {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (prompt.slice(0, 30) || 'image').replace(/[^a-zA-Z0-9]/g, '_') + '.svg';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [svg, imageB64, mime, prompt]);

  const imageSrc = imageB64 ? `data:${mime || 'image/png'};base64,${imageB64}` : null;

  if (isGenerating) {
    return (
      <div className="w-full max-w-md rounded-2xl overflow-hidden bg-slate-100 border border-slate-200" style={{ aspectRatio: '1' }}>
        <div className="w-full h-full relative flex flex-col">
          <div className="px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Creating image</span>
          </div>
          <div className="flex-1 relative">
            {/* Dot grid pattern */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              opacity: 0.5,
            }} />
            {/* Animated shimmer */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/60 to-transparent animate-shimmer" />
            {/* Subtle pink tint */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-50/30 via-transparent to-purple-50/30 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-2">
      {imageSrc ? (
        <img src={imageSrc} alt={prompt} className="w-full rounded-2xl" />
      ) : svg ? (
        <div className="w-full rounded-2xl overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : null}
      {imageSrc && (
        <button
          onClick={handleDownload}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          ⤓ Download
        </button>
      )}
      {svg && !imageSrc && (
        <button
          onClick={handleDownload}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          ⤓ Download SVG
        </button>
      )}
    </div>
  );
}