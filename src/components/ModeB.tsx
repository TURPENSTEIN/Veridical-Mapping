import { useCallback, useEffect, useRef, useState } from 'react';
import { Network, Play, Check, X, ArrowLeft, AlertTriangle, Volume2, Crosshair } from 'lucide-react';
import type { TrialResult } from '@/types';
import { AXES } from '@/types';
import { generateModeBTrial, type ModeBTrial, clamp01 } from '@/lib/stimulus';
import { playTone, playFeedbackTone, resumeAudio } from '@/lib/audio';
import { createSession, logTrial, completeSession } from '@/lib/session';
import { createAdaptiveState, updateAdaptive, getAxisErrorRates, getAccuracy, type AdaptiveState } from '@/lib/adaptive';

interface ModeBProps {
  onComplete: (summary: ModeBSummary) => void;
  onExit: () => void;
}

export interface ModeBSummary {
  totalTrials: number;
  correctTrials: number;
  avgReactionTimeMs: number;
  difficultyLevel: number;
  axisErrors: Record<string, number>;
  accuracy: number;
}

const TOTAL_TRIALS = 15;
const LATENCY_CAP_MS = 4000;
const MATCH_THRESHOLD = 0.15;

type Phase = 'intro' | 'target' | 'mapping' | 'feedback' | 'done';

export function ModeB({ onComplete, onExit }: ModeBProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [trialIdx, setTrialIdx] = useState(0);
  const [trial, setTrial] = useState<ModeBTrial | null>(null);
  const [results, setResults] = useState<TrialResult[]>([]);
  const [adaptive, setAdaptive] = useState<AdaptiveState>(createAdaptiveState());
  const [feedback, setFeedback] = useState<{ error1: number; error2: number; totalError: number; correct: boolean } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const [committed, setCommitted] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const presentTarget = useCallback(async (data: ModeBTrial) => {
    // Play auditory target: pitch + duration
    await playTone(data.value1, data.value2, 0);
    await new Promise(r => setTimeout(r, 200));
    await playTone(data.value1, data.value2, 0);

    startTimeRef.current = performance.now();
    setPhase('mapping');
    setCursor({ x: 0.5, y: 0.5 });
    setCommitted(false);

    timerRef.current = window.setTimeout(() => {
      submitResponse(0.5, 0.5, true);
    }, LATENCY_CAP_MS);
  }, []);

  const submitResponse = useCallback((x: number, y: number, isTimeout: boolean = false) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!trial) return;

    const rt = performance.now() - startTimeRef.current;
    // x maps to axis1 (height), y maps to axis2 (size)
    const error1 = Math.abs(x - trial.value1);
    const error2 = Math.abs(y - trial.value2);
    const totalError = (error1 + error2) / 2;
    const correct = !isTimeout && totalError < MATCH_THRESHOLD;

    const result: TrialResult = {
      trialNumber: trialIdx,
      axisName: trial.targetAxis1,
      stimulusA: trial.stimulusA,
      stimulusB: { [trial.mapAxis1]: x, [trial.mapAxis2]: y },
      userResponse: `x:${x.toFixed(3)},y:${y.toFixed(3)}`,
      correct,
      reactionTimeMs: Math.round(rt),
      errorMargin: totalError,
    };

    setResults(prev => [...prev, result]);
    setFeedback({ error1, error2, totalError, correct });
    setPhase('feedback');
    setCommitted(true);
    playFeedbackTone(correct);

    const newAdaptive = updateAdaptive(adaptive, correct, trial.targetAxis1, totalError);
    setAdaptive(newAdaptive);

    if (sessionId) {
      logTrial(sessionId, result);
    }
  }, [trial, trialIdx, sessionId, adaptive]);

  const nextTrial = useCallback(() => {
    setFeedback(null);
    if (trialIdx + 1 >= TOTAL_TRIALS) {
      setPhase('done');
      return;
    }
    const nextIdx = trialIdx + 1;
    setTrialIdx(nextIdx);
    const data = generateModeBTrial(adaptive.difficulty);
    setTrial(data);
    setPhase('target');
    presentTarget(data);
  }, [trialIdx, adaptive.difficulty, presentTarget]);

  const startMode = async () => {
    resumeAudio();
    const id = await createSession('mode_b');
    setSessionId(id);
    const data = generateModeBTrial(0.5);
    setTrial(data);
    setTrialIdx(0);
    setResults([]);
    setAdaptive(createAdaptiveState());
    setPhase('target');
    presentTarget(data);
  };

  useEffect(() => {
    if (phase === 'done' && results.length > 0 && sessionId) {
      const correctCount = results.filter(r => r.correct).length;
      const avgRt = results.reduce((a, b) => a + b.reactionTimeMs, 0) / results.length;
      const axisErrors = getAxisErrorRates(adaptive);

      completeSession(sessionId, {
        startedAt: '',
        completedAt: null,
        totalTrials: results.length,
        correctTrials: correctCount,
        avgReactionTimeMs: avgRt,
        difficultyLevel: adaptive.difficulty,
        axisErrors,
      });

      onComplete({
        totalTrials: results.length,
        correctTrials: correctCount,
        avgReactionTimeMs: avgRt,
        difficultyLevel: adaptive.difficulty,
        axisErrors,
        accuracy: correctCount / results.length,
      });
    }
  }, [phase, results, sessionId, adaptive, onComplete]);

  // Pointer handlers for the 2D graph
  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== 'mapping' || !graphRef.current) return;
    isDraggingRef.current = true;
    updateCursor(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || phase !== 'mapping' || !graphRef.current) return;
    updateCursor(e);
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (phase === 'mapping') {
      submitResponse(cursor.x, cursor.y);
    }
  };

  const updateCursor = (e: React.PointerEvent) => {
    const rect = graphRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01(1 - (e.clientY - rect.top) / rect.height);
    setCursor({ x, y });
  };

  const progress = (trialIdx / TOTAL_TRIALS) * 100;
  const accuracy = getAccuracy(adaptive) * 100;

  if (phase === 'intro') {
    return <ModeBIntro onStart={startMode} onExit={onExit} />;
  }

  if (phase === 'done') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex p-4 rounded-2xl bg-violet-500/10 border border-violet-500/30 mb-6">
          <Check className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Session Complete</h2>
        <p className="text-slate-400">Computing your results...</p>
      </div>
    );
  }

  const mapAxis1Label = trial ? AXES[trial.mapAxis1].label : '';
  const mapAxis2Label = trial ? AXES[trial.mapAxis2].label : '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Network className="w-4 h-4 text-violet-400" />
            <span>Graph Mapping</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="text-slate-500">Acc: <span className={accuracy > 80 ? 'text-emerald-400' : accuracy > 60 ? 'text-amber-400' : 'text-rose-400'}>{accuracy.toFixed(0)}%</span></span>
            <span className="text-slate-500">Diff: <span className="text-cyan-400">{adaptive.difficulty.toFixed(2)}</span></span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Trial {trialIdx + 1} of {TOTAL_TRIALS}</span>
          <span>Pitch + Duration → {mapAxis1Label} + {mapAxis2Label}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-violet-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Target indicator */}
      {phase === 'target' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-violet-500/20 blur-2xl rounded-full animate-pulse" />
            <Volume2 className="w-16 h-16 text-violet-400 relative z-10 animate-pulse" strokeWidth={1.5} />
          </div>
          <span className="text-slate-400 text-sm">Listen to the auditory target...</span>
        </div>
      )}

      {/* 2D Mapping Graph */}
      {(phase === 'mapping' || phase === 'feedback') && trial && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/20">
            <Crosshair className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-xs text-violet-300/80">
              {phase === 'mapping'
                ? `Drag to place the point — X: ${mapAxis1Label}, Y: ${mapAxis2Label}. Release to submit.`
                : 'Feedback shown below.'}
            </span>
          </div>

          <div
            ref={graphRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`relative aspect-square max-w-md mx-auto rounded-2xl border border-white/10 bg-[#0d0d1a] overflow-hidden ${
              phase === 'mapping' ? 'cursor-crosshair touch-none' : ''
            }`}
            style={{ touchAction: 'none' }}
          >
            {/* Grid lines */}
            <div className="absolute inset-0">
              {[0.25, 0.5, 0.75].map((v) => (
                <div key={`h${v}`} className="absolute left-0 right-0 border-t border-white/5" style={{ top: `${(1 - v) * 100}%` }} />
              ))}
              {[0.25, 0.5, 0.75].map((v) => (
                <div key={`v${v}`} className="absolute top-0 bottom-0 border-l border-white/5" style={{ left: `${v * 100}%` }} />
              ))}
            </div>

            {/* Axis labels */}
            <span className="absolute bottom-1.5 left-2 text-[10px] text-slate-600">low {mapAxis1Label}</span>
            <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-600">high {mapAxis1Label}</span>
            <span className="absolute top-1.5 left-2 text-[10px] text-slate-600 -rotate-0">high {mapAxis2Label}</span>
            <span className="absolute bottom-7 left-2 text-[10px] text-slate-600">low {mapAxis2Label}</span>

            {/* User cursor */}
            <div
              className={`absolute w-6 h-6 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 transition-all ${
                phase === 'feedback'
                  ? feedback?.correct ? 'border-emerald-400 bg-emerald-400/20' : 'border-rose-400 bg-rose-400/20'
                  : 'border-violet-400 bg-violet-400/20'
              }`}
              style={{ left: `${cursor.x * 100}%`, top: `${(1 - cursor.y) * 100}%` }}
            >
              <div className={`absolute inset-0 rounded-full ${phase === 'feedback' ? (feedback?.correct ? 'bg-emerald-400/10' : 'bg-rose-400/10') : 'bg-violet-400/10 animate-ping'} `} />
            </div>

            {/* Target (shown in feedback) */}
            {phase === 'feedback' && (
              <div
                className="absolute w-6 h-6 rounded-full border-2 border-cyan-400 bg-cyan-400/20 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${trial.value1 * 100}%`, top: `${(1 - trial.value2) * 100}%` }}
              >
                <div className="absolute inset-0 rounded-full bg-cyan-400/10" />
              </div>
            )}

            {/* Connecting line in feedback */}
            {phase === 'feedback' && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <line
                  x1={`${cursor.x * 100}%`}
                  y1={`${(1 - cursor.y) * 100}%`}
                  x2={`${trial.value1 * 100}%`}
                  y2={`${(1 - trial.value2) * 100}%`}
                  stroke={feedback?.correct ? '#34d399' : '#fb7185'}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
              </svg>
            )}
          </div>

          {/* Feedback */}
          {phase === 'feedback' && feedback && (
            <div className="space-y-4">
              <div className={`flex items-center justify-center gap-4 py-4 rounded-xl border ${
                feedback.correct
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                {feedback.correct ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
                <span className="text-lg font-semibold">
                  {feedback.correct ? 'Match' : 'Off Target'}
                </span>
                <span className="text-sm opacity-70">
                  Δ{mapAxis1Label}: {feedback.error1.toFixed(3)} · Δ{mapAxis2Label}: {feedback.error2.toFixed(3)}
                </span>
              </div>
              <button
                onClick={nextTrial}
                className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all"
              >
                {trialIdx + 1 >= TOTAL_TRIALS ? 'Finish' : 'Next Trial'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModeBIntro({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex p-4 rounded-2xl bg-violet-500/10 border border-violet-500/30 mb-6">
          <Network className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">1-to-Many Graph Mapping</h2>
        <p className="text-slate-400 leading-relaxed max-w-lg mx-auto">
          Hear a two-dimensional auditory stimulus (pitch + duration). Then place a
          point on a 2D visual graph so that its position matches the auditory target's
          underlying parameters. Build an intuitive cross-modal coordinate system.
        </p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#0d0d1a] p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-violet-400" strokeWidth={1.5} />
            <span className="text-sm text-slate-300">Auditory Target</span>
          </div>
          <span className="text-slate-600 text-xs">→</span>
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-cyan-400" strokeWidth={1.5} />
            <span className="text-sm text-slate-300">Visual Graph</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/5">
            <div className="text-violet-400 font-medium">Pitch → Height</div>
            <div className="text-slate-500 mt-0.5">Tone frequency maps to vertical position</div>
          </div>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/5">
            <div className="text-cyan-400 font-medium">Duration → Size</div>
            <div className="text-slate-500 mt-0.5">Tone length maps to spatial extent</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        <InfoRow num="1" text="Listen to the two-axis auditory target" />
        <InfoRow num="2" text="Drag on the 2D graph to place your point" />
        <InfoRow num="3" text="Release to submit — X axis = Height, Y axis = Size" />
        <InfoRow icon={AlertTriangle} text={`Respond within ${(LATENCY_CAP_MS / 1000).toFixed(1)}s`} />
      </div>

      <div className="flex gap-3">
        <button onClick={onExit} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 font-semibold hover:bg-violet-500/30 transition-all"
        >
          <Play className="w-5 h-5" /> Start Training
        </button>
      </div>
    </div>
  );
}

function InfoRow({ num, icon: Icon, text }: { num?: string; icon?: any; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5">
      {num && (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold shrink-0">
          {num}
        </span>
      )}
      {Icon && <Icon className="w-4 h-4 text-violet-400 shrink-0" strokeWidth={1.5} />}
      <span className="text-slate-300 text-sm">{text}</span>
    </div>
  );
}
