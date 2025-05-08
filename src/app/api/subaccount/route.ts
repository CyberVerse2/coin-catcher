import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      parentWalletAddress,
      newSubAccountAddress,
    } = body;

    console.log('Received POST /api/subaccount request:', body);

    // Basic Validations
    if (!parentWalletAddress || typeof parentWalletAddress !== 'string' || !parentWalletAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid parentWalletAddress provided' }, { status: 400 });
    }
    if (!newSubAccountAddress || typeof newSubAccountAddress !== 'string' || !newSubAccountAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid newSubAccountAddress provided' }, { status: 400 });
    }

    // Find the parent User
    const parentUser = await prisma.user.findUnique({
      where: { walletAddress: parentWalletAddress },
    });

    if (!parentUser) {
      return NextResponse.json({ error: 'Parent user not found' }, { status: 404 });
    }

    // Check if subaccount address already exists (should be unique from SDK)
    const existingSubAccount = await prisma.subAccount.findUnique({
        where: { subAccountAddress: newSubAccountAddress },
    });

    if (existingSubAccount) {
        console.log('Subaccount address already registered:', existingSubAccount);
        return NextResponse.json(existingSubAccount, { status: 200 }); 
    }

    // Create the new subaccount with fixed allocation and default name
    const defaultUsername = `Player_${parentWalletAddress.substring(2, 8)}`;
    const defaultAllocation = 100;

    const newSubAccount = await prisma.subAccount.create({
      data: {
        parentId: parentUser.id,
        username: defaultUsername,
        subAccountAddress: newSubAccountAddress,
        allocatedCoins: defaultAllocation,
        spendingLimitAmount: 0,
        spendingLimitInterval: 'WEEKLY',
      },
    });

    console.log('Created new SubAccount:', newSubAccount);
    return NextResponse.json(newSubAccount, { status: 201 });

  } catch (error) {
    console.error('Error creating subaccount:', error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create subaccount' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect();
  }
}

// NEW GET handler to check existence
export async function GET(request: NextRequest) { // Import NextRequest from next/server
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const parentWalletAddr = searchParams.get('parentWalletAddress'); // Get parent address to ensure link

    if (!address || !parentWalletAddr) {
      return NextResponse.json({ error: 'Missing address or parentWalletAddress query parameter' }, { status: 400 });
    }

    console.log(`Received GET /api/subaccount check for address: ${address}, parent: ${parentWalletAddr}`);

    // Find parent first to get their DB ID
    const parentUser = await prisma.user.findUnique({
        where: { walletAddress: parentWalletAddr },
        select: { id: true } // Only need parent ID
    });

    if (!parentUser) {
         // Return 404 for subaccount check if parent doesn't exist
         return NextResponse.json({ message: 'Parent user not found, cannot check subaccount.' }, { status: 404 }); 
    }

    // Check if subaccount exists and is linked to this parent
    const subAccount = await prisma.subAccount.findUnique({
      where: { 
        subAccountAddress: address,
        // We need to ensure it's linked to this specific parent.
        // However, Prisma doesn't allow querying unique fields AND relation fields directly in `findUnique` `where`.
        // Let's find by address and then check parentId.
        // Alternative: use findFirst with a compound condition if subAccountAddress wasn't unique globally (but it is).
      },
    });

    // If found by address, verify it belongs to the correct parent
    if (subAccount && subAccount.parentId === parentUser.id) {
      console.log('Subaccount found and linked to correct parent:', subAccount);
      return NextResponse.json(subAccount, { status: 200 }); // Found
    } else {
      console.log('Subaccount not found for this address or not linked to this parent.');
      return NextResponse.json({ message: 'Subaccount not found for this parent' }, { status: 404 }); // Not found for this parent
    }
  } catch (error) {
    console.error('Error in GET /api/subaccount:', error);
    return NextResponse.json({ error: 'Failed to check subaccount' }, { status: 500 });
  } finally {
    // Optional: await prisma.$disconnect();
  }
} 