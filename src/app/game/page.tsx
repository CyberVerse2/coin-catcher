'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient, useBalance } from 'wagmi';
import { formatEther } from 'viem';

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
  const { address, addresses, status: accountStatus } = useAccount();
  const { connectors, connect, error: connectError, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  // State for selected address
  const [selectedAddress, setSelectedAddress] = useState<string | undefined>(undefined);

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

  // State for Subaccount Creation UI
  const [subAccountNameInput, setSubAccountNameInput] = useState('');
  const [subAccountAllocationInput, setSubAccountAllocationInput] = useState(50); // Default to 50 coins
  const [isCreatingSubAccount, setIsCreatingSubAccount] = useState(false);
  const [subAccountCreationError, setSubAccountCreationError] = useState<string | null>(null);

  // Parent's balance and max allocable coins for subaccounts
  const [parentMaxAllocableCoins, setParentMaxAllocableCoins] = useState(100); // Default to 100, will be updated
  const parentEoaAddress = accountStatus === 'connected' && addresses && addresses.length > 0 ? addresses[addresses.length - 1] : undefined;
  const { data: parentBalanceData, isLoading: isLoadingParentBalance } = useBalance({
    address: parentEoaAddress, // Fetch balance for the calculated parent EOA
  });

  const COIN_PRICE_IN_ETH = 0.000525;

  // Sync state to ref
  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  // Effect to set default selected address
  useEffect(() => {
    console.log('[Account Selection Effect] Running. Status:', accountStatus);
    console.log('[Account Selection Effect] Wagmi EOA (address hook):', address); // Renamed log for clarity
    console.log('[Account Selection Effect] All addresses (addresses hook):', addresses);

    if (accountStatus === 'connected' && addresses && addresses.length > 0) {
      const mainEoaFromAddresses = addresses[addresses.length - 1];
      console.log('[Account Selection Effect] Deduced Main EOA from addresses array (last item):', mainEoaFromAddresses);
      
      if (mainEoaFromAddresses) { 
        console.log('[Account Selection Effect] Setting selected address to Deduced Main EOA:', mainEoaFromAddresses);
        setSelectedAddress(mainEoaFromAddresses);
      } else {
        console.log('[Account Selection Effect] Could not deduce Main EOA. Defaulting to addresses[0]:', addresses[0]);
        setSelectedAddress(addresses[0]); 
      }
    } else {
      console.log('[Account Selection Effect] Conditions not met for setting address, or disconnecting. Clearing selected address.');
      setSelectedAddress(undefined);
    }
  }, [accountStatus, /* address, */ addresses]); // Removed address from deps as it was causing confusion, using addresses directly

  // Effect to calculate parent's max allocable coins
  useEffect(() => {
    if (selectedAddress && parentEoaAddress && selectedAddress === parentEoaAddress && parentBalanceData) {
      try {
        const ethBalance = parseFloat(formatEther(parentBalanceData.value));
        const maxCoins = Math.floor(ethBalance / COIN_PRICE_IN_ETH);
        console.log(`Parent ETH Balance: ${ethBalance}, Max Allocable Coins: ${maxCoins}`);
        setParentMaxAllocableCoins(maxCoins > 0 ? maxCoins : 0); // Ensure it's not negative

        // Adjust current allocation if it exceeds new max, or if max is 0 and current is not
        if (subAccountAllocationInput > maxCoins || (maxCoins === 0 && subAccountAllocationInput !== 0)) {
          setSubAccountAllocationInput(maxCoins > 0 ? Math.min(subAccountAllocationInput, maxCoins) : 0);
        }
      } catch (e) {
        console.error("Error calculating max allocable coins:", e);
        setParentMaxAllocableCoins(0); // Fallback to 0 on error
      }
    } else if (selectedAddress && parentEoaAddress && selectedAddress !== parentEoaAddress) {
      // If a subaccount is selected, reset max allocable to a sensible default (or hide UI)
      setParentMaxAllocableCoins(100); // Or 0, depending on desired UX when non-parent is selected
    }
  }, [selectedAddress, parentEoaAddress, parentBalanceData, subAccountAllocationInput]);

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
    if (gameState === 'running' || !selectedAddress) { // Check for selectedAddress
        console.log("Cannot start game. State:", gameState, "Selected Address:", selectedAddress);
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

    // The gameLoop is self-perpetuating via requestAnimationFrame within its own definition
    // and its behavior is controlled by gameState. Setting gameState to 'running' is sufficient.
    // // Ensure game loop is started if it was stopped
    // if (!animationFrameIdRef.current) {
    //     animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    // }
  };

  // Modified Submit Score: Uses connected address
  const submitHighScore = useCallback(async () => {
    if (!playerName.trim() || !selectedAddress) { // Check for selectedAddress
      setSubmissionStatus('error'); // Or some other feedback
      return;
    }
    setIsSubmitting(true);
    setSubmissionStatus('idle');
    console.log('Submitting score:', score, 'for player:', playerName, 'address:', selectedAddress);

    try {
        const response = await fetch('/api/highscore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Send address instead of placeholder userId
            body: JSON.stringify({ 
                score: score,
                address: selectedAddress, 
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
  }, [score, playerName, isSubmitting, selectedAddress]); // Added selectedAddress dependency

  const playAgain = () => { startGame(); };

  const handleCreateSubAccount = async () => {
    setIsCreatingSubAccount(true);
    setSubAccountCreationError(null);
    console.log('Attempting to create subaccount:');
    console.log('Name:', subAccountNameInput);
    console.log('Allocation:', subAccountAllocationInput);

    if (!selectedAddress || !addresses || selectedAddress !== addresses[addresses.length - 1]) {
      setSubAccountCreationError('Main account (EOA) must be selected to create subaccounts.');
      setIsCreatingSubAccount(false);
      return;
    }

    if (!subAccountNameInput.trim()) {
        setSubAccountCreationError('Subaccount name cannot be empty.');
        setIsCreatingSubAccount(false);
        return;
    }

    const parentEoaAddress = selectedAddress; // This is the main EOA

    try {
        if (!walletClient) {
            setSubAccountCreationError('Wallet client not available.');
            setIsCreatingSubAccount(false);
            return;
        }

        console.log('Calling wallet_addSubAccount with parent EOA:', parentEoaAddress);
        // Actual SDK call
        const subAccountSDKResponse = await walletClient.request({
            method: 'wallet_addSubAccount',
            params: [{
                version: '1',
                account: {
                    type: 'create',
                    keys: [{ type: 'address', key: parentEoaAddress as `0x${string}` }]
                }
            }]
        } as any) as AddSubAccountResponse | null; // Cast request options to any, and response to expected type or null

        // Type guard for the response structure
        if (!subAccountSDKResponse || typeof subAccountSDKResponse.address !== 'string') {
            console.error('Invalid or null response from wallet_addSubAccount:', subAccountSDKResponse);
            setSubAccountCreationError('Failed to get subaccount address from wallet. The wallet might have denied the request or an unexpected error occurred.');
            setIsCreatingSubAccount(false);
            return;
        }
        const newSubAccountAddress = subAccountSDKResponse.address as string;
        console.log('SDK returned new subaccount address:', newSubAccountAddress);
        
        // Now call our backend to save this subaccount
        console.log('Calling backend /api/subaccount with:', {
            parentWalletAddress: parentEoaAddress,
            subAccountName: subAccountNameInput,
            allocatedCoins: subAccountAllocationInput,
            newSubAccountAddress: newSubAccountAddress,
        });

        const backendResponse = await fetch('/api/subaccount', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                parentWalletAddress: parentEoaAddress,
                subAccountName: subAccountNameInput,
                allocatedCoins: subAccountAllocationInput,
                newSubAccountAddress: newSubAccountAddress,
            }),
        });

        if (!backendResponse.ok) {
            const errorData = await backendResponse.json();
            // If subaccount address conflict, it might mean SDK succeeded but DB entry failed prior or is duplicated.
            // Or user tried to create one with an address that somehow already exists from another context.
            setSubAccountCreationError(`Backend Error: ${errorData.error || backendResponse.statusText || 'Failed to save subaccount'}`);
            // Do not reset form here, allow user to see values and retry or change name if that was the issue.
            setIsCreatingSubAccount(false);
            return; // Stop execution on backend error
        }

        const savedSubAccount = await backendResponse.json();
        console.log('Subaccount saved to backend:', savedSubAccount);

        // Reset form and UI on full success (SDK + Backend)
        setSubAccountNameInput('');
        // Recalculate parent's max allocable coins and reset slider
        // This logic is already in a useEffect, but we can be more direct here if parentBalanceData is available
        if (parentBalanceData) {
            try {
                const ethBalance = parseFloat(formatEther(parentBalanceData.value));
                const maxCoins = Math.floor(ethBalance / COIN_PRICE_IN_ETH);
                setParentMaxAllocableCoins(maxCoins > 0 ? maxCoins : 0);
                // After successful allocation, the actual available amount for *new* allocations decreases.
                // For simplicity, we'll just reset the input to 0. A more advanced UI would show remaining allocable.
                setSubAccountAllocationInput(0); 
            } catch (e) {
                console.error("Error refreshing parent max coins after subaccount creation:", e);
                // Fallback, user might see stale max on slider until next balance update triggers useEffect
            }
        } else {
             setSubAccountAllocationInput(0); // Default reset if balance data isn't immediately ready
        }

        alert(`Subaccount '${subAccountNameInput}' created successfully with address ${newSubAccountAddress} and ${subAccountAllocationInput} coins!`);
        // TODO: Add this new subaccount to a list displayed in the UI for the parent.
        // TODO: Update parent's displayed total allocated coins / available coins.

    } catch (error: any) {
        console.error('Error creating subaccount:', error);
        let message = 'Failed to create subaccount.';
        if (error.code === 4001) { // User rejected request
            message = 'User rejected the request.';
        }
        setSubAccountCreationError(message);
    }

    setIsCreatingSubAccount(false);
  };

  // Render Logic
  const renderContent = () => {
    if (accountStatus === 'disconnected') {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-2xl font-bold mb-4">Welcome to Coin Catcher!</h2>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-2"
            >
              Connect with {connector.name}
            </button>
          ))}
          {connectError && <p className="text-red-500 mt-2">Error: {connectError.message}</p>}
          {connectStatus === 'pending' && <p className="text-gray-500 mt-2">Connecting...</p>}
        </div>
      );
    }

    if (accountStatus === 'connecting') {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-xl">Connecting wallet...</p>
            </div>
        )
    }

    // Wallet Connected State
    return (
      <div className="relative z-10">
        {/* Account Selection Dropdown */}
        {addresses && addresses.length > 0 && (
          <div className="absolute top-2 left-2 z-50 bg-white p-2 rounded shadow">
            <label htmlFor="account-select" className="block text-sm font-medium text-gray-700 mr-2">Play as:</label>
            <select
              id="account-select"
              value={selectedAddress || ''}
              onChange={(e) => setSelectedAddress(e.target.value)}
              disabled={gameState === 'running'}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {addresses && addresses.map((addr) => {
                const mainEoaFromAddresses = addresses[addresses.length - 1];
                const isMain = addr === mainEoaFromAddresses;
                return (
                  <option key={addr} value={addr}>
                    {isMain ? `Main (${addr.substring(0, 6)}...${addr.substring(addr.length - 4)})` : `Sub (${addr.substring(0, 6)}...${addr.substring(addr.length - 4)})`}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <canvas ref={canvasRef} className="border border-gray-300 rounded-lg shadow-md" />
        {gameState === 'idle' && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 40, pointerEvents: 'none' }}>
            <button onClick={startGame} style={{ padding: '20px 40px', fontSize: '24px', pointerEvents: 'auto' }}>Start Game</button>
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
             flexDirection: 'column', 
             zIndex: 40,
             pointerEvents: 'none'
         }}>
            <h2 style={{ fontSize: '40px', margin: '0 0 10px 0' }}>Game Over!</h2>
            <p style={{ fontSize: '30px', margin: '0 0 30px 0' }}>Final Score: {score}</p>
            
            {/* Score Submission Form */} 
            {submissionStatus !== 'success' && score > 0 && (
                <div style={{ marginTop: '20px', pointerEvents: 'auto' }}>
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
            {submissionStatus === 'success' && <p style={{ color: 'lime', marginTop: '10px', pointerEvents: 'auto' }}>Score submitted!</p>}
            
            <button 
                onClick={playAgain} 
                style={{ 
                    padding: '15px 30px', 
                    fontSize: '20px', 
                    marginTop: '30px',
                    pointerEvents: 'auto'
                }}
             >
                Play Again?
            </button>
        </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
      <h1>Coin Catcher</h1>
      {renderContent()}

      {/* Subaccount Creation Section - Only visible if parent EOA is selected */}
      {accountStatus === 'connected' && addresses && addresses.length > 0 && selectedAddress === addresses[addresses.length - 1] && (
        <div className="mt-8 p-6 border border-gray-300 rounded-lg shadow-md w-full max-w-md bg-gray-50">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Create New Subaccount</h2>
          <div className="mb-4">
            <label htmlFor="subAccountName" className="block text-sm font-medium text-gray-700 text-left mb-1">Subaccount Name:</label>
            <input 
              type="text"
              id="subAccountName"
              value={subAccountNameInput}
              onChange={(e) => setSubAccountNameInput(e.target.value)}
              placeholder="Child's Name"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={isCreatingSubAccount}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="subAccountAllocation" className="block text-sm font-medium text-gray-700 text-left mb-1">Allocate Coins (0-100): {subAccountAllocationInput}</label>
            <input 
              type="range"
              id="subAccountAllocation"
              min="0"
              max={parentMaxAllocableCoins > 0 ? parentMaxAllocableCoins : 100}
              value={subAccountAllocationInput}
              onChange={(e) => setSubAccountAllocationInput(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              disabled={isCreatingSubAccount}
            />
          </div>
          <button 
            onClick={handleCreateSubAccount}
            disabled={isCreatingSubAccount || !subAccountNameInput.trim()}
            className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {isCreatingSubAccount ? 'Creating...' : 'Create Subaccount'}
          </button>
          {subAccountCreationError && (
            <p className="text-red-500 text-sm mt-3">{subAccountCreationError}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default GamePage; 