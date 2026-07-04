import { prisma } from '../src/lib/prisma';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Clean up test data between tests
afterEach(async () => {
  // Delete in dependency order
  await prisma.dLQEntry.deleteMany();
  await prisma.workerHeartbeat.deleteMany();
  await prisma.jobExecution.deleteMany();
  await prisma.jobLog.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.job.deleteMany();
  await prisma.jobBatch.deleteMany();
  await prisma.queueShard.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.project.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.retryPolicy.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.distributedLock.deleteMany();
  await prisma.user.deleteMany();
});
