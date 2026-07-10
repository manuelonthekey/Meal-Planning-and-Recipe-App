import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { ShoppingListService } from '../services/shoppingList.service';

const router = Router();
router.use(authenticateToken);

const entrySchema = z.object({
  recipeId: z.number().int(),
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  servingsMultiplier: z.number().positive().optional()
});

// Helper to get start of current week (Monday)
function getStartOfCurrentWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0,0,0,0);
  return monday;
}

router.get('/current', async (req: AuthRequest, res, next) => {
  try {
    const startOfWeekDate = getStartOfCurrentWeek();
    
    let plan = await prisma.mealPlan.findFirst({
      where: { 
        userId: req.user.id,
        weekStartDate: startOfWeekDate
      },
      include: {
        entries: {
          include: { recipe: true }
        }
      }
    });
    
    if (!plan) {
      plan = await prisma.mealPlan.create({
        data: {
          userId: req.user.id,
          weekStartDate: startOfWeekDate
        },
        include: {
          entries: {
            include: { recipe: true }
          }
        }
      });
    }
    
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/entries', async (req: AuthRequest, res, next) => {
  try {
    const { id: mealPlanId } = req.params;
    const { recipeId, dayOfWeek, mealType, servingsMultiplier } = entrySchema.parse(req.body);

    const plan = await prisma.mealPlan.findUnique({ where: { id: mealPlanId as string } });
    if (!plan || plan.userId !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal plan not found' } });
    }

    const entry = await prisma.mealPlanEntry.create({
      data: {
        mealPlanId: mealPlanId as string,
        recipeId,
        dayOfWeek,
        mealType,
        servingsMultiplier: servingsMultiplier || 1.0
      },
      include: { recipe: true }
    });

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

router.delete('/entries/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id: entryId } = req.params;
    
    const entry = await prisma.mealPlanEntry.findUnique({ 
      where: { id: entryId as string },
      include: { mealPlan: true }
    });
    
    if (!entry || entry.mealPlan.userId !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entry not found' } });
    }

    await prisma.mealPlanEntry.delete({ where: { id: entryId as string } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/:id/shopping-list', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const hideOwned = req.query.hideOwned === 'true';

    const plan = await prisma.mealPlan.findUnique({ where: { id: id as string } });
    if (!plan || plan.userId !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal plan not found' } });
    }

    const list = await ShoppingListService.generate(id as string, hideOwned);
    res.json(list);
  } catch (error) {
    next(error);
  }
});

export default router;
