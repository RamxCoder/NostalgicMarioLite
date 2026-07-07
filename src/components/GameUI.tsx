import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, LevelConfig, LevelProgress, Achievement, GameSettings, LevelTheme } from '../types';
import { LEVEL_METADATA, getLevelMetadata } from './LevelData';
import { Play, Grid, Trophy, Settings, RotateCcw, Volume2, VolumeX, ArrowLeft, Shield, Zap, CircleAlert, Sparkles, Check } from 'lucide-react';
import { audio } from './AudioEngine';

interface GameUIProps {
  gameState: GameState;
  unlockedLevelId: number;
  progress: LevelProgress[];
  achievements: Achievement[];
  settings: GameSettings;
  currentLevelIndex: number;
  onSelectLevel: (id: number) => void;
  onStartGame: () => void;
  onSetState: (state: GameState) => void;
  onResetProgress: () => void;
  onToggleMute: (type: 'music' | 'sfx') => void;
  onUpdateSettings: (s: Partial<GameSettings>) => void;
  // Stats inside active level:
  activeStats: { score: number; coins: number; lives: number };
  activeLevelConfig?: LevelConfig;
  // Completed details:
  completedStats?: { score: number; coins: number; starsCollected: number; timeSpent: number };
  onNextLevel: () => void;
  onRestartLevel: () => void;
}

export default function GameUI({
  gameState,
  unlockedLevelId,
  progress,
  achievements,
  settings,
  currentLevelIndex,
  onSelectLevel,
  onStartGame,
  onSetState,
  onResetProgress,
  onToggleMute,
  onUpdateSettings,
  activeStats,
  activeLevelConfig,
  completedStats,
  onNextLevel,
  onRestartLevel,
}: GameUIProps) {

  const [levelPage, setLevelPage] = useState<number>(0);

  // Background Theme Badge Generator
  const getThemeBadge = (theme: LevelTheme) => {
    switch (theme) {
      case 'retro-hills':
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-green-500/10 text-green-400 border border-green-500/20">Grasslands</span>;
      case 'neon-city':
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">Neon City</span>;
      case 'obsidian-caves':
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Lava Caves</span>;
      case 'sky-sanctuary':
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Nimbus Clouds</span>;
      case 'digital-void':
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Digital Grid</span>;
      case 'cyber-fortress':
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-red-500/10 text-red-400 border border-red-500/20">Cyber Fort</span>;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {/* 1. START / MAIN MENU VIEW */}
      {gameState === 'menu' && (
        <motion.div
          key="menu"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4 }}
          className="relative flex flex-col justify-between items-center w-full min-h-[500px] bg-slate-950/40 p-6 md:p-8 overflow-hidden"
        >
          {/* Neon particle backglow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-indigo-500/10 blur-[80px]" />

          {/* Top Row: Quick Mutes */}
          <div className="w-full flex justify-end gap-3 z-10">
            <button
              onClick={() => {
                onToggleMute('music');
                audio.playJump();
              }}
              className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 active:scale-95 transition-all cursor-pointer"
              title="Toggle Music"
            >
              {settings.musicVolume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={() => {
                onToggleMute('sfx');
                audio.playJump();
              }}
              className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 active:scale-95 transition-all cursor-pointer"
              title="Toggle SFX"
            >
              {settings.sfxVolume > 0 ? <Volume2 className="text-emerald-400" size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          {/* Main Hero Group */}
          <div className="flex flex-col items-center text-center max-w-xl z-10 my-auto">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-4"
            >
              <Sparkles size={12} />
              Chrono-Symphony Edition
            </motion.div>

            <motion.h1
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none uppercase select-none"
            >
              Nostalgic <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-400 animate-pulse">Mario</span>
            </motion.h1>

            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-3 text-slate-400 font-mono text-xs md:text-sm max-w-md tracking-tight"
            >
              Control <strong className="text-orange-400">Aki the Cyber-Fox</strong> through 100 handcrafted temporal zones, avoiding security bots, spikes, and lava.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-6 flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 max-w-sm"
            >
              {/* Animated Fox Avatar Procedural Render Mock */}
              <div className="w-16 h-16 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center relative overflow-hidden group">
                <span className="text-3xl animate-bounce">🦊</span>
                <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent" />
              </div>
              <div className="text-left font-sans">
                <h4 className="text-sm font-bold text-slate-200">Aki the Cyber-Fox</h4>
                <p className="text-[11px] text-slate-400 font-mono">Double dual-tails, high momentum, neon shielding. Immune to friction damage.</p>
              </div>
            </motion.div>
          </div>

          {/* Navigation Action Buttons Grid */}
          <div className="grid grid-cols-2 md:flex md:flex-row gap-4 w-full max-w-lg z-10">
            <button
              onClick={() => {
                onStartGame();
                audio.playJump();
              }}
              className="col-span-2 py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              id="start-game-btn"
            >
              <Play fill="white" size={18} />
              PLAY NOW
            </button>

            <button
              onClick={() => {
                onSetState('level-select');
                audio.playJump();
              }}
              className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              id="menu-btn-levels"
            >
              <Grid size={16} />
              LEVELS
            </button>

            <button
              onClick={() => {
                onSetState('achievements');
                audio.playJump();
              }}
              className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              id="menu-btn-trophy"
            >
              <Trophy size={16} />
              MEDALS
            </button>

            <button
              onClick={() => {
                onSetState('paused'); // Redirects to full settings view
                audio.playJump();
              }}
              className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              id="menu-btn-settings"
            >
              <Settings size={16} />
              PREFS
            </button>
          </div>

          {/* Footer information */}
          <div className="mt-6 text-[10px] text-slate-500 font-mono uppercase tracking-widest z-10">
            © 2026 Retro Cyber-Labs • High Fidelity Engine
          </div>
        </motion.div>
      )}

      {/* 2. LEVEL SELECT VIEW */}
      {gameState === 'level-select' && (
        <motion.div
          key="level-select"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col w-full min-h-[500px] bg-slate-950/40 p-4 md:p-6"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => {
                onSetState('menu');
                audio.playJump();
              }}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              id="back-to-menu-btn"
            >
              <ArrowLeft size={14} />
              MENU
            </button>
            <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Select Zone</h2>
            <div className="text-xs font-mono text-emerald-400">
              {unlockedLevelId - 1} / 100 Cleared
            </div>
          </div>

          {/* Pagination Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-white/5 scrollbar-none">
            {[0, 1, 2, 3, 4].map(pageIdx => {
              const startLvl = pageIdx * 20 + 1;
              const endLvl = (pageIdx + 1) * 20;
              const isActive = levelPage === pageIdx;
              const isTabUnlocked = startLvl <= unlockedLevelId;
              
              return (
                <button
                  key={pageIdx}
                  disabled={!isTabUnlocked}
                  onClick={() => {
                    setLevelPage(pageIdx);
                    audio.playJump();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                      : isTabUnlocked
                      ? 'bg-slate-900/60 text-slate-300 hover:bg-slate-800/80 border border-white/5'
                      : 'bg-slate-950/20 text-slate-600 border border-white/5 opacity-45 cursor-not-allowed'
                  }`}
                >
                  {startLvl} - {endLvl}
                </button>
              );
            })}
          </div>

          {/* Grid of 20 levels on the selected page */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {Array.from({ length: 20 }).map((_, index) => {
              const id = levelPage * 20 + index + 1;
              const lvl = getLevelMetadata(id);
              const isUnlocked = id <= unlockedLevelId;
              const lvlProgress = progress.find(p => p.levelId === id);
              const isCompleted = lvlProgress?.completed || false;
              const stars = lvlProgress?.stars || 0;
              const bestTime = lvlProgress?.bestTime || 0;

              return (
                <button
                  key={id}
                  disabled={!isUnlocked}
                  onClick={() => {
                    onSelectLevel(id);
                    audio.playJump();
                  }}
                  className={`relative p-3 rounded-xl text-left flex flex-col justify-between h-[100px] transition-all cursor-pointer ${
                    isUnlocked
                      ? 'bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-white/20 hover:scale-[1.02]'
                      : 'bg-black/30 opacity-40 border border-white/5 cursor-not-allowed'
                  }`}
                  id={`level-card-${id}`}
                >
                  {/* Lock Overlay */}
                  {!isUnlocked && (
                    <div className="absolute top-2 right-2 text-slate-500 text-xs">
                      🔒
                    </div>
                  )}

                  {/* Level Number & Difficulty */}
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono text-xl font-black text-slate-300">
                      {String(id).padStart(2, '0')}
                    </span>
                    <div className="flex gap-0.5 text-[8px]">
                      {Array.from({ length: lvl.difficulty }).map((_, i) => (
                        <span key={i} className="text-amber-400">★</span>
                      ))}
                    </div>
                  </div>

                  {/* Level Name and Theme */}
                  <div className="mt-1 text-left">
                    <div className="text-[11px] font-bold text-white leading-tight truncate">
                      {lvl.name}
                    </div>
                    <div className="mt-0.5">
                      {getThemeBadge(lvl.theme)}
                    </div>
                  </div>

                  {/* High Scores Stars bottom */}
                  {isUnlocked && (
                    <div className="flex justify-between items-center w-full mt-1.5 pt-1 border-t border-white/5">
                      <div className="flex text-[10px]">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <span key={i} className={i < stars ? 'text-cyan-400 font-bold' : 'text-slate-600'}>
                            ⭐
                          </span>
                        ))}
                      </div>
                      {bestTime > 0 && (
                        <span className="text-[8px] font-mono text-slate-400">
                          ⏱️{bestTime}s
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom disclaimer */}
          <div className="mt-auto pt-4 flex justify-between items-center border-t border-white/5">
            <button
              onClick={() => {
                if (confirm("Reset all unlocked levels and achievements?")) {
                  onResetProgress();
                }
              }}
              className="text-xs text-rose-500 font-mono hover:underline flex items-center gap-1 cursor-pointer"
            >
              Reset Saved Progress
            </button>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-tight">
              Tip: Step on Springs to launch higher!
            </span>
          </div>
        </motion.div>
      )}

      {/* 3. PAUSED / SETTINGS OVERLAY */}
      {gameState === 'paused' && (
        <motion.div
          key="paused"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="flex flex-col items-center justify-center w-full min-h-[500px] bg-slate-950/40 p-6 md:p-8"
        >
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl relative">
            <h2 className="text-2xl font-black text-white text-center uppercase tracking-tight mb-6">Game Options</h2>

            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
              {/* BGM music */}
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-bold text-slate-200">Retro Music Track</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">Synthesizes BGM live on-chip</div>
                </div>
                <button
                  onClick={() => onToggleMute('music')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold font-mono transition-all border ${
                    settings.musicVolume > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {settings.musicVolume > 0 ? 'ENABLED' : 'MUTED'}
                </button>
              </div>

              {/* SFX audio */}
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-bold text-slate-200">Sound Effects (SFX)</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">Boings, stomps, and powerups</div>
                </div>
                <button
                  onClick={() => onToggleMute('sfx')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold font-mono transition-all border ${
                    settings.sfxVolume > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {settings.sfxVolume > 0 ? 'ENABLED' : 'MUTED'}
                </button>
              </div>

              {/* Controls input type */}
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-bold text-slate-200">Device Controls</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">Onscreen layout vs keyboard</div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { onUpdateSettings({ controlsType: 'keyboard' }); audio.playJump(); }}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all ${settings.controlsType === 'keyboard' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-300'}`}
                  >
                    KEYBOARD
                  </button>
                  <button
                    onClick={() => { onUpdateSettings({ controlsType: 'onscreen' }); audio.playJump(); }}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all ${settings.controlsType === 'onscreen' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-300'}`}
                  >
                    TOUCH
                  </button>
                </div>
              </div>

              {/* Touch Layout inversion */}
              {settings.controlsType === 'onscreen' && (
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <div>
                    <div className="text-sm font-bold text-slate-200">D-Pad Position</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">Left or right-handed placement</div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { onUpdateSettings({ touchLayout: 'standard' }); audio.playJump(); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all ${settings.touchLayout === 'standard' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-300'}`}
                    >
                      STANDARD
                    </button>
                    <button
                      onClick={() => { onUpdateSettings({ touchLayout: 'inverted' }); audio.playJump(); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all ${settings.touchLayout === 'inverted' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-300'}`}
                    >
                      INVERTED
                    </button>
                  </div>
                </div>
              )}

              {/* Sprint button toggle */}
              {settings.controlsType === 'onscreen' && (
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <div>
                    <div className="text-sm font-bold text-slate-200">Sprint "B" Button</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">Add dedicated speed dash trigger</div>
                  </div>
                  <button
                    onClick={() => { onUpdateSettings({ sprintButton: !settings.sprintButton }); audio.playJump(); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold font-mono transition-all border ${
                      settings.sprintButton
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border-white/10'
                    }`}
                  >
                    {settings.sprintButton ? 'SHOWN' : 'HIDDEN'}
                  </button>
                </div>
              )}

              {/* Particle High Graphics Toggle */}
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-bold text-slate-200">Particle Trailing</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">Enables advanced physics details</div>
                </div>
                <button
                  onClick={() => { onUpdateSettings({ highGraphics: !settings.highGraphics }); audio.playJump(); }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold font-mono transition-all border ${
                    settings.highGraphics
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      : 'bg-slate-800 text-slate-400 border-white/10'
                  }`}
                >
                  {settings.highGraphics ? 'HIGH FIDELITY' : 'BALANCED'}
                </button>
              </div>

              {/* Controls guide display */}
              <div className="p-3.5 bg-black/40 rounded-xl border border-white/5 space-y-2 text-left text-xs font-mono text-slate-400">
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-1">
                  Keybindings Guide (PC)
                </div>
                <div className="grid grid-cols-2 gap-y-1">
                  <div>🏃 Move Left / Right:</div>
                  <div className="text-slate-200 font-semibold">◀ ▶ or A / D</div>
                  <div>🦘 Leap / Jump:</div>
                  <div className="text-slate-200 font-semibold">▲ / W / Space</div>
                  <div>⚡ Sprint / Dash:</div>
                  <div className="text-slate-200 font-semibold">Shift or B</div>
                  <div>⏸️ Main Menu:</div>
                  <div className="text-slate-200 font-semibold">Esc</div>
                </div>
              </div>
            </div>

            {/* Actions at the bottom */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  onSetState('menu');
                  audio.playJump();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-sm transition-all cursor-pointer"
              >
                MAIN MENU
              </button>
              <button
                onClick={() => {
                  if (activeLevelConfig) {
                    onSetState('playing');
                  } else {
                    onSetState('level-select');
                  }
                  audio.playJump();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all shadow-md cursor-pointer text-center"
              >
                {activeLevelConfig ? 'RESUME GAME' : 'LEVELS'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 4. GAME OVER OVERLAY */}
      {gameState === 'game-over' && (
        <motion.div
          key="game-over"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center w-full h-full min-h-0 bg-slate-950/80 p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            className="text-center space-y-3 max-w-sm w-full bg-slate-900 border border-white/10 p-5 rounded-2xl"
          >
            <div className="inline-flex p-2.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 animate-bounce">
              <CircleAlert size={28} />
            </div>

            <div>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-600 tracking-tight uppercase leading-none">
                Game Over
              </h1>
              <p className="mt-1 text-slate-400 font-mono text-[10px]">
                Aki the Cyber-Fox depleted all batteries.
              </p>
            </div>

            {/* Run summary stats */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-black/40 border border-white/5 rounded-xl text-left font-mono text-xs text-slate-300">
              <div>Zone Attempted:</div>
              <div className="text-right font-bold text-slate-100">{currentLevelIndex}</div>
              <div>Coins Salvaged:</div>
              <div className="text-right font-bold text-yellow-400">🪙 {activeStats.coins}</div>
              <div>Final Score:</div>
              <div className="text-right font-bold text-white">{activeStats.score} pts</div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => {
                  onSetState('level-select');
                  audio.playJump();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                LEVELS
              </button>
              <button
                onClick={() => {
                  onRestartLevel();
                  audio.playJump();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                id="gameover-restart-btn"
              >
                <RotateCcw size={14} />
                RETRY
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 5. LEVEL COMPLETED OVERLAY */}
      {gameState === 'level-complete' && completedStats && (
        <motion.div
          key="level-complete"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center w-full h-full min-h-0 bg-slate-950/60 p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            className="text-center space-y-3 max-w-sm w-full bg-slate-900 border border-white/10 p-5 rounded-2xl"
          >
            <div className="inline-flex p-2.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse">
              <Sparkles size={28} />
            </div>

            <div>
              <h2 className="text-[9px] uppercase tracking-widest font-black text-emerald-400 font-mono leading-none">
                Zone Cleared!
              </h2>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase leading-none mt-1">
                Level Complete
              </h1>
            </div>

            {/* Star Slots */}
            <div className="flex justify-center gap-3 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, type: 'spring' }}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center text-base shadow-md ${
                    i < completedStats.starsCollected
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-cyan-500/10'
                      : 'bg-black/40 text-slate-700 border-white/5'
                  }`}
                >
                  ⭐
                </motion.div>
              ))}
            </div>

            {/* Stats list */}
            <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1 text-left text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span>Time Spent:</span>
                <span className="text-slate-100 font-semibold">{completedStats.timeSpent} seconds</span>
              </div>
              <div className="flex justify-between">
                <span>Coins Collected:</span>
                <span className="text-yellow-400 font-bold">🪙 {completedStats.coins}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-1 mt-1 font-bold">
                <span>Total Score:</span>
                <span className="text-emerald-400 font-bold">{completedStats.score} pts</span>
              </div>
            </div>

            {/* Actions navigation */}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => {
                  onSetState('level-select');
                  audio.playJump();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                id="win-levels-btn"
              >
                ZONES
              </button>

              <button
                onClick={() => {
                  onNextLevel();
                  audio.playJump();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
                id="win-nextlevel-btn"
              >
                NEXT LEVEL
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 6. ACHIEVEMENTS / MEDALS LIST */}
      {gameState === 'achievements' && (
        <motion.div
          key="achievements"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col w-full min-h-[500px] bg-slate-950/40 p-6"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => {
                onSetState('menu');
                audio.playJump();
              }}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              MENU
            </button>
            <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Achievements</h2>
            <div className="text-xs font-mono text-yellow-400">
              {achievements.filter(a => a.unlocked).length} / {achievements.length} Unlocked
            </div>
          </div>

          {/* List scroll container */}
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-3.5 rounded-xl flex items-center justify-between border transition-all ${
                  ach.unlocked
                    ? 'bg-slate-900 border-emerald-500/20'
                    : 'bg-black/30 border-white/5 opacity-50'
                }`}
              >
                <div className="flex items-center gap-4 text-left">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0 ${
                    ach.unlocked ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400' : 'bg-white/5 border border-white/10 text-slate-500'
                  }`}>
                    {ach.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 leading-tight">{ach.title}</h4>
                    <p className="text-xs text-slate-400 font-mono leading-normal mt-1">{ach.description}</p>
                  </div>
                </div>

                {/* Unlocked status tag */}
                {ach.unlocked ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase font-mono font-bold tracking-wider rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <Check size={10} />
                    UNLOCKED
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 shrink-0">
                    LOCKED
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 text-center border-t border-white/5">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-tight">
              Unlock unique achievements by beating challenges in specific zones!
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
