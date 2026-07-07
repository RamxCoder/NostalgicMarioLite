export interface Vector2D {
  x: number;
  y: number;
}

export type GameState = 'menu' | 'level-select' | 'playing' | 'paused' | 'game-over' | 'level-complete' | 'achievements';

export type LevelTheme = 'retro-hills' | 'neon-city' | 'obsidian-caves' | 'sky-sanctuary' | 'digital-void' | 'cyber-fortress';

export interface LevelConfig {
  id: number;
  name: string;
  theme: LevelTheme;
  width: number; // in tiles
  height: number; // in tiles
  timeLimit: number; // in seconds
  difficulty: number; // 1 to 5 stars
  grid: number[][]; // tile grid
  enemies: EnemyDef[];
  collectibles: CollectibleDef[];
  checkpoints: Vector2D[];
  startPos: Vector2D;
  goalPos: Vector2D;
  backgroundColors: string[]; // Gradient steps for parallax
  accentColor: string;
  hint?: string;
}

export interface EnemyDef {
  type: 'patrol' | 'fly-horizontal' | 'fly-vertical' | 'jumper' | 'spikey';
  x: number; // tile coordinates
  y: number;
  range?: number; // travel range in tiles
  speed?: number;
}

export interface CollectibleDef {
  type: 'coin' | 'star_coin' | 'key' | 'shield';
  x: number; // tile coordinates
  y: number;
  id: string;
}

export interface PlayerState {
  pos: Vector2D;
  vel: Vector2D;
  width: number;
  height: number;
  isGrounded: boolean;
  facing: 'left' | 'right';
  animState: 'idle' | 'run' | 'jump' | 'fall';
  animFrame: number;
  coyoteTime: number;
  jumpBuffer: number;
  invincibleTime: number;
  hasShield: boolean;
  hasKey: boolean;
  score: number;
  coins: number;
  collectedStarCoins: { [key: string]: boolean }; // Track star coins collected in current attempt
  lives: number;
  checkpoint: Vector2D | null;
  deathCount: number;
}

export interface LevelProgress {
  levelId: number;
  completed: boolean;
  highScore: number;
  stars: number; // 0 to 3
  bestTime: number; // in seconds
  goldMedal: boolean; // if completed within target time
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  maxProgress?: number;
  currentProgress?: number;
}

export interface GameSettings {
  musicVolume: number; // 0 to 1
  sfxVolume: number; // 0 to 1
  controlsType: 'keyboard' | 'onscreen';
  touchLayout: 'standard' | 'inverted';
  sprintButton: boolean;
  highGraphics: boolean;
}
