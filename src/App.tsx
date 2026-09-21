import { useState } from 'react';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { Calibration } from '@/components/Calibration';
import { ModeA } from '@/components/ModeA';
import { ModeB } from '@/components/ModeB';
import { Results } from '@/components/Results';
import type { AppView, CalibrationResult } from '@/types';

interface LastSummary {
  totalTrials: number;
  correctTrials: number;
  avgReactionTimeMs: number;
  difficultyLevel: number;
  axisErrors: Record<string, number>;
  accuracy: number;
}

function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [lastSummary, setLastSummary] = useState<LastSummary | null>(null);
  const [lastMode, setLastMode] = useState<string | undefined>(undefined);

  const navigate = (v: AppView) => {
    setView(v);
  };

  const handleCalibrationComplete = (_result: CalibrationResult) => {
    setLastMode('calibration');
    setLastSummary(null);
    setView('results');
  };

  const handleModeAComplete = (summary: LastSummary) => {
    setLastMode('mode_a');
    setLastSummary(summary);
    setView('results');
  };

  const handleModeBComplete = (summary: LastSummary) => {
    setLastMode('mode_b');
    setLastSummary(summary);
    setView('results');
  };

  return (
    <div className="min-h-screen bg-[#070710] text-slate-200">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/3 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-amber-500/2 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Header onNavigate={navigate} currentView={view} />

        <main className="pt-16 md:pt-16 min-h-screen">
          {view === 'dashboard' && (
            <Dashboard onNavigate={(v) => navigate(v as AppView)} />
          )}
          {view === 'calibration' && (
            <Calibration
              onComplete={handleCalibrationComplete}
              onExit={() => navigate('dashboard')}
            />
          )}
          {view === 'mode_a' && (
            <ModeA
              onComplete={handleModeAComplete}
              onExit={() => navigate('dashboard')}
            />
          )}
          {view === 'mode_b' && (
            <ModeB
              onComplete={handleModeBComplete}
              onExit={() => navigate('dashboard')}
            />
          )}
          {view === 'results' && (
            <Results
              onExit={() => navigate('dashboard')}
              lastSummary={lastSummary}
              lastMode={lastMode}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
