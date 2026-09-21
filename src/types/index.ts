export type Modality = 'auditory' | 'visual' | 'temporal';

export type AxisName =
  | 'pitch'
  | 'toneDuration'
  | 'timbre'
  | 'size'
  | 'height'
  | 'roundness'
  | 'contrast'
  | 'luminance'
  | 'saturation'
  | 'hue'
  | 'position'
  | 'flicker'
  | 'interval'
  | 'tempo';

export interface AxisDef {
  name: AxisName;
  label: string;
  modality: Modality;
  min: number;
  max: number;
  description: string;
}

export type StimulusParams = Partial<Record<AxisName, number>>;

export interface Stimulus {
  modality: Modality;
  params: StimulusParams;
}

export type SessionMode = 'calibration' | 'mode_a' | 'mode_b';

export interface TrialResult {
  trialNumber: number;
  axisName: AxisName | null;
  stimulusA: StimulusParams;
  stimulusB: StimulusParams;
  userResponse: string;
  correct: boolean;
  reactionTimeMs: number;
  errorMargin: number;
}

export interface SessionSummary {
  id?: string;
  mode: SessionMode;
  startedAt: string;
  completedAt: string | null;
  totalTrials: number;
  correctTrials: number;
  avgReactionTimeMs: number | null;
  difficultyLevel: number;
  axisErrors: Record<string, number>;
}

export interface CalibrationResult {
  thresholds: Partial<Record<AxisName, number>>;
  baselineAccuracy: number;
  avgReactionTimeMs: number;
}

export type AppView = 'dashboard' | 'calibration' | 'mode_a' | 'mode_b' | 'results';

export const AXES: Record<AxisName, AxisDef> = {
  pitch: {
    name: 'pitch',
    label: 'Pitch',
    modality: 'auditory',
    min: 80,
    max: 1200,
    description: 'Tone frequency — low to high',
  },
  toneDuration: {
    name: 'toneDuration',
    label: 'Tone Duration',
    modality: 'auditory',
    min: 200,
    max: 1800,
    description: 'How long the tone sounds',
  },
  timbre: {
    name: 'timbre',
    label: 'Timbre',
    modality: 'auditory',
    min: 0,
    max: 3,
    description: 'Waveform shape — smooth to rich',
  },
  size: {
    name: 'size',
    label: 'Size',
    modality: 'visual',
    min: 20,
    max: 120,
    description: 'Spatial extent — small to large',
  },
  height: {
    name: 'height',
    label: 'Height',
    modality: 'visual',
    min: 0,
    max: 1,
    description: 'Vertical position — low to high (SMARC)',
  },
  roundness: {
    name: 'roundness',
    label: 'Roundness',
    modality: 'visual',
    min: 0,
    max: 1,
    description: 'Curvature — angular to circular',
  },
  contrast: {
    name: 'contrast',
    label: 'Contrast',
    modality: 'visual',
    min: 0.1,
    max: 1,
    description: 'Light-dark difference',
  },
  luminance: {
    name: 'luminance',
    label: 'Luminance',
    modality: 'visual',
    min: 0.15,
    max: 0.95,
    description: 'Brightness — dim to bright',
  },
  saturation: {
    name: 'saturation',
    label: 'Saturation',
    modality: 'visual',
    min: 0,
    max: 1,
    description: 'Color intensity — gray to vivid',
  },
  hue: {
    name: 'hue',
    label: 'Hue',
    modality: 'visual',
    min: 0,
    max: 360,
    description: 'Color — red through green to blue',
  },
  position: {
    name: 'position',
    label: 'Position',
    modality: 'visual',
    min: 0,
    max: 1,
    description: 'Horizontal position — left to right',
  },
  flicker: {
    name: 'flicker',
    label: 'Flicker',
    modality: 'visual',
    min: 0,
    max: 12,
    description: 'Flicker frequency — still to rapid',
  },
  interval: {
    name: 'interval',
    label: 'Time Interval',
    modality: 'temporal',
    min: 300,
    max: 2000,
    description: 'Duration between pulses',
  },
  tempo: {
    name: 'tempo',
    label: 'Tempo',
    modality: 'temporal',
    min: 60,
    max: 240,
    description: 'Pulse frequency — slow to fast',
  },
};

export const AXIS_LIST = Object.values(AXES);

export const CROSS_MODAL_MAP: Record<AxisName, AxisName> = {
  pitch: 'height',
  height: 'pitch',
  toneDuration: 'size',
  size: 'toneDuration',
  contrast: 'pitch',
  timbre: 'roundness',
  roundness: 'timbre',
  luminance: 'toneDuration',
  interval: 'size',
  tempo: 'flicker',
  flicker: 'tempo',
  saturation: 'timbre',
  hue: 'pitch',
  position: 'pitch',
};

export const MODE_A_PAIRS: Array<[AxisName, AxisName]> = [
  ['pitch', 'height'],
  ['toneDuration', 'size'],
  ['contrast', 'luminance'],
  ['roundness', 'timbre'],
  ['tempo', 'flicker'],
  ['interval', 'size'],
];
