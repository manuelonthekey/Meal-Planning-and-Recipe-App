import prisma from '../db';

export class MatchingService {
  /**
   * Evaluates how well a user's pantry matches available recipes.
   * Calculates the percentage of ingredients the user already has.
   */
  static async getRecipesByPantry(userId: string, minMatch: number = 50, query?: string) {
    // 1. Get user's pantry ingredient IDs
    const pantryItems = await prisma.pantryItem.findMany({
      where: { userId },
      select: { ingredientId: true }
    });
    const pantryIngredientIds = new Set(pantryItems.map((item: any) => item.ingredientId));

    // 2. Fetch all cached recipes with their required ingredients
    // In a real world app with thousands of recipes, we might filter this initially, 
    // but for MVP we process the local cache.
    let localQuery: any = {
      include: {
        recipeIngredients: {
          include: { ingredient: true }
        }
      }
    };

    if (query) {
      localQuery.where = {
        title: { contains: query, mode: 'insensitive' }
      };
    }
    const recipes = await prisma.recipe.findMany(localQuery) as any[];

    const results = [];

    // 3. Compute match percentage
    for (const recipe of recipes) {
      const requiredIngredients = recipe.recipeIngredients;
      if (requiredIngredients.length === 0) continue;

      let matchCount = 0;
      const missingIngredients = [];

      for (const reqIng of requiredIngredients) {
        if (reqIng.ingredientId && pantryIngredientIds.has(reqIng.ingredientId)) {
          matchCount++;
        } else {
          missingIngredients.push({
            id: reqIng.ingredientId,
            name: reqIng.ingredient?.canonicalName || reqIng.rawText,
            rawText: reqIng.rawText
          });
        }
      }

      const matchPercentage = Math.round((matchCount / requiredIngredients.length) * 100);

      if (matchCount > 0 && matchPercentage >= minMatch) {
        results.push({
          recipe,
          matchPercentage,
          matchCount,
          missingIngredients
        });
      }
    }

    // 4. Rank by matchCount DESC, then prep time ASC
    results.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      return (a.recipe.prepTimeMinutes || 999) - (b.recipe.prepTimeMinutes || 999);
    });

    return results;
  }
}
