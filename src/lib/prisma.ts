import { PrismaClient } from '@prisma/client';

// Declare a global variable to hold the PrismaClient instance.
// This is necessary because in development, Next.js clears the Node.js
// module cache on every request, which would lead to a new PrismaClient
// instance being created each time if not handled this way.

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient({
  // log: ['query', 'info', 'warn', 'error'], // Optional: enable Prisma logging
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma; 