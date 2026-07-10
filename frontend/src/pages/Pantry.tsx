import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Trash2, Plus, Calendar, History, Search, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface PantryItem {
  id: string;
  quantity: number | null;
  unit: string | null;
  expiryDate: string | null;
  ingredient: {
    canonicalName: string;
    category: string;
  };
}

interface PantryHistoryItem {
  id: string;
  action: string;
  quantity: number | null;
  unit: string | null;
  recordedAt: string;
  ingredient: {
    canonicalName: string;
  };
}

const COMMON_UNITS = ['g', 'kg', 'ml', 'L', 'cup', 'tbsp', 'tsp', 'unit', 'oz', 'lb', 'pinch'];

export default function Pantry() {
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState(COMMON_UNITS[0]);
  const [newExpiry, setNewExpiry] = useState('');
  
  const [suggestions, setSuggestions] = useState<{name: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const [similarItem, setSimilarItem] = useState<PantryItem | null>(null);
  const [pendingItem, setPendingItem] = useState<{ ingredientName: string, quantity?: number, unit?: string, expiryDate?: string } | null>(null);

  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['pantry'],
    queryFn: async () => {
      const { data } = await apiClient.get<PantryItem[]>('/pantry');
      return data;
    }
  });

  const { data: history } = useQuery({
    queryKey: ['pantryHistory'],
    queryFn: async () => {
      const { data } = await apiClient.get<PantryHistoryItem[]>('/pantry-history');
      return data;
    }
  });

  const addItemMutation = useMutation({
    mutationFn: async (newItem: { ingredientName: string, quantity?: number, unit?: string, expiryDate?: string }) => {
      await apiClient.post('/pantry', newItem);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] });
      resetForm();
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, quantity, unit }: { id: string; quantity: number; unit?: string }) => {
      await apiClient.patch(`/pantry/${id}`, { quantity, unit });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] });
      resetForm();
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
      await apiClient.delete(`/pantry/${id}?reason=${reason}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] });
      queryClient.invalidateQueries({ queryKey: ['pantryHistory'] });
    }
  });

  const resetForm = () => {
    setNewItemName('');
    setNewItemQty('');
    setNewExpiry('');
    setSimilarItem(null);
    setPendingItem(null);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    
    const payload = {
      ingredientName: newItemName.trim(),
      quantity: newItemQty ? parseFloat(newItemQty) : undefined,
      unit: newItemUnit || undefined,
      expiryDate: newExpiry || undefined
    };

    if (items) {
      const inputWords = payload.ingredientName.toLowerCase().split(' ');
      const match = items.find(i => {
        const existingWords = i.ingredient.canonicalName.toLowerCase().split(' ');
        return inputWords.some(w => existingWords.includes(w)) || existingWords.some(w => inputWords.includes(w));
      });

      if (match) {
        setSimilarItem(match);
        setPendingItem(payload);
        return;
      }
    }

    addItemMutation.mutate(payload);
  };

  const handleMerge = () => {
    if (!similarItem || !pendingItem) return;
    const newQty = (similarItem.quantity || 0) + (pendingItem.quantity || 0);
    updateItemMutation.mutate({
      id: similarItem.id,
      quantity: newQty,
      unit: pendingItem.unit || similarItem.unit || undefined
    });
  };

  const handleKeepSeparate = () => {
    if (!pendingItem) return;
    addItemMutation.mutate(pendingItem);
  };

  // Autocomplete fetcher
  useEffect(() => {
    if (newItemName.length < 2) {
      setSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await apiClient.get(`/recipes/ingredients/autocomplete?query=${newItemName}`);
        setSuggestions(data);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [newItemName]);

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

  const groupedItems = useMemo(() => {
    if (!items) return {};
    const groups: Record<string, PantryItem[]> = {};
    items.forEach(item => {
      const firstWord = item.ingredient.canonicalName.split(' ')[0].toLowerCase();
      if (!groups[firstWord]) groups[firstWord] = [];
      groups[firstWord].push(item);
    });
    return groups;
  }, [items]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Pantry</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Pantry Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle>Add New Item</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddItem} className="space-y-4">
                
                {/* Search Bar with Autocomplete */}
                <div className="relative" ref={suggestionRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input 
                      placeholder="Search ingredient (e.g., chicken, olive oil)..." 
                      value={newItemName}
                      onChange={(e) => {
                        setNewItemName(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="pl-10 h-12 text-lg bg-white"
                      required
                    />
                  </div>
                  
                  {/* Autocomplete Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border">
                      <ul className="py-1">
                        {suggestions.map((s, i) => (
                          <li 
                            key={i} 
                            className="px-4 py-2 hover:bg-secondary cursor-pointer capitalize text-sm"
                            onClick={() => {
                              setNewItemName(s.name);
                              setShowSuggestions(false);
                            }}
                          >
                            {s.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Details Row */}
                <div className="flex flex-wrap gap-4">
                  
                  {/* Quantity & Unit Combined */}
                  <div className="flex-1 min-w-[200px] flex shadow-sm rounded-md">
                    <Input 
                      type="number" 
                      placeholder="Qty" 
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      step="0.1"
                      min="0"
                      className="rounded-r-none border-r-0 h-10 bg-white"
                    />
                    <select
                      className="h-10 px-3 border border-input bg-white rounded-r-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                    >
                      {COMMON_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  {/* Expiry Date */}
                  <div className="flex-1 min-w-[200px] relative shadow-sm rounded-md">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input 
                      type="date"
                      value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                      className="pl-10 h-10 bg-white"
                      title="Expiry Date"
                    />
                  </div>

                  <Button type="submit" disabled={addItemMutation.isPending} className="h-10 whitespace-nowrap shadow-sm">
                    <Plus size={18} className="mr-2" /> Add to Pantry
                  </Button>
                </div>
              </form>

              {/* Similar Item Popup Modal */}
              {similarItem && pendingItem && (
                <div className="mt-4 p-4 border border-orange-200 bg-orange-50 rounded-lg animate-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-orange-500 mt-0.5" size={20} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-orange-800">Similar item detected!</h4>
                      <p className="text-sm text-orange-700 mt-1">
                        You already have <strong>{similarItem.ingredient.canonicalName}</strong> in your pantry 
                        ({similarItem.quantity} {similarItem.unit}).
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button size="sm" onClick={handleMerge} disabled={updateItemMutation.isPending}>
                          Merge quantities
                        </Button>
                        <Button size="sm" variant="outline" className="bg-white" onClick={handleKeepSeparate} disabled={addItemMutation.isPending}>
                          Keep both items
                        </Button>
                        <Button size="sm" variant="ghost" onClick={resetForm}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : Object.keys(groupedItems).length > 0 ? (
                <div className="divide-y divide-border/50">
                  {Object.entries(groupedItems).map(([groupName, groupItems]) => (
                    <div key={groupName} className="py-4 first:pt-0 last:pb-0">
                      {groupItems.length > 1 && (
                        <h3 className="font-semibold text-primary capitalize mb-2">{groupName}</h3>
                      )}
                      <div className="space-y-2">
                        {groupItems.map((item) => (
                          <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg group transition-colors hover:bg-secondary/30 ${groupItems.length > 1 ? 'ml-4 border border-transparent hover:border-border' : ''}`}>
                            <div className="flex-1">
                              <p className="font-medium text-foreground capitalize">
                                {item.ingredient.canonicalName}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                {item.quantity && (
                                  <span className="font-medium bg-secondary px-2 py-0.5 rounded">{item.quantity} {item.unit || ''}</span>
                                )}
                                {item.expiryDate && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} /> Exp: {format(new Date(item.expiryDate), 'MMM d, yyyy')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                                onClick={() => deleteItemMutation.mutate({ id: item.id, reason: 'expired' })}
                                title="Mark as expired"
                              >
                                Expired
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50" 
                                onClick={() => deleteItemMutation.mutate({ id: item.id, reason: 'deleted' })}
                                title="Remove item"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-secondary/30 rounded-xl border border-dashed">
                  <p className="font-medium text-lg">Your pantry is empty.</p>
                  <p className="text-muted-foreground mt-1">Add items above to start getting recipe recommendations.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="text-primary" size={18} />
                Recent History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((h: PantryHistoryItem) => (
                    <div key={h.id} className="flex items-start justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium capitalize text-foreground line-clamp-1">{h.ingredient.canonicalName}</p>
                        <div className="mt-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            h.action === 'expired' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {h.action}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-foreground">{h.quantity ? `${h.quantity} ${h.unit || ''}` : '-'}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(h.recordedAt), 'MMM d, p')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                  <p className="text-sm">No history yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
      </div>
    </div>
  );
}
