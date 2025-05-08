import { PrismaClient, Account, HighScore } from '@prisma/client';
import { NextResponse } from 'next/server';

// Use Prisma singleton instance
import prisma from '@/lib/prisma'; 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { score, address, userName } = body; // Address is the game account address

    console.log('[API /highscore POST] Received submission:', body);

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

    let newPersonalBest = false;
    let updatedAccount: Account | null = null;
    let newHighScore: HighScore | null = null;

    // Use transaction to fetch account, potentially update personal best, and create high score
    await prisma.$transaction(async (tx) => {
        // 1. Find the account associated with the game address
        const account = await tx.account.findUnique({
            where: { walletAddress: address },
        });

        if (!account) {
            console.error(`[API /highscore POST] Account not found for address ${address}. This should not happen if account setup flow is working.`);
            // Throw an error to rollback transaction
            throw new Error('Player account not found.'); 
        }

        updatedAccount = account; // Initially set to the fetched account

        // 2. Check if it's a new personal best
        if (score > account.personalBestScore) {
            console.log(`[API /highscore POST] New personal best for ${address}: ${score} > ${account.personalBestScore}`);
            newPersonalBest = true;
            // Update the account's personalBestScore
            updatedAccount = await tx.account.update({
                where: { walletAddress: address },
                data: { personalBestScore: score },
            });
            console.log(`[API /highscore POST] Updated account personal best score.`);
        }

        // 3. Create the HighScore linked to the Account
        newHighScore = await tx.highScore.create({
            data: {
                score: score,
                userName: userName.trim(), // Store the submitted name on the score record
                accountId: account.id, // Link to the Account model
            },
        });
        console.log('[API /highscore POST] Saved new high score:', newHighScore);
    });

    // Check if transaction completed successfully (newHighScore should be set)
    if (!newHighScore) {
        // This implies the transaction rolled back due to the account not being found
        return NextResponse.json({ error: 'Player account not found.' }, { status: 404 });
    }

    // Return the results
    return NextResponse.json({ 
        highScore: newHighScore, 
        account: updatedAccount, // Return the potentially updated account
        newPersonalBest: newPersonalBest 
    }, { status: 201 });

  } catch (error) {
    console.error('[API /highscore POST] Error saving high score:', error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    // Handle specific error thrown from transaction
    if (error instanceof Error && error.message === 'Player account not found.') {
        return NextResponse.json({ error: 'Player account not found.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to save high score' }, { status: 500 });
  } 
  // Removed finally block with disconnect for singleton pattern
}

// --- GET Handler for Leaderboard ---
export async function GET(request: Request) {
    try {
        const leaderboardLimit = 10;
        console.log(`[API /highscore GET] Fetching top ${leaderboardLimit} high scores...`);
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
        console.log('[API /highscore GET] Fetched high scores:', highScores);
        return NextResponse.json(highScores, { status: 200 });
    } catch (error) {
        console.error('[API /highscore GET] Error fetching high scores:', error);
        return NextResponse.json({ error: 'Failed to fetch high scores' }, { status: 500 });
    } 
    // Removed finally block with disconnect for singleton pattern
} 