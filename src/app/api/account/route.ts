import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  DEFAULT_ALLOWANCE_ETH,
  DEFAULT_ALLOWANCE_PERIOD_SECONDS,
} from '@/lib/constants'; // Import constants

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameAccountAddress = searchParams.get('gameAccountAddress');

  console.log('Received GET /api/account request for address:', gameAccountAddress);

  if (!gameAccountAddress || typeof gameAccountAddress !== 'string' || !gameAccountAddress.startsWith('0x')) {
    return NextResponse.json({ error: 'Invalid or missing gameAccountAddress query parameter' }, { status: 400 });
  }

  try {
    let account = await prisma.account.findUnique({
      where: { walletAddress: gameAccountAddress },
    });

    if (!account) {
      console.log('Account not found for address:', gameAccountAddress);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // --- Allowance Period Reset Check --- 
    const now = new Date();
    let needsUpdate = false;

    if (account.allowancePeriodStart && account.currentAllowancePeriodSeconds && account.currentAllowanceLimitETH !== null) {
      const periodEndTime = new Date(account.allowancePeriodStart.getTime() + account.currentAllowancePeriodSeconds * 1000);
      
      if (now >= periodEndTime) {
        console.log(`[Allowance Reset] Period for ${gameAccountAddress} expired. Resetting.`);
        account.allowancePeriodStart = now;
        account.allowanceSpentThisPeriodETH = 0;
        needsUpdate = true;
      } else {
        console.log(`[Allowance Check] Period for ${gameAccountAddress} still active. Ends at: ${periodEndTime.toISOString()}`);
      }
    } else {
      // Handle cases where allowance fields might be null (e.g., older accounts before feature added)
      // Or if the setup API didn't run yet. Initialize/Set them now using constants.
      console.log(`[Allowance Init/Update] Initializing/Updating allowance fields for ${gameAccountAddress}`);
      account.currentAllowanceLimitETH = DEFAULT_ALLOWANCE_ETH;
      account.currentAllowancePeriodSeconds = DEFAULT_ALLOWANCE_PERIOD_SECONDS;
      account.allowancePeriodStart = now; // Start new period now
      account.allowanceSpentThisPeriodETH = 0; // Reset spend
      needsUpdate = true;
    }

    // If we detected a reset/update is needed, update the DB
    if (needsUpdate) {
      try {
        account = await prisma.account.update({
          where: { walletAddress: gameAccountAddress },
          data: {
            currentAllowanceLimitETH: account.currentAllowanceLimitETH,
            currentAllowancePeriodSeconds: account.currentAllowancePeriodSeconds,
            allowancePeriodStart: account.allowancePeriodStart,
            allowanceSpentThisPeriodETH: account.allowanceSpentThisPeriodETH,
          },
        });
        console.log('Allowance details updated in DB for:', gameAccountAddress);
      } catch (updateError) {
        console.error('Error updating allowance details in DB:', updateError);
        // Decide if we should proceed with stale data or return an error.
        // Returning stale data might be acceptable here, but log the failure.
      }
    }
    // --- End Allowance Period Reset Check ---

    console.log('Account found (potentially updated):', account);
    return NextResponse.json(account, { status: 200 });

  } catch (error) {
    console.error('Error fetching account in /api/account:', error);
    // It's good practice to avoid sending detailed server errors to the client.
    return NextResponse.json({ error: 'Failed to fetch account details' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect(); // Depending on Prisma client lifecycle management
  }
} 