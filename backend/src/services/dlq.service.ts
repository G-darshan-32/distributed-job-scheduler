import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { JobService } from './job.service';
import { getPaginationParams, paginate } from '../utils/pagination';
import { config } from '../config';

export class DLQService {
  static async list(query: Record<string, unknown>) {
    const params = getPaginationParams(query);
    const queueId = query.queueId ? String(query.queueId) : undefined;

    const where = queueId ? { queueId } : {};

    const [entries, total] = await Promise.all([
      prisma.dLQEntry.findMany({
        where,
        include: { job: { include: { queue: true } } },
        orderBy: { failedAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.dLQEntry.count({ where }),
    ]);

    return paginate(entries, total, params);
  }

  static async replay(dlqEntryId: string) {
    const entry = await prisma.dLQEntry.findUnique({
      where: { id: dlqEntryId },
      include: { job: true },
    });
    if (!entry) throw new AppError('DLQ entry not found', 404, 'NOT_FOUND');

    const newJob = await JobService.create(entry.queueId, {
      name: `${entry.job.name} [replay]`,
      payload: entry.payload as Record<string, unknown>,
      priority: entry.job.priority,
    });

    await prisma.dLQEntry.update({
      where: { id: dlqEntryId },
      data: { replayedAt: new Date(), replayJobId: newJob.id },
    });

    return newJob;
  }

  static async delete(dlqEntryId: string) {
    const entry = await prisma.dLQEntry.findUnique({ where: { id: dlqEntryId } });
    if (!entry) throw new AppError('DLQ entry not found', 404, 'NOT_FOUND');
    await prisma.dLQEntry.delete({ where: { id: dlqEntryId } });
  }

  static async generateAiSummary(dlqEntryId: string): Promise<string> {
    const entry = await prisma.dLQEntry.findUnique({
      where: { id: dlqEntryId },
      include: { job: { include: { logs: { orderBy: { timestamp: 'desc' }, take: 20 } } } },
    });
    if (!entry) throw new AppError('DLQ entry not found', 404, 'NOT_FOUND');

    // AI summary placeholder - integrates with OpenAI if key is present
    let summary = '';
    if (config.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content:
                  'You are a DevOps engineer analyzing job failure logs. Provide a concise root cause analysis in 2-3 sentences.',
              },
              {
                role: 'user',
                content: `Job "${entry.job.name}" failed ${entry.attempts} times.\nLast error: ${entry.lastError}\nReason: ${entry.reason}\nLogs: ${entry.job.logs.map((l) => l.message).join('\n')}`,
              },
            ],
            max_tokens: 200,
          }),
        });
        const data = (await response.json()) as { choices: { message: { content: string } }[] };
        summary = data.choices[0]?.message?.content ?? 'Unable to generate summary.';
      } catch {
        summary = 'AI summary unavailable.';
      }
    } else {
      summary = `Job failed ${entry.attempts} times. Last error: ${entry.lastError}. Review logs for details.`;
    }

    await prisma.dLQEntry.update({ where: { id: dlqEntryId }, data: { aiSummary: summary } });
    return summary;
  }
}
