import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Search, Clock, Users, CheckCircle2, XCircle, Flame, Loader2 } from 'lucide-react';
import RecipeDetailModal from '../components/RecipeDetailModal';

// helper: pull calories
function getCalories(nutrition: any): number | null {
  if (!nutrition) return null;
  if (Array.isArray(nutrition?.nutrients)) {
    const c = nutrition.nutrients.find((n: any) => n.name === 'Calories');
    return c ? Math.round(c.amount) : null;
  }
  if (nutrition.calories !== undefined) return Math.round(Number(nutrition.calories));
  return null;
}

const Recipes = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [matchPantry, setMatchPantry] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);

  const [suggestions, setSuggestions] = useState<{title: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLFormElement>(null);

  // Autocomplete fetcher
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await apiClient.get(`/recipes/autocomplete?query=${searchQuery}`);
        setSuggestions(data);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Main search query
  const {
    data: recipesData,
    isLoading: isSearching,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['recipes', 'search', searchQuery, matchPantry],
    queryFn: async () => {
      if (matchPantry) {
        // query is optional for pantry match
        const url = searchQuery 
          ? `/recipes/by-pantry?minMatch=1&query=${encodeURIComponent(searchQuery)}`
          : `/recipes/by-pantry?minMatch=1`;
        const { data } = await apiClient.get(url);
        return data; // returns [{ recipe, matchPercentage, matchCount, missingIngredients }]
      } else {
        // Global search
        if (!searchQuery.trim()) return [];
        const { data } = await apiClient.get(`/recipes/search?query=${encodeURIComponent(searchQuery)}`);
        // normalize to array of objects
        return data.map((r: any) => ({ recipe: r }));
      }
    },
    // Disabled by default; we trigger via refetch() on form submit or checkbox toggle
    enabled: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    refetch();
  };

  // Trigger search if checkbox changes and we don't have query
  useEffect(() => {
    if (matchPantry) {
      refetch();
    }
  }, [matchPantry, refetch]);

  const isLoading = isSearching || isFetching;
  const recipes = recipesData || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Discover Recipes</h1>
      </div>

      {/* Search Bar & Options */}
      <div className="bg-secondary/30 p-4 rounded-xl border flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            id="matchPantry"
            className="w-5 h-5 rounded border-gray-300 accent-primary cursor-pointer"
            checked={matchPantry}
            onChange={(e) => setMatchPantry(e.target.checked)}
          />
          <label htmlFor="matchPantry" className="text-sm font-medium cursor-pointer text-foreground flex items-center gap-2">
            Match My Pantry
            {matchPantry && <CheckCircle2 size={16} className="text-primary" />}
          </label>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 flex-1 w-full relative" ref={suggestionRef}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search recipes (e.g. pasta, chicken, vegan)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="pl-10 h-12 text-lg bg-white"
            />
            
            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white rounded-md shadow-lg border">
                <ul className="py-1">
                  {suggestions.map((s, i) => (
                    <li 
                      key={i} 
                      className="px-4 py-2 hover:bg-secondary cursor-pointer text-sm"
                      onClick={() => {
                        setSearchQuery(s.title);
                        setShowSuggestions(false);
                        // Using timeout to ensure state update completes before fetching
                        setTimeout(() => refetch(), 0);
                      }}
                    >
                      {s.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <Button type="submit" className="h-12 px-6" disabled={isLoading}>
            {isLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : 'Search'}
          </Button>
        </form>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={32} className="animate-spin mr-3" />
          Searching recipes...
        </div>
      ) : recipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((match: any) => (
            <RecipeCard
              key={match.recipe.id}
              recipe={match.recipe}
              matchCount={match.matchCount}
              missingIngredients={match.missingIngredients}
              onViewDetail={() => setSelectedRecipeId(match.recipe.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground bg-secondary/30 rounded-xl border border-dashed">
          <p className="text-lg font-medium text-foreground">No recipes found.</p>
          <p className="mt-1">Try a different search term or uncheck "Match My Pantry" to see more options.</p>
        </div>
      )}

      {/* Recipe detail modal */}
      <RecipeDetailModal
        recipeId={selectedRecipeId}
        onClose={() => setSelectedRecipeId(null)}
      />
    </div>
  );
};

// ── Recipe Card ──────────────────────────────────────────────────────────────

const RecipeCard = ({
  recipe,
  matchCount,
  missingIngredients,
  onViewDetail,
}: {
  recipe: any;
  matchCount?: number;
  missingIngredients?: any[];
  onViewDetail: () => void;
}) => {
  const calories = getCalories(recipe.nutrition);

  return (
    <Card className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow cursor-pointer group border-primary/10" onClick={onViewDetail}>
      <div className="h-48 overflow-hidden relative bg-secondary">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No Image
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          {matchCount !== undefined && (
            <span className="bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-primary shadow-sm flex items-center gap-1.5 border border-primary/20">
              <CheckCircle2 size={12} className="text-primary" /> {matchCount} ingredients
            </span>
          )}
          {calories !== null && calories > 0 && (
            <span className="bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-orange-500 shadow-sm flex items-center gap-1.5 ml-auto border border-orange-500/20">
              <Flame size={12} /> {calories} kcal
            </span>
          )}
        </div>
      </div>

      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors leading-snug" title={recipe.title}>
          {recipe.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 mb-3 font-medium">
          {recipe.prepTimeMinutes && (
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {recipe.prepTimeMinutes}m
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1.5">
              <Users size={14} /> {recipe.servings} srv
            </span>
          )}
          {recipe.cuisine && (
            <span className="capitalize bg-secondary/80 text-foreground px-2 py-0.5 rounded-full">
              {recipe.cuisine}
            </span>
          )}
        </div>

        {missingIngredients && missingIngredients.length > 0 && (
          <div className="mb-4 bg-red-50/50 p-2 rounded-lg border border-red-100">
            <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mb-1">
              <XCircle size={12} /> Still need ({missingIngredients.length}):
            </p>
            <p className="text-xs text-red-600/80 line-clamp-1">
              {missingIngredients.map((i: any) => i.name).join(', ')}
            </p>
          </div>
        )}

        <Button
          variant="secondary"
          className="w-full mt-auto group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
        >
          View Recipe
        </Button>
      </CardContent>
    </Card>
  );
};

export default Recipes;
