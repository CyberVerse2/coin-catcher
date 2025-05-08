'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const COIN_RADIUS = 20;
const SILVER_COIN_COLOR = '#C0C0C0';
const GOLD_COIN_COLOR = '#FFD700';
const MIN_TIME_BETWEEN_SPAWNS_MS = 500;
const MIN_SPAWN_DISTANCE_FACTOR = 4;
const MAX_SPAWN_ATTEMPTS = 10;
const BASKET_WIDTH = 100;
const BASKET_HEIGHT = 20;
const BASKET_COLOR = '#333333';
const BASKET_Y_OFFSET = 30;
const BASKET_MOVE_SPEED = 5;
const GAME_DURATION_S = 30; // Game duration in seconds
const MAX_MISSED_COINS = 5;

// Difficulty Scaling
const BASE_COIN_FALL_SPEED = 1.5; // Starting speed
const SPEED_INCREASE_INTERVAL_S = 6; // Increase speed every 6 seconds
const SPEED_INCREASE_AMOUNT = 0.5; // Speed increase per interval

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
  // Wagmi Hooks
  const { address, status: accountStatus } = useAccount(); // Renamed status to avoid conflict
  const { connectors, connect, error: connectError, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();

  // Game State Refs and State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [coins, setCoins] = useState<Coin[]>([]); 
  const coinsRef = useRef<Coin[]>([]);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(GAME_DURATION_S);
  const [missedCoins, setMissedCoins] = useState(0);
  const actualLastSpawnOccasionTimeRef = useRef<number>(0);
  const lastTimerUpdateTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const [basketX, setBasketX] = useState(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2);
  const leftArrowPressed = useRef(false);
  const rightArrowPressed = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');

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

      // --- Calculate Current Fall Speed --- 
      const elapsedTimeMs = currentTime - gameStartTimeRef.current;
      const currentInterval = Math.floor(elapsedTimeMs / (SPEED_INCREASE_INTERVAL_S * 1000));
      const currentFallSpeed = BASE_COIN_FALL_SPEED + (currentInterval * SPEED_INCREASE_AMOUNT);
      // --- End Fall Speed Calculation ---

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
        
        // Move coin using currentFallSpeed
        coin.y += currentFallSpeed;

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

  // Function to initiate connection
  const connectWallet = () => {
      const coinbaseConnector = connectors.find(c => c.name === 'Coinbase Wallet');
      if (coinbaseConnector) {
          connect({ connector: coinbaseConnector });
      }
  };

  // Modified Start Game: Requires connected wallet
  const startGame = () => {
    if (accountStatus !== 'connected') {
      console.error("Cannot start game: Wallet not connected.");
      // Optionally prompt connection here
      return;
    }
    console.log("Starting game...");
    setSubmissionStatus('idle');
    setPlayerName('');
    setScore(0);
    setMissedCoins(0);
    setTimer(GAME_DURATION_S);
    coinsRef.current = [];
    setCoins([]);
    setBasketX(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2);
    leftArrowPressed.current = false;
    rightArrowPressed.current = false;
    actualLastSpawnOccasionTimeRef.current = 0;
    lastTimerUpdateTimeRef.current = Date.now();
    gameStartTimeRef.current = Date.now();
    setGameState('running');
  };

  // Modified Submit Score: Uses connected address
  const submitHighScore = useCallback(async () => {
    if (!playerName.trim() || score <= 0 || isSubmitting || accountStatus !== 'connected' || !address) {
        console.log('Submission prevented: Invalid name, score, connection status, address or already submitting.');
        setSubmissionStatus('error'); 
        return;
    }
    setIsSubmitting(true);
    setSubmissionStatus('idle');
    console.log('Submitting score:', score, 'for player:', playerName, 'address:', address);

    try {
        const response = await fetch('/api/highscore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Send address instead of placeholder userId
            body: JSON.stringify({ 
                score: score,
                address: address, 
                userName: playerName.trim()
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Score submission successful:', result);
        setSubmissionStatus('success');
    } catch (error) {
        console.error("Failed to submit high score:", error);
        setSubmissionStatus('error');
    } finally {
        setIsSubmitting(false);
    }
  }, [score, playerName, isSubmitting, address, accountStatus]); // Added address/status dependencies

  const playAgain = () => { startGame(); };

  // Render Logic
  const renderContent = () => {
    if (accountStatus === 'disconnected') {
      return (
          <div style={{ textAlign: 'center', marginTop: '50px' }}>
              <button onClick={connectWallet} style={{ padding: '20px 40px', fontSize: '24px' }}>Connect Wallet to Play</button>
              {connectStatus === 'pending' && <p>Connecting...</p>}
              {connectError && <p style={{ color: 'red' }}>Error connecting: {connectError.message}</p>}
          </div>
      );
    }

    if (accountStatus === 'connecting') {
        return <p>Connecting wallet...</p>;
    }

    // Connected State:
    return (
        <>
            <div style={{ marginBottom: '10px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                    Connected: {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
                </span>
                <button onClick={() => disconnect()} style={{ padding: '5px 10px'}}>Disconnect</button>
            </div>
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
                      
                      {/* Score Submission Form */} 
                      {submissionStatus !== 'success' && score > 0 && (
                          <div style={{ marginTop: '20px' }}>
                              <input 
                                  type="text"
                                  value={playerName}
                                  onChange={(e) => setPlayerName(e.target.value)}
                                  placeholder="Enter Your Name"
                                  maxLength={20} // Optional: limit name length
                                  disabled={isSubmitting}
                                  style={{ padding: '10px', marginRight: '10px', fontSize: '16px' }}
                              />
                              <button 
                                  onClick={submitHighScore}
                                  disabled={isSubmitting || !playerName.trim()}
                                  style={{ padding: '10px 20px', fontSize: '16px' }}
                               >
                                  {isSubmitting ? 'Submitting...' : 'Submit Score'}
                              </button>
                              {submissionStatus === 'error' && <p style={{ color: 'red', marginTop: '10px' }}>Failed to submit score.</p>}
                          </div>
                      )}
                      {submissionStatus === 'success' && <p style={{ color: 'lime', marginTop: '10px' }}>Score submitted!</p>}
                      
                      <button 
                          onClick={playAgain} 
                          style={{ 
                              padding: '15px 30px', 
                              fontSize: '20px', 
                              marginTop: '30px' // Add margin above play again button
                          }}
                       >
                          Play Again?
                      </button>
                  </div>
              )}
            </div>
            <p style={{ marginTop: '10px' }}>Use Left/Right Arrows to move the basket.</p>
            <p>Base Speed: {BASE_COIN_FALL_SPEED}, Increases by {SPEED_INCREASE_AMOUNT} every {SPEED_INCREASE_INTERVAL_S}s.</p>
        </>
    );
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
      <h1>Coin Catcher</h1>
      {renderContent()}
    </div>
  );
};

export default GamePage; 