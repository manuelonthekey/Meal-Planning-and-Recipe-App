import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticateToken);

const updateTargetsSchema = z.object({
  dailyCaloriesTarget: z.number().positive().nullable().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  age: z.number().int().positive().nullable().optional(),
  weightKg: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
  gender: z.string().nullable().optional(),
  activityLevel: z.string().nullable().optional(),
  dailyCaloriesTarget: z.number().positive().nullable().optional(),
  proteinTarget: z.number().positive().nullable().optional(),
  carbsTarget: z.number().positive().nullable().optional(),
  fatTarget: z.number().positive().nullable().optional(),
  dietaryPreferences: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
});

// Get full user profile
router.get('/profile', async (req: AuthRequest, res: any, next: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true,
        dailyCaloriesTarget: true, age: true,
        weightKg: true, heightCm: true,
        gender: true, activityLevel: true,
        proteinTarget: true, carbsTarget: true, fatTarget: true,
        dietaryPreferences: true, allergies: true,
        createdAt: true,
      }
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update profile
router.patch('/profile', async (req: AuthRequest, res: any, next: any) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, email: true, name: true,
        dailyCaloriesTarget: true, age: true,
        weightKg: true, heightCm: true,
        gender: true, activityLevel: true,
        proteinTarget: true, carbsTarget: true, fatTarget: true,
        dietaryPreferences: true, allergies: true,
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    next(error);
  }
});

// Update nutrition targets only (kept for backward compat)
router.patch('/targets', async (req: AuthRequest, res: any, next: any) => {
  try {
    const data = updateTargetsSchema.parse(req.body);
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, email: true, name: true,
        dailyCaloriesTarget: true,
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating targets:', error);
    next(error);
  }
});

export default router;
