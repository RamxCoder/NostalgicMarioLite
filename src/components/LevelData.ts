import { LevelConfig, LevelTheme, EnemyDef, CollectibleDef, Vector2D } from '../types';

// Deterministic seedable random number generator
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  // Returns 0 to 1
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
  // Returns min to max (inclusive)
  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  // Random element from array
  choose<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// 20 Level Names and Metadata
export const LEVEL_METADATA: { name: string; theme: LevelTheme; difficulty: number; hint: string }[] = [
  { name: "Sunny Beginnings", theme: "retro-hills", difficulty: 1, hint: "Use Arrow keys or WASD to run and jump. Tap Up/W to jump higher!" },
  { name: "Spring Valley", theme: "retro-hills", difficulty: 1, hint: "Step on the glowing Green Jump Pads to launch into the air!" },
  { name: "Neon Heights", theme: "neon-city", difficulty: 2, hint: "Watch your step on high-altitude gridlines. Hold jump for float time." },
  { name: "Chrono Gaps", theme: "neon-city", difficulty: 2, hint: "Crumbling yellow blocks collapse shortly after stepping on them." },
  { name: "Obsidian Depths", theme: "obsidian-caves", difficulty: 2, hint: "Red spikes are extremely dangerous. Leap over them with care." },
  { name: "Lava Vault", theme: "obsidian-caves", difficulty: 3, hint: "Find the shining Gold Key to unlock the security barrier!" },
  { name: "Nimbus Cruise", theme: "sky-sanctuary", difficulty: 3, hint: "Semi-solid clouds can be jumped through from below." },
  { name: "Wind-swept Spire", theme: "sky-sanctuary", difficulty: 3, hint: "Ascend the sky fortress by chained spring pads." },
  { name: "Digital Grid", theme: "digital-void", difficulty: 3, hint: "Cyber-patrollers change speed. Jump on their heads to disable them." },
  { name: "Glitch Leap", theme: "digital-void", difficulty: 4, hint: "Time your jumps across wide gaps. Momentum is key!" },
  { name: "Neon Corridor", theme: "neon-city", difficulty: 4, hint: "Multiple vaults require locating secret keys hidden high above." },
  { name: "Obsidian Core", theme: "obsidian-caves", difficulty: 4, hint: "The heat rises. Navigate crumbling stepping stones over spike pits." },
  { name: "Sky High", theme: "sky-sanctuary", difficulty: 4, hint: "A true vertical climbing test. Bounce your way to the clouds." },
  { name: "Byte-sized Run", theme: "digital-void", difficulty: 4, hint: "A fast-paced level with rapid speed-run hazards." },
  { name: "Cyber Fort entry", theme: "cyber-fortress", difficulty: 5, hint: "Welcome to the central CPU. Extreme security protocols active." },
  { name: "Laser Maze", theme: "cyber-fortress", difficulty: 5, hint: "Dodge laser-like spike walls and fast robotic patrollers." },
  { name: "The Grid Overload", theme: "digital-void", difficulty: 5, hint: "Glitched levels require mastery of physics and quick landing." },
  { name: "Magma Chamber", theme: "obsidian-caves", difficulty: 5, hint: "The ultimate cave experience. Save your checkpoints!" },
  { name: "Aetherial Castle", theme: "sky-sanctuary", difficulty: 5, hint: "Float amongst gold temples. Collect all 3 Star Coins to prove mastery." },
  { name: "Nostalgic Core", theme: "cyber-fortress", difficulty: 5, hint: "The final mainframe. Dodge, bounce, and sprint to save retro gaming!" }
];

// Retrieve or generate level metadata for up to 100 levels
export function getLevelMetadata(levelId: number): { name: string; theme: LevelTheme; difficulty: number; hint: string } {
  const metaIndex = levelId - 1;
  if (metaIndex >= 0 && metaIndex < LEVEL_METADATA.length) {
    return LEVEL_METADATA[metaIndex];
  }
  
  // Procedural metadata for levels 21 to 100
  const themes: LevelTheme[] = ['retro-hills', 'neon-city', 'obsidian-caves', 'sky-sanctuary', 'digital-void', 'cyber-fortress'];
  const theme = themes[(levelId - 1) % themes.length];
  const difficulty = Math.min(5, Math.floor((levelId - 1) / 20) + 1);
  
  let name = "";
  let hint = "";
  
  if (theme === 'retro-hills') {
    name = `Vintage Hills ${levelId}`;
    hint = "Look out for gaps! Hold jump to leap further.";
  } else if (theme === 'neon-city') {
    name = `Cyber Outpost ${levelId}`;
    hint = "Crumbling yellow platforms dissolve. Bounce quickly!";
  } else if (theme === 'obsidian-caves') {
    name = `Volcanic Core ${levelId}`;
    hint = "Dodge the lava spikes! Grab the keys to unlock gates.";
  } else if (theme === 'sky-sanctuary') {
    name = `Overcloud Summit ${levelId}`;
    hint = "Jump through cloud platforms from below to reach the heavens.";
  } else if (theme === 'digital-void') {
    name = `Mainframe Node ${levelId}`;
    hint = "Watch out for fast cyber patrollers! Head bounce to disable.";
  } else {
    name = `Command Center X-${levelId}`;
    hint = "Extreme security activated. Find keys and step on green pads.";
  }
  
  return { name, theme, difficulty, hint };
}

// Generate Level Config
export function getLevel(levelId: number): LevelConfig {
  const meta = getLevelMetadata(levelId);
  const rng = new SeededRandom(levelId * 2026);

  // Level dimensions
  const height = 16;
  const width = 160 + levelId * 10; // Level 1 is 170 tiles wide, Level 100 is 1160 tiles wide (grand, scrolling, fun and epic!)

  // Initialize empty grid (0 = air)
  const grid: number[][] = Array(height).fill(null).map(() => Array(width).fill(0));

  const enemies: EnemyDef[] = [];
  const collectibles: CollectibleDef[] = [];
  const checkpoints: Vector2D[] = [];

  // Theme-specific colors (gradients)
  let backgroundColors: string[] = ['#1a2a6c', '#b21f1f', '#fdbb2d']; // Default sunrise
  let accentColor = '#38bdf8'; // sky blue

  if (meta.theme === 'retro-hills') {
    backgroundColors = ['#bae6fd', '#e0f2fe', '#f0f9ff']; // bright sky blue
    accentColor = '#22c55e'; // green
  } else if (meta.theme === 'neon-city') {
    backgroundColors = ['#0f051d', '#1e0b36', '#2d144d']; // cyber violet
    accentColor = '#ec4899'; // hot pink
  } else if (meta.theme === 'obsidian-caves') {
    backgroundColors = ['#0c0a09', '#1c1917', '#292524']; // charcoal dark slate
    accentColor = '#f97316'; // orange glow
  } else if (meta.theme === 'sky-sanctuary') {
    backgroundColors = ['#e0f2fe', '#f0f9ff', '#ffffff']; // pristine clouds
    accentColor = '#06b6d4'; // cyan
  } else if (meta.theme === 'digital-void') {
    backgroundColors = ['#020617', '#0f172a', '#1e293b']; // space dark blue
    accentColor = '#10b981'; // emerald green matrix
  } else if (meta.theme === 'cyber-fortress') {
    backgroundColors = ['#09090b', '#18181b', '#27272a']; // dark metallic
    accentColor = '#ef4444'; // laser red
  }

  // Define tile ids:
  // 1: ground top (grass/neon panel)
  // 2: underground filler (dirt/rock)
  // 3: solid metal/indestructible box
  // 4: semi-solid cloud platform
  // 5: spike hazard (up)
  // 6: jump pad (spring)
  // 9: mystery coin block (yields coin when hit from below)
  // 10: fragile block (crumbles after touch)
  // 12: locked door

  // --- PROCEDURAL GENERATION ENGINE ---
  // Generate starting platform (always safe, width 12)
  for (let x = 0; x < 12; x++) {
    grid[12][x] = 1;
    grid[13][x] = 2;
    grid[14][x] = 2;
    grid[15][x] = 2;
  }

  const startPos = { x: 3, y: 10 };
  let currentY = 12; // current ground level
  let x = 12;

  // Track key placement and locked doors
  let needsKeyPlaced = false;
  let keyCount = 0;
  let lastSegWasHazard = false;

  // Let's build the level in segments of size 8-12
  while (x < width - 15) {
    const segWidth = rng.range(8, 12);
    const endX = Math.min(x + segWidth, width - 15);
    
    // Safety check: force a flat safe segment if the previous segment was a gap or spike hazard
    let choice = rng.range(0, 100);
    if (lastSegWasHazard) {
      choice = 10; // Forces flat area (choice < 25)
    }

    // Ensure we don't put impossible jumps. Track last action to avoid back-to-back deep hazards
    if (choice < 25) {
      // 1. FLAT AREA with coins and maybe an enemy
      lastSegWasHazard = false;
      for (let sx = x; sx < endX; sx++) {
        grid[currentY][sx] = 1;
        for (let sy = currentY + 1; sy < height; sy++) grid[sy][sx] = 2;
      }
      
      // Spawn items/enemies
      if (rng.next() < 0.6) {
        // Line of coins
        const coinY = currentY - rng.range(2, 4);
        for (let sx = x + 2; sx < endX - 2; sx++) {
          collectibles.push({ type: 'coin', x: sx, y: coinY, id: `coin_${sx}_${coinY}` });
        }
      }

      if (rng.next() < 0.4 && (endX - x) >= 5) {
        enemies.push({
          type: rng.next() < 0.2 && meta.theme === 'cyber-fortress' ? 'spikey' : 'patrol',
          x: x + 3,
          y: currentY - 1,
          speed: Math.min(1.4, 0.8 + levelId * 0.015) // Slightly slower, capped speed for fair and smooth gameplay
        });
      }
    } 
    else if (choice < 45) {
      // 2. GAP / HOLE (Cap gap size to 3 blocks for easy, guaranteed safe leaps)
      lastSegWasHazard = true;
      const gapSize = Math.min(rng.range(2, 3), endX - x - 1);
      
      // Build solid block on left edge
      grid[currentY][x] = 1;
      for (let sy = currentY + 1; sy < height; sy++) grid[sy][x] = 2;

      // Gap is empty air (all 0s)
      const gapEndX = x + gapSize;
      
      // Build landing platform on right edge
      // Sometime adjust height slightly (-1 to +1 for safety)
      let nextY = currentY;
      if (rng.next() < 0.5) {
        nextY = Math.max(9, Math.min(13, currentY + rng.range(-1, 1)));
      }

      for (let sx = gapEndX + 1; sx < endX; sx++) {
        grid[nextY][sx] = 1;
        for (let sy = nextY + 1; sy < height; sy++) grid[sy][sx] = 2;
      }

      // Add a coin or star coin floating in the gap
      if (rng.next() < 0.5) {
        collectibles.push({
          type: 'coin',
          x: x + Math.floor(gapSize / 2) + 1,
          y: Math.min(currentY, nextY) - 2,
          id: `coin_gap_${x}`
        });
      }

      currentY = nextY;
    } 
    else if (choice < 60) {
      // 3. STEPPING PILLARS or CLOUD LANDS
      lastSegWasHazard = false;
      const pillarY = currentY - rng.range(1, 2); // lower height for easier climbing
      for (let sx = x; sx < endX; sx++) {
        if (sx % 3 === 0) {
          // Semi-solid clouds or small grid blocks
          if (meta.theme === 'sky-sanctuary') {
            grid[pillarY][sx] = 4; // Semi-solid platform
          } else {
            grid[pillarY][sx] = 1; // Solid Block
            grid[pillarY + 1][sx] = 2;
          }
          // Add coin above it
          collectibles.push({ type: 'coin', x: sx, y: pillarY - 1, id: `coin_pillar_${sx}` });
        }
      }
      
      // Keep ground floor intact below but with hazard/spikes very occasionally in higher levels
      for (let sx = x; sx < endX; sx++) {
        if (rng.next() < 0.1 && levelId > 15) {
          grid[currentY][sx] = 5; // spikes below pillars (extremely rare and only high levels)!
        } else {
          grid[currentY][sx] = 1;
          for (let sy = currentY + 1; sy < height; sy++) grid[sy][sx] = 2;
        }
      }
    } 
    else if (choice < 75) {
      // 4. SPIKE TRAPS / HAZARDS
      lastSegWasHazard = true;
      for (let sx = x; sx < endX; sx++) {
        grid[currentY][sx] = 1;
        for (let sy = currentY + 1; sy < height; sy++) grid[sy][sx] = 2;
      }

      // Add actual spikes in the middle (limited to max 2 wide spikes so it is easy to dodge/clear)
      const spikeX1 = x + 2;
      const spikeX2 = Math.min(x + 3, endX - 2);
      for (let sx = spikeX1; sx <= spikeX2; sx++) {
        grid[currentY - 1][sx] = 5; // Spike block above ground
      }

      // Add jump pad behind the spikes to allow high jumps
      if (rng.next() < 0.5) {
        grid[currentY - 1][x + 1] = 6; // Spring/Jump pad
      }

      // Hovering flying patroller
      if (levelId > 2 && rng.next() < 0.5) {
        enemies.push({
          type: 'fly-horizontal',
          x: x + 4,
          y: currentY - 4,
          range: 4,
          speed: 1.0 // Slightly slower flying for friendly platforming
        });
      }
    } 
    else if (choice < 88) {
      // 5. LOCKED SECURITY VAULT (Level 4+ only, introduces key and lock door)
      lastSegWasHazard = false;
      if (levelId >= 4 && !needsKeyPlaced) {
        // Place a brick barrier wall with a locked door
        const wallX = x + Math.floor(segWidth / 2);
        
        for (let sy = 0; sy < height; sy++) {
          if (sy >= currentY - 4 && sy < currentY) {
            if (sy === currentY - 2 || sy === currentY - 1) {
              grid[sy][wallX] = 12; // Locked Door blocks!
            } else {
              grid[sy][wallX] = 3; // Metal indestructibles
            }
          }
        }

        // Place ground safely
        for (let sx = x; sx < endX; sx++) {
          grid[currentY][sx] = 1;
          for (let sy = currentY + 1; sy < height; sy++) grid[sy][sx] = 2;
        }

        // Place key on the LEFT side of the wall, safely within reach of the player!
        const keyX = x + Math.max(1, Math.floor(segWidth / 4));
        const keyY = currentY - 2;
        collectibles.push({
          type: 'key',
          x: keyX,
          y: keyY,
          id: `key_${levelId}_${keyCount++}`
        });

        needsKeyPlaced = false;
      } else {
        // Fallback to simple climbing stairs
        for (let sx = x; sx < endX; sx++) {
          const stairHeight = sx - x;
          const sy = currentY - Math.min(stairHeight, 3);
          for (let row = sy; row < height; row++) {
            grid[row][sx] = (row === sy) ? 1 : 2;
          }
        }
        currentY = Math.max(6, currentY - Math.min(endX - x - 1, 3));
      }
    } 
    else {
      // 6. SPRING BOUNCE VAULT
      lastSegWasHazard = false;
      // Place ground
      for (let sx = x; sx < endX; sx++) {
        grid[currentY][sx] = 1;
        for (let sy = currentY + 1; sy < height; sy++) grid[sy][sx] = 2;
      }

      // Put a solid obstacle wall in front, with spring to jump over it
      const wallX = x + 5;
      grid[currentY - 1][wallX] = 3;
      grid[currentY - 2][wallX] = 3;
      grid[currentY - 3][wallX] = 3;

      // Spring on the left
      grid[currentY - 1][x + 2] = 6;

      // Coins on top of the wall
      collectibles.push({ type: 'coin', x: wallX, y: currentY - 4, id: `coin_wall_${x}` });

      if (levelId > 4) {
        // Add flying patroller over the wall
        enemies.push({
          type: 'fly-vertical',
          x: wallX + 2,
          y: currentY - 5,
          range: 3,
          speed: 0.9 // Slower vertical movement for ease of play
        });
      }
    }

    // Place key if needed and we are on flat area
    if (needsKeyPlaced && x > 15) {
      const keyY = currentY - 3;
      const keyX = x + 1;
      collectibles.push({
        type: 'key',
        x: keyX,
        y: keyY,
        id: `key_${levelId}_${keyCount++}`
      });
      needsKeyPlaced = false;
    }

    // Intermittently place a crumbling platform above
    if (rng.next() < 0.3 && x > 20) {
      const platY = currentY - 4;
      for (let sx = x + 2; sx < endX - 2; sx++) {
        grid[platY][sx] = 10; // Crumbling/fragile blocks
        // Place coin on top
        if (rng.next() < 0.5) {
          collectibles.push({ type: 'coin', x: sx, y: platY - 1, id: `coin_fragile_${sx}` });
        }
      }
    }

    // Intermittently place Checkpoint flag at flat areas
    const lastCheckpointX = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].x : 0;
    if (x > 25 && (x - lastCheckpointX >= 35) && !lastSegWasHazard) {
      // Safe flat landing
      grid[currentY][x] = 1;
      grid[currentY - 1][x] = 7; // Checkpoint block!
      checkpoints.push({ x: x, y: currentY - 1 });
    }

    // Increment cursor
    x = endX;
  }

  // --- FINAL GOAL ZONE ---
  // Large flat safe zone at the end for the flagpole!
  const finalX = width - 15;
  for (let sx = finalX; sx < width; sx++) {
    grid[12][sx] = 1;
    for (let sy = 13; sy < height; sy++) {
      grid[sy][sx] = 2;
    }
  }

  // Create nice stairs leading up to the flagpole!
  for (let stair = 0; stair < 4; stair++) {
    const sx = finalX + stair;
    for (let sy = 12 - stair; sy <= 12; sy++) {
      grid[sy][sx] = 1;
    }
  }

  // Place the Flagpole
  const flagpoleX = finalX + 7;
  grid[11][flagpoleX] = 8; // Flagpole block!

  const goalPos = { x: flagpoleX, y: 11 };

  // --- PLACE 3 UNIQUE STAR COINS IN EACH LEVEL ---
  // Place them deterministically at custom tricky locations
  const starPositions: Vector2D[] = [
    { x: Math.floor(width * 0.25), y: 5 },
    { x: Math.floor(width * 0.55), y: 4 },
    { x: Math.floor(width * 0.80), y: 6 },
  ];

  starPositions.forEach((pos, idx) => {
    // Make sure we don't overwrite a solid tile
    let finalY = pos.y;
    // Walk down until we find air or a platform above a safe block
    while (finalY < height && grid[finalY][pos.x] !== 0) {
      finalY--;
    }
    if (finalY > 1 && finalY < height) {
      collectibles.push({
        type: 'star_coin',
        x: pos.x,
        y: finalY,
        id: `star_${levelId}_${idx}`
      });
    }
  });

  return {
    id: levelId,
    name: meta.name,
    theme: meta.theme,
    width,
    height,
    timeLimit: meta.theme === 'cyber-fortress' ? 120 : 180,
    difficulty: meta.difficulty,
    grid,
    enemies,
    collectibles,
    checkpoints,
    startPos,
    goalPos,
    backgroundColors,
    accentColor,
    hint: meta.hint
  };
}
