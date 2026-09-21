import type { AxisName, StimulusParams, Stimulus } from '@/types';
import { AXES, MODE_A_PAIRS, CROSS_MODAL_MAP } from '@/types';

export function denormalize(axis: AxisName, value: number): number {
  const def = AXES[axis];
  return def.min + value * (def.max - def.min);
}

export function normalize(axis: AxisName, value: number): number {
  const def = AXES[axis];
  return (value - def.min) / (def.max - def.min);
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function randomNorm(): number {
  return Math.random();
}

export function randomAxisFromList(list: AxisName[]): AxisName {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateStimulusParams(
  axes: AxisName[],
  values?: Partial<Record<AxisName, number>>,
): StimulusParams {
  const params: StimulusParams = {};
  for (const axis of axes) {
    params[axis] = values?.[axis] ?? randomNorm();
  }
  return params;
}

export interface ModeATrial {
  axisA: AxisName;
  axisB: AxisName;
  valueA: number;
  valueB: number;
  isMatch: boolean;
  stimulusA: StimulusParams;
  stimulusB: StimulusParams;
}

export function generateModeATrial(difficulty: number): ModeATrial {
  const pairIdx = Math.floor(Math.random() * MODE_A_PAIRS.length);
  const [axisA, axisB] = MODE_A_PAIRS[pairIdx];

  const valueA = randomNorm();
  const isMatch = Math.random() < 0.5;

  const tolerance = 0.35 - difficulty * 0.25;
  let valueB: number;

  if (isMatch) {
    const noise = (Math.random() - 0.5) * tolerance * 0.6;
    valueB = clamp01(valueA + noise);
  } else {
    let diff = tolerance + Math.random() * (0.4 - tolerance * 0.5);
    if (Math.random() < 0.5) diff = -diff;
    valueB = clamp01(valueA + diff);
    if (Math.abs(valueB - valueA) < tolerance) {
      valueB = clamp01(valueA + (valueA > 0.5 ? -tolerance - 0.05 : tolerance + 0.05));
    }
  }

  return {
    axisA,
    axisB,
    valueA,
    valueB,
    isMatch,
    stimulusA: { [axisA]: valueA } as StimulusParams,
    stimulusB: { [axisB]: valueB } as StimulusParams,
  };
}

export interface ModeBTrial {
  targetAxis1: AxisName;
  targetAxis2: AxisName;
  mapAxis1: AxisName;
  mapAxis2: AxisName;
  value1: number;
  value2: number;
  stimulusA: StimulusParams;
}

export function generateModeBTrial(_difficulty: number): ModeBTrial {
  const targetAxis1: AxisName = 'pitch';
  const targetAxis2: AxisName = 'toneDuration';
  const mapAxis1 = CROSS_MODAL_MAP[targetAxis1];
  const mapAxis2 = CROSS_MODAL_MAP[targetAxis2];

  const value1 = 0.15 + Math.random() * 0.7;
  const value2 = 0.15 + Math.random() * 0.7;

  return {
    targetAxis1,
    targetAxis2,
    mapAxis1,
    mapAxis2,
    value1,
    value2,
    stimulusA: { pitch: value1, toneDuration: value2 } as StimulusParams,
  };
}

export function errorMargin(a: number, b: number): number {
  return Math.abs(a - b);
}

export function getStimulusModality(axes: AxisName[]): Stimulus['modality'] {
  const mods = axes.map((a) => AXES[a].modality);
  if (mods.every((m) => m === 'auditory')) return 'auditory';
  if (mods.every((m) => m === 'visual')) return 'visual';
  if (mods.every((m) => m === 'temporal')) return 'temporal';
  return 'visual';
}
