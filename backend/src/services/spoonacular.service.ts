import axios from 'axios';
import prisma from '../db';
import { NormalizationService } from './normalization.service';

const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

export class SpoonacularService {
  private static get apiKey() {
    return process.env.SPOONACULAR_API_KEY || '';
  }

  /**
   * Autocomplete ingredients
   */
  static async autocompleteIngredients(query: string) {
    if (!query || query.length < 2) return [];
    try {
      const response = await axios.get(`${SPOONACULAR_BASE_URL}/food/ingredients/autocomplete`, {
        params: {
          apiKey: this.apiKey,
          query,
          number: 5,
        }
      });
      return response.data.map((item: any) => ({ name: item.name }));
    } catch (error) {
      console.error('Error fetching ingredient autocomplete:', error);
      return [];
    }
  }

  /**
   * Autocomplete recipes
   */
  static async autocompleteRecipes(query: string) {
    if (!query || query.length < 2) return [];
    try {
      const response = await axios.get(`${SPOONACULAR_BASE_URL}/recipes/autocomplete`, {
        params: {
          apiKey: this.apiKey,
          query,
          number: 5,
        }
      });
      return response.data; // [{ id, title, imageType }]
    } catch (error) {
      console.error('Error fetching recipe autocomplete:', error);
      return [];
    }
  }

  /**
   * Search recipes with Spoonacular API, falling back to local cache if possible.
   * Actually, PRD says: query local first. If fewer than N results, call Spoonacular.
   */
  static async searchRecipes(query: string, cuisine?: string, diet?: string, maxPrepTime?: number) {
    const minLocalResults = 50;
    
    // 1. Check local cache
    let localQuery: any = {
      where: {}
    };
    
    if (query) {
      localQuery.where.title = { contains: query, mode: 'insensitive' };
    }
    if (cuisine) {
      localQuery.where.cuisine = { contains: cuisine, mode: 'insensitive' };
    }
    if (diet) {
      // Basic check for MVP, exact match in array
      localQuery.where.dietTags = { has: diet.toLowerCase() };
    }
    if (maxPrepTime) {
      localQuery.where.prepTimeMinutes = { lte: maxPrepTime };
    }

    const localResults = await prisma.recipe.findMany({
      ...localQuery,
      take: minLocalResults,
      include: { recipeIngredients: true }
    });

    if (localResults.length >= minLocalResults) {
      return localResults;
    }

    // 2. Fetch from Spoonacular if not enough local results
    try {
      const response = await axios.get(`${SPOONACULAR_BASE_URL}/recipes/complexSearch`, {
        params: {
          apiKey: this.apiKey,
          query: query || undefined,
          cuisine: cuisine || undefined,
          diet: diet || undefined,
          maxReadyTime: maxPrepTime || undefined,
          addRecipeInformation: true,
          addRecipeNutrition: true,
          fillIngredients: true,
          number: minLocalResults
        }
      });

      const spoonacularRecipes = response.data.results || [];
      const savedRecipes = [];

      // 3. Cache the fetched recipes
      for (const sRecipe of spoonacularRecipes) {
        // Prepare recipe data
        const recipeData = {
          id: sRecipe.id,
          title: sRecipe.title,
          imageUrl: sRecipe.image,
          prepTimeMinutes: sRecipe.readyInMinutes,
          servings: sRecipe.servings,
          cuisine: sRecipe.cuisines?.[0] || null, // take first cuisine if array
          dietTags: sRecipe.diets || [],
          instructions: sRecipe.analyzedInstructions || [],
          nutrition: sRecipe.nutrition || null,
          sourceUrl: sRecipe.sourceUrl || null
        };

        // Upsert recipe
        const recipe = await prisma.recipe.upsert({
          where: { id: sRecipe.id },
          update: { ...recipeData, cachedAt: new Date() },
          create: recipeData
        });
        
        // Handle ingredients
        const ingredients = sRecipe.extendedIngredients || [];
        
        for (const ing of ingredients) {
          const rawText = ing.original || ing.name;
          const canonicalId = await NormalizationService.normalize(rawText);
          
          // Use a basic unique identifier for the join table row or just create
          // Wait, multiple same ingredients in a recipe could happen, we just create them
          // Let's delete existing ingredients for this recipe to avoid duplicates on upsert
          await prisma.recipeIngredient.deleteMany({
            where: { recipeId: recipe.id }
          });
        }
        
        for (const ing of ingredients) {
          const rawText = ing.original || ing.name;
          const canonicalId = await NormalizationService.normalize(rawText);
          
          await prisma.recipeIngredient.create({
            data: {
              recipeId: recipe.id,
              ingredientId: canonicalId,
              rawText: rawText,
              quantity: ing.amount,
              unit: ing.unit || null
            }
          });
        }
        
        // Refetch full recipe with ingredients to return
        const fullRecipe = await prisma.recipe.findUnique({
          where: { id: recipe.id },
          include: { recipeIngredients: { include: { ingredient: true } } }
        });
        
        if (fullRecipe) savedRecipes.push(fullRecipe);
      }
      
      return savedRecipes.length > 0 ? savedRecipes : localResults;
      
    } catch (error) {
      console.error('Error fetching from Spoonacular:', error);
      // Fallback to whatever we have locally
      return localResults;
    }
  }

  static async getRecipeById(id: number) {
    let recipe = await prisma.recipe.findUnique({
      where: { id },
      include: { recipeIngredients: { include: { ingredient: true } } }
    });

    if (recipe) return recipe;

    // Fetch from Spoonacular
    try {
      const response = await axios.get(`${SPOONACULAR_BASE_URL}/recipes/${id}/information`, {
        params: { apiKey: this.apiKey, includeNutrition: true }
      });
      
      const sRecipe = response.data;
      
      const recipeData = {
        id: sRecipe.id,
        title: sRecipe.title,
        imageUrl: sRecipe.image,
        prepTimeMinutes: sRecipe.readyInMinutes,
        servings: sRecipe.servings,
        cuisine: sRecipe.cuisines?.[0] || null,
        dietTags: sRecipe.diets || [],
        instructions: sRecipe.analyzedInstructions || [],
        nutrition: sRecipe.nutrition || null,
        sourceUrl: sRecipe.sourceUrl || null
      };

      const newRecipe = await prisma.recipe.upsert({
        where: { id: sRecipe.id },
        update: { ...recipeData, cachedAt: new Date() },
        create: recipeData
      });
      
      const ingredients = sRecipe.extendedIngredients || [];
      
      await prisma.recipeIngredient.deleteMany({
        where: { recipeId: newRecipe.id }
      });
      
      for (const ing of ingredients) {
        const rawText = ing.original || ing.name;
        const canonicalId = await NormalizationService.normalize(rawText);
        
        await prisma.recipeIngredient.create({
          data: {
            recipeId: newRecipe.id,
            ingredientId: canonicalId,
            rawText: rawText,
            quantity: ing.amount,
            unit: ing.unit || null
          }
        });
      }
      
      return prisma.recipe.findUnique({
        where: { id: newRecipe.id },
        include: { recipeIngredients: { include: { ingredient: true } } }
      });
      
    } catch (error) {
      console.error('Error fetching recipe by ID from Spoonacular:', error);
      return null;
    }
  }
}
