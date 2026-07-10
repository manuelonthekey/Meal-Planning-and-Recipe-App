import fuzzball from 'fuzzball';
import prisma from '../db';

const KNOWN_MODIFIERS = [
  'chopped', 'diced', 'sliced', 'minced', 'crushed', 'whole', 
  'fresh', 'dried', 'ground', 'cooked', 'raw', 'peeled'
];

export class NormalizationService {
  /**
   * Cleans an ingredient string by lowering case, removing punctuation, 
   * and stripping known modifiers.
   */
  static cleanIngredientString(rawText: string): string {
    let clean = rawText.toLowerCase().replace(/[.,;:!()]/g, '');
    
    for (const modifier of KNOWN_MODIFIERS) {
      const regex = new RegExp(`\\b${modifier}\\b`, 'gi');
      clean = clean.replace(regex, '');
    }
    
    return clean.trim().replace(/\s+/g, ' ');
  }

  /**
   * Normalizes an ingredient name to its canonical ID.
   * If it doesn't exist and threshold isn't met, creates a new one.
   */
  static async normalize(rawText: string): Promise<number> {
    const cleanedText = this.cleanIngredientString(rawText);
    
    // 1. Try exact match on aliases
    const exactMatch = await prisma.ingredientAlias.findFirst({
      where: { alias: cleanedText }
    });
    
    if (exactMatch) {
      return exactMatch.ingredientId;
    }
    
    // 2. Try fuzzy match against all aliases
    const allAliases = await prisma.ingredientAlias.findMany({
      include: { ingredient: true }
    });
    
    let bestMatch = null;
    let highestScore = 0;
    
    for (const aliasRecord of allAliases) {
      const score = fuzzball.ratio(cleanedText, aliasRecord.alias);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = aliasRecord;
      }
    }
    
    // 3. Check if score meets threshold (e.g., 80)
    if (bestMatch && highestScore >= 80) {
      return bestMatch.ingredientId;
    }
    
    // 4. No suitable match found, create a new canonical ingredient
    // We use the cleanedText as the canonical name.
    // If it already exists in canonicalName (edge case), we just use it.
    let canonical = await prisma.ingredient.findUnique({
      where: { canonicalName: cleanedText }
    });
    
    if (!canonical) {
      canonical = await prisma.ingredient.create({
        data: {
          canonicalName: cleanedText,
          // create a self alias
          aliases: {
            create: {
              alias: cleanedText
            }
          }
        }
      });
      // Optionally log this somewhere for manual review
      console.log(`[Normalization] Created new canonical ingredient: "${cleanedText}" from raw: "${rawText}"`);
    } else {
      // Create alias for this canonical if it didn't exist
      await prisma.ingredientAlias.create({
        data: {
          alias: cleanedText,
          ingredientId: canonical.id
        }
      });
    }
    
    return canonical.id;
  }
}
