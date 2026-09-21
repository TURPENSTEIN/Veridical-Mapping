import { supabase } from './supabase';
import type { SessionMode, TrialResult, SessionSummary } from '@/types';

export async function createSession(mode: SessionMode): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      mode,
      started_at: new Date().toISOString(),
      difficulty_level: 0.5,
    })
    .select('id')
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

export async function logTrial(sessionId: string, result: TrialResult): Promise<void> {
  await supabase.from('trials').insert({
    session_id: sessionId,
    trial_number: result.trialNumber,
    axis_name: result.axisName,
    stimulus_a: result.stimulusA,
    stimulus_b: result.stimulusB,
    user_response: result.userResponse,
    correct: result.correct,
    reaction_time_ms: result.reactionTimeMs,
    error_margin: result.errorMargin,
  });
}

export async function completeSession(
  sessionId: string,
  summary: Omit<SessionSummary, 'id' | 'mode'>,
): Promise<void> {
  await supabase
    .from('sessions')
    .update({
      completed_at: new Date().toISOString(),
      total_trials: summary.totalTrials,
      correct_trials: summary.correctTrials,
      avg_reaction_time_ms: summary.avgReactionTimeMs,
      difficulty_level: summary.difficultyLevel,
      axis_errors: summary.axisErrors,
    })
    .eq('id', sessionId);
}

export async function getRecentSessions(limit: number = 10): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    mode: row.mode,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    totalTrials: row.total_trials,
    correctTrials: row.correct_trials,
    avgReactionTimeMs: row.avg_reaction_time_ms,
    difficultyLevel: row.difficulty_level,
    axisErrors: row.axis_errors ?? {},
  }));
}
