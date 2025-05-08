import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DEFAULT_ALLOWANCE_ETH, DEFAULT_ALLOWANCE_PERIOD_SECONDS } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameAccountAddress, amountSpentETH } = body;

    console.log('Received POST /api/account/record-spend request:', body);

    // --- Input Validation ---
    if (!gameAccountAddress || typeof gameAccountAddress !== 'string' || !gameAccountAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid gameAccountAddress provided' }, { status: 400 });
    }
    if (typeof amountSpentETH !== 'number' || amountSpentETH <= 0) {
      return NextResponse.json({ error: 'Invalid amountSpentETH provided (must be a positive number)' }, { status: 400 });
    }
    // --- End Input Validation ---

    // Fetch the account
    let account = await prisma.account.findUnique({
      where: { walletAddress: gameAccountAddress },
    });

    if (!account) {
      console.error(`[Record Spend] Account not found for address: ${gameAccountAddress}`);
      // Should not happen if called after successful setup/get, but handle defensively
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // --- Allowance Period Reset Check & Initialization (similar to GET /api/account) --- 
    const now = new Date();
    let needsUpdateBeforeSpend = false;

    if (account.allowancePeriodStart && account.currentAllowancePeriodSeconds && account.currentAllowanceLimitETH !== null) {
      const periodEndTime = new Date(account.allowancePeriodStart.getTime() + account.currentAllowancePeriodSeconds * 1000);
      if (now >= periodEndTime) {
        console.log(`[Record Spend - Allowance Reset] Period for ${gameAccountAddress} expired. Resetting before recording spend.`);
        account.allowancePeriodStart = now;
        account.allowanceSpentThisPeriodETH = 0; // Reset spend first
        needsUpdateBeforeSpend = true;
      }
    } else {
      // Initialize if fields are missing (should ideally be set by setup)
      console.log(`[Record Spend - Allowance Init] Initializing allowance fields for ${gameAccountAddress} before recording spend.`);
      account.currentAllowanceLimitETH = DEFAULT_ALLOWANCE_ETH;
      account.currentAllowancePeriodSeconds = DEFAULT_ALLOWANCE_PERIOD_SECONDS;
      account.allowancePeriodStart = now; // Start new period now
      account.allowanceSpentThisPeriodETH = 0;
      needsUpdateBeforeSpend = true;
    }
    
    // If a reset/init occurred, update the DB state *before* checking the limit
    if (needsUpdateBeforeSpend) {
         // Re-assign account after update to ensure we have the latest state for limit check
         account = await prisma.account.update({
             where: { walletAddress: gameAccountAddress },
             data: {
                 currentAllowanceLimitETH: account.currentAllowanceLimitETH,
                 currentAllowancePeriodSeconds: account.currentAllowancePeriodSeconds,
                 allowancePeriodStart: account.allowancePeriodStart,
                 allowanceSpentThisPeriodETH: account.allowanceSpentThisPeriodETH, // This is 0 if reset
             },
         });
         console.log('[Record Spend] Allowance details reset/initialized in DB for:', gameAccountAddress);
    }
    // --- End Period Check ---

    // --- Spending Limit Validation --- 
    const currentSpent = account.allowanceSpentThisPeriodETH;
    const limit = account.currentAllowanceLimitETH; // Should be non-null after the check above
    const newTotalSpent = currentSpent + amountSpentETH;

    // Use a small tolerance for floating point comparisons
    const tolerance = 1e-9;
    if (limit !== null && newTotalSpent > limit + tolerance) {
      console.warn(`[Record Spend] Spending limit exceeded for ${gameAccountAddress}. Attempted: ${amountSpentETH}, Current Spent: ${currentSpent}, Limit: ${limit}`);
      return NextResponse.json({ error: 'Spending limit exceeded for the current period.' }, { status: 403 }); // 403 Forbidden
    }
    // --- End Validation --- 

    // --- Record the Spend --- 
    const updatedAccount = await prisma.account.update({
        where: { walletAddress: gameAccountAddress },
        data: {
            allowanceSpentThisPeriodETH: newTotalSpent, // Update with the new total
        },
    });
    // --- End Record Spend --- 

    console.log(`[Record Spend] Successfully recorded spend of ${amountSpentETH} for ${gameAccountAddress}. New total: ${newTotalSpent}`);
    return NextResponse.json(updatedAccount, { status: 200 }); // Return updated account

  } catch (error) {
    console.error('Error in /api/account/record-spend:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to record spend' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect();
  }
} 