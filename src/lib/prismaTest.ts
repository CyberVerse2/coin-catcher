import { PrismaClient, SpendingLimitInterval } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Prisma test script...');

  try {
    // 1. Create a test User
    const testUser = await prisma.user.create({
      data: {
        walletAddress: `test-wallet-${Date.now()}@example.com`, // Ensure unique walletAddress
        coinBalance: 1000, // Example balance
      },
    });
    console.log('Created User:', testUser);

    // 2. Create a SubAccount for that User
    const testSubAccount = await prisma.subAccount.create({
      data: {
        parentId: testUser.id,
        username: 'TestChildAccount',
        subAccountAddress: `test-sub-wallet-${Date.now()}@example.com`, // Ensure unique address
        spendingLimitAmount: 50.0,
        spendingLimitInterval: SpendingLimitInterval.WEEKLY,
      },
    });
    console.log('Created SubAccount:', testSubAccount);

    // 3. Create a HighScore for the User
    const userHighScore = await prisma.highScore.create({
      data: {
        score: 15000,
        userId: testUser.id,
      },
    });
    console.log('Created User HighScore:', userHighScore);

    // 4. Create a HighScore for the SubAccount
    const subAccountHighScore = await prisma.highScore.create({
      data: {
        score: 25000,
        subAccountId: testSubAccount.id,
      },
    });
    console.log('Created SubAccount HighScore:', subAccountHighScore);

    // 5. Read and print data (fetching user with related data)
    const fetchedUserWithRelations = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        createdSubAccounts: {
          include: {
            highScores: true,
          },
        },
        highScores: true,
      },
    });
    console.log('Fetched User with relations:', JSON.stringify(fetchedUserWithRelations, null, 2));

    console.log('Prisma test script completed successfully!');

  } catch (e) {
    console.error('Error in Prisma test script:', e);
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected Prisma client.');
  }
}

main(); 