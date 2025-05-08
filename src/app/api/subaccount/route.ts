import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      parentWalletAddress,
      subAccountName,
      allocatedCoins,
      newSubAccountAddress,
    } = body;

    console.log('Received /api/subaccount request:', body);

    // Basic Validations
    if (!parentWalletAddress || typeof parentWalletAddress !== 'string' || !parentWalletAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid parentWalletAddress provided' }, { status: 400 });
    }
    if (!newSubAccountAddress || typeof newSubAccountAddress !== 'string' || !newSubAccountAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid newSubAccountAddress provided' }, { status: 400 });
    }
    if (!subAccountName || typeof subAccountName !== 'string' || subAccountName.trim() === '') {
      return NextResponse.json({ error: 'Invalid subAccountName provided' }, { status: 400 });
    }
    if (typeof allocatedCoins !== 'number' || allocatedCoins < 0) { // Add check for <= max parent coins later
      return NextResponse.json({ error: 'Invalid allocatedCoins provided' }, { status: 400 });
    }

    // Find the parent User
    const parentUser = await prisma.user.findUnique({
      where: { walletAddress: parentWalletAddress },
    });

    if (!parentUser) {
      return NextResponse.json({ error: 'Parent user not found' }, { status: 404 });
    }

    // TODO: Add validation here for parentUser.coinBalance vs allocatedCoins for THIS subaccount
    // and also total allocated coins for ALL subaccounts of this parent.
    // This requires fetching parentUser.coinBalance (which should be up-to-date from their ETH balance)
    // and also summing `allocatedCoins` for existing subaccounts of this parent.
    // For now, we'll proceed with creation assuming client-side checks were indicative.

    // Check if subaccount address already exists (should be unique from SDK)
    const existingSubAccount = await prisma.subAccount.findUnique({
        where: { subAccountAddress: newSubAccountAddress },
    });

    if (existingSubAccount) {
        return NextResponse.json({ error: 'This subaccount address is already registered.' }, { status: 409 });
    }

    const newSubAccount = await prisma.subAccount.create({
      data: {
        parentId: parentUser.id,
        username: subAccountName.trim(),
        subAccountAddress: newSubAccountAddress,
        allocatedCoins: allocatedCoins,
        // Default spendingLimitAmount and spendingLimitInterval for now, as we aren't setting them via SDK yet
        // These fields are in the schema with no defaults, so they need values.
        // Let's assume 0 and DAILY as placeholders if they are mandatory and not nullable.
        // Re-checking schema: spendingLimitAmount (Float), spendingLimitInterval (Enum)
        // They are not optional. We must provide values.
        spendingLimitAmount: 0, // Placeholder - assuming 0 means no specific on-chain limit set by us for now
        spendingLimitInterval: 'WEEKLY', // Placeholder - default interval
      },
    });

    console.log('Created new SubAccount:', newSubAccount);
    return NextResponse.json(newSubAccount, { status: 201 });

  } catch (error) {
    console.error('Error creating subaccount:', error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    // Add specific Prisma error checks if needed, e.g., unique constraint violations not caught above
    return NextResponse.json({ error: 'Failed to create subaccount' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect();
  }
} 