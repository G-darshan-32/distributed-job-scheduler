#!/usr/bin/env node
// Production seed script — runs with plain node, no TypeScript needed.
// Usage from Railway console: node dist/../prisma/seed-prod.js
'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding production database...');

  // Retry policies with fixed UUIDs for idempotency
  await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Exponential Backoff',
      strategy: 'EXPONENTIAL',
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 3600000,
      multiplier: 2.0,
    },
  });

  await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Linear Backoff',
      strategy: 'LINEAR',
      maxAttempts: 3,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      multiplier: 1.0,
    },
  });

  await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Fixed Delay',
      strategy: 'FIXED',
      maxAttempts: 3,
      baseDelayMs: 5000,
      maxDelayMs: 5000,
      multiplier: 1.0,
    },
  });

  const hash = await bcrypt.hash('Admin@123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', passwordHash: hash, name: 'Admin User' },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: { name: 'Demo Organization', slug: 'demo-org' },
  });

  await prisma.orgMembership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {},
    create: { userId: user.id, organizationId: org.id, role: 'OWNER' },
  });

  const project = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'demo-project' } },
    update: {},
    create: { organizationId: org.id, name: 'Demo Project', slug: 'demo-project', description: 'Default demo project' },
  });

  await prisma.queue.upsert({
    where: { projectId_slug: { projectId: project.id, slug: 'default' } },
    update: {},
    create: {
      projectId: project.id,
      retryPolicyId: '00000000-0000-0000-0000-000000000001',
      name: 'Default',
      slug: 'default',
      description: 'Default queue',
      priority: 0,
      concurrencyLimit: 10,
    },
  });

  await prisma.queue.upsert({
    where: { projectId_slug: { projectId: project.id, slug: 'critical' } },
    update: {},
    create: {
      projectId: project.id,
      retryPolicyId: '00000000-0000-0000-0000-000000000003',
      name: 'Critical',
      slug: 'critical',
      description: 'High-priority critical jobs',
      priority: 100,
      concurrencyLimit: 5,
    },
  });

  console.log('Seed complete. Login: admin@example.com / Admin@123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
