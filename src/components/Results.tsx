import { useEffect, useState } from 'react';
import { Check, X, Clock, TrendingUp, Target, Zap, Network, ArrowLeft, BarChart3, RotateCcw } from 'lucide-react';
import type { SessionSummary } from '@/types';
import { AXES } from '@/types';
import { getRecentSessions } from '@/lib/session';

interface ResultsProps {
  onExit: () => void;
  lastSummary?: {
    totalTrials: number;
    correctTrials: number;
    avgReactionTimeMs: number;
    difficultyLevel: number;
    axisErrors: Record<string, number>;
    accuracy: number;
  } | null;
  lastMode?: string;
}

export function Results({ onExit, lastSummary, lastMode }: ResultsProps) {
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentSessions(20).then((data) => {
      setHistory(data.filter(s => s.completedAt));
      setLoading(false);
    });
  }, []);

  const modeIcon = lastMode === 'calibration' ? Target : lastMode === 'mode_a' ? Zap : Network;
  const modeColor = lastMode === 'calibration' ? 'cyan' : lastMode === 'mode_a' ? 'amber' : 'violet';
  const modeLabel = lastMode === 'calibration' ? 'Calibration' : lastMode === 'mode_a' ? 'Equivalence Matching' : 'Graph Mapping';
  const Icon = modeIcon;
  const colorClass = `text-${modeColor}-400`;
  const bgClass = `bg-${modeColor}-500/10`;
  const borderClass = `border-${modeColor}-500/30`;

  const accuracy = lastSummary ? lastSummary.accuracy * 100 : 0;
  const avgRt = lastSummary?.avgReactionTimeMs ?? 0;

  const axisEntries = lastSummary
    ? Object.entries(lastSummary.axisErrors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {/* Last session summary */}
      {lastSummary && (
        <div className={`rounded-2xl border ${borderClass} ${bgClass} p-6`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2.5 rounded-xl ${bgClass} border ${borderClass}`}>
              <Icon className={`w-6 h-6 ${colorClass}`} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{modeLabel} Results</h2>
              <span className="text-slate-500 text-sm">Session complete</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <MetricCard
              icon={Check}
              label="Accuracy"
              value={`${accuracy.toFixed(1)}%`}
              sub={`${lastSummary.correctTrials}/${lastSummary.totalTrials} correct`}
              color={accuracy > 80 ? 'emerald' : accuracy > 60 ? 'amber' : 'rose'}
            />
            <MetricCard
              icon={Clock}
              label="Avg Reaction"
              value={`${avgRt.toFixed(0)}ms`}
              sublabel="per trial"
            />
            <MetricCard
              icon={TrendingUp}
              label="Difficulty"
              value={lastSummary.difficultyLevel.toFixed(2)}
              sublabel="adaptive level"
            />
            <MetricCard
              icon={Target}
              label="Total Trials"
              value={lastSummary.totalTrials.toString()}
              sublabel="completed"
            />
          </div>

          {/* Per-axis error bars */}
          {axisEntries.length > 0 && (
            <div className="rounded-xl bg-black/20 border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                <span className="text-sm text-slate-300 font-medium">Per-Axis Error Rates</span>
              </div>
              <div className="space-y-2">
                {axisEntries.map(([axis, error]) => {
                  const pct = Math.min(100, (error as number) * 100);
                  const axisDef = AXES[axis as keyof typeof AXES];
                  return (
                    <div key={axis} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-24 shrink-0">{axisDef?.label ?? axis}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct > 50 ? 'bg-rose-400' : pct > 25 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">{(error as number).toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="rounded-2xl border border-white/5 bg-[#0d0d1a] p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
          Session History
        </h3>
        {loading ? (
          <div className="text-slate-500 text-sm py-8 text-center">Loading...</div>
        ) : history.length === 0 ? (
          <div className="text-slate-500 text-sm py-8 text-center">No completed sessions yet.</div>
        ) : (
          <div className="space-y-2">
            {history.map((s) => {
              const acc = s.totalTrials > 0 ? (s.correctTrials / s.totalTrials) * 100 : 0;
              const mLabel = s.mode === 'calibration' ? 'Calibration' : s.mode === 'mode_a' ? 'Equivalence' : 'Graph Mapping';
              const mColor = s.mode === 'calibration' ? 'text-cyan-400' : s.mode === 'mode_a' ? 'text-amber-400' : 'text-violet-400';
              return (
                <div key={s.id} className="flex items-center gap-4 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${mColor}`}>{mLabel}</span>
                    <span className="text-slate-600 text-xs ml-2">{new Date(s.startedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-xs text-slate-500">
                    <span>{s.totalTrials} trials</span>
                    <span>{acc.toFixed(0)}% acc</span>
                    <span>{s.avgReactionTimeMs?.toFixed(0) ?? '—'}ms</span>
                    <span>L{s.difficultyLevel.toFixed(2)}</span>
                  </div>
                  <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${acc > 80 ? 'bg-emerald-400' : acc > 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                      style={{ width: `${acc}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={onExit}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all"
      >
        <RotateCcw className="w-4 h-4" /> Return to Dashboard
      </button>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sublabel, sub, color }: {
  icon: any;
  label: string;
  value: string;
  sublabel?: string;
  sub?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
  };
  const valueColor = color ? colorMap[color] : 'text-white';
  return (
    <div className="rounded-xl bg-black/20 border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</div>
      <div className="text-xs text-slate-600 mt-0.5">{sub ?? sublabel}</div>
    </div>
  );
}
