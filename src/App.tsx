import React, { useState, useEffect } from 'react';
import { GameState, LevelConfig, LevelProgress, Achievement, GameSettings } from './types';
import { getLevel } from './components/LevelData';
import GameCanvas from './components/GameCanvas';
import GameUI from './components/GameUI';
import { audio } from './components/AudioEngine';
import { Sparkles, Trophy, Settings, Music, VolumeX, Grid3X3, RefreshCw, Star, Info } from 'lucide-react';

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_clear', title: 'First Quantum Leap', description: 'Complete the very first zone safely.', icon: '🦊', unlocked: false },
  { id: 'coin_hoarder', title: 'Gilded Hoarder', description: 'Collect 50 or more total coins in your saves.', icon: '🪙', unlocked: false },
  { id: 'all_stars', title: 'Star Gatherer', description: 'Collect all 3 star coins in any single level.', icon: '⭐', unlocked: false },
  { id: 'immortal', title: 'Chronos Survivor', description: 'Beat any level from Level 2+ without losing a single life.', icon: '🛡️', unlocked: false },
  { id: 'speedrun', title: 'Warp Speed', description: 'Beat any level within 60 seconds of starting.', icon: '⚡', unlocked: false },
  { id: 'completionist', title: 'Nostalgic Master', description: 'Conquer all 100 time-warped levels of Nostalgic Mario.', icon: '🏆', unlocked: false }
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [currentLevelId, setCurrentLevelId] = useState<number>(1);
  const [unlockedLevelId, setUnlockedLevelId] = useState<number>(1);
  const [progress, setProgress] = useState<LevelProgress[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  
  const [settings, setSettings] = useState<GameSettings>({
    musicVolume: 0.8,
    sfxVolume: 1.0,
    controlsType: 'onscreen',
    touchLayout: 'standard',
    sprintButton: true,
    highGraphics: true
  });

  // Current active play-session stats (pushed from canvas)
  const [activeStats, setActiveStats] = useState({ score: 0, coins: 0, lives: 5 });
  const [activeLevelConfig, setActiveLevelConfig] = useState<LevelConfig | undefined>(undefined);
  const [completedStats, setCompletedStats] = useState<{ score: number; coins: number; starsCollected: number; timeSpent: number } | undefined>(undefined);

  // Load state from local storage on mount
  useEffect(() => {
    // 1. Progress
    const savedProgress = localStorage.getItem('nostalgic_mario_progress');
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress) as LevelProgress[];
        setProgress(parsed);
        // Find highest completed level + 1
        const maxCompleted = parsed.reduce((max, curr) => curr.completed && curr.levelId > max ? curr.levelId : max, 0);
        setUnlockedLevelId(Math.max(1, Math.min(100, maxCompleted + 1)));
      } catch (e) {
        setProgress([]);
      }
    } else {
      setProgress([]);
    }

    // 2. Achievements
    const savedAchievements = localStorage.getItem('nostalgic_mario_achievements');
    if (savedAchievements) {
      try {
        const parsed = JSON.parse(savedAchievements) as Achievement[];
        // Merge saved unlocked state with initial metadata to support updates
        const merged = INITIAL_ACHIEVEMENTS.map(initial => {
          const match = parsed.find(p => p.id === initial.id);
          return match ? { ...initial, unlocked: match.unlocked, unlockedAt: match.unlockedAt } : initial;
        });
        setAchievements(merged);
      } catch (e) {
        setAchievements(INITIAL_ACHIEVEMENTS);
      }
    } else {
      setAchievements(INITIAL_ACHIEVEMENTS);
    }

    // 3. Settings
    const savedSettings = localStorage.getItem('nostalgic_mario_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings) as GameSettings;
        setSettings({
          musicVolume: 0.8,
          sfxVolume: 1.0,
          controlsType: 'onscreen',
          touchLayout: 'standard',
          sprintButton: true,
          highGraphics: true,
          ...parsed
        });
        audio.setMute('music', parsed.musicVolume === 0);
        audio.setMute('sfx', parsed.sfxVolume === 0);
      } catch (e) {}
    }
  }, []);

  // Update background audio when state changes
  useEffect(() => {
    if (gameState === 'playing') {
      audio.startMusic();
    } else if (gameState !== 'paused') {
      audio.stopMusic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Save Progress to localStorage
  const saveProgress = (newProgress: LevelProgress[]) => {
    setProgress(newProgress);
    localStorage.setItem('nostalgic_mario_progress', JSON.stringify(newProgress));
    const maxCompleted = newProgress.reduce((max, curr) => curr.completed && curr.levelId > max ? curr.levelId : max, 0);
    setUnlockedLevelId(Math.max(1, Math.min(100, maxCompleted + 1)));
  };

  // Save Achievements to localStorage
  const saveAchievements = (newAchievements: Achievement[]) => {
    setAchievements(newAchievements);
    localStorage.setItem('nostalgic_mario_achievements', JSON.stringify(newAchievements));
  };

  // Save Settings
  const saveSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    localStorage.setItem('nostalgic_mario_settings', JSON.stringify(newSettings));
  };

  // Unlock an achievement
  const unlockAchievement = (id: string) => {
    const updated = achievements.map(ach => {
      if (ach.id === id && !ach.unlocked) {
        audio.playPowerup();
        return { ...ach, unlocked: true, unlockedAt: new Date().toLocaleDateString() };
      }
      return ach;
    });
    saveAchievements(updated);
  };

  const handleStartGame = () => {
    // Start highest unlocked level
    handleSelectLevel(unlockedLevelId);
  };

  const handleSelectLevel = (levelId: number) => {
    const config = getLevel(levelId);
    setCurrentLevelId(levelId);
    setActiveLevelConfig(config);
    setActiveStats({ score: 0, coins: 0, lives: 10 });
    setGameState('playing');
  };

  const handleStatsUpdate = (coins: number, lives: number, score: number) => {
    setActiveStats({ coins, lives, score });
  };

  const handleLevelComplete = (gainedScore: number, coinsGained: number, starsCollected: number, timeSpent: number) => {
    // 1. Calculate overall star rating (1-3 stars)
    let finalStars = 1; // 1 star for completion
    if (coinsGained >= 15) finalStars = 2; // 2 stars for coin collections
    if (starsCollected === 3) finalStars = 3; // 3 stars for finding all 3 star-coins

    // 2. Record record progress
    const existing = progress.find(p => p.levelId === currentLevelId);
    const goldMedal = timeSpent <= 90; // gold medal if beat under 1.5 mins

    const record: LevelProgress = {
      levelId: currentLevelId,
      completed: true,
      highScore: Math.max(existing?.highScore || 0, gainedScore),
      stars: Math.max(existing?.stars || 0, finalStars),
      bestTime: existing?.bestTime ? Math.min(existing.bestTime, timeSpent) : timeSpent,
      goldMedal: existing?.goldMedal || goldMedal
    };

    const newProgress = [...progress.filter(p => p.levelId !== currentLevelId), record];
    saveProgress(newProgress);

    // 3. Set Stats for screen
    setCompletedStats({
      score: gainedScore,
      coins: coinsGained,
      starsCollected,
      timeSpent
    });

    // 4. Trigger achievements checks
    checkAchievements(currentLevelId, coinsGained, starsCollected, timeSpent, activeStats.lives);

    // 5. Change state
    setGameState('level-complete');
  };

  const checkAchievements = (levelId: number, coins: number, stars: number, time: number, finalLives: number) => {
    if (levelId === 1) {
      unlockAchievement('first_clear');
    }

    // Accumulate total coins across completed levels
    const totalCoins = progress.reduce((acc, curr) => acc + curr.highScore * 0.1, 0) + coins;
    if (totalCoins >= 50) {
      unlockAchievement('coin_hoarder');
    }

    if (stars === 3) {
      unlockAchievement('all_stars');
    }

    if (levelId >= 2 && finalLives === 10) {
      unlockAchievement('immortal');
    }

    if (time <= 60) {
      unlockAchievement('speedrun');
    }

    // Check if level 100 is conquered
    if (levelId === 100) {
      unlockAchievement('completionist');
    }
  };

  const handleRestartLevel = () => {
    handleSelectLevel(currentLevelId);
  };

  const handleNextLevel = () => {
    const nextId = currentLevelId + 1;
    if (nextId <= 100) {
      handleSelectLevel(nextId);
    } else {
      setGameState('level-select'); // Completed all levels!
    }
  };

  const handleGameOver = () => {
    setGameState('game-over');
  };

  const handleToggleMute = (type: 'music' | 'sfx') => {
    const isMuted = audio.toggleMute(type);
    const vol = isMuted ? 0 : 1.0;
    const updated = { ...settings, [type === 'music' ? 'musicVolume' : 'sfxVolume']: vol };
    saveSettings(updated);
  };

  const handleUpdateSettings = (partial: Partial<GameSettings>) => {
    const updated = { ...settings, ...partial };
    saveSettings(updated);
  };

  const handleResetProgress = () => {
    localStorage.removeItem('nostalgic_mario_progress');
    localStorage.removeItem('nostalgic_mario_achievements');
    setProgress([]);
    setUnlockedLevelId(1);
    setAchievements(INITIAL_ACHIEVEMENTS);
  };

  const isCurrentlyInGame = ['playing', 'paused', 'game-over', 'level-complete'].includes(gameState);

  if (isCurrentlyInGame && activeLevelConfig) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#020617] overflow-hidden select-none z-50 flex items-center justify-center p-0 m-0">
        <div className="w-full h-full relative flex items-center justify-center">
          <GameCanvas
            level={activeLevelConfig}
            isPaused={gameState !== 'playing'}
            onLevelComplete={handleLevelComplete}
            onGameOver={handleGameOver}
            onStatsUpdate={handleStatsUpdate}
            highGraphics={settings.highGraphics}
            settings={settings}
            onPauseToggle={() => setGameState('paused')}
          />
          
          {gameState !== 'playing' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-40 flex items-center justify-center p-4 overflow-y-auto">
              <div className="w-full max-w-xl">
                <GameUI
                  gameState={gameState}
                  unlockedLevelId={unlockedLevelId}
                  progress={progress}
                  achievements={achievements}
                  settings={settings}
                  currentLevelIndex={currentLevelId}
                  onSelectLevel={handleSelectLevel}
                  onStartGame={handleStartGame}
                  onSetState={setGameState}
                  onResetProgress={handleResetProgress}
                  onToggleMute={handleToggleMute}
                  onUpdateSettings={handleUpdateSettings}
                  activeStats={activeStats}
                  activeLevelConfig={activeLevelConfig}
                  completedStats={completedStats}
                  onNextLevel={handleNextLevel}
                  onRestartLevel={handleRestartLevel}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-2 md:p-6 font-sans antialiased selection:bg-cyan-500/30 selection:text-white relative overflow-y-auto">
      
      {/* Immersive background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Main console frame */}
      <div className="w-full max-w-6xl bg-slate-950/40 border border-white/5 rounded-[32px] backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative z-10">
        
        {/* TOP HUD NAV BAR */}
        <nav className="h-20 w-full flex items-center justify-between px-6 md:px-10 border-b border-white/5 backdrop-blur-xl bg-slate-950/40 z-50 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-bold tracking-tighter uppercase italic leading-none">
                Nostalgic <span className="text-cyan-400">Mario</span>
              </h1>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">Aki's Chrono-Escape</span>
            </div>
          </div>
          
          {/* Dynamic HUD Counters */}
          <div className="flex items-center gap-6 md:gap-12">
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">World</span>
              <span className="text-sm md:text-lg font-mono font-bold">
                {gameState === 'playing' ? `04 — ${String(currentLevelId).padStart(2, '0')}` : `-- — --`}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Essence</span>
              <span className="text-sm md:text-lg font-mono font-bold text-amber-400">
                {gameState === 'playing' ? activeStats.coins : progress.reduce((acc, curr) => acc + (curr.completed ? curr.highScore * 0.1 : 0), 0).toFixed(0)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Battery</span>
              <span className="text-sm md:text-lg font-mono font-bold text-cyan-400">
                {gameState === 'playing' ? `${activeStats.lives} HP` : '100%'}
              </span>
            </div>
          </div>

          {/* Right Controls Actions */}
          <div className="flex items-center gap-3 md:gap-4">
            <div className="hidden sm:flex h-10 w-28 bg-white/5 rounded-full border border-white/10 items-center px-4 gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Live Engine</span>
            </div>

            {/* Home/Back button */}
            {gameState !== 'menu' && (
              <button
                onClick={() => {
                  setGameState('menu');
                  audio.playJump();
                }}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/20 flex items-center justify-center transition-colors cursor-pointer text-sm"
                title="Return to Menu"
              >
                🏠
              </button>
            )}
            
            <button
              onClick={() => {
                setGameState(gameState === 'paused' ? 'playing' : 'paused');
                audio.playJump();
              }}
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/20 flex items-center justify-center transition-colors cursor-pointer text-sm"
              title="Configure Preferences"
              id="hud-settings-btn"
            >
              ⚙️
            </button>
          </div>
        </nav>

        {/* MAIN PANEL VIEWPORT SPLIT */}
        <main className={`flex-1 relative flex flex-col lg:flex-row overflow-hidden gap-6 ${gameState === 'playing' ? 'p-1.5 sm:p-4 md:p-6' : 'p-4 md:p-6'}`}>
          
          {/* Left Sidebar: Character Profile / Cyber Loadout */}
          <div className={`w-full lg:w-72 bg-slate-900/40 border border-white/10 rounded-3xl backdrop-blur-2xl p-5 flex flex-col justify-between gap-4 z-40 ${gameState === 'playing' ? 'hidden lg:flex' : 'flex'}`}>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 block mb-4 font-bold">Character Loadout</span>
              
              {/* Character Profile card */}
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 relative">
                  <span className="text-2xl animate-bounce">🦊</span>
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-tight text-white">Aether</p>
                  <p className="text-[10px] text-cyan-400 font-semibold uppercase">Kinetic Specialist</p>
                </div>
              </div>

              {/* Stats parameters */}
              <div className="space-y-4 pt-4">
                <div className="h-[1px] bg-white/10"></div>
                
                <div className="flex justify-between text-[11px] font-semibold uppercase font-mono">
                  <span className="text-slate-400">Fox Agility</span>
                  <span className="text-white">88%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-[88%] bg-cyan-500 rounded-full"></div>
                </div>

                <div className="flex justify-between text-[11px] font-semibold uppercase font-mono">
                  <span className="text-slate-400">Grav-Leap</span>
                  <span className="text-white">94%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-[94%] bg-purple-500 rounded-full"></div>
                </div>

                <div className="flex justify-between text-[11px] font-semibold uppercase font-mono">
                  <span className="text-slate-400">Shield Battery</span>
                  <span className="text-white">
                    {gameState === 'playing' ? `${activeStats.lives * 20}%` : '100%'}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: gameState === 'playing' ? `${activeStats.lives * 20}%` : '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Context Dependent Sidebar Action Button */}
            <button
              onClick={() => {
                if (gameState === 'playing') {
                  setGameState('paused');
                } else if (gameState === 'paused') {
                  setGameState('playing');
                } else if (gameState === 'menu') {
                  handleStartGame();
                } else if (gameState === 'level-select') {
                  handleStartGame();
                } else {
                  setGameState('menu');
                }
                audio.playJump();
              }}
              className="w-full py-3.5 bg-white text-slate-950 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-cyan-400 transition-colors cursor-pointer text-center"
              id="sidebar-action-btn"
            >
              {gameState === 'playing' && 'Pause Game'}
              {gameState === 'paused' && 'Resume Game'}
              {gameState === 'menu' && 'Start Adventure'}
              {gameState === 'level-select' && 'Play Selected'}
              {gameState === 'game-over' && 'Back To Menu'}
              {gameState === 'level-complete' && 'Continue Play'}
              {gameState === 'achievements' && 'Return Home'}
            </button>
          </div>

          {/* Center Display: Primary Game Area */}
          <div className={`flex-1 flex items-center justify-center relative ${gameState === 'playing' ? 'min-h-[300px] xs:min-h-[360px] sm:min-h-[440px] md:min-h-[500px] lg:min-h-[550px]' : 'min-h-[350px] md:min-h-[450px]'}`}>
            <div className={`w-full h-full border border-white/10 overflow-hidden shadow-2xl relative bg-slate-950 ${gameState === 'playing' ? 'rounded-2xl sm:rounded-[32px]' : 'rounded-[32px]'}`}>
              {gameState === 'playing' && activeLevelConfig ? (
                <GameCanvas
                  level={activeLevelConfig}
                  isPaused={gameState === 'paused'}
                  onLevelComplete={handleLevelComplete}
                  onGameOver={handleGameOver}
                  onStatsUpdate={handleStatsUpdate}
                  highGraphics={settings.highGraphics}
                  settings={settings}
                  onPauseToggle={() => setGameState('paused')}
                />
              ) : (
                <GameUI
                  gameState={gameState}
                  unlockedLevelId={unlockedLevelId}
                  progress={progress}
                  achievements={achievements}
                  settings={settings}
                  currentLevelIndex={currentLevelId}
                  onSelectLevel={handleSelectLevel}
                  onStartGame={handleStartGame}
                  onSetState={setGameState}
                  onResetProgress={handleResetProgress}
                  onToggleMute={handleToggleMute}
                  onUpdateSettings={handleUpdateSettings}
                  activeStats={activeStats}
                  activeLevelConfig={activeLevelConfig}
                  completedStats={completedStats}
                  onNextLevel={handleNextLevel}
                  onRestartLevel={handleRestartLevel}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar: Level Grid Quick selection Nodes */}
          <div className={`w-full lg:w-24 flex lg:flex-col gap-3 justify-center items-center z-40 overflow-x-auto lg:overflow-y-auto max-h-[140px] lg:max-h-[500px] p-1 ${gameState === 'playing' ? 'hidden lg:flex' : 'flex'}`}>
            {(() => {
              // Show 5 levels centered around currentLevelId, bounded by [1, 100]
              let start = Math.max(1, currentLevelId - 2);
              if (start + 4 > 100) {
                start = 96;
              }
              return Array.from({ length: 5 }).map((_, idx) => {
                const targetLvlId = start + idx;
                const isUnlocked = targetLvlId <= unlockedLevelId;
                const isActive = targetLvlId === currentLevelId && gameState === 'playing';
                
                return (
                  <button
                    key={targetLvlId}
                    disabled={!isUnlocked}
                    onClick={() => {
                      handleSelectLevel(targetLvlId);
                      audio.playJump();
                    }}
                    className={`w-14 h-14 lg:w-20 lg:h-20 rounded-2xl flex flex-col items-center justify-center gap-0.5 backdrop-blur-xl transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-white scale-105'
                        : isUnlocked
                        ? 'bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-slate-100 hover:scale-105 cursor-pointer'
                        : 'bg-slate-950/40 border border-white/5 opacity-40 grayscale cursor-not-allowed'
                    }`}
                    title={isUnlocked ? `Select Zone ${targetLvlId}` : `Zone ${targetLvlId} Locked`}
                  >
                    <span className="text-[10px] opacity-60 uppercase font-mono tracking-tight">LVL</span>
                    <span className="text-base lg:text-xl font-bold font-mono">
                      {String(targetLvlId).padStart(2, '0')}
                    </span>
                  </button>
                );
              });
            })()}
            
            {/* More dots button to open level selector menu */}
            <button
              onClick={() => {
                setGameState('level-select');
                audio.playJump();
              }}
              className="w-14 h-14 lg:w-20 lg:h-20 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 backdrop-blur-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
              title="Open Level Selection Menu"
            >
              <span className="text-[9px] text-slate-500 font-bold uppercase font-mono tracking-tight">Zones</span>
              <span className="text-slate-300 font-bold text-xs">•••</span>
            </button>
          </div>
        </main>

        {/* BOTTOM HUD FOOTER */}
        <footer className="h-16 w-full border-t border-white/5 px-6 md:px-10 flex items-center justify-between backdrop-blur-md bg-slate-950/20 z-50">
          <div className="flex gap-4 md:gap-8 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 font-mono">
            <span className="text-cyan-400 animate-pulse">Rendering: 120 FPS</span>
            <span className="hidden sm:inline text-slate-400">Graphics: Ultra</span>
            <span className="hidden md:inline text-slate-400">Audio: Immersive 3D</span>
          </div>
          <div className="flex gap-4 text-slate-400 font-mono text-[9px] md:text-[10px]">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-200">WASD</kbd>
              <span className="uppercase font-bold tracking-wider text-slate-500">Move</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-200">Space</kbd>
              <span className="uppercase font-bold tracking-wider text-slate-500">Jump</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
