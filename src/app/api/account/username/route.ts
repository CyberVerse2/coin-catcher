import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { gameAccountAddress, newUsername } = body;

    console.log('Received PUT /api/account/username request:', body);

    // Validate inputs
    if (!gameAccountAddress || typeof gameAccountAddress !== 'string' || !gameAccountAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid gameAccountAddress provided' }, { status: 400 });
    }
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim().length < 1 || newUsername.trim().length > 20) {
        return NextResponse.json({ error: 'Invalid newUsername provided (must be 1-20 chars)' }, { status: 400 });
    }
    if (newUsername.trim().startsWith('Player_')) {
        return NextResponse.json({ error: 'Username cannot start with \'Player_\'.' }, { status: 400 });
    }

    // Find the account
    const account = await prisma.account.findUnique({
        where: { walletAddress: gameAccountAddress },
    });

    if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Update the username
    const updatedAccount = await prisma.account.update({
        where: { walletAddress: gameAccountAddress },
        data: { username: newUsername.trim() },
    });

    console.log('Account username updated:', updatedAccount);
    return NextResponse.json(updatedAccount, { status: 200 });

  } catch (error) {
    console.error('Error in /api/account/username:', error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    // Add specific Prisma error checks if needed
    return NextResponse.json({ error: 'Failed to update username' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect();
  }
} 