'use client'

import React, { useRef, useEffect, useState } from 'react';

// Constants
const CANVAS_WIDTH = 800;    // User updated
const CANVAS_HEIGHT = 600;   // User updated
const COIN_RADIUS = 20;      // User updated
const SILVER_COIN_COLOR = '#C0C0C0';
const GOLD_COIN_COLOR = '#FFD700';
const COIN_FALL_SPEED = 1.5; // User updated
const MIN_TIME_BETWEEN_SPAWNS_MS = 500; // New: Min cooldown between spawn attempts
const COIN_LIFETIME_MS = 3000; // Each coin stays for 3 seconds unless it falls off earlier
const MIN_SPAWN_DISTANCE_FACTOR = 4; // Factor for minimum distance (COIN_RADIUS * factor)
const MAX_SPAWN_ATTEMPTS = 10; // Attempts to find a clear spawn spot

// Basket Constants
const BASKET_WIDTH = 100;
const BASKET_HEIGHT = 20;
const BASKET_COLOR = '#333333';
const BASKET_Y_OFFSET = 30; // From bottom of canvas
const BASKET_MOVE_SPEED = 20; // Speed for keyboard controls

interface Coin {
  id: number;
  x: number;
  y: number;
  type: 'silver' | 'gold';
  value: number;
  spawnTime: number; // To track lifetime
}

let nextCoinId = 0;

const GamePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [score, setScore] = useState(0);
  const actualLastSpawnOccasionTimeRef = useRef<number>(0); // Ref to track last successful spawn time
  const [basketX, setBasketX] = useState(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2);
  const leftArrowPressed = useRef(false);
  const rightArrowPressed = useRef(false);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const context = canvasElement.getContext('2d');
    if (!context) return;

    canvasElement.width = CANVAS_WIDTH;
    canvasElement.height = CANVAS_HEIGHT;

    // Keyboard event handlers
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        leftArrowPressed.current = true;
      }
      if (event.key === 'ArrowRight') {
        rightArrowPressed.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        leftArrowPressed.current = false;
      }
      if (event.key === 'ArrowRight') {
        rightArrowPressed.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const spawnCoin = () => {
      let attempts = 0;
      const minHorizontalDistance = COIN_RADIUS * MIN_SPAWN_DISTANCE_FACTOR;

      findSpotAndSpawn: while (attempts < MAX_SPAWN_ATTEMPTS) {
        const potentialX = Math.random() * (CANVAS_WIDTH - COIN_RADIUS * 2) + COIN_RADIUS;
        let tooClose = false;

        for (const existingCoin of coins) {
          if (existingCoin.y < COIN_RADIUS * 5) {
            if (Math.abs(potentialX - existingCoin.x) < minHorizontalDistance) {
              tooClose = true;
              break;
            }
          }
        }

        if (!tooClose) {
          const isGold = Math.random() < 1 / 11;
          const newCoin: Coin = {
            id: nextCoinId++,
            x: potentialX,
            y: -COIN_RADIUS,
            type: isGold ? 'gold' : 'silver',
            value: isGold ? 5 : 1,
            spawnTime: Date.now(), // Record spawn time
          };
          setCoins((prevCoins) => [...prevCoins, newCoin]);
          actualLastSpawnOccasionTimeRef.current = Date.now(); // Update time of successful spawn
          return;
        }
        attempts++;
      }
      // console.log('Skipped spawning: No clear spot found.');
    };

    let animationFrameId: number;

    const gameLoop = () => { // Removed timestamp as it wasn't used for Date.now() comparisons
      context.fillStyle = '#f0f0f0';
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const currentTime = Date.now(); // Use consistent Date.now() for this frame's logic

      // Update basket position based on keyboard input
      let newBasketX = basketX;
      if (leftArrowPressed.current) {
        newBasketX -= BASKET_MOVE_SPEED;
      }
      if (rightArrowPressed.current) {
        newBasketX += BASKET_MOVE_SPEED;
      }
      // Constrain basket
      if (newBasketX < 0) newBasketX = 0;
      if (newBasketX + BASKET_WIDTH > CANVAS_WIDTH) newBasketX = CANVAS_WIDTH - BASKET_WIDTH;
      // Only call setBasketX if position actually changed to avoid unnecessary re-renders from this source
      // Though useEffect already depends on basketX, this is a good practice.
      if (newBasketX !== basketX) {
         setBasketX(newBasketX);
      }

      // Spawn logic
      if (currentTime - actualLastSpawnOccasionTimeRef.current > MIN_TIME_BETWEEN_SPAWNS_MS) {
        if (coins.length === 0) {
          spawnCoin();
        } else {
          const lastCoin = coins[coins.length - 1]; // Get the most recently spawned coin
          if (lastCoin.y >= CANVAS_HEIGHT * 0.25) {
            spawnCoin();
          }
        }
      }

      setCoins((prevCoins) =>
        prevCoins
          .map((coin) => ({ ...coin, y: coin.y + COIN_FALL_SPEED }))
          .filter((coin) => 
            coin.y < CANVAS_HEIGHT + COIN_RADIUS && // Still on screen vertically
            (currentTime - coin.spawnTime) < COIN_LIFETIME_MS // Lifetime not expired
          )
      );

      coins.forEach((coin) => {
        context.beginPath();
        context.arc(coin.x, coin.y, COIN_RADIUS, 0, Math.PI * 2);
        context.fillStyle = coin.type === 'gold' ? GOLD_COIN_COLOR : SILVER_COIN_COLOR;
        context.fill();
        context.closePath();
      });
      
      // Draw basket
      context.fillStyle = BASKET_COLOR;
      context.fillRect(basketX, CANVAS_HEIGHT - BASKET_HEIGHT - BASKET_Y_OFFSET, BASKET_WIDTH, BASKET_HEIGHT);

      if (coins.length > 0 && coins.some(c => c.id === nextCoinId -1) && (nextCoinId-1) % 10 === 0) { 
          const currentCoinsForLog = coins; // Use a consistent snapshot for logging
          const silverCount = currentCoinsForLog.filter(c => c.type === 'silver').length;
          const goldCount = currentCoinsForLog.filter(c => c.type === 'gold').length;
          console.log(`Coins on screen: ${currentCoinsForLog.length}. Silver: ${silverCount}, Gold: ${goldCount} (S/G Ratio: ${goldCount > 0 ? (silverCount/goldCount).toFixed(1): 'inf'}) Last ID: ${nextCoinId-1}`);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    // Initialize actualLastSpawnOccasionTimeRef to allow first spawn after MIN_TIME_BETWEEN_SPAWNS_MS
    actualLastSpawnOccasionTimeRef.current = Date.now() - MIN_TIME_BETWEEN_SPAWNS_MS; 

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      // canvasElement.removeEventListener('mousemove', handleMouseMove); // Removed mouse listener
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [coins, basketX]); // basketX still needed for re-render when it changes, coins for game logic

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
      <h1>Coin Catcher</h1>
      <p>Score: {score}</p>
      <canvas ref={canvasRef} style={{ border: '1px solid #000' }} />
      <p>Coin Lifetime: {COIN_LIFETIME_MS / 1000}s. Fall speed: {COIN_FALL_SPEED}. Min spawn cooldown: {MIN_TIME_BETWEEN_SPAWNS_MS}ms. Next spawns after last coin falls 25%.</p>
    </div>
  );
};

export default GamePage; 