import { Router } from 'express';
import { SpoonacularService } from '../services/spoonacular.service';
import { MatchingService } from '../services/matching.service';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../db';

const router = Router();

// Public routes (or can be authenticated if desired, PRD doesn't explicitly restrict search)
// We'll require auth for pantry-based matching
router.get('/ingredients/autocomplete', async (req, res, next) => {
  try {
    const { query } = req.query;
    const results = await SpoonacularService.autocompleteIngredients(query as string);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.get('/autocomplete', async (req, res, next) => {
  try {
    const { query } = req.query;
    const results = await SpoonacularService.autocompleteRecipes(query as string);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const { query, cuisine, diet, maxPrepTime } = req.query;
    
    const recipes = await SpoonacularService.searchRecipes(
      query as string,
      cuisine as string,
      diet as string,
      maxPrepTime ? parseInt(maxPrepTime as string, 10) : undefined
    );
    
    res.json(recipes);
  } catch (error) {
    next(error);
  }
});

router.get('/by-pantry', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const minMatch = req.query.minMatch ? parseInt(req.query.minMatch as string, 10) : 50;
    const query = req.query.query as string | undefined;
    
    const matches = await MatchingService.getRecipesByPantry(req.user.id, minMatch, query);
    
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid ID' } });
    }
    
    const recipe = await SpoonacularService.getRecipeById(id);
    
    if (!recipe) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } });
    }
    
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

export default router;
