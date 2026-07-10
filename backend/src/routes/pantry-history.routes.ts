import { Router } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Get pantry history for the logged-in user
router.get('/', async (req: AuthRequest, res: any, next: any) => {
  try {
    const userId = req.user.id;
    const history = await prisma.pantryItemHistory.findMany({
      where: { userId },
      include: {
        ingredient: {
          select: {
            canonicalName: true,
            category: true,
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 10,
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching pantry history:', error);
    next(error);
  }
});

// Clear pantry history (optional utility)
router.delete('/', async (req: AuthRequest, res: any, next: any) => {
  try {
    const userId = req.user.id;
    await prisma.pantryItemHistory.deleteMany({
      where: { userId },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing pantry history:', error);
    next(error);
  }
});

export default router;
