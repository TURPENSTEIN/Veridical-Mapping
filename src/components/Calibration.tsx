import { useCallback, useEffect, useRef, useState } from 'react';
import { Target, Play, Check, X, RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react';
import type { AxisName, TrialResult, CalibrationResult } from '@/types';
import { AXES, AXIS_LIST } from '@/types';
import { playTone, playFeedbackTone, resumeAudio } from '@/lib/audio';
import { VisualStimulus } from './VisualStimulus';
import { createSession, logTrial, completeSession } from '@/lib/session';

interface CalibrationProps {
  onComplete: (result: CalibrationResult) => void;
  onExit: () => void;
}

const CALIBRATION_AXES: AxisName[] = ['pitch', 'height', 'size', 'toneDuration', 'contrast', 'luminance', 'roundness', 'timbre'];
const TRIALS_PER_AXIS = 4;
const TOTAL_TRIALS = CALIBRATION_AXES.length * TRIALS_PER_AXIS;
const LATENCY_CAP_MS = 3000;

type Phase = 'intro' | 'stimulus' | 'response' | 'feedback' | 'done';

interface TrialData {
  axis: AxisName;
  valueA: number;
  valueB: number;
  isMatch: boolean;
}

export function Calibration({ onComplete, onExit }: CalibrationProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [trialIdx, setTrialIdx] = useState(0);
  const [trialData, setTrialData] = useState<TrialData | null>(null);
  const [results, setResults] = useState<TrialResult[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; error: number } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const generateTrial = useCallback((idx: number): TrialData => {
    const axis = CALIBRATION_AXES[Math.floor(idx / TRIALS_PER_AXIS)];
    const valueA = 0.1 + Math.random() * 0.8;
    const isMatch = Math.random() < 0.5;
    const tolerance = 0.2;
    let valueB: number;
    if (isMatch) {
      valueB = Math.max(0, Math.min(1, valueA + (Math.random() - 0.5) * tolerance * 0.5));
    } else {
      const diff = tolerance + Math.random() * 0.3;
      valueB = Math.max(0, Math.min(1, valueA + (Math.random() < 0.5 ? -diff : diff)));
    }
    return { axis, valueA, valueB, isMatch };
  }, []);

  const presentStimulus = useCallback(async (data: TrialData) => {
    const axis = data.axis;
    const def = AXES[axis];

    if (def.modality === 'auditory') {
      if (axis === 'pitch') {
        await playTone(data.valueA, 0.5, 0);
        await new Promise(r => setTimeout(r, 300));
        await playTone(data.valueB, 0.5, 0);
      } else if (axis === 'toneDuration') {
        await playTone(0.5, data.valueA, 0);
        await new Promise(r => setTimeout(r, 300));
        await playTone(0.5, data.valueB, 0);
      } else if (axis === 'timbre') {
        await playTone(0.5, 0.5, data.valueA);
        await new Promise(r => setTimeout(r, 300));
        await playTone(0.5, 0.5, data.valueB);
      }
    } else if (def.modality === 'visual') {
      await new Promise(r => setTimeout(r, 700));
    }

    startTimeRef.current = performance.now();
    setPhase('response');

    timerRef.current = window.setTimeout(() => {
      handleResponse('timeout');
    }, LATENCY_CAP_MS);
  }, []);

  const handleResponse = useCallback((response: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!trialData) return;

    const rt = performance.now() - startTimeRef.current;
    const isTimeout = response === 'timeout';
    const userResp = isTimeout ? 'timeout' : response;
    const correct = !isTimeout && ((response === 'match') === trialData.isMatch);
    const error = Math.abs(trialData.valueA - trialData.valueB);

    const result: TrialResult = {
      trialNumber: trialIdx,
      axisName: trialData.axis,
      stimulusA: { [trialData.axis]: trialData.valueA },
      stimulusB: { [trialData.axis]: trialData.valueB },
      userResponse: userResp,
      correct,
      reactionTimeMs: Math.round(rt),
      errorMargin: error,
    };

    setResults(prev => [...prev, result]);
    setFeedback({ correct, error });
    setPhase('feedback');
    playFeedbackTone(correct);

    if (sessionId) {
      logTrial(sessionId, result);
    }
  }, [trialData, trialIdx, sessionId]);

  const nextTrial = useCallback(() => {
    setFeedback(null);
    if (trialIdx + 1 >= TOTAL_TRIALS) {
      setPhase('done');
      return;
    }
    const nextIdx = trialIdx + 1;
    setTrialIdx(nextIdx);
    const data = generateTrial(nextIdx);
    setTrialData(data);
    setPhase('stimulus');
    presentStimulus(data);
  }, [trialIdx, generateTrial, presentStimulus]);

  const startCalibration = async () => {
    resumeAudio();
    const id = await createSession('calibration');
    setSessionId(id);
    const data = generateTrial(0);
    setTrialData(data);
    setTrialIdx(0);
    setResults([]);
    setPhase('stimulus');
    presentStimulus(data);
  };

  useEffect(() => {
    if (phase === 'done' && results.length > 0) {
      const axisThresholds: Partial<Record<AxisName, number>> = {};
      for (const axis of CALIBRATION_AXES) {
        const axisResults = results.filter(r => r.axisName === axis);
        if (axisResults.length > 0) {
          const errors = axisResults.map(r => r.errorMargin);
          const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
          axisThresholds[axis] = avgError;
        }
      }
      const correctCount = results.filter(r => r.correct).length;
      const avgRt = results.reduce((a, b) => a + b.reactionTimeMs, 0) / results.length;

      if (sessionId) {
        const axisErrors: Record<string, number> = {};
        for (const [k, v] of Object.entries(axisThresholds)) {
          axisErrors[k] = v ?? 0;
        }
        completeSession(sessionId, {
          startedAt: '',
          completedAt: null,
          totalTrials: results.length,
          correctTrials: correctCount,
          avgReactionTimeMs: avgRt,
          difficultyLevel: 0.5,
          axisErrors,
        });
      }

      onComplete({
        thresholds: axisThresholds,
        baselineAccuracy: correctCount / results.length,
        avgReactionTimeMs: avgRt,
      });
    }
  }, [phase, results, sessionId, onComplete]);

  const progress = (trialIdx / TOTAL_TRIALS) * 100;
  const currentAxis = trialData ? AXES[trialData.axis] : null;

  if (phase === 'intro') {
    return (
      <CalibrationIntro onStart={startCalibration} onExit={onExit} />
    );
  }

  if (phase === 'done') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-6">
          <Check className="w-8 h-8 text-cyan-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Calibration Complete</h2>
        <p className="text-slate-400 mb-8">Analyzing your perceptual thresholds...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Target className="w-4 h-4 text-cyan-400" />
          <span>Calibration</span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Trial {trialIdx + 1} of {TOTAL_TRIALS}</span>
          <span>{currentAxis?.label ?? ''}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-cyan-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Latency warning */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 mb-6">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs text-amber-300/80">
          Respond within {(LATENCY_CAP_MS / 1000).toFixed(1)}s — timeouts count as errors to prevent strategy formation.
        </span>
      </div>

      {/* Stimulus area */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="aspect-square rounded-2xl border border-white/5 bg-[#0d0d1a] overflow-hidden">
          <VisualStimulus
            params={trialData ? { [trialData.axis]: trialData.valueA } : {}}
            active={phase === 'stimulus' || phase === 'response'}
            label="Stimulus A"
          />
        </div>
        <div className="aspect-square rounded-2xl border border-white/5 bg-[#0d0d1a] overflow-hidden">
          <VisualStimulus
            params={trialData ? { [trialData.axis]: trialData.valueB } : {}}
            active={phase === 'stimulus' || phase === 'response'}
            label="Stimulus B"
          />
        </div>
      </div>

      {/* Response / Feedback */}
      {phase === 'response' && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleResponse('match')}
            className="flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/20 hover:scale-[1.02] transition-all"
          >
            <Check className="w-5 h-5" /> Same
          </button>
          <button
            onClick={() => handleResponse('different')}
            className="flex items-center justify-center gap-2 py-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold hover:bg-rose-500/20 hover:scale-[1.02] transition-all"
          >
            <X className="w-5 h-5" /> Different
          </button>
        </div>
      )}

      {phase === 'feedback' && feedback && (
        <div className="space-y-4">
          <div className={`flex items-center justify-center gap-3 py-4 rounded-xl border ${
            feedback.correct
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {feedback.correct ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
            <span className="text-lg font-semibold">
              {feedback.correct ? 'Correct' : 'Incorrect'}
            </span>
            <span className="text-sm opacity-70">
              Δ = {feedback.error.toFixed(3)}
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

      {phase === 'stimulus' && (
        <div className="text-center py-8 text-slate-500 text-sm">
          {currentAxis?.modality === 'auditory' ? 'Listen carefully...' : 'Observe the shapes...'}
        </div>
      )}
    </div>
  );
}

function CalibrationIntro({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-6">
          <Target className="w-8 h-8 text-cyan-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">Perceptual Calibration</h2>
        <p className="text-slate-400 leading-relaxed max-w-lg mx-auto">
          Before training, we measure your baseline discrimination thresholds across
          {CALIBRATION_AXES.length} sensory axes. You'll compare pairs of stimuli within
          the same axis and judge whether they're the same or different.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        <InfoRow num="1" text="Two stimuli appear sequentially or side by side" />
        <InfoRow num="2" text="Judge if they share the same underlying value" />
        <InfoRow num="3" text={`Respond within ${(LATENCY_CAP_MS / 1000).toFixed(1)}s — no time for reasoning`} />
        <InfoRow num="4" text={`${TOTAL_TRIALS} trials across ${CALIBRATION_AXES.length} axes`} />
      </div>

      <div className="flex gap-3">
        <button onClick={onExit} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-semibold hover:bg-cyan-500/30 transition-all"
        >
          <Play className="w-5 h-5" /> Start Calibration
        </button>
      </div>
    </div>
  );
}

function InfoRow({ num, text }: { num: string; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold shrink-0">
        {num}
      </span>
      <span className="text-slate-300 text-sm">{text}</span>
    </div>
  );
}
