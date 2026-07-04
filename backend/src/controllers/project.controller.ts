import { Request, Response } from 'express';
import { z } from 'zod';
import { ProjectService } from '../services/project.service';
import { asyncHandler } from '../utils/asyncHandler';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const { name, description } = CreateProjectSchema.parse(req.body);
  const project = await ProjectService.create(req.params.orgId, name, description);
  res.status(201).json({ success: true, data: project });
});

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const result = await ProjectService.list(req.params.orgId, req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
});

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await ProjectService.getById(req.params.projectId);
  res.json({ success: true, data: project });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const data = CreateProjectSchema.partial().parse(req.body);
  const project = await ProjectService.update(req.params.projectId, data);
  res.json({ success: true, data: project });
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  await ProjectService.delete(req.params.projectId);
  res.json({ success: true, message: 'Project deleted' });
});
