import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { X, Clock, Users, ExternalLink, Loader2, Flame, Dumbbell, Wheat, Droplets } from 'lucide-react';


interface RecipeDetailModalProps {
  recipeId: number | null;
  onClose: () => void;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function getNutrient(nutrition: any, name: string): number | null {
  if (!nutrition) return null;

  // Spoonacular format: { nutrients: [{ name, amount, unit }] }
  if (Array.isArray(nutrition?.nutrients)) {
    const found = nutrition.nutrients.find(
      (n: any) => n.name?.toLowerCase() === name.toLowerCase()
    );
    return found ? Math.round(found.amount) : null;
  }

  // Dataset flat format: { calories, protein, fat, carbohydrates, fiber }
  const map: Record<string, string[]> = {
    calories: ['calories'],
    protein: ['protein'],
    fat: ['fat'],
    carbohydrates: ['carbohydrates', 'carbs'],
    fiber: ['fiber'],
  };
  for (const key of map[name.toLowerCase()] ?? []) {
    if (nutrition[key] !== undefined) return Math.round(Number(nutrition[key]));
  }
  return null;
}

function getSteps(instructions: any): string[] {
  if (!instructions) return [];

  // Spoonacular analyzedInstructions format
  if (Array.isArray(instructions) && instructions.length > 0) {
    const steps: string[] = [];
    for (const block of instructions) {
      if (Array.isArray(block.steps)) {
        for (const s of block.steps) {
          if (s.step) steps.push(s.step);
        }
      }
    }
    if (steps.length > 0) return steps;
  }

  // Dataset flat array of strings: ["Step 1...", "Step 2..."]
  if (Array.isArray(instructions) && typeof instructions[0] === 'string') {
    return instructions;
  }

  // Dataset object array: [{ step: 1, text: "..." }]
  if (Array.isArray(instructions) && instructions[0]?.text) {
    return instructions.map((s: any) => s.text);
  }

  return [];
}

// ── component ────────────────────────────────────────────────────────────────

const RecipeDetailModal = ({ recipeId, onClose }: RecipeDetailModalProps) => {
  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/recipes/${recipeId}`);
      return data;
    },
    enabled: !!recipeId,
  });

  if (!recipeId) return null;

  const calories     = recipe ? getNutrient(recipe.nutrition, 'Calories')      : null;
  const protein      = recipe ? getNutrient(recipe.nutrition, 'Protein')       : null;
  const fat          = recipe ? getNutrient(recipe.nutrition, 'Fat')           : null;
  const carbs        = recipe ? getNutrient(recipe.nutrition, 'Carbohydrates') : null;
  const fiber        = recipe ? getNutrient(recipe.nutrition, 'Fiber')         : null;
  const steps        = recipe ? getSteps(recipe.instructions)                  : [];
  const hasNutrition = calories !== null || protein !== null || fat !== null || carbs !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

          {/* Hero image + close */}
          <div className="relative flex-shrink-0">
            {recipe?.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-56 object-cover"
              />
            ) : (
              <div className="w-full h-32 bg-secondary" />
            )}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow hover:bg-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={28} className="animate-spin mr-3" /> Loading recipe...
              </div>
            ) : recipe ? (
              <>
                {/* Title + meta */}
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {recipe.cuisine && (
                      <span className="text-xs bg-secondary text-foreground px-2 py-1 rounded-full font-medium capitalize">
                        {recipe.cuisine}
                      </span>
                    )}
                    {recipe.dietTags?.map((tag: string) => (
                      <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium capitalize">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h2 className="text-2xl font-bold text-foreground leading-tight">{recipe.title}</h2>

                  <div className="flex items-center gap-5 mt-3 text-sm text-muted-foreground">
                    {recipe.prepTimeMinutes && (
                      <span className="flex items-center gap-1.5">
                        <Clock size={16} className="text-primary" />
                        {recipe.prepTimeMinutes} min
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="flex items-center gap-1.5">
                        <Users size={16} className="text-primary" />
                        {recipe.servings} servings
                      </span>
                    )}
                    {calories !== null && (
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Flame size={16} className="text-orange-500" />
                        {calories} kcal / serving
                      </span>
                    )}
                  </div>
                </div>

                {/* Nutrition panel */}
                {hasNutrition && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Nutrition (per serving)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {calories !== null && (
                        <NutrientCard icon={<Flame size={18} className="text-orange-500" />} label="Calories" value={`${calories} kcal`} />
                      )}
                      {protein !== null && (
                        <NutrientCard icon={<Dumbbell size={18} className="text-blue-500" />} label="Protein" value={`${protein}g`} />
                      )}
                      {carbs !== null && (
                        <NutrientCard icon={<Wheat size={18} className="text-yellow-500" />} label="Carbs" value={`${carbs}g`} />
                      )}
                      {fat !== null && (
                        <NutrientCard icon={<Droplets size={18} className="text-pink-500" />} label="Fat" value={`${fat}g`} />
                      )}
                      {fiber !== null && (
                        <NutrientCard icon={<span className="text-green-600 font-bold text-xs">F</span>} label="Fiber" value={`${fiber}g`} />
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Ingredients */}
                  {recipe.recipeIngredients?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-3">
                        Ingredients
                        <span className="text-muted-foreground font-normal text-sm ml-2">
                          ({recipe.recipeIngredients.length})
                        </span>
                      </h3>
                      <ul className="space-y-2">
                        {recipe.recipeIngredients.map((ing: any, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                            <span className="text-foreground">
                              {ing.quantity ? (
                                <span className="font-medium">
                                  {Math.round(Number(ing.quantity) * 10) / 10}
                                  {ing.unit ? ` ${ing.unit}` : ''}{' '}
                                </span>
                              ) : null}
                              {ing.ingredient?.canonicalName || ing.rawText}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {steps.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-3">Instructions</h3>
                      <ol className="space-y-3">
                        {steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-foreground leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                {/* Source link */}
                {recipe.sourceUrl && (
                  <div className="border-t pt-4">
                    <a
                      href={recipe.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink size={14} /> View original recipe
                    </a>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Recipe not found.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const NutrientCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-secondary/60 rounded-xl p-3 flex flex-col items-center text-center gap-1">
    <div>{icon}</div>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className="text-sm font-bold text-foreground">{value}</p>
  </div>
);

export default RecipeDetailModal;
