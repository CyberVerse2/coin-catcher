import { Account } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    // Upsert the Account
    // This will create the account if it doesn't exist, or update it if it does.
    const account: Account = await prisma.account.upsert({
      where: { walletAddress: gameAccountAddress },
      update: {
        username: trimmedUsername,
        parentWalletAddress: parentEoaAddress , // Ensure parent is linked/updated
      },
      create: {
        walletAddress: gameAccountAddress,
        parentWalletAddress: parentEoaAddress ,
        username: trimmedUsername,
        allocatedCoins: 100, // Default allocation
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