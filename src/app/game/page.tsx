'use client'

import React, { useRef, useEffect, useState } from 'react';

// Constants
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
const GAME_DURATION_S = 60; // Game duration in seconds
const MAX_MISSED_COINS = 3;

// Types
type GameState = 'idle' | 'running' | 'gameOver';

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
  const [gameState, setGameState] = useState<GameState>('idle');
  const [coins, setCoins] = useState<Coin[]>([]); 
  const coinsRef = useRef<Coin[]>([]);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(GAME_DURATION_S);
  const [missedCoins, setMissedCoins] = useState(0);
  const actualLastSpawnOccasionTimeRef = useRef<number>(0);
  const lastTimerUpdateTimeRef = useRef<number>(0); // Ref for timer update logic
  const [basketX, setBasketX] = useState(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2);
  const leftArrowPressed = useRef(false);
  const rightArrowPressed = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null); // Ref to store animation frame ID

  // Sync state to ref
  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  // Main game loop and event listeners effect
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const context = canvasElement.getContext('2d');
    if (!context) return;

    canvasElement.width = CANVAS_WIDTH;
    canvasElement.height = CANVAS_HEIGHT;
    
    // Initialize ref with current state value
    coinsRef.current = coins; 

    const handleKeyDown = (event: KeyboardEvent) => {
      if (gameState !== 'running') return; // Only allow movement if running
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
        for (const existingCoin of coinsRef.current) { 
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
          coinsRef.current.push(newCoin); 
          setCoins([...coinsRef.current]); 
          actualLastSpawnOccasionTimeRef.current = Date.now();
          return;
        }
        attempts++;
      }
    };

    const gameLoop = () => {
      if (!context) return;
      const currentTime = Date.now();

      // --- Game State Check --- 
      if (gameState !== 'running') {
        // Clear canvas and draw background overlay if game over
        context.fillStyle = '#f0f0f0';
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (gameState === 'gameOver') {
             context.fillStyle = 'rgba(0, 0, 0, 0.7)';
             context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
             // Explicitly ensuring no text is drawn on canvas here
        }
        // Keep requesting frames even if not running
        animationFrameIdRef.current = requestAnimationFrame(gameLoop);
        return; // Stop further execution in this frame if not running
      }
      // --- End Game State Check ---

      // --- Timer Update --- 
      if (currentTime - lastTimerUpdateTimeRef.current >= 1000) {
          setTimer(prevTimer => {
              const newTime = prevTimer - 1;
              if (newTime <= 0) {
                  setGameState('gameOver'); // Game over by time
                  return 0;
              }
              return newTime;
          });
          lastTimerUpdateTimeRef.current = currentTime;
      }
      // --- End Timer Update ---

      context.fillStyle = '#f0f0f0';
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // --- Basket Movement --- 
      let newBasketX = basketX;
      if (leftArrowPressed.current) newBasketX -= BASKET_MOVE_SPEED;
      if (rightArrowPressed.current) newBasketX += BASKET_MOVE_SPEED;
      if (newBasketX < 0) newBasketX = 0;
      if (newBasketX + BASKET_WIDTH > CANVAS_WIDTH) newBasketX = CANVAS_WIDTH - BASKET_WIDTH;
      if (newBasketX !== basketX) setBasketX(newBasketX);
      // --- End Basket Movement --- 

      // --- Spawning --- 
      const timeSinceLastSpawn = currentTime - actualLastSpawnOccasionTimeRef.current;
      if (timeSinceLastSpawn > MIN_TIME_BETWEEN_SPAWNS_MS) {
        if (coinsRef.current.length === 0 || (coinsRef.current.length > 0 && coinsRef.current[coinsRef.current.length - 1].y >= CANVAS_HEIGHT * 0.25)) {
          spawnCoin();
        }
      }
      // --- End Spawning --- 

      const basketTopY = CANVAS_HEIGHT - BASKET_HEIGHT - BASKET_Y_OFFSET;
      const basketBottomY = basketTopY + BASKET_HEIGHT;
      const basketLeftX = basketX;
      const basketRightX = basketX + BASKET_WIDTH;

      let scoreUpdateAmountInFrame = 0;
      let missedCoinsUpdateInFrame = 0;
      let coinsChanged = false;
      
      // --- Process Coins --- 
      for (let i = coinsRef.current.length - 1; i >= 0; i--) {
        const coin = coinsRef.current[i];
        coin.y += COIN_FALL_SPEED;

        const coinBottom = coin.y + COIN_RADIUS;
        const coinTop = coin.y - COIN_RADIUS;
        const coinLeft = coin.x - COIN_RADIUS;
        const coinRight = coin.x + COIN_RADIUS;
        
        // Check if off-screen (Missed)
        if (coin.y - COIN_RADIUS > CANVAS_HEIGHT) {
             missedCoinsUpdateInFrame++;
             coinsRef.current.splice(i, 1);
             coinsChanged = true;
             continue; 
        }

        // Check for collision with basket (Caught)
        const caught = 
            coinBottom >= basketTopY &&
            coinTop <= basketBottomY && 
            coinRight >= basketLeftX &&
            coinLeft <= basketRightX;

        if (caught) {
          scoreUpdateAmountInFrame += coin.value;
          coinsRef.current.splice(i, 1);
          coinsChanged = true;
        }
      }
      // --- End Process Coins --- 
      
      // --- Update State --- 
      if (coinsChanged) {
          setCoins([...coinsRef.current]);
      }
      if (scoreUpdateAmountInFrame > 0) {
        setScore(prevScore => prevScore + scoreUpdateAmountInFrame);
      }
      if (missedCoinsUpdateInFrame > 0) {
          setMissedCoins(prevCount => {
              const newCount = prevCount + missedCoinsUpdateInFrame;
              if (newCount >= MAX_MISSED_COINS) {
                  setGameState('gameOver'); // Game over by misses
                  return MAX_MISSED_COINS;
              }
              return newCount;
          });
      }
      // --- End Update State --- 

      // --- Drawing --- 
      context.fillStyle = SILVER_COIN_COLOR;
      coinsRef.current.forEach((coin) => {
        context.beginPath();
        context.arc(coin.x, coin.y, COIN_RADIUS, 0, Math.PI * 2);
        context.fillStyle = coin.type === 'gold' ? GOLD_COIN_COLOR : SILVER_COIN_COLOR;
        context.fill();
        context.closePath();
      });
      context.fillStyle = BASKET_COLOR;
      context.fillRect(basketX, basketTopY, BASKET_WIDTH, BASKET_HEIGHT);
      // --- End Drawing --- 

      animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    };
    
    // Start the loop
    animationFrameIdRef.current = requestAnimationFrame(gameLoop);

    // Cleanup function
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [basketX, gameState, score]); // Added gameState and score to dependencies

  const startGame = () => {
    console.log("Starting game...");
    setScore(0);
    setMissedCoins(0);
    setTimer(GAME_DURATION_S);
    coinsRef.current = []; // Clear coins ref
    setCoins([]); // Clear coins state
    setBasketX(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2); // Reset basket pos
    leftArrowPressed.current = false;
    rightArrowPressed.current = false;
    actualLastSpawnOccasionTimeRef.current = 0; // Reset spawn timer
    lastTimerUpdateTimeRef.current = Date.now(); // Reset session timer update time
    setGameState('running');
  };

  const playAgain = () => {
    startGame(); // For now, play again just restarts
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', textAlign: 'center' }}>
      <h1>Coin Catcher</h1>
      <div style={{ marginBottom: '10px' }}>
          <span>Score: {score}</span> | 
          <span>Time Left: {timer}s</span> | 
          <span>Missed: {missedCoins}/{MAX_MISSED_COINS}</span>
      </div>
      <div style={{ position: 'relative', width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
          <canvas 
              ref={canvasRef} 
              style={{ border: '1px solid #000', display: 'block' }} 
           />
          {gameState === 'idle' && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <button onClick={startGame} style={{ padding: '20px 40px', fontSize: '24px' }}>Start Game</button>
              </div>
          )}
          {gameState === 'gameOver' && (
               <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    color: 'white', 
                    textAlign: 'center',
                    flexDirection: 'column' 
                }}>
                  <h2 style={{ fontSize: '40px', margin: '0 0 10px 0' }}>Game Over!</h2>
                  <p style={{ fontSize: '30px', margin: '0 0 30px 0' }}>Final Score: {score}</p>
                  <button 
                      onClick={playAgain} 
                      style={{ 
                          padding: '15px 30px', 
                          fontSize: '20px', 
                      }}
                   >
                      Play Again?
                  </button>
              </div>
          )}
      </div>
      <p style={{ marginTop: '10px' }}>Use Left/Right Arrows to move the basket.</p>
      {/* <p>Fall speed: {COIN_FALL_SPEED}. Min spawn cooldown: {MIN_TIME_BETWEEN_SPAWNS_MS}ms. Next spawns after last coin falls 25%.</p> */}
    </div>
  );
};

export default GamePage; 