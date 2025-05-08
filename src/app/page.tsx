'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient, useBalance } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import Leaderboard from '@/components/Leaderboard';
import { Account as PrismaAccount } from '@prisma/client'; // Import the generated type

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
const BASKET_MOVE_SPEED = 13;
const GAME_DURATION_S = 30; // Game duration in seconds
const MAX_MISSED_COINS = 6;

// Difficulty Scaling
const BASE_COIN_FALL_SPEED = 4; // Original value
const SPEED_INCREASE_INTERVAL_S = 6; // Original value
const SPEED_INCREASE_AMOUNT = 1.5; // Original value

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

// Define Power-Up Types
interface PowerUp {
  id: string;
  name: string;
  icon: string; // Emoji or placeholder
  cost: number;
  durationMs: number;
  description: string;
}

const AVAILABLE_POWER_UPS: PowerUp[] = [
  {
    id: 'wideBasket',
    name: 'Wide Basket',
    icon: '↔️',
    cost: 10, // Example cost
    durationMs: 7000, // 7 seconds
    description: 'Temporarily increases basket width.',
  },
  {
    id: 'slowTime',
    name: 'Slow Mo',
    icon: '⏳',
    cost: 15, // Example cost
    durationMs: 5000, // 5 seconds
    description: 'Briefly slows down falling coins.',
  },
];

const GamePage = () => {
  // Wagmi Hooks
  const { address: connectedAddress, addresses, status: accountStatus } = useAccount();
  const { connectors, connect, error: connectError, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  
  // Determine parent EOA from addresses list
  const parentEoaAddress = accountStatus === 'connected' && addresses && addresses.length > 0 ? addresses[addresses.length - 1] : undefined;
  
  // Fetch parent EOA ETH balance
  const { data: balanceData, isLoading: isBalanceLoading, error: balanceError } = useBalance({
    address: parentEoaAddress,
  });
  
  // Game State Refs and State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [coins, setCoins] = useState<Coin[]>([]); 
  const coinsRef = useRef<Coin[]>([]);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(score); // Ref for score
  const [timer, setTimer] = useState(GAME_DURATION_S);
  const timerRef = useRef(timer); // Ref for timer
  const [missedCoins, setMissedCoins] = useState(0);
  const missedCoinsRef = useRef(missedCoins); // Ref for missedCoins
  const actualLastSpawnOccasionTimeRef = useRef<number>(0);
  const lastTimerUpdateTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const [basketX, setBasketX] = useState(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2);
  const basketXRef = useRef(basketX); // Ref for basketX
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

  // State for player's game coins derived from ETH balance
  const [playerGameCoins, setPlayerGameCoins] = useState<number>(0);

  // State for power-ups
  const [currentBasketWidth, setCurrentBasketWidth] = useState<number>(BASKET_WIDTH);
  const currentBasketWidthRef = useRef(currentBasketWidth); // Ref for basket width
  const [activePowerUps, setActivePowerUps] = useState<Record<string, number | null>>({});
  const [isTransactionPending, setIsTransactionPending] = useState<boolean>(false);
  const gameSpeedMultiplierRef = useRef(1); // Ref for speed multiplier
  const [gameSpeedMultiplier, setGameSpeedMultiplier] = useState<number>(1);

  // State for countdown timer
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false); // To prevent double clicks

  // New ref for gameState
  const gameStateRef = useRef(gameState);

  // --- NEW State for Account Data (including allowance) ---
  const [accountData, setAccountData] = useState<PrismaAccount | null>(null);
  const [isFetchingAccount, setIsFetchingAccount] = useState<boolean>(false);
  const [fetchAccountError, setFetchAccountError] = useState<string | null>(null);
  // Update refs whenever state changes
  useEffect(() => { basketXRef.current = basketX; }, [basketX]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { timerRef.current = timer; }, [timer]);
  useEffect(() => { missedCoinsRef.current = missedCoins; }, [missedCoins]);
  useEffect(() => { gameSpeedMultiplierRef.current = gameSpeedMultiplier; }, [gameSpeedMultiplier]);
  useEffect(() => { currentBasketWidthRef.current = currentBasketWidth; }, [currentBasketWidth]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const COIN_PRICE_IN_ETH = 0.000525;

  // --- Function to fetch/refresh account data --- 
  const fetchAccountData = useCallback(async (address: string) => {
      if (!address) return;
      console.log('[Account Fetch] Fetching account details from DB for:', address);
      setIsFetchingAccount(true);
      setFetchAccountError(null);
      try {
          const response = await fetch(`/api/account?gameAccountAddress=${address}`);
          if (!response.ok) {
              if (response.status === 404) {
                  console.log('[Account Fetch] Account not found in DB for fetch.');
                  setAccountData(null); // Ensure state reflects not found
                  setIsAccountSetupComplete(false); // Mark setup incomplete if not found
              } else {
                  const errorData = await response.json().catch(() => ({ error: 'Failed to parse error' }));
                  throw new Error(errorData.error || `Failed to fetch account details (status: ${response.status})`);
              }
          } else {
              const fetchedAccount: PrismaAccount = await response.json();
              console.log('[Account Fetch] Account details fetched:', fetchedAccount);
              setAccountData(fetchedAccount);
              setCurrentGameAccountUsername(fetchedAccount.username);
              // Update setup complete status based on fetched data
              if (fetchedAccount.username && !fetchedAccount.username.startsWith('Player_')) {
                  setIsAccountSetupComplete(true);
              } else {
                  setIsAccountSetupComplete(false); // Needs username setup
              }
          }
      } catch (error: any) {
          console.error('[Account Fetch] Error fetching account data:', error);
          setFetchAccountError(error.message || 'Failed to load account data.');
          setAccountData(null); // Clear data on error
          setIsAccountSetupComplete(false); // Mark incomplete on error
      } finally {
          setIsFetchingAccount(false);
      }
  }, []); // Dependencies: none, relies on address argument

  // Effect to calculate game coins from ETH balance
  useEffect(() => {
    if (balanceData && parentEoaAddress) { 
      try {
        const ethValue = parseFloat(formatEther(balanceData.value));
        const calculatedGameCoins = Math.floor(ethValue / COIN_PRICE_IN_ETH);
        setPlayerGameCoins(calculatedGameCoins); 
        console.log(`ETH Balance: ${ethValue}, Game Coins: ${calculatedGameCoins} for ${parentEoaAddress}`);

      } catch (e) {
        console.error("Error calculating game coins from ETH balance:", e); // Changed console message slightly
        setPlayerGameCoins(0); 
      }
    } else {
      setPlayerGameCoins(0); 
    }
  }, [balanceData, parentEoaAddress]);

  // Sync coins state to ref
  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  // Effect to get game account address via SDK and then fetch account details from DB
  useEffect(() => {
    const setupGameAccount = async () => {
      // Only run if connected, have parent EOA, walletClient, and haven't started/completed setup
      if (accountStatus === 'connected' && parentEoaAddress && walletClient && !gameAccountAddress && !isSettingUpAccount && !accountData) {
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
          } as any) as AddSubAccountResponse | null; // Ensure AddSubAccountResponse type is defined

          if (!sdkResponse || !sdkResponse.address) {
            throw new Error('Failed to get game account address from SDK (null or invalid response).');
          }
          accountAddressFromSDK = sdkResponse.address;
          console.log('[Game Account Flow] Address received from SDK:', accountAddressFromSDK);
          setGameAccountAddress(accountAddressFromSDK); // Set the game address state
          setGameAccountError(null);

          // 2. Fetch account details using the new fetch function
          await fetchAccountData(accountAddressFromSDK); // Fetch data immediately after getting address

        } catch (error: any) {
          // Wagmi/SDK errors might have specific structures
          console.error('[Game Account Flow] Error during game account setup:', error);
          let message = 'Failed to set up game account.';
          if (error.code === 4001) { // Example: Check for user rejection code
            message = 'User rejected the wallet request.';
          } else if (error.message) {
            message = error.message;
          }
          setGameAccountError(message);
          setGameAccountAddress(null);
          setAccountData(null); // Clear account data on SDK/fetch error
          setIsAccountSetupComplete(false);
        } finally { 
             setIsSettingUpAccount(false);
        }
      }
    };

    setupGameAccount();
  // Re-run if connection status changes, parent EOA appears, wallet client is available,
  // OR if we don't have gameAccountAddress or accountData yet.
  }, [accountStatus, parentEoaAddress, walletClient, gameAccountAddress, isSettingUpAccount, accountData, fetchAccountData]);

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
      console.log(`[KeyDown] Key: ${event.key}, GameState: ${gameStateRef.current}, Target: ${event.target}`); // Log key presses

      // Prevent keyboard control if an input field is focused (e.g. welcome modal)
      if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      if (gameStateRef.current === 'running') {
        if (event.key === 'ArrowLeft') leftArrowPressed.current = true;
        if (event.key === 'ArrowRight') rightArrowPressed.current = true;
        if (event.key === 'a' || event.key === 'A') {
            console.log("[KeyDown] 'A' pressed, attempting to activate wideBasket");
            handleActivatePowerUp('wideBasket');
        }
        if (event.key === 's' || event.key === 'S') {
            console.log("[KeyDown] 'S' pressed, attempting to activate slowTime");
            handleActivatePowerUp('slowTime');
        }
      } else {
        // If game is not running, still log but don't process game actions
        // This helps debug if keys are registered when they shouldn't be active
        console.log(`[KeyDown] Key: ${event.key} ignored, game not running.`);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') leftArrowPressed.current = false;
      if (event.key === 'ArrowRight') rightArrowPressed.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const spawnCoin = () => {
      console.log(`[Spawn] Attempting to spawn coin. Current count: ${coinsRef.current.length}`); // Log spawn attempt
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
          console.log(`[Spawn] Spawned ${newCoin.type} coin #${newCoin.id} at (${newCoin.x.toFixed(0)}, ${newCoin.y.toFixed(0)})`); // Log successful spawn
          setCoins([...coinsRef.current]); 
          actualLastSpawnOccasionTimeRef.current = Date.now();
          return;
        }
        attempts++;
      }
      if (attempts >= MAX_SPAWN_ATTEMPTS) {
           console.warn('[Spawn] Max spawn attempts reached, could not place coin.'); // Log spawn failure
      }
    };

    let frameCount = 0;
    let lastFrameTimestamp = performance.now(); // For delta time calculation

    const gameLoop = () => {
      const loopStartTime = performance.now(); 
      frameCount++;

      // Calculate time since last frame (delta time)
      const timeSinceLastFrame = loopStartTime - lastFrameTimestamp;
      lastFrameTimestamp = loopStartTime;
      
      // Simplified periodic log condition
      const shouldLog = frameCount % 60 === 0 && gameStateRef.current === 'running';

      // Log Delta Time occasionally
      if (shouldLog) { 
        console.log(`[LoopTiming] Frame: ${frameCount}, Delta: ${timeSinceLastFrame.toFixed(2)}ms`);
      }

      if (!context) return;
      const currentTime = Date.now();
      frameCount++; // Increment frame counter

      // --- Game State Check --- 
      if (gameStateRef.current !== 'running') {
        // Clear canvas and draw background overlay if game over
        context.fillStyle = '#f0f0f0';
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (gameStateRef.current === 'gameOver') {
             context.fillStyle = 'rgba(0, 0, 0, 0.7)';
             context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        animationFrameIdRef.current = requestAnimationFrame(gameLoop);
        return; 
      }
      // --- End Game State Check ---

      // --- Calculate Current Fall Speed --- 
      const elapsedTimeMs = currentTime - gameStartTimeRef.current;
      const currentInterval = Math.floor(elapsedTimeMs / (SPEED_INCREASE_INTERVAL_S * 1000));
      const baseSpeed = BASE_COIN_FALL_SPEED + (currentInterval * SPEED_INCREASE_AMOUNT);
      const currentFallSpeed = baseSpeed * gameSpeedMultiplierRef.current;
      
      // Log speed values and coin count periodically (e.g., every 60 frames)
      if (frameCount % 60 === 0 && gameStateRef.current === 'running') { 
        console.log(`[gameLoop] Multiplier: ${gameSpeedMultiplierRef.current}, BaseSpeed: ${baseSpeed.toFixed(2)}, FallSpeed: ${currentFallSpeed.toFixed(2)}, Coins: ${coinsRef.current.length}`);
      }
      // --- End Fall Speed Calculation ---

      // --- Timer Update --- 
      if (currentTime - lastTimerUpdateTimeRef.current >= 1000) {
          const oldTimer = timerRef.current; // Capture old value for logging
          setTimer(prevTimer => {
              const newTime = prevTimer - 1;
              console.log(`[StateUpdate] setTimer: ${newTime}`); // Log timer update
              if (newTime <= 0) {
                  setGameState('gameOver'); 
                  console.log(`[StateUpdate] setGameState: gameOver (timer expired)`); // Log game over by timer
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
      let currentBasketX = basketXRef.current; // Read from ref
      let newBasketX = currentBasketX;
      if (leftArrowPressed.current) newBasketX -= BASKET_MOVE_SPEED;
      if (rightArrowPressed.current) newBasketX += BASKET_MOVE_SPEED;
      if (newBasketX < 0) newBasketX = 0;
      // Use currentBasketWidthRef for boundary check
      if (newBasketX + currentBasketWidthRef.current > CANVAS_WIDTH) newBasketX = CANVAS_WIDTH - currentBasketWidthRef.current;
      // Update state only if value changed
      if (newBasketX !== currentBasketX) {
         setBasketX(newBasketX);
      }
      // --- End Basket Movement --- 

      // --- Spawning --- 
      // Apply gameSpeedMultiplier to spawn rate (effectiveMinTimeBetweenSpawns will be longer if speed is slower)
      const effectiveMinTimeBetweenSpawns = MIN_TIME_BETWEEN_SPAWNS_MS / gameSpeedMultiplierRef.current;
      const timeSinceLastSpawn = currentTime - actualLastSpawnOccasionTimeRef.current;
      
      // Check against effectiveMinTimeBetweenSpawns
      if (timeSinceLastSpawn > effectiveMinTimeBetweenSpawns) {
        if (coinsRef.current.length === 0 || (coinsRef.current.length > 0 && coinsRef.current[coinsRef.current.length - 1].y >= CANVAS_HEIGHT * 0.25)) {
          spawnCoin();
        }
      }
      // --- End Spawning --- 

      // Use currentBasketWidthRef and basketXRef for collision detection bounds
      const basketTopY = CANVAS_HEIGHT - BASKET_HEIGHT - BASKET_Y_OFFSET;
      const basketBottomY = basketTopY + BASKET_HEIGHT;
      const basketLeftX = basketXRef.current; // Use ref
      const basketRightX = basketXRef.current + currentBasketWidthRef.current; // Use refs

      let scoreUpdateAmountInFrame = 0;
      let missedCoinsUpdateInFrame = 0;
      let coinsChanged = false;
      
      // --- Process Coins --- 
      for (let i = coinsRef.current.length - 1; i >= 0; i--) {
        const coin = coinsRef.current[i];
        
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
             console.log(`[CoinEvent] Missed coin`); // Log missed coin
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
          console.log(`[CoinEvent] Caught ${coin.type} coin #${coin.id}`); // Log caught coin
        }
      }
      // --- End Process Coins --- 
      
      // --- Update State --- 
      if (coinsChanged) {
          setCoins([...coinsRef.current]); 
      }
      if (scoreUpdateAmountInFrame > 0) {
        const oldScore = scoreRef.current; // Capture old value for logging
        setScore(prevScore => {
          const newScore = prevScore + scoreUpdateAmountInFrame;
          console.log(`[StateUpdate] setScore: ${newScore}`); // Log score update
          return newScore;
        });
      }
      if (missedCoinsUpdateInFrame > 0) {
          const oldMissed = missedCoinsRef.current; // Capture old value for logging
          setMissedCoins(prevCount => {
              const newCount = prevCount + missedCoinsUpdateInFrame;
              console.log(`[StateUpdate] setMissedCoins: ${newCount}`); // Log missed update
              if (newCount >= MAX_MISSED_COINS) {
                  setGameState('gameOver'); 
                  console.log(`[StateUpdate] setGameState: gameOver (${newCount} missed coins)`); // Log game over by misses
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
      context.fillRect(basketXRef.current, basketTopY, currentBasketWidthRef.current, BASKET_HEIGHT);

      // --- Draw HUD (Score, Timer, Missed Coins) ---
      context.fillStyle = '#333333'; // Dark color for text
      context.font = '24px Arial';
      context.textAlign = 'left';
      context.fillText(`Score: ${scoreRef.current}`, 20, 40);
      context.textAlign = 'right';
      context.fillText(`Time: ${timerRef.current}`, CANVAS_WIDTH - 20, 40);
      context.textAlign = 'left'; // Reset for next text if any or keep consistent
      context.fillText(`Missed: ${missedCoinsRef.current}/${MAX_MISSED_COINS}`, 20, 70);
      // --- End HUD Drawing ---

      // Measure loop end time and log duration
      const loopEndTime = performance.now();
      const loopDuration = loopEndTime - loopStartTime;
      if (shouldLog) { 
        console.log(`           [LoopTiming] Loop Duration: ${loopDuration.toFixed(2)}ms`);
      }

      animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    };
    
    // Start the loop only if gameState is 'running'
    if (gameState === 'running') {
        console.log('[Setup] Starting requestAnimationFrame loop');
        lastFrameTimestamp = performance.now(); // Initialize timestamp when loop actually starts
        frameCount = 0; // Reset frame count when loop starts
        animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    } else {
        // If gameState is not 'running', ensure any existing animation frame is cancelled
        if (animationFrameIdRef.current) {
            console.log('[Setup] Cancelling requestAnimationFrame loop because gameState is not running');
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
    }

    // Cleanup function
    return () => {
      if (animationFrameIdRef.current) {
        console.log('[Cleanup] Cancelling requestAnimationFrame loop due to effect cleanup');
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Function to initiate connection
  const connectWallet = () => {
      const coinbaseConnector = connectors.find(c => c.name === 'Coinbase Wallet');
      if (coinbaseConnector) {
          connect({ connector: coinbaseConnector });
      }
  };

  // Modified startGame to include countdown
  const startGame = () => {
    // Prevent starting if already running, already starting, or setup/account not ready
    if (gameState === 'running' || isStarting || !gameAccountAddress || !isAccountSetupComplete) { 
        console.log("Cannot start game. State:", gameState, "isStarting:", isStarting, "Account Ready:", !!gameAccountAddress, "SetupComplete:", isAccountSetupComplete);
        // Alert user if relevant condition fails (optional, could rely on button being disabled)
        if (isStarting) {
             alert("Game is already starting...");
        } else if (!isAccountSetupComplete) {
             alert('Please complete account setup (set username) before starting the game.');
             setShowWelcomeModal(true); 
        }
        return;
    }
    
    console.log("Initiating start sequence...");
    setIsStarting(true); // Mark that we are in the start sequence
    setGameState('idle'); // Ensure state is idle before countdown shows over canvas
    setSubmissionStatus('idle'); // Reset submission status

    // Reset game values immediately before countdown starts
    setScore(0);
    setMissedCoins(0);
    setTimer(GAME_DURATION_S);
    coinsRef.current = [];
    setCoins([]);
    setCurrentBasketWidth(BASKET_WIDTH); 
    // Set basket position based on the default width, before potential power-ups affect it
    setBasketX(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2); 
    setActivePowerUps({}); 
    setGameSpeedMultiplier(1); 
    console.log(`[startGame] Reset gameSpeedMultiplier to: ${1}`);
    leftArrowPressed.current = false;
    rightArrowPressed.current = false;

    // Start countdown
    setCountdown(3);
    let count = 3;
    const countdownInterval = setInterval(() => {
        count--;
        setCountdown(currentCount => (currentCount ? currentCount - 1 : 0)); // More robust state update
        
        if (count <= 0) {
            clearInterval(countdownInterval);
            setCountdown(null); // Hide countdown number
            console.log("Countdown finished. Starting game!");
            
            // Set actual game start time and state
            lastTimerUpdateTimeRef.current = Date.now();
            gameStartTimeRef.current = Date.now();
            setGameState('running');
            setIsStarting(false); // Finish start sequence
        }
    }, 1000); // 1 second interval

    // Optional: Store interval ID to clear it if component unmounts during countdown
    // const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
    // intervalIdRef.current = countdownInterval; 
    // Need cleanup in a useEffect return if using ref.
  };

  // playAgain just calls startGame, which now includes the countdown
  const playAgain = () => { 
    startGame(); 
  };

  // Renamed and adjusted submission logic
  const performScoreSubmission = useCallback(async () => {
    if (!isAccountSetupComplete || !gameAccountAddress || scoreRef.current <= 0) { 
      console.log('Conditions not met for score submission:', { isAccountSetupComplete, gameAccountAddress, score: scoreRef.current });
      if (scoreRef.current > 0) { 
          setSubmissionStatus('error');
      } else {
          setSubmissionStatus('idle'); 
      }
      return;
    }
    
    const highScoreUsername = currentGameAccountUsername || 'Anonymous'; 

    setIsSubmitting(true); // Keep for broader control if needed
    setSubmissionStatus('pending'); 
    console.log('Submitting score:', scoreRef.current, 'for player:', highScoreUsername, 'address:', gameAccountAddress);

    try {
        const response = await fetch('/api/highscore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                score: scoreRef.current, 
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
  }, [scoreRef, gameAccountAddress, isAccountSetupComplete, currentGameAccountUsername, setIsSubmitting, setSubmissionStatus]);

  // Effect to automatically submit score on game over
  useEffect(() => {
    // Only attempt submission if the status is idle (to prevent re-submission on re-renders after an attempt)
    if (gameState === 'gameOver' && submissionStatus === 'idle') {
        if (scoreRef.current > 0 && isAccountSetupComplete && gameAccountAddress) {
            console.log('Game over, triggering automatic score submission.');
            performScoreSubmission();
        } else if (scoreRef.current <= 0) {
            console.log('Game over, no score to submit or conditions not met for submission.');
            // No action needed, submissionStatus remains 'idle', UI will show "No score to submit"
        }
    }
  }, [gameState, scoreRef, isAccountSetupComplete, gameAccountAddress, performScoreSubmission, submissionStatus]);

  // handleSaveUsername needs to refresh account data after successful setup
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

        // Don't set state directly from setup response anymore, use fetchAccountData
        setShowWelcomeModal(false); 
        setModalUsernameInput(''); 

        // --- Refresh account data after successful save --- 
        if (response.ok && gameAccountAddress) {
           console.log('[Save Username] Setup successful, refreshing account data...');
           await fetchAccountData(gameAccountAddress);
        }
        // --- END Refresh --- 

    } catch (error: any) {
        console.error("Failed to setup account:", error);
        setUsernameSaveError(error.message || 'An unknown error occurred.');
        setIsAccountSetupComplete(false); // Ensure setup is marked as not complete on error
    } finally {
        setIsSavingUsername(false);
    }
  };

  // Function to activate a power-up with on-chain transaction
  const handleActivatePowerUp = async (powerUpId: string) => {
    const powerUp = AVAILABLE_POWER_UPS.find(p => p.id === powerUpId);
    if (!powerUp) return;
    if (!walletClient) {
      alert("Wallet client not available. Please connect your wallet properly.");
      return;
    }
    if (!gameAccountAddress) {
      alert("Game account address not available. Cannot initiate transaction.");
      return;
    }

    // --- Use accountData state for checks --- 
    if (!accountData) {
        alert("Account data not loaded. Cannot check spending limit.");
        return;
    }
    // --- END --- 

    // UI check for affordability (displayed coins) - Keep this for immediate feedback
    if (playerGameCoins < powerUp.cost) {
      alert("Not enough displayed game coins! Check your ETH balance.");
      return;
    }

    // Check if already active or pending
    if (activePowerUps[powerUpId] && activePowerUps[powerUpId]! > Date.now()) {
      alert(`${powerUp.name} is already active!`);
      return;
    }
    if (isTransactionPending) {
      alert("Another power-up transaction is already in progress.");
      return;
    }

    // --- Client-side Spending Limit Pre-check --- 
    const ethCost = powerUp.cost * COIN_PRICE_IN_ETH;
    const currentSpent = accountData.allowanceSpentThisPeriodETH ?? 0; // Use fetched value, fallback to 0
    const limit = accountData.currentAllowanceLimitETH; // Use fetched value (can be null)
    const tolerance = 1e-9; // Tolerance for float comparison

    // Only check if limit is actually set (not null)
    if (limit !== null && (currentSpent + ethCost) > limit + tolerance) {
        alert(`Activating this power-up would exceed your spending limit of ${limit.toFixed(4)} ETH for this period.`);
        console.warn(`[Power-Up] Spending limit pre-check failed. Limit: ${limit}, Spent: ${currentSpent}, Cost: ${ethCost}`);
        return;
    }
    // --- END Pre-check --- 

    setIsTransactionPending(true);
    console.log(`Attempting to purchase ${powerUp.name} for ${powerUp.cost} coins.`);

    try {
      const ethCostString = ethCost.toFixed(18);

      console.log(`Calculated ETH cost: ${ethCostString} for ${powerUp.name}. Sending from: ${gameAccountAddress}`);

      const txHash = await walletClient.sendTransaction({ 
        account: gameAccountAddress as `0x${string}`,
        to: '0xd09e70C83185E9b5A2Abd365146b58Ef0ebb8B7B', // Replace with actual treasury if needed
        value: parseEther(ethCostString),
      });

      console.log(`Transaction for ${powerUp.name} sent. Hash: ${txHash}. Activating power-up optimistically.`);

      // --- Call Record Spend API --- 
      try {
          console.log(`[Record Spend Call] Reporting spend of ${ethCost} ETH to backend.`);
          const spendResponse = await fetch('/api/account/record-spend', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  gameAccountAddress: gameAccountAddress,
                  amountSpentETH: ethCost
              })
          });

          if (!spendResponse.ok) {
              const errorData = await spendResponse.json().catch(() => ({ error: 'Failed to parse spend recording error' }));
              console.error(`[Record Spend Call] Failed to record spend on backend (Status: ${spendResponse.status}):`, errorData.error);
              alert(`Warning: Power-up activated, but failed to update spending record on server: ${errorData.error}`);
              // Optionally force a refresh of account data to sync state despite error
              if(gameAccountAddress) fetchAccountData(gameAccountAddress);
          } else {
              const updatedAccountData: PrismaAccount = await spendResponse.json();
              console.log('[Record Spend Call] Spend recorded successfully. Updated account data:', updatedAccountData);
              // Update local state with the confirmed data from the backend
              setAccountData(updatedAccountData);
          }
      } catch (recordError: any) {
           console.error('[Record Spend Call] Error calling record-spend API:', recordError);
           alert(`Warning: Power-up activated, but encountered an error trying to update spending record on server.`);
      }
      // --- END Record Spend Call --- 


      // Optimistic updates (existing logic)
      setPlayerGameCoins(prevCoins => prevCoins - powerUp.cost); // Frontend coin display update
      const expiryTime = Date.now() + powerUp.durationMs;
      setActivePowerUps(prev => ({ ...prev, [powerUpId]: expiryTime }));
      if (powerUp.id === 'wideBasket') { setCurrentBasketWidth(BASKET_WIDTH * 2); }
      if (powerUp.id === 'slowTime') { setGameSpeedMultiplier(0.5); console.log(`[handleActivatePowerUp] Set gameSpeedMultiplier to: ${0.5}`); }
      // Add other power-up effects here

    } catch (err: any) {
      console.error(`Transaction for ${powerUp.name} failed:`, err);
      // Try to provide a more user-friendly error
      if (err.message && err.message.includes('User rejected the request')) {
        alert('Transaction rejected.');
      } else if (err.message && err.message.includes('insufficient funds')) {
        alert('Transaction failed: Insufficient funds in the game account for cost + gas.');
      } else {
        alert(`Power-up purchase failed: ${err.shortMessage || err.message || 'Unknown error'}`);
      }
    } finally {
      setIsTransactionPending(false);
    }
  };

  // Effect to manage power-up expiry
  useEffect(() => {
    const interval = setInterval(() => {
      let updated = false;
      const now = Date.now();
      const newActivePowerUps = { ...activePowerUps };

      for (const powerUpId in newActivePowerUps) {
        const expiry = newActivePowerUps[powerUpId];
        if (expiry && now > expiry) {
          console.log(`${AVAILABLE_POWER_UPS.find(p=>p.id === powerUpId)?.name} expired.`);
          newActivePowerUps[powerUpId] = null; // Mark as inactive or remove
          updated = true;

          // Deactivate effect
          if (powerUpId === 'wideBasket') {
            setCurrentBasketWidth(BASKET_WIDTH);
          }
          if (powerUpId === 'slowTime') {
            setGameSpeedMultiplier(1); // Reset game speed
            console.log(`[Expiry Effect] Reset gameSpeedMultiplier to: ${1}`); // Log deactivation
          }
          // TODO: Deactivate other power-up effects
        }
      }

      if (updated) {
        setActivePowerUps(newActivePowerUps);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [activePowerUps]);

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
      <div className="flex flex-col items-center">
        <div 
          className="relative z-10 mb-4" // Container for canvas and overlays
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Display the game account being used */}
          {gameAccountAddress && (
            <div className="absolute top-2 left-2 text-xs text-gray-500 bg-white p-1 rounded shadow z-20">
              Game Account: {gameAccountAddress.substring(0, 6)}...{gameAccountAddress.substring(gameAccountAddress.length - 4)}
            </div>
          )}

          <canvas ref={canvasRef} className="border border-gray-300 rounded-lg shadow-md" />
          
          {/* Start Game Button Overlay (Only when idle and not starting) */}
          {gameState === 'idle' && gameAccountAddress && isAccountSetupComplete && !isStarting && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 40, pointerEvents: 'none' }}>
              <button onClick={startGame} disabled={isStarting} style={{ padding: '20px 40px', fontSize: '24px', pointerEvents: 'auto' }}>Start Game</button>
            </div>
          )}

          {/* Countdown Timer Overlay */}
          {isStarting && countdown !== null && (
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              zIndex: 50, // Ensure it's above other overlays like start button overlay
              fontSize: '120px', 
              fontWeight: 'bold', 
              color: 'white',
              textShadow: '2px 2px 8px rgba(0,0,0,0.7)'
            }}>
              {countdown}
            </div>
          )}

          {/* Game Over Overlay */}
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
              <p style={{ fontSize: '30px', margin: '0 0 30px 0' }}>Final Score: {scoreRef.current}</p>
              
              {/* Score Submission UI - Automatic now */}
              <div style={{ marginTop: '20px', minHeight: '25px' /* space for messages */ }}>
                  {scoreRef.current > 0 && submissionStatus === 'pending' && <p style={{ color: 'yellow' }}>Submitting score...</p>}
                  {scoreRef.current > 0 && submissionStatus === 'success' && <p style={{ color: 'lime' }}>Score submitted!</p>}
                  {scoreRef.current > 0 && submissionStatus === 'error' && <p style={{ color: 'red' }}>Failed to submit score.</p>}
                  {scoreRef.current <= 0 && gameState === 'gameOver' && submissionStatus !== 'success' &&  (
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

        {/* Power-ups Display Area */}
        {accountStatus === 'connected' && isAccountSetupComplete && (gameState === 'idle' || gameState === 'running') && (
          <div className="w-full max-w-md p-4 bg-gray-100 rounded-lg shadow mb-4">
            <h3 className="text-xl font-semibold text-center mb-3 text-gray-700">Power-ups</h3>
            <div className="flex justify-around items-start">
              {AVAILABLE_POWER_UPS.map((powerUp, index) => {
                const isActive = activePowerUps[powerUp.id] && activePowerUps[powerUp.id]! > Date.now();
                const canAfford = playerGameCoins >= powerUp.cost;
                return (
                  <button
                    key={powerUp.id}
                    onClick={() => handleActivatePowerUp(powerUp.id)}
                    disabled={isActive || !canAfford || isTransactionPending}
                    title={`${powerUp.description}\nDuration: ${powerUp.durationMs / 1000}s${isActive ? ' (Active)': ''}`}
                    className={`p-3 m-1 border rounded-lg shadow-sm transition-all flex flex-col items-center w-32
                                ${isActive ? 'bg-green-200 cursor-not-allowed' : 
                                 !canAfford ? 'bg-red-200 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200'}`}
                  >
                    <span className="text-2xl mb-1">{powerUp.icon}</span>
                    <span className="text-sm font-medium">
                      {powerUp.name} {index === 0 ? '(A)' : index === 1 ? '(S)' : ''}
                    </span>
                    <span className="text-xs text-gray-600">Cost: {powerUp.cost} 🪙</span>
                    {isActive && (
                        <span className="text-xs text-green-700 mt-1">
                           Active ({Math.ceil((activePowerUps[powerUp.id]! - Date.now()) / 1000)}s left)
                        </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
      <div className="flex justify-between items-center w-full max-w-4xl mb-1">
        <h1 className="text-3xl font-bold">Coin Catcher</h1>
        <div className="flex items-center space-x-4">
            {/* Display Player Game Coins */}
            {accountStatus === 'connected' && parentEoaAddress && (
                <div className="text-sm text-gray-700 bg-gray-100 p-2 rounded shadow">
                    {isBalanceLoading && <span>Loading balance...</span>}
                    {balanceError && <span className="text-red-500">Balance error</span>}
                    {!isBalanceLoading && !balanceError && balanceData && (
                        <span>🪙 Game Coins: {playerGameCoins}</span>
                    )}
                </div>
            )}
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
      </div>
      
      {/* Account Info Area */}
      <div className="w-full max-w-4xl mb-4 text-xs text-gray-500 flex justify-between items-start">
        <div>
          {parentEoaAddress && <p>Parent EOA: {parentEoaAddress}</p>}
          {gameAccountAddress && (
            <p className="mt-1">
              Game Account: {gameAccountAddress.substring(0, 6)}...{gameAccountAddress.substring(gameAccountAddress.length - 4)}
            </p>
          )}
        </div>
        
        {/* --- NEW: Allowance Progress Bar & Info --- */} 
        {accountData && accountData.currentAllowanceLimitETH !== null && accountData.allowancePeriodStart && (
          <div className="w-1/2 pl-4 text-right">
            <label htmlFor="allowance-progress" className="block text-xs font-medium text-gray-600 mb-1">
              Daily Spending Allowance ({accountData.currentAllowanceLimitETH?.toFixed(4)} ETH)
            </label>
            <progress 
              id="allowance-progress"
              value={accountData.allowanceSpentThisPeriodETH ?? 0}
              max={accountData.currentAllowanceLimitETH}
              className="w-full h-2 [&::-webkit-progress-bar]:rounded-lg [&::-webkit-progress-value]:rounded-lg [&::-webkit-progress-bar]:bg-slate-300 [&::-webkit-progress-value]:bg-violet-500 [&::-moz-progress-bar]:bg-violet-500"
            >
              {/* Fallback for browsers that don't support progress element styling well */} 
              {(accountData.allowanceSpentThisPeriodETH / accountData.currentAllowanceLimitETH * 100).toFixed(0)}% 
            </progress>
            <p className="text-xs text-gray-500 mt-1">
              Used: {(accountData.allowanceSpentThisPeriodETH ?? 0).toFixed(4)} ETH
              {/* Calculate and display reset time - simple example */} 
              {/* You might want a more robust date/time formatting library */} 
              {accountData.allowancePeriodStart && accountData.currentAllowancePeriodSeconds && (
                  <span className="ml-2">
                      (Resets in: {formatTimeRemaining(accountData.allowancePeriodStart, accountData.currentAllowancePeriodSeconds)})
                  </span>
              )}
            </p>
          </div>
        )}
        {/* --- END NEW --- */} 
      </div>
      
      {renderContent()}
      {/* Render Leaderboard below the game content, ensure it can take full width needed */}
      <div className="w-full flex justify-center">
        { accountStatus === 'connected' && isAccountSetupComplete && <Leaderboard />}
      </div>
    </div>
  );
};

// Helper function to format remaining time (add this outside the component)
function formatTimeRemaining(startDateInput: Date | string, periodSeconds: number): string {
  // Ensure startDate is a Date object
  const startDate = typeof startDateInput === 'string' ? new Date(startDateInput) : startDateInput;
  
  // Check if the conversion resulted in a valid date
  if (isNaN(startDate.getTime())) {
    console.error("Invalid startDate provided to formatTimeRemaining:", startDateInput);
    return "Invalid date";
  }

  const now = Date.now();
  const endTime = startDate.getTime() + periodSeconds * 1000;
  const remainingMs = Math.max(0, endTime - now);

  if (remainingMs === 0) return "Now";

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0 || days > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
  result += `${seconds}s`;

  return result.trim();
}

export default GamePage; 
