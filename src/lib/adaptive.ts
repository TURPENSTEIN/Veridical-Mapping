import type { AxisName } from '@/types';

export interface AdaptiveState {
  difficulty: number;
  recentAccuracy: boolean[];
  axisErrors: Record<string, number>;
  axisCounts: Record<string, number>;
}

export function createAdaptiveState(): AdaptiveState {
  return {
    difficulty: 0.5,
    recentAccuracy: [],
    axisErrors: {},
    axisCounts: {},
  };
}

export function updateAdaptive(
  state: AdaptiveState,
  correct: boolean,
  axis: AxisName | null,
  error: number,
): AdaptiveState {
  const recent = [...state.recentAccuracy, correct].slice(-10);
  const accuracy = recent.filter(Boolean).length / recent.length;

  let newDifficulty = state.difficulty;
  if (recent.length >= 5) {
    if (accuracy > 0.9) {
      newDifficulty = Math.min(1, state.difficulty + 0.04);
    } else if (accuracy < 0.75) {
      newDifficulty = Math.max(0.1, state.difficulty - 0.05);
    }
  }

  const axisErrors = { ...state.axisErrors };
  const axisCounts = { ...state.axisCounts };
  if (axis) {
    const key = axis;
    axisCounts[key] = (axisCounts[key] ?? 0) + 1;
    const prevTotal = axisErrors[key] ?? 0;
    axisErrors[key] = prevTotal + error;
  }

  return {
    difficulty: newDifficulty,
    recentAccuracy: recent,
    axisErrors,
    axisCounts,
  };
}

export function getAxisErrorRates(state: AdaptiveState): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const key of Object.keys(state.axisCounts)) {
    const total = state.axisErrors[key] ?? 0;
    const count = state.axisCounts[key] ?? 1;
    rates[key] = total / count;
  }
  return rates;
}

export function getAccuracy(state: AdaptiveState): number {
  if (state.recentAccuracy.length === 0) return 0;
  return state.recentAccuracy.filter(Boolean).length / state.recentAccuracy.length;
}
