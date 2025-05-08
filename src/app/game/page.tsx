'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import Leaderboard from '@/components/Leaderboard';

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

// Define the expected response structure for wallet_addSubAccount
interface AddSubAccountResponse {
  address: string;
  chainId?: string; // Hex
  factory?: string; // Address
  factoryData?: string; // Hex
}

const GamePage = () => {
  // Wagmi Hooks
  const { address: connectedAddress, addresses, status: accountStatus } = useAccount();
  const { connectors, connect, error: connectError, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  
  // Determine parent EOA from addresses list
  const parentEoaAddress = accountStatus === 'connected' && addresses && addresses.length > 0 ? addresses[addresses.length - 1] : undefined;
  
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
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  // State for the single game account address (from SDK)
  const [gameAccountAddress, setGameAccountAddress] = useState<string | null>(null);
  const [gameAccountError, setGameAccountError] = useState<string | null>(null);
  const [isSettingUpAccount, setIsSettingUpAccount] = useState<boolean>(false);

  // State for Welcome Modal / Username Update
  const [currentGameAccountUsername, setCurrentGameAccountUsername] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);
  const [modalUsernameInput, setModalUsernameInput] = useState<string>('');
  const [isSavingUsername, setIsSavingUsername] = useState<boolean>(false);
  const [usernameSaveError, setUsernameSaveError] = useState<string | null>(null);

  // New state to track if account setup (username choice) is pending/complete
  const [isAccountSetupComplete, setIsAccountSetupComplete] = useState<boolean>(false);

  const COIN_PRICE_IN_ETH = 0.000525; // Ensure this is correctly placed

  // Sync coins state to ref
  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  // Effect to get game account address via SDK and then fetch account details from DB
  useEffect(() => {
    const setupGameAccount = async () => {
      if (accountStatus === 'connected' && parentEoaAddress && walletClient && !gameAccountAddress && !isSettingUpAccount && !isAccountSetupComplete) {
        console.log('[Game Account Flow] Parent EOA connected. Starting game account setup...');
        setIsSettingUpAccount(true);
        setGameAccountError(null);
        let accountAddressFromSDK: string | null = null;

        try {
          // 1. Get game account address from SDK
          console.log('[Game Account Flow] Calling SDK: wallet_addSubAccount for parent:', parentEoaAddress);
          const sdkResponse = await walletClient.request({
            method: 'wallet_addSubAccount',
            params: [{
              version: '1',
              account: {
                type: 'create',
                keys: [{ type: 'address', key: parentEoaAddress as `0x${string}` }]
              }
            }]
          } as any) as AddSubAccountResponse | null;

          if (!sdkResponse || !sdkResponse.address) {
            throw new Error('Failed to get game account address from SDK (null or invalid response).');
          }
          accountAddressFromSDK = sdkResponse.address;
          console.log('[Game Account Flow] Address received from SDK:', accountAddressFromSDK);
          setGameAccountAddress(accountAddressFromSDK);
          setGameAccountError(null); // Clear SDK errors before DB check

          // 2. Fetch account details from DB using the SDK address
          console.log('[Game Account Flow] Fetching account details from DB for:', accountAddressFromSDK);
          const response = await fetch(`/api/account?gameAccountAddress=${accountAddressFromSDK}`);
          
          if (response.ok) {
            const account = await response.json();
            console.log('[Game Account Flow] Account details from DB:', account);
            setCurrentGameAccountUsername(account.username);
            if (account.username && !account.username.startsWith('Player_')) {
              console.log('[Game Account Flow] Existing user with non-default username. Setup complete.');
              setIsAccountSetupComplete(true);
              setShowWelcomeModal(false); // Ensure modal is hidden
            } else {
              console.log('[Game Account Flow] New user or default username. Setup pending (modal will show).');
              setIsAccountSetupComplete(false);
              // setShowWelcomeModal(true); // Let the other useEffect handle this based on isAccountSetupComplete
            }
          } else if (response.status === 404) {
            console.log('[Game Account Flow] Account not found in DB. New user setup required (modal will show).');
            setCurrentGameAccountUsername(null); // Ensure no stale username
            setIsAccountSetupComplete(false);
          } else {
            // Other non-404 error from backend
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error from account fetch' }));
            throw new Error(errorData.error || `Failed to fetch account details (status: ${response.status})`);
          }

        } catch (error: any) {
          console.error('[Game Account Flow] Error during game account setup:', error);
          let message = 'Failed to set up game account.';
          if (error.code === 4001) { // SDK user rejection
            message = 'User rejected the wallet request.';
          } else if (error.message) {
            message = error.message;
          }
          setGameAccountError(message);
          setGameAccountAddress(null); 
          setIsAccountSetupComplete(false); // Ensure setup is marked incomplete on error
          setCurrentGameAccountUsername(null);
        }
        setIsSettingUpAccount(false);
      }
    };

    setupGameAccount();
  }, [accountStatus, parentEoaAddress, walletClient, gameAccountAddress, isSettingUpAccount, isAccountSetupComplete]); // Added isAccountSetupComplete to prevent re-running if already complete

  // Show Welcome Modal if game account is fetched but setup is not complete
  useEffect(() => {
    if (gameAccountAddress && !isAccountSetupComplete && !isSettingUpAccount && gameState === 'idle') {
      // This effect now primarily reacts to isAccountSetupComplete being false after the setupGameAccount effect has run.
      console.log('Conditions met to show Welcome Modal (gameAddress present, setup incomplete, not currently setting up).');
      setShowWelcomeModal(true);
    }
  }, [gameAccountAddress, isAccountSetupComplete, isSettingUpAccount, gameState]);

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

      // --- Draw HUD (Score, Timer, Missed Coins) ---
      context.fillStyle = '#333333'; // Dark color for text
      context.font = '24px Arial';
      context.textAlign = 'left';
      context.fillText(`Score: ${score}`, 20, 40);
      context.textAlign = 'right';
      context.fillText(`Time: ${timer}`, CANVAS_WIDTH - 20, 40);
      context.textAlign = 'left'; // Reset for next text if any or keep consistent
      context.fillText(`Missed: ${missedCoins}/${MAX_MISSED_COINS}`, 20, 70);
      // --- End HUD Drawing ---

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

  // Modified Start Game: Requires game account address
  const startGame = () => {
    if (gameState === 'running' || !gameAccountAddress || !isAccountSetupComplete) {
        console.log("Cannot start game. State:", gameState, "Game Account Address:", gameAccountAddress, "SetupComplete:", isAccountSetupComplete);
        if (isSettingUpAccount) {
            alert('Still setting up game account, please wait...');
        } else if (gameAccountError) {
            alert(`Cannot start game: ${gameAccountError}`);
        } else if (!isAccountSetupComplete) {
            alert('Please complete account setup (set username) before starting the game.');
            setShowWelcomeModal(true); 
        }
        return;
    }
    console.log("Starting game with account:", gameAccountAddress, "Username:", currentGameAccountUsername);
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
    setSubmissionStatus('idle');
    setGameState('running');
  };

  // Renamed and adjusted submission logic
  const performScoreSubmission = useCallback(async () => {
    if (!isAccountSetupComplete || !gameAccountAddress || score <= 0) { 
      console.log('Conditions not met for score submission:', { isAccountSetupComplete, gameAccountAddress, score });
      if (score > 0) { 
          setSubmissionStatus('error');
      } else {
          setSubmissionStatus('idle'); 
      }
      return;
    }
    
    const highScoreUsername = currentGameAccountUsername || 'Anonymous'; 

    setIsSubmitting(true); // Keep for broader control if needed
    setSubmissionStatus('pending'); 
    console.log('Submitting score:', score, 'for player:', highScoreUsername, 'address:', gameAccountAddress);

    try {
        const response = await fetch('/api/highscore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                score: score, 
                address: gameAccountAddress, 
                userName: highScoreUsername 
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const result = await response.json(); 
        console.log('Score submission successful:', result);
        setSubmissionStatus('success');
    } catch (error: any) {
        console.error("Failed to submit high score:", error);
        setSubmissionStatus('error');
    } finally {
        setIsSubmitting(false);
    }
  }, [score, gameAccountAddress, isAccountSetupComplete, currentGameAccountUsername, setIsSubmitting, setSubmissionStatus]);

  // Effect to automatically submit score on game over
  useEffect(() => {
    // Only attempt submission if the status is idle (to prevent re-submission on re-renders after an attempt)
    if (gameState === 'gameOver' && submissionStatus === 'idle') {
        if (score > 0 && isAccountSetupComplete && gameAccountAddress) {
            console.log('Game over, triggering automatic score submission.');
            performScoreSubmission();
        } else if (score <= 0) {
            console.log('Game over, no score to submit or conditions not met for submission.');
            // No action needed, submissionStatus remains 'idle', UI will show "No score to submit"
        }
    }
  }, [gameState, score, isAccountSetupComplete, gameAccountAddress, performScoreSubmission, submissionStatus]);

  const handleSaveUsername = async () => {
    if (!modalUsernameInput.trim() || !gameAccountAddress || !parentEoaAddress) {
        setUsernameSaveError('Please enter a valid username. Wallet details missing.');
        return;
    }
    setIsSavingUsername(true);
    setUsernameSaveError(null);
    console.log(`Attempting to setup account for game address ${gameAccountAddress} with username '${modalUsernameInput}' and parent EOA ${parentEoaAddress}`);

    try {
        const response = await fetch('/api/account/setup', { // CALL THE NEW SETUP ENDPOINT
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameAccountAddress: gameAccountAddress,
                parentEoaAddress: parentEoaAddress, // Pass parent EOA
                newUsername: modalUsernameInput.trim(),
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to setup account: ${response.status}`);
        }
        const account = await response.json(); // Expecting the full Account object
        console.log('Account setup successfully:', account);

        setCurrentGameAccountUsername(account.username);
        setIsAccountSetupComplete(true); // Mark setup as complete
        setShowWelcomeModal(false); 
        setModalUsernameInput(''); 

    } catch (error: any) {
        console.error("Failed to setup account:", error);
        setUsernameSaveError(error.message || 'An unknown error occurred.');
        setIsAccountSetupComplete(false); // Ensure setup is marked as not complete on error
    } finally {
        setIsSavingUsername(false);
    }
  };

  const playAgain = () => { 
    // submissionStatus is reset at the beginning of startGame now
    startGame(); 
  };

  // Render Logic
  const renderContent = () => {
    if (accountStatus === 'disconnected' || accountStatus === 'connecting' || accountStatus === 'reconnecting') {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-2xl font-bold mb-4">Welcome to Coin Catcher!</h2>
          {connectError && <p className="text-red-500 mt-2">Error: {connectError.message}</p>}
          {connectStatus === 'pending' && <p className="text-gray-500 mt-2">Connecting with wallet...</p>}
          {(accountStatus === 'connecting' || accountStatus === 'reconnecting') && !connectStatus && (
            <p className="text-gray-500 mt-2">Attempting to connect...</p>
          )}
          {accountStatus === 'disconnected' && !connectError && (
            <p className="text-gray-600 mt-2">Please use the "Connect Wallet" button above to play.</p>
          )}
        </div>
      );
    }

    if (isSettingUpAccount) { // Show a generic setup message
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-xl">Preparing your game account...</p>
          {gameAccountError && <p className="text-red-500 text-xl mt-2">Error: {gameAccountError}</p>}
        </div>
      );
    }

    // After SDK address is fetched, but before account setup (username) is complete, the modal will be triggered by its useEffect
    // If there was an error during the DB fetch part of setup, gameAccountError will be shown by the above block if isSettingUpAccount is still true,
    // or if !isAccountSetupComplete and modal isn't shown for some reason.
    if (accountStatus === 'connected' && gameAccountAddress && !isAccountSetupComplete && !showWelcomeModal && !isSettingUpAccount) {
        // This state indicates an issue or a brief moment before modal shows. Display a message or rely on modal.
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-xl">Finalizing account setup...</p>
                {gameAccountError && <p className="text-red-500 text-xl mt-2">Error: {gameAccountError}</p>} 
            </div>
        );
    }

    // Wallet Connected and Game Account Ready State
    return (
      <div 
        className="relative z-10" 
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        {/* Display the game account being used */}
        {gameAccountAddress && (
          <div className="absolute top-2 left-2 text-xs text-gray-500 bg-white p-1 rounded shadow z-20">
            Game Account: {gameAccountAddress.substring(0, 6)}...{gameAccountAddress.substring(gameAccountAddress.length - 4)}
          </div>
        )}

        <canvas ref={canvasRef} className="border border-gray-300 rounded-lg shadow-md" />
        {gameState === 'idle' && gameAccountAddress && isAccountSetupComplete && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 40, pointerEvents: 'none' }}>
            <button onClick={startGame} disabled={!isAccountSetupComplete} style={{ padding: '20px 40px', fontSize: '24px', pointerEvents: 'auto' }}>Start Game</button>
          </div>
        )}
        {gameState === 'idle' && gameAccountAddress && !isAccountSetupComplete && !showWelcomeModal && (
             <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 40 }}>
                <p className="text-xl text-gray-700">Please set your username to play.</p>
                {usernameSaveError && <p style={{ color: 'red', marginTop: '10px' }}>Error: {usernameSaveError}</p>} 
                {/* Modal should be shown by its own logic, this is a fallback message area if modal isn't showing but should be */} 
            </div>
        )}
        {gameState === 'gameOver' && gameAccountAddress && (
          <div style={{
             position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
             display: 'flex', 
             justifyContent: 'center', 
             alignItems: 'center',
             color: 'white', 
             textAlign: 'center',
             flexDirection: 'column', 
             zIndex: 40,
             pointerEvents: 'auto'
         }}>
            <h2 style={{ fontSize: '40px', margin: '0 0 10px 0' }}>Game Over!</h2>
            <p style={{ fontSize: '30px', margin: '0 0 30px 0' }}>Final Score: {score}</p>
            
            {/* Score Submission UI - Automatic now */}
            <div style={{ marginTop: '20px', minHeight: '25px' /* space for messages */ }}>
                {score > 0 && submissionStatus === 'pending' && <p style={{ color: 'yellow' }}>Submitting score...</p>}
                {score > 0 && submissionStatus === 'success' && <p style={{ color: 'lime' }}>Score submitted!</p>}
                {score > 0 && submissionStatus === 'error' && <p style={{ color: 'red' }}>Failed to submit score.</p>}
                {score <= 0 && gameState === 'gameOver' && submissionStatus !== 'success' &&  (
                     <p style={{ color: 'grey' }}>No score to submit.</p>
                )}
            </div>
            
            <button 
                onClick={playAgain} 
                style={{ 
                    padding: '15px 30px', 
                    fontSize: '20px', 
                    marginTop: '30px',
                    pointerEvents: 'auto'
                }}
                disabled={showWelcomeModal || submissionStatus === 'pending'} // Disable Play Again if submitting or modal visible
             >
                Play Again?
            </button>
        </div>
        )}

        {/* Welcome Modal */}
        {showWelcomeModal && (
             <div 
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
             >
                 <div style={{ background: 'white', padding: '30px', borderRadius: '8px', color: '#333', textAlign: 'center', width: '90%', maxWidth: '400px' }}>
                    <h2 style={{ marginTop: 0, marginBottom: '15px' }}>Welcome!</h2>
                    <p style={{ marginBottom: '20px' }}>Please set your display name:</p>
                    <input 
                        type="text"
                        value={modalUsernameInput}
                        onChange={(e) => setModalUsernameInput(e.target.value)}
                        placeholder="Enter desired username"
                        maxLength={20} 
                        disabled={isSavingUsername}
                        style={{ padding: '10px', width:'calc(100% - 22px)', marginBottom: '20px', fontSize: '16px', border:'1px solid #ccc', borderRadius: '4px' }}
                    />
                    <button 
                        onClick={handleSaveUsername} // This now calls /api/account/setup
                        disabled={isSavingUsername || !modalUsernameInput.trim() || !parentEoaAddress /* Ensure parent EOA is available */}
                        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
                     >
                        {isSavingUsername ? 'Saving...' : 'Save Name & Continue'}
                    </button>
                    {usernameSaveError && <p style={{ color: 'red', marginTop: '15px' }}>{usernameSaveError}</p>}
                 </div>
             </div>
        )}

      </div>
    );
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
      <div className="flex justify-between items-center w-full max-w-4xl mb-4">
        <h1 className="text-3xl font-bold">Coin Catcher</h1>
        { /* Connect/Disconnect Button */}
        {accountStatus === 'connected' && (
            <button 
                onClick={() => disconnect()}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
                Disconnect
            </button>
        )}
         {accountStatus === 'disconnected' && (
            <button 
                onClick={() => {
                    const coinbaseConnector = connectors.find(c => c.name === 'Coinbase Wallet');
                    if (coinbaseConnector) {
                        connect({ connector: coinbaseConnector });
                    }
                 }}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
                Connect Wallet
            </button>
        )}
        {(accountStatus === 'connecting' || accountStatus === 'reconnecting') && (
             <button 
                className="bg-gray-500 text-white font-bold py-2 px-4 rounded opacity-50 cursor-not-allowed"
                disabled
            >
                {accountStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
            </button>
        )}
      </div>
      {renderContent()}
      {/* Render Leaderboard below the game content */}
      { accountStatus === 'connected' && isAccountSetupComplete && <Leaderboard />}
    </div>
  );
};

export default GamePage; 