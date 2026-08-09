import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️ Clearing database...');

  // The order matters if there were strict foreign key constraints, 
  // but MongoDB is more flexible. Still, it's good practice to go from children to parents.
  
  const models = [
    'faceDetection',
    'galleryMedia',
    'mediaContribution',
    'registration',
    'galleryAlbum',
    'event',
    'userFaceProfile',
    'subscription',
    'account',
    'session',
    'verificationToken',
    'passwordResetToken',
    'user',
    'membershipPlan',
    'leadershipMember',
    'config',
  ];

  for (const model of models) {
    try {
      // @ts-ignore - dynamic access
      await prisma[model].deleteMany({});
      console.log(`✅ Cleared ${model}`);
    } catch (error) {
      console.error(`❌ Failed to clear ${model}:`, error);
    }
  }

  console.log('✨ Database cleared successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
