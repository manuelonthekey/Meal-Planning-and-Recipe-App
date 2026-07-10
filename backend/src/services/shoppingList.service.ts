import prisma from '../db';

export class ShoppingListService {
  /**
   * Generates a deduplicated shopping list for a given meal plan,
   * factoring in what the user already has in their pantry.
   */
  static async generate(mealPlanId: string, hideOwned: boolean = false) {
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: {
        entries: {
          include: {
            recipe: {
              include: {
                recipeIngredients: {
                  include: { ingredient: true }
                }
              }
            }
          }
        }
      }
    });

    if (!mealPlan) throw new Error('Meal plan not found');

    // Fetch user's pantry
    const pantryItems = await prisma.pantryItem.findMany({
      where: { userId: mealPlan.userId }
    });

    // Create a map for fast lookup of pantry items by canonical ingredientId
    // For MVP, we ignore units and just say "we have it" or "we don't", 
    // or we can subtract quantity if units match exactly.
    // The PRD says: "Subtract quantities already available. optional toggle to hide items"
    const pantryMap = new Map();
    for (const item of pantryItems) {
      if (!pantryMap.has(item.ingredientId)) {
        pantryMap.set(item.ingredientId, []);
      }
      pantryMap.get(item.ingredientId).push(item);
    }

    // 1. Aggregate required ingredients
    // Group by ingredientId AND unit
    const requiredList = new Map();

    for (const entry of mealPlan.entries) {
      const multiplier = entry.servingsMultiplier ? Number(entry.servingsMultiplier) : 1.0;

      for (const reqIng of entry.recipe.recipeIngredients) {
        if (!reqIng.ingredientId) continue;
        
        const key = `${reqIng.ingredientId}_${reqIng.unit || 'nounit'}`;
        
        if (!requiredList.has(key)) {
          requiredList.set(key, {
            ingredientId: reqIng.ingredientId,
            name: reqIng.ingredient?.canonicalName || reqIng.rawText,
            category: reqIng.ingredient?.category || 'other',
            unit: reqIng.unit,
            quantity: 0
          });
        }
        
        const current = requiredList.get(key);
        current.quantity += (Number(reqIng.quantity) || 0) * multiplier;
      }
    }

    // 2. Subtract from pantry and group by category
    const categorizedList: Record<string, any[]> = {};

    for (const [key, reqItem] of requiredList.entries()) {
      let remainingQty = reqItem.quantity;
      let isFullyOwned = false;

      const ownedItems = pantryMap.get(reqItem.ingredientId) || [];
      
      for (const owned of ownedItems) {
        // If the units match exactly, subtract
        if (owned.unit === reqItem.unit && owned.quantity) {
          remainingQty -= Number(owned.quantity);
        } else if (!reqItem.unit && !owned.unit) {
           // Both unitless
           remainingQty -= Number(owned.quantity || 1);
        }
      }

      if (remainingQty <= 0) {
        isFullyOwned = true;
        remainingQty = 0;
      }

      if (hideOwned && isFullyOwned) continue;

      const category = reqItem.category || 'Other';
      if (!categorizedList[category]) {
        categorizedList[category] = [];
      }

      categorizedList[category].push({
        id: reqItem.ingredientId,
        name: reqItem.name,
        quantity: Math.max(0, remainingQty),
        unit: reqItem.unit,
        isFullyOwned
      });
    }

    return categorizedList;
  }
}
