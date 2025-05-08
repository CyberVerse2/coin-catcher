'use client'

import React, { useRef, useEffect, useState } from 'react';

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const COIN_RADIUS = 15;
const SILVER_COIN_COLOR = '#C0C0C0';
const GOLD_COIN_COLOR = '#FFD700';
const COIN_FALL_SPEED = 2;
const SPAWN_INTERVAL = 1000; // ms, how often a new coin might spawn

interface Coin {
  id: number;
  x: number;
  y: number;
  type: 'silver' | 'gold';
  value: number;
}

let nextCoinId = 0;

const GamePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [score, setScore] = useState(0); // Will be used later

  // Function to spawn a new coin
  const spawnCoin = () => {
    const randomX = Math.random() * (CANVAS_WIDTH - COIN_RADIUS * 2) + COIN_RADIUS;
    const isGold = Math.random() < 1 / 11; // 1 out of 11 chances for gold (approx 10:1 silver to gold)

    const newCoin: Coin = {
      id: nextCoinId++,
      x: randomX,
      y: -COIN_RADIUS, // Start just above the canvas
      type: isGold ? 'gold' : 'silver',
      value: isGold ? 5 : 1,
    };

    setCoins((prevCoins) => [...prevCoins, newCoin]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Game loop
    let lastSpawnTime = 0;
    let animationFrameId: number;

    const gameLoop = (timestamp: number) => {
      // Clear canvas
      context.fillStyle = '#f0f0f0';
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Spawn new coins periodically
      if (timestamp - lastSpawnTime > SPAWN_INTERVAL) {
        spawnCoin();
        lastSpawnTime = timestamp;
      }

      // Update and draw coins
      setCoins((prevCoins) =>
        prevCoins
          .map((coin) => ({ ...coin, y: coin.y + COIN_FALL_SPEED })) // Move coins down
          .filter((coin) => coin.y < CANVAS_HEIGHT + COIN_RADIUS) // Remove coins that are off-screen
      );

      coins.forEach((coin) => {
        context.beginPath();
        context.arc(coin.x, coin.y, COIN_RADIUS, 0, Math.PI * 2);
        context.fillStyle = coin.type === 'gold' ? GOLD_COIN_COLOR : SILVER_COIN_COLOR;
        context.fill();
        context.closePath();

        // For debugging spawn ratio and value:
        // context.fillStyle = '#000';
        // context.font = '10px Arial';
        // context.fillText(`${coin.type}(${coin.value})`, coin.x - COIN_RADIUS, coin.y - COIN_RADIUS - 5);
      });
      
      // For debugging spawn ratio, let's log to console
      if (coins.length > 0 && coins[coins.length-1].id % 10 === 0) { // Log every 10th spawned coin approx
          const silverCount = coins.filter(c => c.type === 'silver').length;
          const goldCount = coins.filter(c => c.type === 'gold').length;
          console.log(`Coins: Silver-${silverCount}, Gold-${goldCount} (Ratio S/G: ${goldCount > 0 ? (silverCount/goldCount).toFixed(1): 'inf'})`);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [coins]); // Re-run effect if coins array reference changes to redraw

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
      <h1>Coin Catcher</h1>
      <p>Score: {score}</p> {/* Display score */}
      <canvas ref={canvasRef} style={{ border: '1px solid #000' }} />
      <p>Game interface will be built here.</p>
    </div>
  );
};

export default GamePage; 