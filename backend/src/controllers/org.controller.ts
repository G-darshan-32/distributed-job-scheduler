import { Request, Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { OrgService } from '../services/org.service';
import { asyncHandler } from '../utils/asyncHandler';

const CreateOrgSchema = z.object({ name: z.string().min(1).max(100) });
const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role).default(Role.MEMBER),
});

export const createOrg = asyncHandler(async (req: Request, res: Response) => {
  const { name } = CreateOrgSchema.parse(req.body);
  const org = await OrgService.create(req.user!.id, name);
  res.status(201).json({ success: true, data: org });
});

export const listOrgs = asyncHandler(async (req: Request, res: Response) => {
  const orgs = await OrgService.listForUser(req.user!.id);
  res.json({ success: true, data: orgs });
});

export const getOrg = asyncHandler(async (req: Request, res: Response) => {
  const org = await OrgService.getById(req.params.orgId);
  res.json({ success: true, data: org });
});

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  const { email, role } = AddMemberSchema.parse(req.body);
  const membership = await OrgService.addMember(req.params.orgId, email, role);
  res.status(201).json({ success: true, data: membership });
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  await OrgService.removeMember(req.params.orgId, req.params.userId);
  res.json({ success: true, message: 'Member removed' });
});
