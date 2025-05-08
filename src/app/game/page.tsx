'use client'

import React, { useRef, useEffect, useState } from 'react';

// Constants (ensure these are final user values)
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const COIN_RADIUS = 20;
const SILVER_COIN_COLOR = '#C0C0C0';
const GOLD_COIN_COLOR = '#FFD700';
const COIN_FALL_SPEED = 1.5;
const MIN_TIME_BETWEEN_SPAWNS_MS = 500;
const MIN_SPAWN_DISTANCE_FACTOR = 4;
const MAX_SPAWN_ATTEMPTS = 10;

const BASKET_WIDTH = 100;
const BASKET_HEIGHT = 20;
const BASKET_COLOR = '#333333';
const BASKET_Y_OFFSET = 30;
const BASKET_MOVE_SPEED = 5;

interface Coin {
  id: number;
  x: number;
  y: number;
  type: 'silver' | 'gold';
  value: number;
  spawnTime: number;
}

let nextCoinId = 0;

const GamePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coins, setCoins] = useState<Coin[]>([]);
  const coinsRef = useRef<Coin[]>([]); // Ref holds the mutable game state for the loop

  const [score, setScore] = useState(0);
  const actualLastSpawnOccasionTimeRef = useRef<number>(0);
  const [basketX, setBasketX] = useState(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2);
  const leftArrowPressed = useRef(false);
  const rightArrowPressed = useRef(false);

  // Main game loop and event listeners effect
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const context = canvasElement.getContext('2d');
    if (!context) return;

    canvasElement.width = CANVAS_WIDTH;
    canvasElement.height = CANVAS_HEIGHT;

    // Sync initial state to ref
    coinsRef.current = coins;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') leftArrowPressed.current = true;
      if (event.key === 'ArrowRight') rightArrowPressed.current = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') leftArrowPressed.current = false;
      if (event.key === 'ArrowRight') rightArrowPressed.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const spawnCoin = () => {
      let attempts = 0;
      const minHorizontalDistance = COIN_RADIUS * MIN_SPAWN_DISTANCE_FACTOR;
      while (attempts < MAX_SPAWN_ATTEMPTS) {
        const potentialX = Math.random() * (CANVAS_WIDTH - COIN_RADIUS * 2) + COIN_RADIUS;
        let tooClose = false;
        for (const existingCoin of coinsRef.current) { // Use ref
          if (existingCoin.y < COIN_RADIUS * 5 && Math.abs(potentialX - existingCoin.x) < minHorizontalDistance) {
            tooClose = true; break;
          }
        }
        if (!tooClose) {
          const isGold = Math.random() < 1 / 11;
          const newCoin: Coin = {
            id: nextCoinId++, x: potentialX, y: -COIN_RADIUS,
            type: isGold ? 'gold' : 'silver', value: isGold ? 5 : 1,
            spawnTime: Date.now(),
          };
          console.log(`Spawning coin ${newCoin.id}`);
          coinsRef.current.push(newCoin); // Mutate ref directly
          setCoins([...coinsRef.current]); // Update state to trigger re-render eventually
          actualLastSpawnOccasionTimeRef.current = Date.now();
          return;
        }
        attempts++;
      }
    };

    let animationFrameId: number;
    const gameLoop = () => {
      if (!context) return; // Ensure context is still valid

      context.fillStyle = '#f0f0f0';
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const currentTime = Date.now();

      let newBasketX = basketX;
      if (leftArrowPressed.current) newBasketX -= BASKET_MOVE_SPEED;
      if (rightArrowPressed.current) newBasketX += BASKET_MOVE_SPEED;
      if (newBasketX < 0) newBasketX = 0;
      if (newBasketX + BASKET_WIDTH > CANVAS_WIDTH) newBasketX = CANVAS_WIDTH - BASKET_WIDTH;
      if (newBasketX !== basketX) setBasketX(newBasketX);

      // Restore original spawn logic, operating on coinsRef.current
      const timeSinceLastSpawn = currentTime - actualLastSpawnOccasionTimeRef.current;
      if (timeSinceLastSpawn > MIN_TIME_BETWEEN_SPAWNS_MS) {
        if (coinsRef.current.length === 0) {
          // console.log(`Spawn check: OK (ref empty)`);
          spawnCoin();
        } else {
          const lastCoin = coinsRef.current[coinsRef.current.length - 1];
          if (lastCoin.y >= CANVAS_HEIGHT * 0.25) {
            // console.log(`Spawn check: OK (last coin Y ${lastCoin.y.toFixed(1)} >= ${CANVAS_HEIGHT * 0.25})`);
            spawnCoin();
          }
        }
      }

      const basketTopY = CANVAS_HEIGHT - BASKET_HEIGHT - BASKET_Y_OFFSET;
      const basketBottomY = basketTopY + BASKET_HEIGHT;
      const basketLeftX = basketX;
      const basketRightX = basketX + BASKET_WIDTH;

      let scoreUpdateAmountInFrame = 0;
      let coinsChanged = false;
      
      // Process coins directly from the ref, iterating backwards for safe removal
      for (let i = coinsRef.current.length - 1; i >= 0; i--) {
        const coin = coinsRef.current[i];
        
        // Move coin
        coin.y += COIN_FALL_SPEED;

        const coinBottom = coin.y + COIN_RADIUS;
        const coinTop = coin.y - COIN_RADIUS;
        const coinLeft = coin.x - COIN_RADIUS;
        const coinRight = coin.x + COIN_RADIUS;
        
        // Check if off-screen
        if (coin.y - COIN_RADIUS > CANVAS_HEIGHT) { // Check if top edge is below bottom
             console.log(`Coin ${coin.id} removed (off-screen)`);
             coinsRef.current.splice(i, 1);
             coinsChanged = true;
             continue; // Go to next coin
        }

        // Check for collision with basket
        const caught = 
            coinBottom >= basketTopY &&
            coinTop <= basketBottomY && 
            coinRight >= basketLeftX &&
            coinLeft <= basketRightX;

        if (caught) {
          scoreUpdateAmountInFrame += coin.value;
          console.log(`Coin ${coin.id} removed (caught)`);
          coinsRef.current.splice(i, 1);
          coinsChanged = true;
          // No continue here, let score update happen below
        }
      }
      
      // Update React state if changes occurred
      if (coinsChanged) {
          setCoins([...coinsRef.current]); // Trigger re-render for potential UI updates
      }
      if (scoreUpdateAmountInFrame > 0) {
        setScore(prevScore => prevScore + scoreUpdateAmountInFrame);
      }

      // Draw all coins currently in the ref
      context.fillStyle = SILVER_COIN_COLOR; // Default color
      coinsRef.current.forEach((coin) => {
        context.beginPath();
        context.arc(coin.x, coin.y, COIN_RADIUS, 0, Math.PI * 2);
        context.fillStyle = coin.type === 'gold' ? GOLD_COIN_COLOR : SILVER_COIN_COLOR;
        context.fill();
        context.closePath();
      });

      context.fillStyle = BASKET_COLOR;
      context.fillRect(basketX, basketTopY, BASKET_WIDTH, BASKET_HEIGHT);
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [basketX]); // Only depends on basketX now for re-running effect

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
      <h1>Coin Catcher</h1>
      <p>Score: {score}</p>
      <canvas ref={canvasRef} style={{ border: '1px solid #000' }} />
      <p>Fall speed: {COIN_FALL_SPEED}. Min spawn cooldown: {MIN_TIME_BETWEEN_SPAWNS_MS}ms. Next spawns after last coin falls 25%.</p>
    </div>
  );
};

export default GamePage; 