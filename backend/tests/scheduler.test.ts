import { prisma } from '../src/lib/prisma';
import { SchedulerService } from '../src/services/scheduler.service';
import {
  createTestUser, createTestOrg, createTestProject, createTestQueue,
} from './helpers';

describe('Scheduler Service', () => {
  let queueId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const org = await createTestOrg(user.id);
    const project = await createTestProject(org.id);
    const queue = await createTestQueue(project.id);
    queueId = queue.id;
  });

  describe('promoteDelayedJobs', () => {
    it('promotes SCHEDULED jobs whose runAt has passed', async () => {
      // Create a delayed job with runAt in the past
      const job = await prisma.job.create({
        data: {
          queueId,
          name: 'delayed-past',
          status: 'SCHEDULED',
          type: 'DELAYED',
          payload: {},
          runAt: new Date(Date.now() - 10000), // 10 seconds ago
        },
      });

      await SchedulerService.tick();

      const updated = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updated!.status).toBe('PENDING');
      expect(updated!.runAt).toBeNull();
    });

    it('does not promote jobs with runAt in the future', async () => {
      const job = await prisma.job.create({
        data: {
          queueId,
          name: 'delayed-future',
          status: 'SCHEDULED',
          type: 'DELAYED',
          payload: {},
          runAt: new Date(Date.now() + 60000), // 1 minute from now
        },
      });

      await SchedulerService.tick();

      const updated = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updated!.status).toBe('SCHEDULED');
    });
  });

  describe('triggerRecurringJobs', () => {
    it('spawns a new job instance when nextRunAt has passed', async () => {
      await prisma.scheduledJob.create({
        data: {
          jobTemplateId: (await prisma.job.create({
            data: { queueId, name: 'tpl', status: 'PENDING', type: 'RECURRING', payload: {} },
          })).id,
          queueId,
          cronExpression: '* * * * *',
          name: 'recurring-test',
          payload: {},
          nextRunAt: new Date(Date.now() - 5000), // due now
        },
      });

      const before = await prisma.job.count({ where: { queueId, type: 'RECURRING' } });
      await SchedulerService.tick();
      const after = await prisma.job.count({ where: { queueId, type: 'RECURRING' } });

      expect(after).toBeGreaterThan(before);
    });
  });
});
