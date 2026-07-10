import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Link } from 'react-router-dom';
import { Calendar, ShoppingBasket, Target, AlertCircle, Edit2, CheckCircle2, Flame, Plus, X } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import RecipeDetailModal from '../components/RecipeDetailModal';

// helper: get calories from nutrition object
function getCalories(nutrition: any): number {
  if (!nutrition) return 0;
  if (Array.isArray(nutrition?.nutrients)) {
    const c = nutrition.nutrients.find((n: any) => n.name === 'Calories');
    return c ? Math.round(c.amount) : 0;
  }
  if (nutrition.calories !== undefined) return Math.round(Number(nutrition.calories));
  return 0;
}

interface ManualEntry {
  id: string;
  name: string;
  calories: number;
}

const Dashboard = () => {
  const { user, updateUser } = useAuth();
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [newTarget, setNewTarget] = useState(user?.dailyCaloriesTarget?.toString() || '');
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);

  const [completedMeals, setCompletedMeals] = useState<Record<string, boolean>>({});
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [snackName, setSnackName] = useState('');
  const [snackCalories, setSnackCalories] = useState('');

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const completedKey = `pantrychef_completed_${todayKey}`;
  const manualKey = `pantrychef_manual_${todayKey}`;

  // Load from localStorage on mount
  useEffect(() => {
    const savedCompleted = localStorage.getItem(completedKey);
    if (savedCompleted) {
      try { setCompletedMeals(JSON.parse(savedCompleted)); } catch(e) {}
    }
    const savedManual = localStorage.getItem(manualKey);
    if (savedManual) {
      try { setManualEntries(JSON.parse(savedManual)); } catch(e) {}
    }
  }, [completedKey, manualKey]);

  // Save completedMeals to localStorage on change
  useEffect(() => {
    localStorage.setItem(completedKey, JSON.stringify(completedMeals));
  }, [completedMeals, completedKey]);

  // Save manualEntries to localStorage on change
  useEffect(() => {
    localStorage.setItem(manualKey, JSON.stringify(manualEntries));
  }, [manualEntries, manualKey]);

  // 1. Fetch current meal plan for Today's Meals and Nutrition calculation
  const { data: mealPlan } = useQuery({
    queryKey: ['mealPlan', 'current'],
    queryFn: async () => {
      const { data } = await apiClient.get('/meal-plans/current');
      return data;
    },
  });

  // 2. Fetch pantry items to find expiring ones
  const { data: pantryItems } = useQuery({
    queryKey: ['pantry'],
    queryFn: async () => {
      const { data } = await apiClient.get('/pantry');
      return data;
    },
  });

  // Mutation to update daily target
  const updateTargetMutation = useMutation({
    mutationFn: async (target: number) => {
      const { data } = await apiClient.patch('/user/targets', { dailyCaloriesTarget: target });
      return data;
    },
    onSuccess: (data) => {
      updateUser({ dailyCaloriesTarget: data.dailyCaloriesTarget });
      setIsEditingTarget(false);
    }
  });

  const handleUpdateTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(newTarget, 10);
    if (!isNaN(val) && val > 0) {
      updateTargetMutation.mutate(val);
    }
  };

  // --- Derived State ---
  
  // Today's Meals
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Mon, 6=Sun
  const todayMeals = useMemo(() => {
    if (!mealPlan?.entries) return [];
    return mealPlan.entries.filter((e: any) => e.dayOfWeek === todayIndex);
  }, [mealPlan, todayIndex]);

  const toggleMealComplete = (entryId: string) => {
    setCompletedMeals(prev => ({ ...prev, [entryId]: !prev[entryId] }));
  };

  const addManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snackName.trim() || !snackCalories) return;
    const caloriesNum = parseInt(snackCalories, 10);
    if (isNaN(caloriesNum)) return;
    
    setManualEntries(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      name: snackName,
      calories: caloriesNum
    }]);
    setSnackName('');
    setSnackCalories('');
  };

  const removeManualEntry = (id: string) => {
    setManualEntries(prev => prev.filter(e => e.id !== id));
  };

  const currentCalories = useMemo(() => {
    let total = 0;
    for (const entry of todayMeals) {
      if (completedMeals[entry.id]) {
        total += getCalories(entry.recipe.nutrition) * (Number(entry.servingsMultiplier) || 1);
      }
    }
    for (const entry of manualEntries) {
      total += entry.calories;
    }
    return total;
  }, [todayMeals, completedMeals, manualEntries]);

  const targetCalories = user?.dailyCaloriesTarget || 2000;
  const progressPercent = Math.min(100, Math.round((currentCalories / targetCalories) * 100));

  let circleColorClass = 'text-primary';
  if (currentCalories === 0) circleColorClass = 'text-gray-200';
  else if (currentCalories >= targetCalories) circleColorClass = 'text-red-500';
  else circleColorClass = 'text-green-500';

  // Expiring Pantry Items
  const expiringItems = useMemo(() => {
    if (!pantryItems) return [];
    const now = new Date();
    return pantryItems
      .filter((item: any) => item.expiryDate)
      .map((item: any) => ({
        ...item,
        daysLeft: differenceInDays(new Date(item.expiryDate), now)
      }))
      .filter((item: any) => item.daysLeft <= 7) // expiring in 7 days or less (or already expired)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [pantryItems]);


  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-muted-foreground mt-2">Here's your summary for {format(new Date(), 'EEEE, MMMM do')}.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3 width on large screens) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Meals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="text-primary" size={20} />
                  Today's Meals
                </span>
                <Link to="/planner">
                  <Button variant="ghost" size="sm" className="text-primary">Edit Plan</Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayMeals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {todayMeals.map((entry: any) => (
                    <div 
                      key={entry.id} 
                      className="border rounded-xl p-3 flex flex-col hover:border-primary/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedRecipeId(entry.recipe.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                          {entry.mealType}
                        </span>
                        <button 
                          className={`p-1 rounded-full ${completedMeals[entry.id] ? 'text-green-500' : 'text-muted-foreground/30 hover:text-green-500'}`}
                          onClick={(e) => { e.stopPropagation(); toggleMealComplete(entry.id); }}
                          title="Mark as completed"
                        >
                          <CheckCircle2 size={20} />
                        </button>
                      </div>
                      <h4 className="font-medium text-sm leading-tight line-clamp-2 flex-1 mb-2">
                        {entry.recipe.title}
                      </h4>
                      {entry.recipe.imageUrl && (
                        <div className="h-20 w-full rounded-md overflow-hidden bg-secondary">
                          <img src={entry.recipe.imageUrl} alt={entry.recipe.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-secondary/50 rounded-lg border border-dashed">
                  <p className="text-muted-foreground mb-4">No meals planned for today.</p>
                  <Link to="/planner">
                    <Button variant="outline">Plan today's meals</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Nutrition Checker */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Target size={20} className="text-primary" />
                Daily Nutrition Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                
                {/* Circular Progress (CSS based) */}
                <div className="relative w-32 h-32 shrink-0 self-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-primary/20" />
                    <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="12" 
                      className={`transition-all duration-1000 ease-in-out ${circleColorClass}`} 
                      strokeDasharray="351.8" 
                      strokeDashoffset={351.8 - (351.8 * progressPercent) / 100} 
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-foreground">{currentCalories}</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">kcal</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 w-full space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Daily Target</p>
                      {isEditingTarget ? (
                        <form onSubmit={handleUpdateTarget} className="flex gap-2 mt-1">
                          <Input 
                            type="number" 
                            value={newTarget} 
                            onChange={(e) => setNewTarget(e.target.value)} 
                            className="w-24 h-8"
                          />
                          <Button type="submit" size="sm">Save</Button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-bold">{targetCalories} kcal</span>
                          <button onClick={() => setIsEditingTarget(true)} className="text-muted-foreground hover:text-primary">
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{progressPercent}%</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                  
                  {/* Manual Add Snack */}
                  <div className="space-y-2 pt-2 border-t border-primary/10">
                    <p className="text-sm font-medium">Add Snack or Custom Food</p>
                    <form onSubmit={addManualEntry} className="flex gap-2">
                      <Input 
                        placeholder="e.g. Apple" 
                        value={snackName}
                        onChange={e => setSnackName(e.target.value)}
                        className="h-8 flex-1 text-sm bg-white"
                      />
                      <Input 
                        type="number"
                        placeholder="kcal" 
                        value={snackCalories}
                        onChange={e => setSnackCalories(e.target.value)}
                        className="h-8 w-20 text-sm bg-white"
                      />
                      <Button type="submit" size="sm" variant="outline" className="h-8 px-2 bg-white"><Plus size={16}/></Button>
                    </form>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <p className="text-xs text-muted-foreground font-medium">Today's Intake:</p>
                    <div className="flex flex-wrap gap-2">
                      {todayMeals.filter(e => completedMeals[e.id]).map(entry => (
                        <div key={entry.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-primary/10 text-primary border-primary/20">
                          <CheckCircle2 size={12}/> {entry.mealType}
                        </div>
                      ))}
                      {manualEntries.map(entry => (
                        <div key={entry.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-white text-foreground">
                          {entry.name} ({entry.calories})
                          <button onClick={() => removeManualEntry(entry.id)} className="text-muted-foreground hover:text-red-500 ml-1">
                            <X size={12}/>
                          </button>
                        </div>
                      ))}
                      {todayMeals.filter(e => completedMeals[e.id]).length === 0 && manualEntries.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">No food logged yet</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          
          {/* Pantry Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingBasket className="text-primary" size={20} />
                  Pantry Status
                </span>
                <Link to="/pantry">
                  <Button variant="ghost" size="sm" className="text-primary">Manage</Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expiringItems.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expiring Soon</p>
                  {expiringItems.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-50/50 border border-red-100">
                      <div className="bg-red-100 text-red-600 p-1.5 rounded-full">
                        <AlertCircle size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate capitalize">{item.ingredient.canonicalName}</p>
                        <p className="text-xs text-red-600 font-medium">
                          {item.daysLeft < 0 
                            ? `Expired ${Math.abs(item.daysLeft)} days ago` 
                            : item.daysLeft === 0 
                              ? 'Expiring today!' 
                              : `${item.daysLeft} days left`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-green-50/50 rounded-lg border border-green-100">
                  <p className="text-sm text-green-700 font-medium">All good!</p>
                  <p className="text-xs text-green-600/80 mt-1">No items expiring within 7 days.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Discover */}
          <Card className="bg-primary text-primary-foreground border-none soft-shadow relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 text-white/10 transform rotate-12 transition-transform group-hover:rotate-45 group-hover:scale-110 duration-500">
              <Flame size={120} />
            </div>
            <CardHeader className="relative z-10 pb-2">
              <CardTitle className="text-lg">Need inspiration?</CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <p className="text-primary-foreground/80 text-sm mb-4">Discover new recipes you can make with what you already have.</p>
              <Link to="/recipes">
                <Button className="w-full bg-white text-primary hover:bg-gray-100 border-none">
                  Match My Pantry
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>
      </div>

      <RecipeDetailModal
        recipeId={selectedRecipeId}
        onClose={() => setSelectedRecipeId(null)}
      />
    </div>
  );
};

export default Dashboard;
