import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { NormalizationService } from '../services/normalization.service';

const router = Router();

router.use(authenticateToken);

const createPantryItemSchema = z.object({
  ingredientName: z.string().min(1),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  expiryDate: z.string().optional() // ISO string
});

const updatePantryItemSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().optional()
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const items = await prisma.pantryItem.findMany({
      where: { userId: req.user.id },
      include: { ingredient: true },
      orderBy: { addedAt: 'desc' }
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { ingredientName, quantity, unit } = createPantryItemSchema.parse(req.body);

    const canonicalId = await NormalizationService.normalize(ingredientName);

    // Check if user already has this ingredient in pantry
    const existing = await prisma.pantryItem.findFirst({
      where: { userId: req.user.id, ingredientId: canonicalId }
    });

    if (existing) {
      // For MVP, just update quantity if it exists, or maybe just return it
      const updated = await prisma.pantryItem.update({
        where: { id: existing.id },
        data: { 
          quantity: quantity || existing.quantity, 
          unit: unit || existing.unit 
        },
        include: { ingredient: true }
      });
      return res.json(updated);
    }

    const newItem = await prisma.pantryItem.create({
      data: {
        userId: req.user.id,
        ingredientId: canonicalId,
        quantity: quantity || null,
        unit: unit || null,
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null
      },
      include: { ingredient: true }
    });

    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, unit } = updatePantryItemSchema.parse(req.body);

    const item = await prisma.pantryItem.findUnique({ where: { id: id as string } });
    if (!item || item.userId !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pantry item not found' } });
    }

    const updated = await prisma.pantryItem.update({
      where: { id: id as string },
      data: { quantity, unit },
      include: { ingredient: true }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/bulk', async (req: AuthRequest, res, next) => {
  try {
    const items = req.body.items as Array<{ ingredientName: string; quantity?: number; unit?: string }>;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'items must be an array' } });
    }

    const addedItems = [];
    for (const item of items) {
      const canonicalId = await NormalizationService.normalize(item.ingredientName);
      const existing = await prisma.pantryItem.findFirst({
        where: { userId: req.user.id, ingredientId: canonicalId }
      });

      if (existing) {
        const updated = await prisma.pantryItem.update({
          where: { id: existing.id },
          data: { 
            quantity: item.quantity || existing.quantity, 
            unit: item.unit || existing.unit 
          },
          include: { ingredient: true }
        });
        addedItems.push(updated);
      } else {
        const newItem = await prisma.pantryItem.create({
          data: {
            userId: req.user.id,
            ingredientId: canonicalId,
            quantity: item.quantity || null,
            unit: item.unit || null
          },
          include: { ingredient: true }
        });
        addedItems.push(newItem);
      }
    }
    res.status(201).json(addedItems);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const reason = (req.query.reason as string) || 'deleted';
    
    const item = await prisma.pantryItem.findUnique({ where: { id: id as string } });
    if (!item || item.userId !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pantry item not found' } });
    }

    // Record in history before deleting
    await prisma.pantryItemHistory.create({
      data: {
        userId: req.user.id,
        ingredientId: item.ingredientId,
        action: reason, // 'expired' or 'deleted'
        quantity: item.quantity,
        unit: item.unit
      }
    });

    await prisma.pantryItem.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
