import { Account } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  DEFAULT_ALLOWANCE_ETH,
  DEFAULT_ALLOWANCE_PERIOD_SECONDS,
} from '@/lib/constants'; // Import constants

// const prisma = new PrismaClient(); // Remove local instantiation

export async function POST(request: Request) {
  console.log('--- DEBUG PRISMA OBJECT ---');
  console.log('Is prisma defined?', !!prisma);
  if (prisma) {
    console.log('Keys in prisma object:', Object.keys(prisma));
    console.log('prisma.account defined?', !!prisma.account);
  }
  console.log('--- END DEBUG PRISMA OBJECT ---');

  try {
    const body = await request.json();
    const { gameAccountAddress, parentEoaAddress, newUsername } = body;

    console.log('Received POST /api/account/setup request:', body);

    // --- Input Validation ---
    if (!gameAccountAddress || typeof gameAccountAddress !== 'string' || !gameAccountAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid gameAccountAddress provided' }, { status: 400 });
    }
    // parentEoaAddress can be null/undefined if not available, but if provided, must be valid.
    if (parentEoaAddress && (typeof parentEoaAddress !== 'string' || !parentEoaAddress.startsWith('0x'))) {
        return NextResponse.json({ error: 'Invalid parentEoaAddress provided' }, { status: 400 });
    }
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim().length < 1 || newUsername.trim().length > 20) {
      return NextResponse.json({ error: 'Invalid newUsername provided (must be 1-20 chars)' }, { status: 400 });
    }
    if (newUsername.trim().startsWith('Player_')) {
      return NextResponse.json({ error: "Username cannot start with 'Player_'." }, { status: 400 });
    }
    // --- End Input Validation ---

    const trimmedUsername = newUsername.trim();
    const now = new Date(); // Use a consistent timestamp

    // Upsert the Account
    // This will create the account if it doesn't exist, or update it if it does.
    // Importantly, we also initialize/reset allowance details here.
    const account: Account = await prisma.account.upsert({
      where: { walletAddress: gameAccountAddress },
      update: {
        username: trimmedUsername,
        parentWalletAddress: parentEoaAddress, // Ensure parent is linked/updated
        // Update allowance details - this ensures they are set even if user updates name later
        currentAllowanceLimitETH: DEFAULT_ALLOWANCE_ETH,
        currentAllowancePeriodSeconds: DEFAULT_ALLOWANCE_PERIOD_SECONDS,
        // Optionally: Only reset period/spent if user didn't exist before? 
        // For simplicity, let's reset on every setup call for now.
        allowancePeriodStart: now,
        allowanceSpentThisPeriodETH: 0,
      },
      create: {
        walletAddress: gameAccountAddress,
        parentWalletAddress: parentEoaAddress,
        username: trimmedUsername,
        allocatedCoins: 100, // Default allocation - NOTE: Is this field still used?
        // Initialize allowance details
        currentAllowanceLimitETH: DEFAULT_ALLOWANCE_ETH,
        currentAllowancePeriodSeconds: DEFAULT_ALLOWANCE_PERIOD_SECONDS,
        allowancePeriodStart: now,
        allowanceSpentThisPeriodETH: 0,
      },
    });

    console.log('Account setup/updated successfully:', account);
    return NextResponse.json(account, { status: 200 }); // 200 for upsert ok, 201 if we only did create

  } catch (error) {
    console.error('Error in /api/account/setup:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    // Add specific Prisma error checks if needed (e.g., unique constraint violations if any)
    return NextResponse.json({ error: 'Failed to setup account' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect();
  }
} 