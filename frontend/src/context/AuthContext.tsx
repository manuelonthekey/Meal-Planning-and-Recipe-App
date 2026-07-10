import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

export interface User {
  id: string;
  email: string;
  name: string;
  dailyCaloriesTarget?: number | null;
  age?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  gender?: string | null;
  activityLevel?: string | null;
  proteinTarget?: number | null;
  carbsTarget?: number | null;
  fatTarget?: number | null;
  dietaryPreferences?: string[];
  allergies?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pantrychef_token');
    const storedUser = localStorage.getItem('pantrychef_user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('pantrychef_token');
        localStorage.removeItem('pantrychef_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('pantrychef_token', token);
    localStorage.setItem('pantrychef_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('pantrychef_token');
    localStorage.removeItem('pantrychef_user');
    setUser(null);
  };

  const updateUser = (userData: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...userData };
    localStorage.setItem('pantrychef_user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
