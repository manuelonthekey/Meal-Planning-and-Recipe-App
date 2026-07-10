/**
 * Dataset Seeder — imports a local JSON recipe dataset into the PantryChef database.
 *
 * Usage:
 *   npx tsx scripts/seed-dataset.ts ./datasets/my_recipes.json
 *
 * Or with npm script (add to package.json):
 *   "seed": "tsx scripts/seed-dataset.ts"
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { NormalizationService } from '../src/services/normalization.service';

// ── DB setup ──────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── types ─────────────────────────────────────────────────────────────────────

interface DatasetIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  rawText?: string;
}

interface DatasetInstruction {
  step: number;
  text: string;
}

interface DatasetNutrition {
  calories?: number;
  protein?: number;
  fat?: number;
  carbohydrates?: number;
  fiber?: number;
  sodium?: number;
  sugar?: number;
}

interface DatasetRecipe {
  /** Must be >= 10_000_000 to avoid clashing with Spoonacular IDs */
  id: number;
  title: string;
  imageUrl?: string;
  prepTimeMinutes?: number;
  servings?: number;
  cuisine?: string;
  dietTags?: string[];
  sourceUrl?: string;
  ingredients: DatasetIngredient[];
  /**
   * Either an array of step objects:  [{ step: 1, text: "..." }]
   * OR an array of plain strings:     ["Preheat oven...", "Mix flour..."]
   */
  instructions?: DatasetInstruction[] | string[];
  nutrition?: DatasetNutrition;
}

// ── seeder ────────────────────────────────────────────────────────────────────

async function seed(filePath: string) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌  File not found: ${resolved}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  const recipes: DatasetRecipe[] = JSON.parse(raw);

  console.log(`\n📂  Loaded ${recipes.length} recipes from: ${resolved}\n`);

  let created = 0;
  let skipped = 0;
  let errors  = 0;

  for (const r of recipes) {
    // Guard: IDs below 10_000_000 are reserved for Spoonacular
    if (r.id < 10_000_000) {
      console.warn(`⚠️   Skipping "${r.title}" — ID ${r.id} is below the dataset minimum (10000000)`);
      skipped++;
      continue;
    }

    try {
      // Normalise instructions to Spoonacular-compatible JSON
      let instructionsJson: any = [];
      if (r.instructions) {
        if (typeof r.instructions[0] === 'string') {
          instructionsJson = [
            {
              name: '',
              steps: (r.instructions as string[]).map((text, i) => ({
                number: i + 1,
                step: text,
              })),
            },
          ];
        } else {
          instructionsJson = [
            {
              name: '',
              steps: (r.instructions as DatasetInstruction[]).map((s) => ({
                number: s.step,
                step: s.text,
              })),
            },
          ];
        }
      }

      // Normalise nutrition to flat object for easy querying
      const nutritionJson = r.nutrition
        ? {
            nutrients: [
              r.nutrition.calories    !== undefined && { name: 'Calories',      amount: r.nutrition.calories,      unit: 'kcal' },
              r.nutrition.protein     !== undefined && { name: 'Protein',       amount: r.nutrition.protein,       unit: 'g'    },
              r.nutrition.fat         !== undefined && { name: 'Fat',           amount: r.nutrition.fat,           unit: 'g'    },
              r.nutrition.carbohydrates !== undefined && { name: 'Carbohydrates', amount: r.nutrition.carbohydrates, unit: 'g'  },
              r.nutrition.fiber       !== undefined && { name: 'Fiber',         amount: r.nutrition.fiber,         unit: 'g'    },
              r.nutrition.sodium      !== undefined && { name: 'Sodium',        amount: r.nutrition.sodium,        unit: 'mg'   },
              r.nutrition.sugar       !== undefined && { name: 'Sugar',         amount: r.nutrition.sugar,         unit: 'g'    },
            ].filter(Boolean),
          }
        : null;

      // Upsert the recipe
      const recipe = await prisma.recipe.upsert({
        where: { id: r.id },
        update: {
          title: r.title,
          imageUrl: r.imageUrl ?? null,
          prepTimeMinutes: r.prepTimeMinutes ?? null,
          servings: r.servings ?? null,
          cuisine: r.cuisine ?? null,
          dietTags: r.dietTags ?? [],
          instructions: instructionsJson,
          nutrition: nutritionJson,
          sourceUrl: r.sourceUrl ?? null,
          cachedAt: new Date(),
        },
        create: {
          id: r.id,
          title: r.title,
          imageUrl: r.imageUrl ?? null,
          prepTimeMinutes: r.prepTimeMinutes ?? null,
          servings: r.servings ?? null,
          cuisine: r.cuisine ?? null,
          dietTags: r.dietTags ?? [],
          instructions: instructionsJson,
          nutrition: nutritionJson,
          sourceUrl: r.sourceUrl ?? null,
        },
      });

      // Re-create ingredients for this recipe
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });

      for (const ing of r.ingredients) {
        const rawText = ing.rawText ?? `${ing.quantity ?? ''} ${ing.unit ?? ''} ${ing.name}`.trim();
        const canonicalId = await NormalizationService.normalize(ing.name);

        await prisma.recipeIngredient.create({
          data: {
            recipeId: recipe.id,
            ingredientId: canonicalId,
            rawText,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
          },
        });
      }

      console.log(`  ✅  [${r.id}] ${r.title}`);
      created++;
    } catch (err: any) {
      console.error(`  ❌  [${r.id}] ${r.title} — ${err.message}`);
      errors++;
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Created / Updated : ${created}
  ⏭  Skipped          : ${skipped}
  ❌ Errors            : ${errors}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  await prisma.$disconnect();
  await pool.end();
}

// ── entry point ───────────────────────────────────────────────────────────────

const file = process.argv[2] ?? './datasets/recipes.json';
seed(file).catch((e) => {
  console.error(e);
  process.exit(1);
});
