import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameAccountAddress = searchParams.get('gameAccountAddress');

  console.log('Received GET /api/account request for address:', gameAccountAddress);

  if (!gameAccountAddress || typeof gameAccountAddress !== 'string' || !gameAccountAddress.startsWith('0x')) {
    return NextResponse.json({ error: 'Invalid or missing gameAccountAddress query parameter' }, { status: 400 });
  }

  try {
    const account = await prisma.account.findUnique({
      where: { walletAddress: gameAccountAddress },
    });

    if (!account) {
      console.log('Account not found for address:', gameAccountAddress);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    console.log('Account found:', account);
    return NextResponse.json(account, { status: 200 });

  } catch (error) {
    console.error('Error fetching account in /api/account:', error);
    // It's good practice to avoid sending detailed server errors to the client.
    return NextResponse.json({ error: 'Failed to fetch account details' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect(); // Depending on Prisma client lifecycle management
  }
} 