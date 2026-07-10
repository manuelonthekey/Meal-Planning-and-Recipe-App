import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ShoppingBasket, BookOpen, Calendar, LogOut, Utensils } from 'lucide-react';

const Layout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/pantry', label: 'My Pantry', icon: ShoppingBasket },
    { path: '/recipes', label: 'Discover Recipes', icon: BookOpen },
    { path: '/planner', label: 'Meal Planner', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r flex flex-col shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl text-primary">
            <Utensils size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">PantryChef</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${
                  isActive 
                    ? 'bg-primary text-primary-foreground soft-shadow' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t mt-auto">
          <Link to="/profile" className="block px-4 py-3 mb-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group cursor-pointer text-left">
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2 w-full rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors font-medium text-left"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
