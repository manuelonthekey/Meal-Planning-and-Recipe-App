import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import RecipePickerModal from '../components/RecipePickerModal';
import RecipeDetailModal from '../components/RecipeDetailModal';
import { Printer, ShoppingCart, Calendar as CalendarIcon, Utensils, X, Loader2, Info } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

interface SelectedSlot {
  dayOfWeek: number;
  mealType: string;
  dayLabel: string;
}

const MealPlanner = () => {
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  
  // Sets for tracking checked and removed items
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  
  // State for user-entered quantities and units
  const [itemQuantities, setItemQuantities] = useState<Record<string, { qty: string; unit: string }>>({});

  const queryClient = useQueryClient();

  const { data: mealPlan, isLoading: isLoadingPlan } = useQuery({
    queryKey: ['mealPlan', 'current'],
    queryFn: async () => {
      const { data } = await apiClient.get('/meal-plans/current');
      return data;
    },
  });

  const { data: shoppingList, isLoading: isLoadingList } = useQuery({
    queryKey: ['shoppingList', mealPlan?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/meal-plans/${mealPlan.id}/shopping-list?hideOwned=false`
      );
      return data;
    },
    enabled: !!mealPlan?.id && showShoppingList,
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await apiClient.delete(`/meal-plans/entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan', 'current'] });
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      setDeletingEntryId(null);
    },
    onError: () => setDeletingEntryId(null),
  });

  const handleDeleteEntry = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    setDeletingEntryId(entryId);
    deleteEntryMutation.mutate(entryId);
  };

  const addToPantryMutation = useMutation({
    mutationFn: async (itemsToPantry: any[]) => {
      await apiClient.post('/pantry/bulk', { items: itemsToPantry });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] });
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      setCheckedItems(new Set()); 
      setItemQuantities({});
    }
  });

  const handleGotIt = () => {
    if (checkedItems.size === 0 || !shoppingList) return;

    const itemsToAdd: any[] = [];
    Object.values(shoppingList).forEach((categoryItems: any) => {
      categoryItems.forEach((item: any) => {
        if (checkedItems.has(item.name) && !item.isFullyOwned && !removedItems.has(item.name)) {
          const userQty = itemQuantities[item.name]?.qty;
          const userUnit = itemQuantities[item.name]?.unit;
          
          itemsToAdd.push({
            ingredientName: item.name,
            quantity: userQty ? parseFloat(userQty) : null,
            unit: userUnit || ''
          });
        }
      });
    });

    if (itemsToAdd.length > 0) {
      addToPantryMutation.mutate(itemsToAdd);
    }
  };

  const getEntryForSlot = (dayIdx: number, mealType: string) => {
    if (!mealPlan?.entries) return null;
    return mealPlan.entries.find(
      (e: any) => e.dayOfWeek === dayIdx && e.mealType === mealType
    );
  };

  const handleSlotClick = (dayIdx: number, mealType: string) => {
    const entry = getEntryForSlot(dayIdx, mealType);
    if (entry) return;
    setSelectedSlot({ dayOfWeek: dayIdx, mealType, dayLabel: DAYS[dayIdx] });
  };

  const toggleCheckItem = (name: string, isOwned: boolean) => {
    if (isOwned) return;
    const next = new Set(checkedItems);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setCheckedItems(next);
  };

  const toggleRemoveItem = (name: string) => {
    const next = new Set(removedItems);
    if (next.has(name)) next.delete(name);
    else {
      next.add(name);
      // If we remove it, also uncheck it
      const nextChecked = new Set(checkedItems);
      nextChecked.delete(name);
      setCheckedItems(nextChecked);
    }
    setRemovedItems(next);
  };

  const handleQtyChange = (name: string, field: 'qty' | 'unit', value: string) => {
    setItemQuantities(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: value
      }
    }));
  };

  const hasUnownedChecked = Array.from(checkedItems).some(name => {
    if (!shoppingList) return false;
    for (const cat of Object.values(shoppingList) as any[]) {
      const item = cat.find((i: any) => i.name === name);
      if (item && !item.isFullyOwned && !removedItems.has(name)) return true;
    }
    return false;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meal Planner</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plan your meals for the week. Updates automatically.
          </p>
        </div>
        <div className="flex bg-secondary p-1 rounded-lg">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !showShoppingList ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
            }`}
            onClick={() => setShowShoppingList(false)}
          >
            <CalendarIcon size={16} className="inline mr-2" /> Calendar
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              showShoppingList ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
            }`}
            onClick={() => setShowShoppingList(true)}
          >
            <ShoppingCart size={16} className="inline mr-2" /> Grocery List
          </button>
        </div>
      </div>

      {/* Horizontal Smart List Banner */}
      {showShoppingList && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <Info className="text-primary mt-0.5 shrink-0" size={20} />
          <div className="text-sm text-foreground/90">
            <h3 className="font-semibold text-primary mb-1">Smart Shopping List</h3>
            <p>
              Generated automatically from your weekly meal plan. Items marked 
              <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs mx-1">In Pantry</span> 
              are already in your inventory. Check off items as you buy them, enter the quantity bought, and click <strong>Got It</strong> to add them to your pantry!
            </p>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {!showShoppingList && (
        <Card className="overflow-x-auto shadow-sm">
          {isLoadingPlan ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 size={24} className="animate-spin mr-2" /> Loading your plan...
            </div>
          ) : (
            <div className="min-w-[820px]">
              {/* Day headers */}
              <div className="grid grid-cols-8 border-b bg-secondary/30">
                <div className="p-4 border-r font-medium text-muted-foreground text-sm text-center">
                  Meal
                </div>
                {DAYS.map((day) => (
                  <div key={day} className="p-4 font-semibold text-center text-sm text-foreground">
                    {day}
                  </div>
                ))}
              </div>

              {/* Meal rows */}
              {MEAL_TYPES.map((mealType) => (
                <div key={mealType} className="grid grid-cols-8 border-b last:border-0">
                  {/* Meal label */}
                  <div className="p-3 border-r font-medium text-muted-foreground capitalize text-sm flex items-center justify-center bg-secondary/10">
                    {mealType}
                  </div>

                  {/* Day slots */}
                  {DAYS.map((day, idx) => {
                    const entry = getEntryForSlot(idx, mealType);
                    const isDeleting = deletingEntryId === entry?.id;

                    return (
                      <div
                        key={`${day}-${mealType}`}
                        className={`p-2 border-r last:border-0 min-h-[120px] relative transition-colors ${
                          entry
                            ? 'bg-white'
                            : 'hover:bg-primary/5 cursor-pointer group'
                        }`}
                        onClick={() => handleSlotClick(idx, mealType)}
                        title={entry ? undefined : `Add ${mealType} for ${day}`}
                      >
                        {entry ? (
                          /* Filled slot */
                          <div 
                            className="bg-white border border-primary/20 rounded-lg p-2 h-full flex flex-col shadow-sm hover:border-primary transition-colors cursor-pointer"
                            onClick={() => setSelectedRecipeId(entry.recipe.id)}
                          >
                            {/* Recipe image thumbnail */}
                            {entry.recipe.imageUrl ? (
                              <div className="w-full h-14 rounded overflow-hidden mb-1.5 flex-shrink-0">
                                <img
                                  src={entry.recipe.imageUrl}
                                  alt={entry.recipe.title}
                                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                                />
                              </div>
                            ) : (
                              <div className="w-full h-14 rounded overflow-hidden mb-1.5 flex-shrink-0 bg-secondary flex items-center justify-center">
                                <Utensils size={16} className="text-muted-foreground/50" />
                              </div>
                            )}
                            <p className="text-xs font-semibold leading-tight line-clamp-2 flex-1 text-foreground hover:text-primary transition-colors">
                              {entry.recipe.title}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded capitalize line-clamp-1">
                                {entry.recipe.cuisine || 'Recipe'}
                              </span>
                              <button
                                onClick={(e) => handleDeleteEntry(e, entry.id)}
                                disabled={isDeleting}
                                className="p-1 rounded text-muted-foreground hover:text-white hover:bg-red-500 transition-colors ml-1"
                                title="Remove from planner"
                              >
                                {isDeleting ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <X size={12} />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Empty slot */
                          <div className="w-full h-full flex flex-col items-center justify-center text-primary/0 group-hover:text-primary/40 transition-all rounded-lg border-2 border-dashed border-transparent group-hover:border-primary/20 bg-secondary/10 group-hover:bg-primary/5">
                            <Utensils size={18} />
                            <span className="text-[10px] mt-1 font-medium">Plan</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Shopping List View */}
      {showShoppingList && (
        <Card className="max-w-4xl mx-auto shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-secondary">
            <CardTitle>Grocery List</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-primary"
                onClick={() => window.print()}
              >
                <Printer size={16} className="mr-2" /> Print
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleGotIt}
                disabled={!hasUnownedChecked || addToPantryMutation.isPending}
                title="Add checked items to your Pantry"
              >
                {addToPantryMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <ShoppingCart size={16} className="mr-2" />}
                Got It
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingList ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={24} className="animate-spin mr-2" /> Generating your list...
              </div>
            ) : shoppingList && Object.keys(shoppingList).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {Object.entries(shoppingList).map(([category, items]: [string, any]) => {
                  const visibleItems = items.filter((item: any) => !removedItems.has(item.name));
                  if (visibleItems.length === 0) return null;

                  return (
                    <div key={category} className="bg-secondary/10 p-4 rounded-xl">
                      <h3 className="font-bold text-lg border-b border-primary/20 pb-2 mb-4 capitalize text-primary flex items-center gap-2">
                        {category}
                        <span className="text-xs font-normal bg-primary/10 px-2 py-0.5 rounded-full text-primary">
                          {visibleItems.length} items
                        </span>
                      </h3>
                      <ul className="space-y-4">
                        {visibleItems.map((item: any, idx: number) => {
                          const isChecked = checkedItems.has(item.name);
                          return (
                            <li key={idx} className="flex flex-col gap-2 group">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  id={`check-${category}-${idx}`}
                                  className="mt-1 w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer transition-transform group-hover:scale-110"
                                  checked={item.isFullyOwned || isChecked}
                                  onChange={() => toggleCheckItem(item.name, item.isFullyOwned)}
                                  disabled={item.isFullyOwned}
                                />
                                <label 
                                  htmlFor={`check-${category}-${idx}`}
                                  className={`flex-1 cursor-pointer transition-opacity ${item.isFullyOwned ? 'opacity-50 line-through' : 'hover:opacity-80'}`}
                                >
                                  <span className="font-medium capitalize text-sm text-foreground">{item.name}</span>
                                  {item.isFullyOwned && (
                                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                      In Pantry
                                    </span>
                                  )}
                                </label>
                                {!item.isFullyOwned && (
                                  <button
                                    onClick={() => toggleRemoveItem(item.name)}
                                    className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="Remove from list"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                              
                              {/* Inline quantity input when checked */}
                              {isChecked && !item.isFullyOwned && (
                                <div className="ml-7 flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm animate-in slide-in-from-top-2">
                                  <Input 
                                    type="number" 
                                    placeholder="Qty (opt)" 
                                    className="w-24 h-8 text-sm"
                                    value={itemQuantities[item.name]?.qty || ''}
                                    onChange={(e) => handleQtyChange(item.name, 'qty', e.target.value)}
                                  />
                                  <select 
                                    className="h-8 px-2 border border-input bg-background rounded-md text-sm w-24"
                                    value={itemQuantities[item.name]?.unit || ''}
                                    onChange={(e) => handleQtyChange(item.name, 'unit', e.target.value)}
                                  >
                                    <option value="">Unit</option>
                                    <option value="g">g</option>
                                    <option value="kg">kg</option>
                                    <option value="ml">ml</option>
                                    <option value="L">L</option>
                                    <option value="cup">cup</option>
                                    <option value="tbsp">tbsp</option>
                                    <option value="tsp">tsp</option>
                                    <option value="unit">unit</option>
                                    <option value="oz">oz</option>
                                    <option value="lb">lb</option>
                                  </select>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground bg-secondary/30 rounded-xl border border-dashed">
                <ShoppingCart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="font-medium text-lg text-foreground">Your shopping list is empty.</p>
                <p className="text-sm mt-1">Add recipes to your meal plan using the Calendar view.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recipe Picker Modal */}
      {selectedSlot && mealPlan && (
        <RecipePickerModal
          isOpen={!!selectedSlot}
          onClose={() => setSelectedSlot(null)}
          mealPlanId={mealPlan.id}
          dayOfWeek={selectedSlot.dayOfWeek}
          mealType={selectedSlot.mealType}
          dayLabel={selectedSlot.dayLabel}
        />
      )}

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipeId={selectedRecipeId}
        onClose={() => setSelectedRecipeId(null)}
      />
    </div>
  );
};

export default MealPlanner;
