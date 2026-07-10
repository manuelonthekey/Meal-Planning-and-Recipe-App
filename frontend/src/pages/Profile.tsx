import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { User as UserIcon, Activity, Target, Heart, AlertTriangle, Save, X } from 'lucide-react';

export default function Profile() {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();

  // Local state for all fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await apiClient.get('/user/profile');
      return data;
    }
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setAge(profile.age?.toString() || '');
      setWeight(profile.weightKg?.toString() || '');
      setHeight(profile.heightCm?.toString() || '');
      setGender(profile.gender || '');
      setActivityLevel(profile.activityLevel || '');
      
      setCalories(profile.dailyCaloriesTarget?.toString() || '');
      setProtein(profile.proteinTarget?.toString() || '');
      setCarbs(profile.carbsTarget?.toString() || '');
      setFat(profile.fatTarget?.toString() || '');
      
      setDietaryPrefs(profile.dietaryPreferences || []);
      setAllergies(profile.allergies || []);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.patch('/user/profile', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      updateUser(data);
    }
  });

  const handleSavePersonal = () => {
    updateProfileMutation.mutate({ name });
  };

  const handleSaveBody = () => {
    updateProfileMutation.mutate({
      age: age ? parseInt(age) : null,
      weightKg: weight ? parseFloat(weight) : null,
      heightCm: height ? parseFloat(height) : null,
      gender: gender || null,
      activityLevel: activityLevel || null,
    });
  };

  const handleSaveNutrition = () => {
    updateProfileMutation.mutate({
      dailyCaloriesTarget: calories ? parseInt(calories) : null,
      proteinTarget: protein ? parseInt(protein) : null,
      carbsTarget: carbs ? parseInt(carbs) : null,
      fatTarget: fat ? parseInt(fat) : null,
    });
  };

  const toggleDiet = (diet: string) => {
    const next = dietaryPrefs.includes(diet)
      ? dietaryPrefs.filter(d => d !== diet)
      : [...dietaryPrefs, diet];
    setDietaryPrefs(next);
    updateProfileMutation.mutate({ dietaryPreferences: next });
  };

  const addAllergy = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && allergyInput.trim()) {
      e.preventDefault();
      const val = allergyInput.trim().toLowerCase();
      if (!allergies.includes(val)) {
        const next = [...allergies, val];
        setAllergies(next);
        updateProfileMutation.mutate({ allergies: next });
      }
      setAllergyInput('');
    }
  };

  const removeAllergy = (a: string) => {
    const next = allergies.filter(x => x !== a);
    setAllergies(next);
    updateProfileMutation.mutate({ allergies: next });
  };

  const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Halal', 'Kosher'];

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading profile...</div>;

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="text-primary" size={20} /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
                {profile?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email Address</p>
                <p className="font-medium">{profile?.email}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <Button onClick={handleSavePersonal} disabled={updateProfileMutation.isPending} size="sm">
              <Save size={16} className="mr-2" /> Save Name
            </Button>
          </CardContent>
        </Card>

        {/* Body & Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="text-primary" size={20} /> Body & Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Age</label>
                <Input type="number" value={age} onChange={e => setAge(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Gender</label>
                <select 
                  className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
                  value={gender} onChange={e => setGender(e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Weight (kg)</label>
                <Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Height (cm)</label>
                <Input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Activity Level</label>
              <select 
                className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
                value={activityLevel} onChange={e => setActivityLevel(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="Sedentary">Sedentary (office job)</option>
                <option value="Lightly Active">Lightly Active (1-3 days/week)</option>
                <option value="Moderately Active">Moderately Active (3-5 days/week)</option>
                <option value="Very Active">Very Active (6-7 days/week)</option>
                <option value="Extra Active">Extra Active (physical job)</option>
              </select>
            </div>
            <Button onClick={handleSaveBody} disabled={updateProfileMutation.isPending} size="sm">
              <Save size={16} className="mr-2" /> Save Body & Goals
            </Button>
          </CardContent>
        </Card>

        {/* Nutrition Targets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-primary" size={20} /> Nutrition Targets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-primary">Daily Calories (kcal)</label>
              <Input type="number" value={calories} onChange={e => setCalories(e.target.value)} className="border-primary/50 bg-primary/5" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Protein (g)</label>
                <Input type="number" value={protein} onChange={e => setProtein(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Carbs (g)</label>
                <Input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fat (g)</label>
                <Input type="number" value={fat} onChange={e => setFat(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSaveNutrition} disabled={updateProfileMutation.isPending} size="sm">
              <Save size={16} className="mr-2" /> Save Targets
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Dietary Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="text-primary" size={20} /> Dietary Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {DIETS.map(diet => (
                  <label key={diet} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${dietaryPrefs.includes(diet) ? 'bg-primary/10 border-primary text-primary font-medium' : 'hover:bg-secondary'}`}>
                    <input type="checkbox" className="hidden" checked={dietaryPrefs.includes(diet)} onChange={() => toggleDiet(diet)} />
                    {diet}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Allergies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={20} /> Allergies & Avoidances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input 
                placeholder="Type allergy (e.g. peanuts) and press Enter..." 
                value={allergyInput} 
                onChange={e => setAllergyInput(e.target.value)}
                onKeyDown={addAllergy}
              />
              <div className="flex flex-wrap gap-2">
                {allergies.map(a => (
                  <div key={a} className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium capitalize">
                    {a}
                    <button onClick={() => removeAllergy(a)} className="hover:text-red-900 rounded-full p-0.5 hover:bg-red-200 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {allergies.length === 0 && <p className="text-sm text-muted-foreground italic">No allergies listed.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
