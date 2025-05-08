import { PrismaClient, User } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    console.log('Received /api/user/sync request for walletAddress:', walletAddress);

    if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid walletAddress provided' }, { status: 400 });
    }

    // Use Prisma's upsert to find or create the user
    // We need to explicitly define the type for the upsertedUser due to Prisma's User type
    const upsertedUser: User = await prisma.user.upsert({
      where: { walletAddress: walletAddress },
      update: {
        // Optionally, update a lastSeenAt field, e.g., lastSeenAt: new Date(),
        // For now, no specific fields to update if user already exists in this sync operation.
      },
      create: {
        walletAddress: walletAddress,
        coinBalance: 0, // Initial coinBalance, will be derived from ETH balance later dynamically
        // createdAt will be set by default by Prisma
      },
    });

    console.log('User synced (found or created):', upsertedUser);
    return NextResponse.json(upsertedUser, { status: 200 }); // Return 200 for upsert (found or created)

  } catch (error) {
    console.error('Error in /api/user/sync:', error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect();
  }
} 