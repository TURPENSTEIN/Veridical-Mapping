import { useEffect, useRef } from 'react';
import type { StimulusParams } from '@/types';

interface VisualStimulusProps {
  params: StimulusParams;
  active: boolean;
  label?: string;
}

export function VisualStimulus({ params, active, label }: VisualStimulusProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    startTimeRef.current = performance.now();

    const render = (now: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, w, h);

      if (!active) {
        ctx.fillStyle = '#3a3a4a';
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('—', w / 2, h / 2);
        return;
      }

      const sizeNorm = params.size ?? 0.5;
      const heightNorm = params.height ?? 0.5;
      const roundnessNorm = params.roundness ?? 0.5;
      const contrastNorm = params.contrast ?? 0.7;
      const luminanceNorm = params.luminance ?? 0.6;
      const saturationNorm = params.saturation ?? 0.5;
      const hueNorm = params.hue ?? 0.55;
      const positionNorm = params.position ?? 0.5;
      const flickerNorm = params.flicker ?? 0;

      const baseSize = 20 + sizeNorm * 100;
      const cx = w * (0.15 + positionNorm * 0.7);
      const cy = h * (0.85 - heightNorm * 0.7);

      const hue = hueNorm * 360;
      const sat = saturationNorm * 100;
      const light = 20 + luminanceNorm * 60;

      const flickerHz = flickerNorm * 12;
      const elapsed = (now - startTimeRef.current) / 1000;
      const flickerPhase = flickerHz > 0
        ? 0.5 + 0.5 * Math.sin(elapsed * flickerHz * 2 * Math.PI)
        : 1;
      const effectiveLight = light * (0.5 + 0.5 * flickerPhase);

      const fgLight = effectiveLight;
      const bgLight = fgLight - contrastNorm * 40;
      const bgColor = `hsl(${hue}, ${sat}%, ${Math.max(5, bgLight)}%)`;
      const fgColor = `hsl(${hue}, ${sat}%, ${Math.max(8, fgLight)}%)`;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(cx, cy);

      const radius = baseSize / 2;
      const corners = roundnessNorm;
      const w2 = radius;
      const h2 = radius;

      if (corners > 0.02) {
        ctx.beginPath();
        const r = Math.min(w2, h2) * corners;
        ctx.moveTo(-w2 + r, -h2);
        ctx.lineTo(w2 - r, -h2);
        ctx.quadraticCurveTo(w2, -h2, w2, -h2 + r);
        ctx.lineTo(w2, h2 - r);
        ctx.quadraticCurveTo(w2, h2, w2 - r, h2);
        ctx.lineTo(-w2 + r, h2);
        ctx.quadraticCurveTo(-w2, h2, -w2, h2 - r);
        ctx.lineTo(-w2, -h2 + r);
        ctx.quadraticCurveTo(-w2, -h2, -w2 + r, -h2);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.moveTo(-w2, -h2);
        ctx.lineTo(w2, -h2);
        ctx.lineTo(w2, h2);
        ctx.lineTo(-w2, h2);
        ctx.closePath();
      }

      ctx.fillStyle = fgColor;
      ctx.fill();

      ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${Math.min(95, fgLight + 15)}%)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [params, active]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-xl"
        style={{ display: 'block' }}
      />
      {label && (
        <span className="text-xs text-slate-400 font-medium tracking-wide">{label}</span>
      )}
    </div>
  );
}
