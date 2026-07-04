/**
 * seed-jobs.ts — Creates sample jobs for manual testing / demo purposes.
 * Run: npx ts-node scripts/seed-jobs.ts
 */
import { PrismaClient, JobType, JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const queue = await prisma.queue.findFirst({ where: { slug: 'default' } });
  if (!queue) {
    console.error('Run prisma:seed first to create default queue');
    process.exit(1);
  }

  console.log(`Seeding jobs into queue: ${queue.name} (${queue.id})`);

  // Immediate jobs
  for (let i = 0; i < 10; i++) {
    await prisma.job.create({
      data: {
        queueId: queue.id,
        name: `send-email-${i}`,
        type: JobType.IMMEDIATE,
        status: JobStatus.PENDING,
        priority: Math.floor(Math.random() * 10),
        payload: { to: `user${i}@example.com`, subject: 'Hello' },
      },
    });
  }

  // A few completed jobs
  for (let i = 0; i < 5; i++) {
    await prisma.job.create({
      data: {
        queueId: queue.id,
        name: `completed-job-${i}`,
        type: JobType.IMMEDIATE,
        status: JobStatus.COMPLETED,
        priority: 0,
        payload: {},
        attempts: 1,
        result: { success: true },
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
      },
    });
  }

  // A failed job destined for DLQ
  const failedJob = await prisma.job.create({
    data: {
      queueId: queue.id,
      name: 'payment-processor-failed',
      type: JobType.IMMEDIATE,
      status: JobStatus.DEAD,
      priority: 5,
      payload: { orderId: 'ord_999', amount: 49.99 },
      attempts: 3,
      maxAttempts: 3,
      lastError: 'Payment gateway timeout after 30000ms',
    },
  });

  await prisma.dLQEntry.create({
    data: {
      jobId: failedJob.id,
      queueId: queue.id,
      reason: 'Exhausted 3 attempts',
      lastError: 'Payment gateway timeout after 30000ms',
      attempts: 3,
      payload: { orderId: 'ord_999', amount: 49.99 },
    },
  });

  // Delayed job
  await prisma.job.create({
    data: {
      queueId: queue.id,
      name: 'send-reminder-email',
      type: JobType.DELAYED,
      status: JobStatus.SCHEDULED,
      priority: 2,
      payload: { userId: 'user_42', templateId: 'reminder_v2' },
      runAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
    },
  });

  console.log('Seed complete — created 10 pending, 5 completed, 1 DLQ, 1 delayed job');
}

main().catch(console.error).finally(() => prisma.$disconnect());
