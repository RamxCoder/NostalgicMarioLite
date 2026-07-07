import React, { useEffect, useRef, useState } from 'react';
import { LevelConfig, PlayerState, Vector2D, EnemyDef, CollectibleDef, GameSettings } from '../types';
import { audio } from './AudioEngine';

interface GameCanvasProps {
  level: LevelConfig;
  isPaused: boolean;
  onLevelComplete: (score: number, coins: number, starsCollected: number, timeSpent: number) => void;
  onGameOver: () => void;
  onStatsUpdate: (coins: number, lives: number, score: number) => void;
  highGraphics: boolean;
  settings: GameSettings;
  onPauseToggle?: () => void;
}

// Particle class for high-fidelity animations
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;

  constructor(x: number, y: number, color: string, type: 'smoke' | 'spark' | 'ring' | 'glow') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.alpha = 1;
    this.life = 0;

    if (type === 'smoke') {
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = -Math.random() * 0.8;
      this.size = Math.random() * 4 + 3;
      this.maxLife = Math.random() * 30 + 20;
      this.decay = 1 / this.maxLife;
    } else if (type === 'spark') {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - 1; // drift up
      this.size = Math.random() * 2 + 1.5;
      this.maxLife = Math.random() * 20 + 15;
      this.decay = 1 / this.maxLife;
    } else if (type === 'ring') {
      this.vx = 0;
      this.vy = 0;
      this.size = 2; // radius
      this.maxLife = 25;
      this.decay = 1 / this.maxLife;
    } else { // glow
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.size = Math.random() * 6 + 4;
      this.maxLife = Math.random() * 40 + 30;
      this.decay = 1 / this.maxLife;
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life++;
    this.alpha = Math.max(0, 1 - this.life * this.decay);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Internal enemy runtime state
interface ActiveEnemy {
  type: 'patrol' | 'fly-horizontal' | 'fly-vertical' | 'jumper' | 'spikey';
  pos: Vector2D;
  vel: Vector2D;
  width: number;
  height: number;
  spawnPos: Vector2D;
  range: number;
  speed: number;
  jumpTimer: number;
  isDead: boolean;
  deadTimer: number;
}

export default function GameCanvas({
  level,
  isPaused,
  onLevelComplete,
  onGameOver,
  onStatsUpdate,
  highGraphics,
  settings,
  onPauseToggle,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  // Keyboard controls state
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Mobile controls state
  const [showTouchControls, setShowTouchControls] = useState(settings.controlsType === 'onscreen');
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobileTouch, setIsMobileTouch] = useState(false);

  // Sync touch controls visibility with settings
  useEffect(() => {
    setShowTouchControls(settings.controlsType === 'onscreen');
  }, [settings.controlsType]);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
      setIsMobileTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    // Attempt screen lock on compatible standalone wrappers
    const optOrientation = screen.orientation as any;
    if (optOrientation && optOrientation.lock) {
      try {
        optOrientation.lock('landscape').catch(() => {});
      } catch (e) {}
    }
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);
  const touchLeft = useRef(false);
  const touchRight = useRef(false);
  const touchJump = useRef(false);
  const touchSprint = useRef(false);

  // Timing & Game State Refs
  const levelTime = useRef(level.timeLimit);
  const coinsCollected = useRef(0);
  const score = useRef(0);
  const lives = useRef(10);
  const elapsedTimer = useRef(0);
  const gameEnded = useRef(false);

  // Player state
  const player = useRef<PlayerState>({
    pos: { x: level.startPos.x * 32, y: level.startPos.y * 32 },
    vel: { x: 0, y: 0 },
    width: 22,
    height: 28,
    isGrounded: false,
    facing: 'right',
    animState: 'idle',
    animFrame: 0,
    coyoteTime: 0,
    jumpBuffer: 0,
    invincibleTime: 0,
    hasShield: false,
    hasKey: false,
    score: 0,
    coins: 0,
    collectedStarCoins: {},
    lives: 10,
    checkpoint: null,
    deathCount: 0,
  });

  // Level configuration & dynamic entities
  const grid = useRef<number[][]>([]);
  const enemies = useRef<ActiveEnemy[]>([]);
  const starCoinsCollected = useRef<{ [key: string]: boolean }>({});
  const levelKeysCollected = useRef<{ [key: string]: boolean }>({});
  const activeCoins = useRef<CollectibleDef[]>([]);

  // Particles & Screen Shake
  const particles = useRef<Particle[]>([]);
  const screenShake = useRef(0);

  // Fragile block crumbling timer mapping
  // Map of "x,y" coordinate string to { crumbleState: number, maxState: number, respawnTimer: number }
  const fragileBlocks = useRef<{ [key: string]: { timer: number; broken: boolean; respawn: number } }>({});

  // Flag animation
  const flagWaveY = useRef(0);

  // Sound initializer helper
  const handleInteractionToUnlockAudio = () => {
    audio.playJump(); // Plays silent jump to kickstart AudioContext
    window.removeEventListener('click', handleInteractionToUnlockAudio);
    window.removeEventListener('keydown', handleInteractionToUnlockAudio);
  };

  useEffect(() => {
    window.addEventListener('click', handleInteractionToUnlockAudio);
    window.addEventListener('keydown', handleInteractionToUnlockAudio);
    return () => {
      window.removeEventListener('click', handleInteractionToUnlockAudio);
      window.removeEventListener('keydown', handleInteractionToUnlockAudio);
    };
  }, []);

  // Initialize/Reset current level
  useEffect(() => {
    // Reset score and coins for this level
    coinsCollected.current = 0;
    elapsedTimer.current = 0;
    levelTime.current = level.timeLimit;
    gameEnded.current = false;

    // Load Grid Deep Copy
    grid.current = level.grid.map(row => [...row]);

    // Load active collectibles
    activeCoins.current = level.collectibles.map(c => ({ ...c }));
    starCoinsCollected.current = {};
    levelKeysCollected.current = {};
    fragileBlocks.current = {};

    // Initialize Enemies
    enemies.current = level.enemies.map(e => {
      const baseSpeed = (e.speed || 1.2) * 0.7; // 30% slower for easy gameplay
      return {
        type: e.type,
        pos: { x: e.x * 32, y: e.y * 32 },
        vel: {
          x: e.type === 'patrol' || e.type === 'fly-horizontal' ? -baseSpeed : 0,
          y: e.type === 'fly-vertical' ? -baseSpeed : 0
        },
        width: 24,
        height: 24,
        spawnPos: { x: e.x * 32, y: e.y * 32 },
        range: (e.range || 4) * 32,
        speed: baseSpeed,
        jumpTimer: 0,
        isDead: false,
        deadTimer: 0
      };
    });

    // Reset checkpoint when a level is loaded/restarted so player doesn't spawn at old level coordinates
    player.current.checkpoint = null;

    // Spawn point (Check if checkpoint exists)
    const spawnX = player.current.checkpoint ? player.current.checkpoint.x : level.startPos.x * 32;
    const spawnY = player.current.checkpoint ? player.current.checkpoint.y : level.startPos.y * 32;

    player.current = {
      pos: { x: spawnX, y: spawnY },
      vel: { x: 0, y: 0 },
      width: 22,
      height: 28,
      isGrounded: false,
      facing: 'right',
      animState: 'idle',
      animFrame: 0,
      coyoteTime: 0,
      jumpBuffer: 0,
      invincibleTime: 0,
      hasShield: true, // Start with a defensive shield!
      hasKey: false,
      score: score.current,
      coins: coinsCollected.current,
      collectedStarCoins: {},
      lives: lives.current,
      checkpoint: null,
      deathCount: player.current.deathCount,
    };

    // Particles clear
    particles.current = [];
    screenShake.current = 0;

    // Enable on-screen touch controls if selected in settings
    setShowTouchControls(settings.controlsType === 'onscreen');

    // Update parent about initial stats
    onStatsUpdate(coinsCollected.current, lives.current, score.current);

  }, [level]);

  // Handle keyboard inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault(); // Prevent scrolling
      }
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Checkpoint flag animation
  useEffect(() => {
    const int = setInterval(() => {
      flagWaveY.current += 0.2;
    }, 50);
    return () => clearInterval(int);
  }, []);

  // Timer loop
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      if (levelTime.current > 0) {
        levelTime.current--;
        elapsedTimer.current++;
      } else {
        // Time out = die
        handlePlayerDeath('timeout');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, level]);

  const triggerScreenShake = (intensity: number) => {
    screenShake.current = intensity;
  };

  const handlePlayerDamage = (reason: 'hazard' | 'enemy') => {
    if (player.current.invincibleTime > 0) return;

    if (player.current.hasShield) {
      player.current.hasShield = false;
      player.current.invincibleTime = 60; // 1 second invincibility
      audio.playDamage();
      triggerScreenShake(5);
      const pX = player.current.pos.x + player.current.width / 2;
      const pY = player.current.pos.y + player.current.height / 2;
      for (let i = 0; i < 15; i++) {
        particles.current.push(new Particle(pX, pY, '#06b6d4', 'spark'));
      }
      return;
    }

    lives.current--;
    player.current.lives = lives.current;
    audio.playDamage();
    triggerScreenShake(8);

    const pX = player.current.pos.x + player.current.width / 2;
    const pY = player.current.pos.y + player.current.height / 2;
    for (let i = 0; i < 15; i++) {
      particles.current.push(new Particle(pX, pY, '#ff4757', 'spark'));
    }

    onStatsUpdate(coinsCollected.current, lives.current, score.current);

    if (lives.current <= 0) {
      gameEnded.current = true;
      audio.playGameOver();
      onGameOver();
    } else {
      player.current.invincibleTime = 90; // 1.5 seconds flash
      player.current.vel.y = -4.0; // small knockback bounce
    }
  };

  const handlePlayerDeath = (reason: 'hazard' | 'enemy' | 'pit' | 'timeout') => {
    lives.current--;
    player.current.deathCount++;
    audio.playDamage();

    // Death particles
    const pX = player.current.pos.x + player.current.width / 2;
    const pY = player.current.pos.y + player.current.height / 2;
    for (let i = 0; i < 40; i++) {
      particles.current.push(new Particle(pX, pY, '#ff4757', 'spark'));
      particles.current.push(new Particle(pX, pY, '#ffa502', 'spark'));
    }
    triggerScreenShake(15);

    // Notify stats
    onStatsUpdate(coinsCollected.current, lives.current, score.current);

    if (lives.current <= 0) {
      gameEnded.current = true;
      audio.playGameOver();
      onGameOver();
    } else {
      // Respawn at starting or checkpoint after a delay
      setTimeout(() => {
        const spawnX = player.current.checkpoint ? player.current.checkpoint.x : level.startPos.x * 32;
        const spawnY = player.current.checkpoint ? player.current.checkpoint.y : level.startPos.y * 32;

        player.current.pos = { x: spawnX, y: spawnY };
        player.current.vel = { x: 0, y: 0 };
        player.current.invincibleTime = 90; // 1.5 seconds flash
        player.current.facing = 'right';
        player.current.hasKey = false;
        player.current.hasShield = true; // Regenerate shield on respawn!
      }, 800);
    }
  };

  // Main Game Loop
  useEffect(() => {
    let lastTime = 0;

    const gameLoop = (timestamp: number) => {
      if (isPaused || gameEnded.current) {
        requestRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!lastTime) lastTime = timestamp;
      const dt = timestamp - lastTime;
      lastTime = timestamp;

      updatePhysics();
      updateEntities();
      renderGame();

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPaused, level]);

  // Tile collision checking helper
  const getTileAt = (tx: number, ty: number): number => {
    if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) {
      // Outside boundary: Solid bottom pit, solid side walls, air elsewhere
      if (ty >= level.height) return 5; // bottom acts like spikes/death pit
      if (tx < 0 || tx >= level.width) {
        if (ty >= 0 && ty < level.height) return 3; // side walls act as indestructible solid blocks
      }
      return 0;
    }

    // Check fragile block status
    const key = `${tx},${ty}`;
    if (fragileBlocks.current[key]?.broken) {
      return 0; // act as air when broken
    }

    return grid.current[ty][tx];
  };

  const isTileSolid = (tileId: number): boolean => {
    // Solid tiles: ground (1), underground (2), metal (3), fragile (10), locked door (12)
    return [1, 2, 3, 10, 12].includes(tileId);
  };

  const isTileSemiSolid = (tileId: number): boolean => {
    // Cloud platforms (4) are semi-solid (can land on them, but jump up through)
    return tileId === 4;
  };

  const setTileAt = (tx: number, ty: number, val: number) => {
    if (tx >= 0 && tx < level.width && ty >= 0 && ty < level.height) {
      grid.current[ty][tx] = val;
    }
  };

  // Update Player & World Physics
  const updatePhysics = () => {
    const p = player.current;

    // Invincibility cooldown
    if (p.invincibleTime > 0) p.invincibleTime--;

    // Gather Inputs
    const leftInput = keysPressed.current['arrowleft'] || keysPressed.current['a'] || touchLeft.current;
    const rightInput = keysPressed.current['arrowright'] || keysPressed.current['d'] || touchRight.current;
    const jumpInput = keysPressed.current['arrowup'] || keysPressed.current['w'] || keysPressed.current[' '] || touchJump.current;
    const sprintInput = keysPressed.current['shift'] || keysPressed.current['b'] || touchSprint.current;

    // Movement Physics constants
    const isSprinting = settings.sprintButton && sprintInput;
    const accel = p.isGrounded ? (isSprinting ? 0.95 : 0.68) : (isSprinting ? 0.62 : 0.48);
    const maxSpeed = isSprinting ? 7.2 : 5.0;
    const friction = p.isGrounded ? 0.82 : 0.93;
    const gravity = 0.5;
    const maxFallSpeed = 9.5;

    // Apply horizontal input
    if (leftInput) {
      p.vel.x -= accel;
      p.facing = 'left';
      p.animState = 'run';
    } else if (rightInput) {
      p.vel.x += accel;
      p.facing = 'right';
      p.animState = 'run';
    } else {
      p.vel.x *= friction;
      if (Math.abs(p.vel.x) < 0.15) {
        p.vel.x = 0;
        p.animState = 'idle';
      }
    }

    // Speed limits
    if (p.vel.x > maxSpeed) p.vel.x = maxSpeed;
    if (p.vel.x < -maxSpeed) p.vel.x = -maxSpeed;

    // Apply gravity
    p.vel.y += gravity;
    if (p.vel.y > maxFallSpeed) p.vel.y = maxFallSpeed;

    // Coyote Time (allow jump slightly off ledge - increased for super easy platforming!)
    if (p.isGrounded) {
      p.coyoteTime = 12; // 12 frames threshold
    } else if (p.coyoteTime > 0) {
      p.coyoteTime--;
    }

    // Jump Buffer (increased look-ahead for reliable responsive timing)
    if (jumpInput) {
      p.jumpBuffer = 10; // 10 frames look-ahead
    } else if (p.jumpBuffer > 0) {
      p.jumpBuffer--;
    }

    // Jump Execution
    if (p.jumpBuffer > 0 && p.coyoteTime > 0) {
      p.vel.y = -10.2; // slight jump boost to easily cross wide procedurally-generated gaps
      p.isGrounded = false;
      p.coyoteTime = 0;
      p.jumpBuffer = 0;
      audio.playJump();

      // Jump sparks
      for (let i = 0; i < 6; i++) {
        particles.current.push(new Particle(p.pos.x + p.width / 2, p.pos.y + p.height, '#ffffff', 'smoke'));
      }
    }

    // Variable jump height (let go of jump key = fall faster)
    if (!jumpInput && p.vel.y < -2.0) {
      p.vel.y = -2.0; // clamp upward momentum if button released early
    }

    // Update animations
    if (!p.isGrounded) {
      p.animState = p.vel.y < 0 ? 'jump' : 'fall';
    }
    p.animFrame += 0.15;

    // --- TILEMAP COLLISIONS (Horizontal) ---
    p.pos.x += p.vel.x;
    resolveHorizontalCollisions(p);

    // --- TILEMAP COLLISIONS (Vertical) ---
    p.isGrounded = false;
    p.pos.y += p.vel.y;
    resolveVerticalCollisions(p);

    // --- GOAL FLAG TRIGGER CHECK ---
    // If player crosses or reaches the goal flagpole X coordinate, trigger win!
    const pX = p.pos.x + p.width / 2;
    const goalX = level.goalPos.x * 32 + 16;
    if (Math.abs(pX - goalX) < 22 && p.pos.y < level.height * 32 && lives.current > 0 && !gameEnded.current) {
      gameEnded.current = true;
      audio.playVictoryFanfare();
      onLevelComplete(score.current + levelTime.current * 10, coinsCollected.current, Object.keys(starCoinsCollected.current).length, elapsedTimer.current);
      return;
    }

    // Fall out of bounds (pit death)
    if (p.pos.y > level.height * 32) {
      handlePlayerDeath('pit');
    }
  };

  const resolveHorizontalCollisions = (p: PlayerState) => {
    const tileWidth = 32;
    const tileHeight = 32;

    const startX = Math.floor(p.pos.x / tileWidth);
    const endX = Math.floor((p.pos.x + p.width) / tileWidth);
    const startY = Math.floor(p.pos.y / tileHeight);
    const endY = Math.floor((p.pos.y + p.height) / tileHeight);

    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        const tile = getTileAt(tx, ty);
        if (isTileSolid(tile)) {
          // Locked door special interaction
          if (tile === 12) {
            if (p.hasKey) {
              // Unlock door! Remove lock tile and surrounding tiles
              setTileAt(tx, ty, 0);
              // Clean above/below lock if they are door frames
              if (getTileAt(tx, ty - 1) === 12) setTileAt(tx, ty - 1, 0);
              if (getTileAt(tx, ty + 1) === 12) setTileAt(tx, ty + 1, 0);

              p.hasKey = false;
              audio.playPowerup();
              triggerScreenShake(8);
              // Spawn unlock sparks
              for (let i = 0; i < 20; i++) {
                particles.current.push(new Particle(tx * 32 + 16, ty * 32 + 16, '#ffca08', 'spark'));
              }
              continue;
            }
          }

          // Normal solid collision
          if (p.vel.x > 0) {
            p.pos.x = tx * tileWidth - p.width - 0.1;
            p.vel.x = 0;
          } else if (p.vel.x < 0) {
            p.pos.x = (tx + 1) * tileWidth + 0.1;
            p.vel.x = 0;
          }
        }
      }
    }
  };

  const resolveVerticalCollisions = (p: PlayerState) => {
    const tileWidth = 32;
    const tileHeight = 32;

    const startX = Math.floor(p.pos.x / tileWidth);
    const endX = Math.floor((p.pos.x + p.width) / tileWidth);
    const startY = Math.floor(p.pos.y / tileHeight);
    const endY = Math.floor((p.pos.y + p.height) / tileHeight);

    for (let tx = startX; tx <= endX; tx++) {
      for (let ty = startY; ty <= endY; ty++) {
        const tile = getTileAt(tx, ty);

        // Check hazard (spikes)
        if (tile === 5) {
          if (p.invincibleTime === 0) {
            handlePlayerDamage('hazard');
            return;
          }
        }

        // Check spring / Jump-pad
        if (tile === 6) {
          // Push player straight up!
          p.vel.y = -13.5;
          p.isGrounded = false;
          audio.playBounce();
          triggerScreenShake(5);
          for (let i = 0; i < 12; i++) {
            particles.current.push(new Particle(tx * 32 + 16, ty * 32 + 16, '#22c55e', 'spark'));
          }
          continue;
        }

        // Check solid tiles
        if (isTileSolid(tile)) {
          if (p.vel.y > 0) {
            // Landing on top
            p.pos.y = ty * tileHeight - p.height - 0.1;
            p.vel.y = 0;
            p.isGrounded = true;

            // Fragile block crumble start
            if (tile === 10) {
              const key = `${tx},${ty}`;
              if (!fragileBlocks.current[key]) {
                fragileBlocks.current[key] = { timer: 20, broken: false, respawn: 0 }; // 300ms countdown
              }
            }
          } else if (p.vel.y < 0) {
            // Hitting from below
            p.pos.y = (ty + 1) * tileHeight + 0.1;
            p.vel.y = 0;

            // Block interactions (mystery blocks, etc)
            if (tile === 9) {
              // Mystery block hits! Turns to active solid metal (3), spawns coin
              setTileAt(tx, ty, 3);
              audio.playCoin();
              coinsCollected.current++;
              score.current += 100;
              onStatsUpdate(coinsCollected.current, lives.current, score.current);

              // Spark coins
              for (let i = 0; i < 10; i++) {
                particles.current.push(new Particle(tx * 32 + 16, ty * 32, '#eab308', 'spark'));
              }
            }
          }
        }

        // Check semi-solids (cloud platform)
        if (isTileSemiSolid(tile)) {
          // Only collide if player's feet are above the top of the cloud and player is falling down
          const tileTopY = ty * tileHeight;
          const prevFeetY = p.pos.y + p.height - p.vel.y;

          if (p.vel.y > 0 && prevFeetY <= tileTopY + 6) {
            p.pos.y = tileTopY - p.height - 0.1;
            p.vel.y = 0;
            p.isGrounded = true;
          }
        }

        // Goal Flag check
        if (tile === 8) {
          // Trigger level win sequence!
          gameEnded.current = true;
          audio.playVictoryFanfare();
          onLevelComplete(score.current + levelTime.current * 10, coinsCollected.current, Object.keys(starCoinsCollected.current).length, elapsedTimer.current);
          return;
        }
      }
    }
  };

  // Update dynamic level entities
  const updateEntities = () => {
    // 1. Update collectibles
    const p = player.current;

    activeCoins.current = activeCoins.current.filter((coin) => {
      // Check collision
      const cX = coin.x * 32 + 16;
      const cY = coin.y * 32 + 16;
      const pX = p.pos.x + p.width / 2;
      const pY = p.pos.y + p.height / 2;

      // Distance check (approximate collision with radius 16)
      const dist = Math.hypot(cX - pX, cY - pY);
      if (dist < 26) {
        if (coin.type === 'coin') {
          coinsCollected.current++;
          score.current += 50;
          audio.playCoin();
          onStatsUpdate(coinsCollected.current, lives.current, score.current);
          for (let i = 0; i < 8; i++) {
            particles.current.push(new Particle(cX, cY, '#eab308', 'spark'));
          }
        } else if (coin.type === 'star_coin') {
          starCoinsCollected.current[coin.id] = true;
          score.current += 500;
          audio.playStarCoin();
          onStatsUpdate(coinsCollected.current, lives.current, score.current);
          for (let i = 0; i < 25; i++) {
            particles.current.push(new Particle(cX, cY, '#38bdf8', 'spark'));
            particles.current.push(new Particle(cX, cY, '#ffffff', 'glow'));
          }
        } else if (coin.type === 'key') {
          p.hasKey = true;
          levelKeysCollected.current[coin.id] = true;
          audio.playPowerup();
          for (let i = 0; i < 15; i++) {
            particles.current.push(new Particle(cX, cY, '#ffca08', 'spark'));
          }
        }
        return false; // remove from list
      }
      return true;
    });

    // 2. Update crumbling fragile blocks
    Object.keys(fragileBlocks.current).forEach((key) => {
      const b = fragileBlocks.current[key];
      if (!b.broken) {
        if (b.timer > 0) {
          b.timer--;
          // Flashing particles on crumble
          if (b.timer % 3 === 0) {
            const [tx, ty] = key.split(',').map(Number);
            particles.current.push(new Particle(tx * 32 + 16, ty * 32 + 16, '#facc15', 'smoke'));
          }
          if (b.timer === 0) {
            b.broken = true;
            b.respawn = 180; // Respawn after 3 seconds (180 frames)
            audio.playStomp();
            const [tx, ty] = key.split(',').map(Number);
            // Splatter block chunks
            for (let i = 0; i < 15; i++) {
              particles.current.push(new Particle(tx * 32 + 16, ty * 32 + 16, '#eab308', 'spark'));
            }
          }
        }
      } else {
        b.respawn--;
        if (b.respawn <= 0) {
          b.broken = false; // Respawn block!
          b.timer = 0;
        }
      }
    });

    // 3. Update Enemies
    enemies.current.forEach((e) => {
      if (e.isDead) {
        e.deadTimer--;
        return;
      }

      // Move patrol/flying
      if (e.type === 'patrol') {
        e.pos.x += e.vel.x;

        // Check collision walls or platform edges
        const tx = Math.floor((e.pos.x + (e.vel.x > 0 ? e.width : 0)) / 32);
        const ty = Math.floor((e.pos.y + e.height - 4) / 32);
        const wallAhead = isTileSolid(getTileAt(tx, ty));

        // Edge detection (turn around before falling if patrol type)
        const edgeTx = Math.floor((e.pos.x + (e.vel.x > 0 ? e.width + 4 : -4)) / 32);
        const edgeTy = Math.floor((e.pos.y + e.height + 4) / 32);
        const groundAhead = isTileSolid(getTileAt(edgeTx, edgeTy));

        if (wallAhead || !groundAhead) {
          e.vel.x = -e.vel.x; // Turn around!
        }
      } else if (e.type === 'fly-horizontal') {
        e.pos.x += e.vel.x;
        const dx = Math.abs(e.pos.x - e.spawnPos.x);
        if (dx > e.range) {
          e.vel.x = -e.vel.x;
        }
      } else if (e.type === 'fly-vertical') {
        e.pos.y += e.vel.y;
        const dy = Math.abs(e.pos.y - e.spawnPos.y);
        if (dy > e.range) {
          e.vel.y = -e.vel.y;
        }
      } else if (e.type === 'jumper') {
        // periodical jump
        e.vel.y += 0.4; // heavy gravity
        e.pos.y += e.vel.y;

        const tx = Math.floor((e.pos.x + 12) / 32);
        const ty = Math.floor((e.pos.y + e.height) / 32);
        if (isTileSolid(getTileAt(tx, ty))) {
          e.pos.y = ty * 32 - e.height;
          e.vel.y = 0; // land
          e.jumpTimer++;
          if (e.jumpTimer > 60) { // jump every 1s
            e.vel.y = -8.5; // jump up
            e.jumpTimer = 0;
          }
        }
      }

      // Check collision with player
      const pLeft = p.pos.x;
      const pRight = p.pos.x + p.width;
      const pTop = p.pos.y;
      const pBottom = p.pos.y + p.height;

      const eLeft = e.pos.x;
      const eRight = e.pos.x + e.width;
      const eTop = e.pos.y;
      const eBottom = e.pos.y + e.height;

      // AABB Intersects
      if (pRight > eLeft && pLeft < eRight && pBottom > eTop && pTop < eBottom) {
        const isPlayerLandingOnHead = pBottom - p.vel.y <= eTop + 10 && p.vel.y > 0;

        if (isPlayerLandingOnHead && e.type !== 'spikey') {
          // Stomp on enemy!
          e.isDead = true;
          e.deadTimer = 25; // dead animation timer
          p.vel.y = -7.5; // bounce player
          audio.playStomp();
          score.current += 200;
          onStatsUpdate(coinsCollected.current, lives.current, score.current);

          // Burst of stomping sparkles
          for (let i = 0; i < 15; i++) {
            particles.current.push(new Particle(e.pos.x + 12, e.pos.y + 12, '#38bdf8', 'spark'));
          }
        } else {
          // Damage Player
          if (p.invincibleTime === 0) {
            handlePlayerDamage('enemy');
          }
        }
      }
    });

    // Remove dead enemies
    enemies.current = enemies.current.filter(e => !e.isDead || e.deadTimer > 0);

    // 4. Update particles
    particles.current.forEach(p => p.update());
    particles.current = particles.current.filter(p => p.alpha > 0);
  };

  // Draw/Render the Game on Canvas
  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Camera Tracking (Lerp)
    const targetCamX = Math.max(0, Math.min(player.current.pos.x - canvas.width / 2, level.width * 32 - canvas.width));
    const targetCamY = Math.max(0, Math.min(player.current.pos.y - canvas.height / 2 - 40, level.height * 32 - canvas.height));

    // Dynamic smoothing
    const camX = targetCamX;
    const camY = targetCamY;

    // Apply Screen Shake
    let shakeOffset = { x: 0, y: 0 };
    if (screenShake.current > 0.1) {
      shakeOffset.x = (Math.random() - 0.5) * screenShake.current;
      shakeOffset.y = (Math.random() - 0.5) * screenShake.current;
      screenShake.current *= 0.88; // decay
    }

    // --- DRAW BACKGROUND PARALLAX ---
    drawBackground(ctx, canvas, camX, camY);

    // Translate to Camera space
    ctx.save();
    ctx.translate(-camX + shakeOffset.x, -camY + shakeOffset.y);

    // --- DRAW TILEMAP GRID ---
    drawTileGrid(ctx, camX, camY, canvas.width, canvas.height);

    // --- DRAW COLLECTIBLES ---
    drawCollectibles(ctx, camX, camY, canvas.width, canvas.height);

    // --- DRAW ENEMIES ---
    drawEnemies(ctx);

    // --- DRAW PARTICLES ---
    particles.current.forEach(p => p.draw(ctx));

    // --- DRAW CHECKPOINT FLAGS ---
    drawCheckpoints(ctx);

    // --- DRAW PLAYER (Aki the Cyber-Fox) ---
    drawPlayer(ctx);

    ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, camX: number, camY: number) => {
    // Clear and draw sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, level.backgroundColors[0]);
    skyGrad.addColorStop(0.5, level.backgroundColors[1]);
    skyGrad.addColorStop(1, level.backgroundColors[2]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax Layer 1: Far Hills / Space Dust / Grid (Slow)
    ctx.save();
    if (level.theme === 'neon-city' || level.theme === 'digital-void') {
      // Draw grid lines on background
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.08)';
      ctx.lineWidth = 1;
      const offsetX = -camX * 0.1 % 40;
      for (let x = offsetX; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    } else if (level.theme === 'retro-hills' || level.theme === 'sky-sanctuary') {
      // Draw procedural happy clouds in distance
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      const cloudSeed = level.id;
      for (let i = 0; i < 5; i++) {
        const cx = (i * 200 - camX * 0.15 + (cloudSeed * i * 35)) % (canvas.width + 100) - 50;
        const cy = 60 + Math.sin(i + cloudSeed) * 20;
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, Math.PI * 2);
        ctx.arc(cx + 20, cy - 10, 30, 0, Math.PI * 2);
        ctx.arc(cx + 40, cy, 25, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (level.theme === 'obsidian-caves' || level.theme === 'cyber-fortress') {
      // Heavy dust floating glow
      ctx.fillStyle = 'rgba(249, 115, 22, 0.05)';
      for (let i = 0; i < 10; i++) {
        const rx = (i * 120 - camX * 0.12) % canvas.width;
        const ry = (i * 80 - camY * 0.1) % canvas.height;
        ctx.beginPath();
        ctx.arc(rx, ry, 15 + i * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Parallax Layer 2: Mid-ground silhouette hills / futuristic cityscape (medium speed)
    ctx.save();
    const offsetY = canvas.height * 0.5;
    ctx.fillStyle = level.theme === 'neon-city' ? 'rgba(45, 20, 77, 0.4)' : 'rgba(15, 23, 42, 0.3)';

    if (level.theme === 'neon-city' || level.theme === 'cyber-fortress') {
      // Draw building block shapes
      const startB = -camX * 0.3 % 180;
      for (let bx = startB - 100; bx < canvas.width + 100; bx += 120) {
        const bHeight = 120 + Math.abs(Math.sin(bx)) * 100;
        ctx.fillRect(bx, canvas.height - bHeight, 80, bHeight);
      }
    } else {
      // Draw rounded hills
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      const segments = 10;
      const step = canvas.width / segments;
      for (let i = 0; i <= segments + 1; i++) {
        const x = (i * step) - (camX * 0.4 % step);
        const y = offsetY + Math.sin((i + camX * 0.001) * 0.8) * 45;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawTileGrid = (ctx: CanvasRenderingContext2D, camX: number, camY: number, screenW: number, screenH: number) => {
    // Only render tiles within camera visible boundaries for extreme performance!
    const tileW = 32;
    const tileH = 32;

    const startTx = Math.max(0, Math.floor(camX / tileW));
    const endTx = Math.min(level.width - 1, Math.ceil((camX + screenW) / tileW));
    const startTy = Math.max(0, Math.floor(camY / tileH));
    const endTy = Math.min(level.height - 1, Math.ceil((camY + screenH) / tileH));

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const tile = getTileAt(tx, ty);
        if (tile === 0) continue;

        const rx = tx * tileW;
        const ry = ty * tileH;

        ctx.save();

        if (tile === 1) {
          // Top ground
          if (level.theme === 'retro-hills') {
            ctx.fillStyle = '#22c55e'; // Green grass top
            ctx.fillRect(rx, ry, tileW, 8);
            ctx.fillStyle = '#78350f'; // Dirt base
            ctx.fillRect(rx, ry + 8, tileW, tileH - 8);
          } else if (level.theme === 'neon-city') {
            ctx.fillStyle = '#0f172a'; // Deep slate
            ctx.fillRect(rx, ry, tileW, tileH);
            ctx.strokeStyle = '#ec4899'; // Glowing hot pink border
            ctx.lineWidth = 1.5;
            ctx.strokeRect(rx, ry, tileW, tileH);
          } else if (level.theme === 'obsidian-caves') {
            ctx.fillStyle = '#1c1917'; // Obsidian stone
            ctx.fillRect(rx, ry, tileW, tileH);
            ctx.strokeStyle = '#f97316'; // Lava orange outline
            ctx.lineWidth = 1.5;
            ctx.strokeRect(rx, ry, tileW, tileH);
          } else if (level.theme === 'sky-sanctuary') {
            ctx.fillStyle = '#ffffff'; // fluffy clouds
            ctx.beginPath();
            ctx.arc(rx + 8, ry + 16, 16, 0, Math.PI * 2);
            ctx.arc(rx + 24, ry + 16, 16, 0, Math.PI * 2);
            ctx.fill();
          } else { // digital-void & cyber-fortress
            ctx.fillStyle = '#020617';
            ctx.fillRect(rx, ry, tileW, tileH);
            ctx.strokeStyle = level.accentColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(rx, ry, tileW, tileH);
            // Draw circuit pattern lines inside
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.beginPath();
            ctx.moveTo(rx + 6, ry + 6);
            ctx.lineTo(rx + 26, ry + 26);
            ctx.stroke();
          }
        } 
        else if (tile === 2) {
          // Underground filler
          if (level.theme === 'retro-hills') {
            ctx.fillStyle = '#451a03'; // Solid deep dirt
            ctx.fillRect(rx, ry, tileW, tileH);
            // Small pebbles texture
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(rx + 4, ry + 8, 4, 4);
            ctx.fillRect(rx + 18, ry + 20, 6, 6);
          } else if (level.theme === 'neon-city') {
            ctx.fillStyle = '#1e1b4b'; // Cyber core blocks
            ctx.fillRect(rx, ry, tileW, tileH);
          } else if (level.theme === 'obsidian-caves') {
            ctx.fillStyle = '#0c0a09';
            ctx.fillRect(rx, ry, tileW, tileH);
          } else {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(rx, ry, tileW, tileH);
          }
        } 
        else if (tile === 3) {
          // Metal block / indestructible box
          ctx.fillStyle = '#475569'; // Slate
          ctx.fillRect(rx, ry, tileW, tileH);
          ctx.strokeStyle = '#94a3b8'; // light metal outline
          ctx.strokeRect(rx + 2, ry + 2, tileW - 4, tileH - 4);
          // Bolts
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(rx + 4, ry + 4, 3, 3);
          ctx.fillRect(rx + tileW - 7, ry + 4, 3, 3);
          ctx.fillRect(rx + 4, ry + tileH - 7, 3, 3);
          ctx.fillRect(rx + tileW - 7, ry + tileH - 7, 3, 3);
        } 
        else if (tile === 4) {
          // Cloud semi-solid platforms
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(rx, ry, tileW, 12, 6);
          ctx.fill();
          ctx.stroke();
        } 
        else if (tile === 5) {
          // Hazard Spikes (UP)
          ctx.fillStyle = level.theme === 'cyber-fortress' ? '#ef4444' : '#94a3b8'; // laser red or metallic
          // Draw 4 neat spike triangles
          for (let i = 0; i < 4; i++) {
            const sx = rx + i * 8;
            ctx.beginPath();
            ctx.moveTo(sx, ry + tileH);
            ctx.lineTo(sx + 4, ry + 12);
            ctx.lineTo(sx + 8, ry + tileH);
            ctx.closePath();
            ctx.fill();
            if (level.theme === 'cyber-fortress') {
              // Add red laser light source glow
              ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
              ctx.fillRect(sx, ry, 8, 12);
            }
          }
        } 
        else if (tile === 6) {
          // Spring pad / Jump-pad
          ctx.fillStyle = '#22c55e'; // Green spring
          ctx.fillRect(rx + 4, ry + 20, tileW - 8, 12);
          // Spring coil visual
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(rx + 8, ry + 20);
          ctx.lineTo(rx + 24, ry + 14);
          ctx.lineTo(rx + 8, ry + 8);
          ctx.lineTo(rx + 24, ry + 4);
          ctx.stroke();
          // Top plate
          ctx.fillStyle = '#10b981';
          ctx.fillRect(rx + 2, ry, tileW - 4, 6);
        } 
        else if (tile === 9) {
          // Mystery coin block (animated)
          const bounceOffset = Math.sin(Date.now() * 0.01) * 1.5;
          ctx.fillStyle = '#eab308'; // Golden yellow
          ctx.fillRect(rx, ry + bounceOffset, tileW, tileH);
          ctx.strokeStyle = '#ffffff';
          ctx.strokeRect(rx + 2, ry + 2 + bounceOffset, tileW - 4, tileH - 4);
          // Draw shiny text question mark or dot
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px Courier New';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', rx + 16, ry + 16 + bounceOffset);
        } 
        else if (tile === 10) {
          // Fragile crumbling block
          ctx.fillStyle = '#facc15'; // Darker sandy yellow
          ctx.fillRect(rx, ry, tileW, tileH);
          ctx.strokeStyle = '#ca8a04';
          ctx.strokeRect(rx, ry, tileW, tileH);
          // Crack lines
          ctx.strokeStyle = '#a16207';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx + 4, ry + 4);
          ctx.lineTo(rx + 20, ry + 12);
          ctx.lineTo(rx + 8, ry + 28);
          ctx.stroke();
        } 
        else if (tile === 12) {
          // Locked door (Golden cyber security gates)
          ctx.fillStyle = '#3f3f46'; // dark background
          ctx.fillRect(rx, ry, tileW, tileH);
          // Golden grid mesh
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rx + 3, ry + 3, tileW - 6, tileH - 6);
          // Keyhole slot
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(rx + 16, ry + 12, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(rx + 14, ry + 12, 4, 10);
        }
        else if (tile === 8) {
          // --- GOAL FLAGPOLE (Tile 8) ---
          // Draw a tall, shining cyber-flagpole!
          const baseHeight = 160; // 5 blocks tall
          const poleX = rx + 14;
          const poleY = ry + 32 - baseHeight; // starts at ground level
          
          // 1. Draw glowing base pedestal
          const pedestalGrad = ctx.createLinearGradient(rx, ry + 24, rx + tileW, ry + 32);
          pedestalGrad.addColorStop(0, '#1e293b');
          pedestalGrad.addColorStop(0.5, '#3b82f6');
          pedestalGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = pedestalGrad;
          ctx.fillRect(rx + 2, ry + 24, tileW - 4, 8);
          
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 1;
          ctx.strokeRect(rx + 2, ry + 24, tileW - 4, 8);
          
          // 2. Draw metallic carbon-fiber pole
          const poleGrad = ctx.createLinearGradient(poleX, poleY, poleX + 4, poleY);
          poleGrad.addColorStop(0, '#4b5563');
          poleGrad.addColorStop(0.5, '#9ca3af');
          poleGrad.addColorStop(1, '#374151');
          ctx.fillStyle = poleGrad;
          ctx.fillRect(poleX, poleY, 4, baseHeight);
          
          // Glowing rings on the pole
          ctx.fillStyle = '#38bdf8';
          for (let py = poleY + 20; py < ry + 16; py += 30) {
            ctx.fillRect(poleX - 1, py, 6, 2);
          }
          
          // 3. Draw golden glowing sphere top
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(poleX + 2, poleY - 4, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
          
          // 4. Draw beautiful waving digital/neon flag
          const flagWave = Math.sin(Date.now() * 0.006) * 4;
          const flagW = 40;
          const flagH = 26;
          const flagX = poleX + 4;
          const flagY = poleY + 12;
          
          ctx.shadowColor = level.accentColor;
          ctx.shadowBlur = 8;
          ctx.fillStyle = level.accentColor; // Theme colored flag!
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          
          ctx.beginPath();
          ctx.moveTo(flagX, flagY);
          ctx.quadraticCurveTo(flagX + flagW/2, flagY - 4 + flagWave, flagX + flagW, flagY + flagWave);
          ctx.lineTo(flagX + flagW, flagY + flagH + flagWave);
          ctx.quadraticCurveTo(flagX + flagW/2, flagY + flagH - 4 + flagWave, flagX, flagY + flagH);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Draw a small star inside the flag
          drawStar(ctx, flagX + flagW / 2, flagY + flagH / 2 + flagWave / 2, 5, 6, 3);
        }

        ctx.restore();
      }
    }
  };

  const drawCollectibles = (ctx: CanvasRenderingContext2D, camX: number, camY: number, screenW: number, screenH: number) => {
    activeCoins.current.forEach((coin) => {
      // Bounds check
      const rx = coin.x * 32;
      const ry = coin.y * 32;

      if (rx < camX - 32 || rx > camX + screenW || ry < camY - 32 || ry > camY + screenH) return;

      ctx.save();
      const wave = Math.sin(Date.now() * 0.007 + coin.x) * 4;

      if (coin.type === 'coin') {
        // Drawing shiny spinning golden coin
        const spinWidth = Math.abs(Math.sin(Date.now() * 0.01)) * 14;
        ctx.fillStyle = '#f59e0b'; // Gold center
        ctx.strokeStyle = '#fbbf24'; // light highlight
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(rx + 16, ry + 16 + wave, spinWidth, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner core
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(rx + 16, ry + 16 + wave, Math.max(1, spinWidth * 0.5), 8, 0, 0, Math.PI * 2);
        ctx.fill();
      } 
      else if (coin.type === 'star_coin') {
        // High premium glowing Cyan Star Coin
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;

        // Big circle
        ctx.beginPath();
        ctx.arc(rx + 16, ry + 16 + wave, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Five point star icon inside
        drawStar(ctx, rx + 16, ry + 16 + wave, 5, 8, 4);
      } 
      else if (coin.type === 'key') {
        // Golden vault key
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        // Key head
        ctx.beginPath();
        ctx.arc(rx + 16, ry + 12 + wave, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Key shaft
        ctx.fillRect(rx + 15, ry + 18 + wave, 2, 10);
        // Key teeth
        ctx.fillRect(rx + 17, ry + 22 + wave, 4, 2);
        ctx.fillRect(rx + 17, ry + 26 + wave, 4, 2);
      }

      ctx.restore();
    });
  };

  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  };

  const drawEnemies = (ctx: CanvasRenderingContext2D) => {
    enemies.current.forEach((e) => {
      ctx.save();

      const rx = e.pos.x;
      const ry = e.pos.y;

      if (e.isDead) {
        // Flatten squished enemy
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.fillRect(rx, ry + 16, e.width, 8);
        ctx.restore();
        return;
      }

      // Procedural modern robot enemy design
      if (e.type === 'spikey') {
        // Dangerous spiky security droid (cannot jump on)
        ctx.fillStyle = '#ef4444'; // Red security sphere
        ctx.beginPath();
        ctx.arc(rx + 12, ry + 12, 11, 0, Math.PI * 2);
        ctx.fill();
        // Glowing red cyber eye
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rx + 10, ry + 9, 4, 4);

        // Surrounding danger spikes
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) {
          const angle = i * (Math.PI / 4) + Date.now() * 0.005;
          ctx.beginPath();
          ctx.moveTo(rx + 12 + Math.cos(angle) * 10, ry + 12 + Math.sin(angle) * 10);
          ctx.lineTo(rx + 12 + Math.cos(angle) * 17, ry + 12 + Math.sin(angle) * 17);
          ctx.stroke();
        }
      } 
      else if (e.type === 'fly-horizontal' || e.type === 'fly-vertical') {
        // Floating cyber recon drone
        const wave = Math.sin(Date.now() * 0.015) * 2;
        ctx.fillStyle = '#a855f7'; // Purple core
        ctx.beginPath();
        ctx.roundRect(rx + 3, ry + 4 + wave, 18, 14, 5);
        ctx.fill();

        // Glowing visor
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(rx + 7, ry + 8 + wave, 10, 4);

        // Hover wings
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx + 3, ry + 10 + wave);
        ctx.lineTo(rx - 4, ry + 2 + wave);
        ctx.moveTo(rx + 21, ry + 10 + wave);
        ctx.lineTo(rx + 28, ry + 2 + wave);
        ctx.stroke();
      } 
      else if (e.type === 'jumper') {
        // Jumping chrome sphere
        ctx.fillStyle = '#3b82f6'; // Neon blue
        ctx.beginPath();
        ctx.arc(rx + 12, ry + 12, 10, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rx + 4, ry + 20);
        ctx.lineTo(rx + 2, ry + 24);
        ctx.moveTo(rx + 20, ry + 20);
        ctx.lineTo(rx + 22, ry + 24);
        ctx.stroke();
      } 
      else {
        // Standard cyber crab bot patrol
        const walkingOffset = Math.sin(Date.now() * 0.018) * 3;
        ctx.fillStyle = '#4b5563'; // Dark slate bot body
        ctx.fillRect(rx + 2, ry + 6, 20, 12);
        
        // Yellow alert eye
        ctx.fillStyle = '#f59e0b';
        if (e.vel.x < 0) {
          ctx.fillRect(rx + 4, ry + 9, 3, 3);
        } else {
          ctx.fillRect(rx + 17, ry + 9, 3, 3);
        }

        // Animated robot legs
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(rx + 5, ry + 18);
        ctx.lineTo(rx + 2 + walkingOffset, ry + 24);
        ctx.moveTo(rx + 19, ry + 18);
        ctx.lineTo(rx + 22 - walkingOffset, ry + 24);
        ctx.stroke();
      }

      ctx.restore();
    });
  };

  const drawCheckpoints = (ctx: CanvasRenderingContext2D) => {
    level.checkpoints.forEach((cp) => {
      const rx = cp.x * 32;
      const ry = cp.y * 32;

      ctx.save();

      // Check if checkpoint is active
      const p = player.current;
      const isActive = p.checkpoint && p.checkpoint.x === rx && p.checkpoint.y === ry;

      // Draw pole
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(rx + 14, ry - 32, 4, 64);

      // Flag wave logic
      const wave = Math.sin(flagWaveY.current) * 3;

      if (isActive) {
        // Radiant neon green active flag!
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx + 18, ry - 30);
        ctx.lineTo(rx + 36, ry - 22 + wave);
        ctx.lineTo(rx + 18, ry - 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Dormant gray/red flag
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(rx + 18, ry - 30);
        ctx.lineTo(rx + 32, ry - 22);
        ctx.lineTo(rx + 18, ry - 14);
        ctx.closePath();
        ctx.fill();

        // Check proximity of player to activate
        const pX = p.pos.x + p.width / 2;
        const pY = p.pos.y + p.height / 2;
        const dist = Math.hypot(pX - (rx + 16), pY - (ry + 16));
        if (dist < 32 && !isActive) {
          p.checkpoint = { x: rx, y: ry };
          audio.playCheckpoint();
          triggerScreenShake(6);
          for (let i = 0; i < 15; i++) {
            particles.current.push(new Particle(rx + 16, ry - 16, '#22c55e', 'spark'));
          }
        }
      }

      ctx.restore();
    });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const p = player.current;

    // Blink if invincible
    if (p.invincibleTime > 0 && Math.floor(p.invincibleTime / 4) % 2 === 0) {
      return;
    }

    ctx.save();

    const rx = p.pos.x;
    const ry = p.pos.y;

    // Flip drawing depending on facing direction
    ctx.translate(rx + p.width / 2, ry + p.height / 2);
    if (p.facing === 'left') {
      ctx.scale(-1, 1);
    }

    // Squash and stretch based on physics
    let scaleX = 1;
    let scaleY = 1;

    if (!p.isGrounded) {
      if (p.vel.y < 0) {
        // Stretching up when jumping
        scaleX = 0.85;
        scaleY = 1.15;
      } else {
        // Contracting when falling
        scaleX = 0.92;
        scaleY = 1.08;
      }
    } else if (p.animState === 'run') {
      // Bobbing while running
      scaleX = 1 + Math.sin(Date.now() * 0.02) * 0.05;
      scaleY = 1 - Math.sin(Date.now() * 0.02) * 0.05;
    }

    ctx.scale(scaleX, scaleY);

    // --- PROCEDURAL CHARACTER ART: Aki the Cyber-Fox ---
    // Beautiful neon cyber fox with orange glowing armor and dual tails

    // Ground glow/shadow
    if (p.isGrounded) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, p.height / 2, 11, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 1. Dual Cyber Tails (Waving behind)
    const wave1 = Math.sin(Date.now() * 0.01) * 8;
    const wave2 = Math.sin(Date.now() * 0.01 + Math.PI / 2) * 8;

    ctx.fillStyle = '#f97316'; // Glowing orange
    ctx.beginPath();
    ctx.ellipse(-14, 4 + wave1 * 0.2, 10, 4, -0.3 + wave1 * 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffedd5'; // cream tip
    ctx.beginPath();
    ctx.ellipse(-20, 2 + wave1 * 0.2, 5, 2, -0.3 + wave1 * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // 2. Main Body / Cyber Armor Torso
    ctx.fillStyle = '#e2e8f0'; // Metallic silver chestplate
    ctx.beginPath();
    ctx.roundRect(-8, -5, 16, 16, 4);
    ctx.fill();
    // Cyber glowing core
    ctx.fillStyle = '#38bdf8'; // bright neon cyan
    ctx.beginPath();
    ctx.arc(0, -1, 3, 0, Math.PI * 2);
    ctx.fill();

    // 3. Cute Fox Head
    ctx.fillStyle = '#f97316'; // Fox Orange
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-4, -4);
    ctx.lineTo(4, -4);
    ctx.lineTo(9, -10);
    ctx.closePath();
    ctx.fill();

    // Fox Cheeks / Snout (Cream)
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(0, -3);
    ctx.lineTo(6, -6);
    ctx.closePath();
    ctx.fill();

    // Cyber Visor / Eyes (glowing cyan)
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.roundRect(-6, -11, 12, 3, 1);
    ctx.fill();

    // 4. Glowing Fox Cyber-Ears
    ctx.fillStyle = '#ea580c'; // dark orange back ear
    ctx.beginPath();
    ctx.moveTo(-8, -13);
    ctx.lineTo(-14, -22);
    ctx.lineTo(-3, -14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(8, -13);
    ctx.lineTo(14, -22);
    ctx.lineTo(3, -14);
    ctx.closePath();
    ctx.fill();

    // Inner glowing cyan ear lining
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(-7, -14);
    ctx.lineTo(-11, -20);
    ctx.lineTo(-4, -14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7, -14);
    ctx.lineTo(11, -20);
    ctx.lineTo(4, -14);
    ctx.closePath();
    ctx.fill();

    // 5. Fox limbs (Legs running animation)
    const runCycle = Math.sin(Date.now() * 0.02) * 8;
    ctx.fillStyle = '#ea580c';

    if (p.animState === 'run') {
      // Left leg forward, right leg back
      ctx.fillRect(-6, 9 + runCycle * 0.1, 4, 5);
      ctx.fillRect(2, 9 - runCycle * 0.1, 4, 5);
    } else {
      // Standing/Jumping static legs
      ctx.fillRect(-6, 10, 4, 5);
      ctx.fillRect(2, 10, 4, 5);
    }

    // Shield bubble aura if active (Premium graphic!)
    if (p.hasShield) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -2, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center select-none rounded-none border-none">
      {/* Real-time stats display floating overlay with Safe Area support */}
      <div 
        className="absolute z-10 flex justify-between items-center px-4 py-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 text-white font-sans text-sm md:text-base"
        style={{
          top: 'calc(1rem + env(safe-area-inset-top, 0px))',
          left: 'calc(1rem + env(safe-area-inset-left, 0px))',
          right: 'calc(1rem + env(safe-area-inset-right, 0px))'
        }}
      >
        <div className="flex gap-4 md:gap-6 items-center">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-emerald-400 font-mono">Lvl</span>
            <span className="text-xl text-white font-mono">{level.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-red-400 font-mono font-bold">Lives</span>
            <span className="text-white font-mono font-bold">{lives.current}</span>
          </div>
        </div>

        {/* Level Name */}
        <div className="hidden md:block text-slate-300 font-semibold uppercase tracking-wider text-xs">
          {level.name}
        </div>

        <div className="flex gap-4 md:gap-6 items-center">
          <div className="flex items-center gap-1.5 text-yellow-400 font-bold">
            <span className="font-mono text-xs">🪙</span>
            <span className="text-white font-mono">{coinsCollected.current}</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <span className="font-mono text-xs">⭐</span>
            <span className="text-white font-mono">{Object.keys(starCoinsCollected.current).length}/3</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400 font-bold">
            <span className="font-mono text-xs">⏱️</span>
            <span className="text-white font-mono">{levelTime.current}s</span>
          </div>
          {onPauseToggle && (
            <button
              onClick={() => {
                audio.playJump();
                onPauseToggle();
              }}
              className="ml-2 px-2 py-0.5 md:py-1 rounded bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 transition-all font-mono text-[10px] md:text-xs text-slate-300 hover:text-white cursor-pointer select-none pointer-events-auto flex items-center justify-center gap-1"
            >
              ⏸️ PAUSE
            </button>
          )}
        </div>
      </div>

      {/* HTML5 Canvas Engine */}
      <canvas
        ref={canvasRef}
        width={854}
        height={480}
        className="w-full h-full block object-contain select-none cursor-default"
      />

      {/* MOBILE CONTROLS OVERLAY */}
      {showTouchControls && (
        <div 
          className="absolute z-20 flex justify-between items-end select-none pointer-events-none"
          style={{
            bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            left: 'calc(1rem + env(safe-area-inset-left, 0px))',
            right: 'calc(1rem + env(safe-area-inset-right, 0px))',
            flexDirection: settings.touchLayout === 'inverted' ? 'row-reverse' : 'row'
          }}
        >
          {/* Left/Right controls */}
          <div className="flex gap-3 pointer-events-auto">
            <button
              onTouchStart={(e) => { e.preventDefault(); touchLeft.current = true; }}
              onTouchEnd={(e) => { e.preventDefault(); touchLeft.current = false; }}
              onMouseDown={(e) => { e.preventDefault(); touchLeft.current = true; }}
              onMouseUp={(e) => { e.preventDefault(); touchLeft.current = false; }}
              onMouseLeave={() => { touchLeft.current = false; }}
              className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl bg-slate-900/60 hover:bg-slate-800/80 active:bg-cyan-500/20 active:border-cyan-500 border border-white/10 text-slate-200 active:text-white font-bold text-xl md:text-2xl backdrop-blur-md active:scale-95 transition-all outline-none shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer select-none"
              style={{ touchAction: 'none' }}
              id="mobile-btn-left"
              title="Move Left"
            >
              ◀
            </button>
            <button
              onTouchStart={(e) => { e.preventDefault(); touchRight.current = true; }}
              onTouchEnd={(e) => { e.preventDefault(); touchRight.current = false; }}
              onMouseDown={(e) => { e.preventDefault(); touchRight.current = true; }}
              onMouseUp={(e) => { e.preventDefault(); touchRight.current = false; }}
              onMouseLeave={() => { touchRight.current = false; }}
              className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl bg-slate-900/60 hover:bg-slate-800/80 active:bg-cyan-500/20 active:border-cyan-500 border border-white/10 text-slate-200 active:text-white font-bold text-xl md:text-2xl backdrop-blur-md active:scale-95 transition-all outline-none shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer select-none"
              style={{ touchAction: 'none' }}
              id="mobile-btn-right"
              title="Move Right"
            >
              ▶
            </button>
          </div>

          {/* Jump & Sprint action controls */}
          <div className="flex gap-4 pointer-events-auto items-end">
            {settings.sprintButton && (
              <button
                onTouchStart={(e) => { e.preventDefault(); touchSprint.current = true; }}
                onTouchEnd={(e) => { e.preventDefault(); touchSprint.current = false; }}
                onMouseDown={(e) => { e.preventDefault(); touchSprint.current = true; }}
                onMouseUp={(e) => { e.preventDefault(); touchSprint.current = false; }}
                onMouseLeave={() => { touchSprint.current = false; }}
                className="w-12 h-12 md:w-13 md:h-13 flex items-center justify-center rounded-full bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/50 border-2 border-amber-500 text-amber-200 active:text-white font-black text-xl md:text-2xl backdrop-blur-md active:scale-90 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all translate-y-1.5 outline-none cursor-pointer select-none"
                style={{ touchAction: 'none' }}
                id="mobile-btn-sprint"
                title="Sprint"
              >
                B
              </button>
            )}
            <button
              onTouchStart={(e) => { e.preventDefault(); touchJump.current = true; }}
              onTouchEnd={(e) => { e.preventDefault(); touchJump.current = false; }}
              onMouseDown={(e) => { e.preventDefault(); touchJump.current = true; }}
              onMouseUp={(e) => { e.preventDefault(); touchJump.current = false; }}
              onMouseLeave={() => { touchJump.current = false; }}
              className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 active:bg-cyan-500/50 border-2 border-cyan-500 text-white font-black text-xl md:text-2xl backdrop-blur-md active:scale-90 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all outline-none cursor-pointer select-none"
              style={{ touchAction: 'none' }}
              id="mobile-btn-jump"
              title="Jump"
            >
              A
            </button>
          </div>
        </div>
      )}

      {/* Level hint floating bubble */}
      {level.hint && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/75 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 text-slate-300 text-[11px] md:text-xs text-center font-mono pointer-events-none tracking-tight max-w-[85%] hidden sm:block shadow-md">
          💡 {level.hint}
        </div>
      )}

      {/* LANDSCAPE ORIENTATION FORCED OVERLAY FOR MOBILE USERS */}
      {isMobileTouch && isPortrait && (
        <div className="absolute inset-0 bg-slate-950/98 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 animate-pulse">
            <span className="text-3xl">🔄</span>
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Rotate to Landscape</h3>
          <p className="mt-1.5 text-[11px] font-mono text-slate-400 max-w-[280px] leading-relaxed">
            Please turn your mobile device sideways (landscape mode) to unlock the full retro game controls!
          </p>
          {/* Animated physical phone rotating */}
          <div className="mt-6 relative w-16 h-8 border border-dashed border-white/20 rounded-lg flex items-center justify-center">
            <div className="absolute w-6 h-12 border-2 border-cyan-400 rounded bg-slate-900 flex items-center justify-center animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
