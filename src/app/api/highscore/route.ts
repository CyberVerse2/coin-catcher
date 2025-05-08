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

    // Check if the address belongs to a User (main account)
    const user = await prisma.user.findUnique({
        where: { walletAddress: address },
    });

    let highScoreData: any;

    if (user) {
        console.log('Address belongs to User:', user.id);
        // Score belongs to the main User
        highScoreData = {
            score: score,
            userName: userName.trim(), 
            userId: user.id,
        };
    } else {
        // Check if the address belongs to a known SubAccount
        const subAccount = await prisma.subAccount.findUnique({
            where: { subAccountAddress: address },
        });

        if (subAccount) {
            console.log('Address belongs to SubAccount:', subAccount.id);
            // Score belongs to the SubAccount
            highScoreData = {
                score: score,
                userName: userName.trim(), // Use submitted name for now
                subAccountId: subAccount.id,
            };
        } else {
            // Address not found as User or known SubAccount
            // This might happen if a subaccount address is used before parent registers it in our DB
            // Handle this case: Maybe link to parent? Or reject? Reject for now.
            console.warn(`Address ${address} not found as User or SubAccount. Rejecting score.`);
            return NextResponse.json({ error: 'Player account not found or registered in the game system.' }, { status: 404 });
        }
    }

    // Add the userName field to the highScoreData, required by schema
    // Note: We added this field back to the schema earlier.
    // Ensure your schema includes: userName String
    // highScoreData.userName = userName.trim(); // Already included above

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
    // Add check for Prisma errors if needed
    return NextResponse.json({ error: 'Failed to save high score' }, { status: 500 });
  } finally {
    // Optional: Disconnect Prisma Client if not using connection pooling effectively
    // await prisma.$disconnect(); 
  }
}

// --- GET Handler for Leaderboard ---
export async function GET(request: Request) {
    try {
        const leaderboardLimit = 10;
        console.log(`Fetching top ${leaderboardLimit} high scores...`);
        const highScores = await prisma.highScore.findMany({
            take: leaderboardLimit,
            orderBy: {
                score: 'desc',
            },
             // Assuming 'userName' field exists on HighScore model now
             select: { score: true, userName: true, createdAt: true } 
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