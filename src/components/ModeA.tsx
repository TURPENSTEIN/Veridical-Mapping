import { useCallback, useEffect, useRef, useState } from 'react';
import { Zap, Play, Check, X, ArrowLeft, AlertTriangle, Volume2, Eye } from 'lucide-react';
import type { TrialResult } from '@/types';
import { AXES, MODE_A_PAIRS } from '@/types';
import { generateModeATrial, type ModeATrial } from '@/lib/stimulus';
import { playTone, playTempo, playFeedbackTone, resumeAudio } from '@/lib/audio';
import { VisualStimulus } from './VisualStimulus';
import { createSession, logTrial, completeSession } from '@/lib/session';
import { createAdaptiveState, updateAdaptive, getAxisErrorRates, getAccuracy, type AdaptiveState } from '@/lib/adaptive';

interface ModeAProps {
  onComplete: (summary: ModeASummary) => void;
  onExit: () => void;
}

export interface ModeASummary {
  totalTrials: number;
  correctTrials: number;
  avgReactionTimeMs: number;
  difficultyLevel: number;
  axisErrors: Record<string, number>;
  accuracy: number;
}

const TOTAL_TRIALS = 20;
const LATENCY_CAP_MS = 1500;

type Phase = 'intro' | 'stimulus' | 'response' | 'feedback' | 'done';

export function ModeA({ onComplete, onExit }: ModeAProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [trialIdx, setTrialIdx] = useState(0);
  const [trial, setTrial] = useState<ModeATrial | null>(null);
  const [results, setResults] = useState<TrialResult[]>([]);
  const [adaptive, setAdaptive] = useState<AdaptiveState>(createAdaptiveState());
  const [feedback, setFeedback] = useState<{ correct: boolean; error: number; axisA: string; axisB: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const presentStimulus = useCallback(async (data: ModeATrial) => {
    const defA = AXES[data.axisA];
    const defB = AXES[data.axisB];

    // Present stimulus A
    if (defA.modality === 'auditory') {
      if (data.axisA === 'pitch') {
        await playTone(data.valueA, 0.5, 0);
      } else if (data.axisA === 'toneDuration') {
        await playTone(0.5, data.valueA, 0);
      } else if (data.axisA === 'timbre') {
        await playTone(0.5, 0.5, data.valueA);
      }
    } else if (defA.modality === 'temporal') {
      if (data.axisA === 'tempo') {
        await playTempo(data.valueA, 0.5, 3);
      } else if (data.axisA === 'interval') {
        await playTempo(0.5, data.valueA, 3);
      }
    } else {
      await new Promise(r => setTimeout(r, 700));
    }

    await new Promise(r => setTimeout(r, 250));

    // Present stimulus B
    if (defB.modality === 'auditory') {
      if (data.axisB === 'pitch') {
        await playTone(data.valueB, 0.5, 0);
      } else if (data.axisB === 'toneDuration') {
        await playTone(0.5, data.valueB, 0);
      } else if (data.axisB === 'timbre') {
        await playTone(0.5, 0.5, data.valueB);
      }
    } else if (defB.modality === 'temporal') {
      if (data.axisB === 'tempo') {
        await playTempo(data.valueB, 0.5, 3);
      } else if (data.axisB === 'interval') {
        await playTempo(0.5, data.valueB, 3);
      }
    } else {
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
    if (!trial) return;

    const rt = performance.now() - startTimeRef.current;
    const isTimeout = response === 'timeout';
    const userResp = isTimeout ? 'timeout' : response;
    const correct = !isTimeout && ((response === 'match') === trial.isMatch);
    const error = Math.abs(trial.valueA - trial.valueB);

    const result: TrialResult = {
      trialNumber: trialIdx,
      axisName: trial.axisA,
      stimulusA: trial.stimulusA,
      stimulusB: trial.stimulusB,
      userResponse: userResp,
      correct,
      reactionTimeMs: Math.round(rt),
      errorMargin: error,
    };

    setResults(prev => [...prev, result]);
    setFeedback({ correct, error, axisA: AXES[trial.axisA].label, axisB: AXES[trial.axisB].label });
    setPhase('feedback');
    playFeedbackTone(correct);

    const newAdaptive = updateAdaptive(adaptive, correct, trial.axisA, error);
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
    const data = generateModeATrial(adaptive.difficulty);
    setTrial(data);
    setPhase('stimulus');
    presentStimulus(data);
  }, [trialIdx, adaptive.difficulty, presentStimulus]);

  const startMode = async () => {
    resumeAudio();
    const id = await createSession('mode_a');
    setSessionId(id);
    const data = generateModeATrial(0.5);
    setTrial(data);
    setTrialIdx(0);
    setResults([]);
    setAdaptive(createAdaptiveState());
    setPhase('stimulus');
    presentStimulus(data);
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

  const progress = (trialIdx / TOTAL_TRIALS) * 100;
  const accuracy = getAccuracy(adaptive) * 100;

  if (phase === 'intro') {
    return <ModeAIntro onStart={startMode} onExit={onExit} />;
  }

  if (phase === 'done') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-6">
          <Check className="w-8 h-8 text-amber-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Session Complete</h2>
        <p className="text-slate-400">Computing your results...</p>
      </div>
    );
  }

  const defA = trial ? AXES[trial.axisA] : null;
  const defB = trial ? AXES[trial.axisB] : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Equivalence</span>
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
          <span>{defA?.label} ↔ {defB?.label}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Latency warning */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 mb-6">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs text-amber-300/80">
          {(LATENCY_CAP_MS / 1000).toFixed(1)}s response cap — trust your intuition, don't reason it out.
        </span>
      </div>

      {/* Stimulus area */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="aspect-square rounded-2xl border border-white/5 bg-[#0d0d1a] overflow-hidden relative">
          {defA?.modality === 'auditory' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Volume2 className={`w-12 h-12 transition-all duration-200 ${phase === 'stimulus' ? 'text-amber-400 scale-110' : 'text-slate-700'}`} strokeWidth={1.5} />
              <span className="text-xs text-slate-500">{phase === 'stimulus' ? 'Listening...' : 'Stimulus A'}</span>
            </div>
          )}
          {defA?.modality === 'temporal' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className={`w-3 h-3 rounded-full transition-all ${phase === 'stimulus' ? 'bg-amber-400 animate-ping' : 'bg-slate-700'}`} />
              <span className="text-xs text-slate-500">{phase === 'stimulus' ? 'Pulses...' : 'Stimulus A'}</span>
            </div>
          )}
          {defA?.modality === 'visual' && (
            <VisualStimulus
              params={trial ? trial.stimulusA : {}}
              active={phase === 'stimulus' || phase === 'response'}
              label="Stimulus A"
            />
          )}
        </div>
        <div className="aspect-square rounded-2xl border border-white/5 bg-[#0d0d1a] overflow-hidden relative">
          {defB?.modality === 'auditory' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Volume2 className={`w-12 h-12 transition-all duration-200 ${phase === 'stimulus' ? 'text-amber-400 scale-110' : 'text-slate-700'}`} strokeWidth={1.5} />
              <span className="text-xs text-slate-500">{phase === 'stimulus' ? 'Listening...' : 'Stimulus B'}</span>
            </div>
          )}
          {defB?.modality === 'temporal' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className={`w-3 h-3 rounded-full transition-all ${phase === 'stimulus' ? 'bg-amber-400 animate-ping' : 'bg-slate-700'}`} />
              <span className="text-xs text-slate-500">{phase === 'stimulus' ? 'Pulses...' : 'Stimulus B'}</span>
            </div>
          )}
          {defB?.modality === 'visual' && (
            <VisualStimulus
              params={trial ? trial.stimulusB : {}}
              active={phase === 'stimulus' || phase === 'response'}
              label="Stimulus B"
            />
          )}
        </div>
      </div>

      {/* Response / Feedback */}
      {phase === 'response' && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleResponse('match')}
            className="flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/20 hover:scale-[1.02] transition-all"
          >
            <Check className="w-5 h-5" /> Equivalent
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
              {feedback.axisA} = {feedback.axisB} · Δ = {feedback.error.toFixed(3)}
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
          Cross-modal comparison in progress...
        </div>
      )}
    </div>
  );
}

function ModeAIntro({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-6">
          <Zap className="w-8 h-8 text-amber-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">Cross-Modal Equivalence</h2>
        <p className="text-slate-400 leading-relaxed max-w-lg mx-auto">
          Two stimuli from different sensory modalities are presented sequentially.
          Determine whether they share the same underlying quantitative parameter —
          for example, a high-pitched tone and a high-contrast shape.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {MODE_A_PAIRS.slice(0, 6).map(([a, b]) => (
          <div key={`${a}-${b}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs">
            <span className="text-amber-400">{AXES[a].label}</span>
            <span className="text-slate-600">↔</span>
            <span className="text-cyan-400">{AXES[b].label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-8">
        <InfoRow icon={Volume2} text="Stimulus A plays (audio or visual)" />
        <InfoRow icon={Eye} text="Stimulus B follows in a different modality" />
        <InfoRow icon={Check} text="Judge: do they share the same value?" />
        <InfoRow icon={AlertTriangle} text={`Respond within ${(LATENCY_CAP_MS / 1000).toFixed(1)}s — no reasoning`} />
      </div>

      <div className="flex gap-3">
        <button onClick={onExit} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold hover:bg-amber-500/30 transition-all"
        >
          <Play className="w-5 h-5" /> Start Training
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5">
      <Icon className="w-4 h-4 text-amber-400 shrink-0" strokeWidth={1.5} />
      <span className="text-slate-300 text-sm">{text}</span>
    </div>
  );
}
