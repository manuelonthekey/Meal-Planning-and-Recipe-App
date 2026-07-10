import { Router } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const favorites = await prisma.userFavorite.findMany({
      where: { userId: req.user.id },
      include: { recipe: true }
    });
    res.json(favorites.map((f: any) => f.recipe));
  } catch (error) {
    next(error);
  }
});

router.post('/:recipeId', async (req: AuthRequest, res, next) => {
  try {
    const recipeId = parseInt(req.params.recipeId as string, 10);
    if (isNaN(recipeId)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid recipe ID' } });
    }

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recipe not found in cache' } });
    }

    await prisma.userFavorite.upsert({
      where: {
        userId_recipeId: {
          userId: req.user.id,
          recipeId
        }
      },
      update: {},
      create: {
        userId: req.user.id,
        recipeId
      }
    });

    res.status(201).send();
  } catch (error) {
    next(error);
  }
});

router.delete('/:recipeId', async (req: AuthRequest, res, next) => {
  try {
    const recipeId = parseInt(req.params.recipeId as string, 10);
    
    await prisma.userFavorite.delete({
      where: {
        userId_recipeId: {
          userId: req.user.id,
          recipeId
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    // ignore if not found
    res.status(204).send();
  }
});

export default router;
