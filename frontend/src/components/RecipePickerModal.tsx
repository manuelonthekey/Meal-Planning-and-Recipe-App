import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Search, X, Clock, Users, CheckCircle2, Loader2 } from 'lucide-react';

interface RecipePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlanId: string;
  dayOfWeek: number;
  mealType: string;
  dayLabel: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const RecipePickerModal = ({
  isOpen,
  onClose,
  mealPlanId,
  dayOfWeek,
  mealType,
  dayLabel,
}: RecipePickerModalProps) => {
  const [viewMode, setViewMode] = useState<'pantry' | 'search'>('pantry');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTrigger, setSearchTrigger] = useState('');
  const [addingId, setAddingId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: pantryMatches, isLoading: isLoadingPantry } = useQuery({
    queryKey: ['recipes', 'pantry-picker'],
    queryFn: async () => {
      const { data } = await apiClient.get('/recipes/by-pantry?minMatch=0');
      return data;
    },
    enabled: isOpen && viewMode === 'pantry',
  });

  const { data: searchResults, isLoading: isLoadingSearch } = useQuery({
    queryKey: ['recipes', 'search-picker', searchTrigger],
    queryFn: async () => {
      const { data } = await apiClient.get(`/recipes/search?query=${searchTrigger}`);
      return data;
    },
    enabled: isOpen && viewMode === 'search' && searchTrigger.length > 0,
  });

  const addEntryMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      await apiClient.post(`/meal-plans/${mealPlanId}/entries`, {
        recipeId,
        dayOfWeek,
        mealType,
        servingsMultiplier: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan', 'current'] });
      setAddingId(null);
      onClose();
    },
    onError: () => {
      setAddingId(null);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchTrigger(searchQuery.trim());
    }
  };

  const handleSelectRecipe = (recipeId: number) => {
    setAddingId(recipeId);
    addEntryMutation.mutate(recipeId);
  };

  if (!isOpen) return null;

  const recipes =
    viewMode === 'pantry'
      ? pantryMatches?.map((m: any) => ({ ...m.recipe, matchPercentage: m.matchPercentage })) ?? []
      : searchResults ?? [];

  const isLoading = viewMode === 'pantry' ? isLoadingPantry : isLoadingSearch;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-lg font-bold text-foreground">Add a Recipe</h2>
              <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                {dayLabel} · {mealType}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            <div className="flex bg-secondary p-1 rounded-lg w-fit">
              <button
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'pantry' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
                }`}
                onClick={() => setViewMode('pantry')}
              >
                From My Pantry
              </button>
              <button
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'search' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
                }`}
                onClick={() => setViewMode('search')}
              >
                Search All
              </button>
            </div>

            {viewMode === 'search' && (
              <form onSubmit={handleSearch} className="flex gap-2 mt-4">
                <Input
                  placeholder="pasta, chicken curry, salad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" size="sm">
                  <Search size={16} className="mr-1.5" /> Search
                </Button>
              </form>
            )}
          </div>

          {/* Recipe list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={24} className="animate-spin mr-2" />
                Loading recipes...
              </div>
            ) : recipes.length > 0 ? (
              recipes.map((recipe: any) => (
                <div
                  key={recipe.id}
                  className="flex items-center gap-4 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  {/* Image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No img
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{recipe.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {recipe.prepTimeMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {recipe.prepTimeMinutes}m
                        </span>
                      )}
                      {recipe.servings && (
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {recipe.servings} servings
                        </span>
                      )}
                      {recipe.matchPercentage !== undefined && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <CheckCircle2 size={11} /> {recipe.matchPercentage}% match
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add button */}
                  <Button
                    size="sm"
                    onClick={() => handleSelectRecipe(recipe.id)}
                    disabled={addingId !== null}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {addingId === recipe.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      'Add'
                    )}
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                {viewMode === 'pantry' ? (
                  <>
                    <p className="font-medium">No pantry-matched recipes yet.</p>
                    <p className="text-sm mt-1">Add ingredients to your pantry, then search for recipes to build the cache.</p>
                  </>
                ) : searchTrigger ? (
                  <p>No recipes found for "{searchTrigger}".</p>
                ) : (
                  <p>Search for a recipe above to get started.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RecipePickerModal;
