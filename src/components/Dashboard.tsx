import { useEffect, useState } from 'react';
import { Activity, Target, Network, TrendingUp, Clock, Zap, ArrowRight, BarChart3 } from 'lucide-react';
import type { SessionSummary } from '@/types';
import { getRecentSessions } from '@/lib/session';

interface DashboardProps {
  onNavigate: (view: 'calibration' | 'mode_a' | 'mode_b') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentSessions(20).then((data) => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  const completedSessions = sessions.filter((s) => s.completedAt);
  const totalTrials = completedSessions.reduce((sum, s) => sum + s.totalTrials, 0);
  const totalCorrect = completedSessions.reduce((sum, s) => sum + s.correctTrials, 0);
  const overallAccuracy = totalTrials > 0 ? (totalCorrect / totalTrials) * 100 : 0;
  const avgRt = completedSessions.length > 0
    ? completedSessions.reduce((sum, s) => sum + (s.avgReactionTimeMs ?? 0), 0) / completedSessions.length
    : 0;

  const modeStats = (mode: string) => {
    const filtered = completedSessions.filter((s) => s.mode === mode);
    if (filtered.length === 0) return { count: 0, accuracy: 0, avgRt: 0 };
    const trials = filtered.reduce((sum, s) => sum + s.totalTrials, 0);
    const correct = filtered.reduce((sum, s) => sum + s.correctTrials, 0);
    return {
      count: filtered.length,
      accuracy: trials > 0 ? (correct / trials) * 100 : 0,
      avgRt: filtered.reduce((sum, s) => sum + (s.avgReactionTimeMs ?? 0), 0) / filtered.length,
    };
  };

  const calibStats = modeStats('calibration');
  const modeAStats = modeStats('mode_a');
  const modeBStats = modeStats('mode_b');

  const modeCards = [
    {
      id: 'calibration' as const,
      title: 'Calibration',
      description: 'Establish your perceptual baseline across all sensory axes. Required before training.',
      icon: Target,
      color: 'cyan',
      stats: calibStats,
    },
    {
      id: 'mode_a' as const,
      title: 'Equivalence Matching',
      description: 'Compare two cross-modal stimuli and judge if they share the same underlying parameter.',
      icon: Zap,
      color: 'amber',
      stats: modeAStats,
    },
    {
      id: 'mode_b' as const,
      title: 'Graph Mapping',
      description: 'Hear a multi-axis auditory target, then place it in a 2D visual coordinate space.',
      icon: Network,
      color: 'violet',
      stats: modeBStats,
    },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'group-hover:shadow-cyan-500/20' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'group-hover:shadow-amber-500/20' },
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'group-hover:shadow-violet-500/20' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-[#0d0d1a] to-[#12121f] p-8 sm:p-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Cognitive Training System
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
            Quantitative Veridical Mapping
          </h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed">
            Train your brain to detect structural isomorphisms across sensory modalities.
            Build intuitive cross-modal perception through rapid, low-level stimulus matching
            under strict latency constraints.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Sessions" value={completedSessions.length.toString()} sublabel="completed" />
        <StatCard icon={Target} label="Accuracy" value={`${overallAccuracy.toFixed(1)}%`} sublabel={`${totalTrials} trials`} />
        <StatCard icon={Clock} label="Avg Reaction" value={`${avgRt.toFixed(0)}ms`} sublabel="per trial" />
        <StatCard icon={TrendingUp} label="Best Difficulty" value={completedSessions.length > 0 ? Math.max(...completedSessions.map(s => s.difficultyLevel)).toFixed(2) : '0.50'} sublabel="adaptive level" />
      </div>

      {/* Mode cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {modeCards.map((card) => {
          const colors = colorMap[card.color];
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className={`group text-left relative overflow-hidden rounded-2xl border ${colors.border} ${colors.bg} p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${colors.glow}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${colors.bg} border ${colors.border}`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} strokeWidth={1.5} />
                </div>
                <ArrowRight className={`w-5 h-5 ${colors.text} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">{card.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{card.description}</p>
              {card.stats.count > 0 ? (
                <div className="flex gap-4 text-xs">
                  <span className="text-slate-500">{card.stats.count} runs</span>
                  <span className="text-slate-500">{card.stats.accuracy.toFixed(0)}% acc</span>
                  <span className="text-slate-500">{card.stats.avgRt.toFixed(0)}ms</span>
                </div>
              ) : (
                <span className="text-xs text-slate-600">No data yet</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Recent sessions */}
      <div className="rounded-2xl border border-white/5 bg-[#0d0d1a] p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
          <h3 className="text-white font-semibold">Recent Sessions</h3>
        </div>
        {loading ? (
          <div className="text-slate-500 text-sm py-8 text-center">Loading...</div>
        ) : completedSessions.length === 0 ? (
          <div className="text-slate-500 text-sm py-8 text-center">
            No sessions yet. Start with calibration to begin training.
          </div>
        ) : (
          <div className="space-y-2">
            {completedSessions.slice(0, 8).map((s) => {
              const acc = s.totalTrials > 0 ? (s.correctTrials / s.totalTrials) * 100 : 0;
              const modeLabel = s.mode === 'calibration' ? 'Calibration' : s.mode === 'mode_a' ? 'Equivalence' : 'Graph Mapping';
              const modeColor = s.mode === 'calibration' ? 'text-cyan-400' : s.mode === 'mode_a' ? 'text-amber-400' : 'text-violet-400';
              return (
                <div key={s.id} className="flex items-center gap-4 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${modeColor}`}>{modeLabel}</span>
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
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sublabel }: { icon: any; label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#0d0d1a] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-xs text-slate-600 mt-0.5">{sublabel}</div>
    </div>
  );
}
