import { PrismaClient, Account } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { score, address, userName } = body; // Address is the game account address

    console.log('Received high score submission:', body);

    // Basic validation
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ error: 'Invalid score provided' }, { status: 400 });
    }
    if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
        return NextResponse.json({ error: 'Invalid address provided' }, { status: 400 });
    }
    if (!userName || typeof userName !== 'string' || userName.trim() === '') {
        // Keep userName from input for now, as per schema
        return NextResponse.json({ error: 'Invalid userName provided' }, { status: 400 });
    }

    // Upsert the Account associated with the game address
    // This ensures the account record exists before we link a high score to it.
    // We don't have the parentWalletAddress here, so we can't link it if creating.
    // It should have been created/linked during the initial sync via the (now removed) sync endpoint.
    // For robustness, we upsert, setting parentWalletAddress to null if creating here.
    // A better flow might involve fetching parent info if needed, but let's keep it simple.
    const defaultUsername = `Player_${address.substring(2, 8)}`;
    const account: Account = await prisma.account.upsert({
        where: { walletAddress: address },
        update: {
            // No fields to update here during high score submission
        },
        create: {
            walletAddress: address,
            parentWalletAddress: null, // We don't know the parent here
            username: defaultUsername,
            allocatedCoins: 100, // Default allocation if created via high score
        },
    });

    console.log('Account ensured/found:', account);

    // Original logic check (should always pass now after upsert)
    // if (!account) {
    //     console.warn(`Account not found for address ${address} during high score submission.`);
    //     return NextResponse.json({ error: 'Player account not found in the game system.' }, { status: 404 });
    // }

    // Create the HighScore linked to the found/created Account
    const newHighScore = await prisma.highScore.create({
      data: {
        score: score,
        userName: userName.trim(), // Store the submitted name on the score record
        accountId: account.id, // Link to the Account model
      },
    });

    console.log('Saved new high score:', newHighScore);
    // Return both the high score and the account data (which includes username)
    return NextResponse.json({ highScore: newHighScore, account: account }, { status: 201 });

  } catch (error) {
    console.error('Error saving high score:', error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save high score' }, { status: 500 });
  } finally {
    // Optional: Disconnect Prisma Client
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
             // Select fields from HighScore model directly
             // Includes userName which is stored on the HighScore itself
             select: { score: true, userName: true, createdAt: true } 
             // If we wanted the Account's username instead, we'd include the relation:
             // select: { score: true, createdAt: true, account: { select: { username: true } } }
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