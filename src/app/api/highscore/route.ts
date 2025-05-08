import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { score, address, userName } = body;

    console.log('Received high score submission:', body);

    // Basic validation
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ error: 'Invalid score provided' }, { status: 400 });
    }
    if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
        return NextResponse.json({ error: 'Invalid address provided' }, { status: 400 });
    }
    if (!userName || typeof userName !== 'string' || userName.trim() === '') {
        return NextResponse.json({ error: 'Invalid userName provided' }, { status: 400 });
    }

    // Find or create user based on wallet address
    const user = await prisma.user.upsert({
      where: { walletAddress: address },
      update: {},
      create: {
        walletAddress: address,
      },
    });

    console.log('Found or created user:', user);

    // Prepare data for HighScore
    const highScoreData = {
        score: score,
        userName: userName.trim(), 
        userId: user.id,
    };

    const newHighScore = await prisma.highScore.create({
      data: highScoreData,
    });

    console.log('Saved new high score:', newHighScore);
    return NextResponse.json(newHighScore, { status: 201 });

  } catch (error) {
    console.error('Error saving high score:', error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save high score' }, { status: 500 });
  } finally {
    // Optional: Disconnect Prisma Client if not using connection pooling effectively
    // await prisma.$disconnect(); 
  }
}

// --- GET Handler for Leaderboard ---
export async function GET(request: Request) {
    try {
        const leaderboardLimit = 10; // Fetch top 10 scores

        console.log(`Fetching top ${leaderboardLimit} high scores...`);

        const highScores = await prisma.highScore.findMany({
            take: leaderboardLimit,
            orderBy: {
                score: 'desc',
            },
            // Optionally include related user/subAccount if needed, but we saved userName directly
            // select: { score: true, userName: true, createdAt: true } // Select specific fields
        });

        console.log('Fetched high scores:', highScores);
        return NextResponse.json(highScores, { status: 200 });

    } catch (error) {
        console.error('Error fetching high scores:', error);
        return NextResponse.json({ error: 'Failed to fetch high scores' }, { status: 500 });
    } finally {
        // Optional: Disconnect Prisma Client
        // await prisma.$disconnect();
    }
} 