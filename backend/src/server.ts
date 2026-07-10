import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import pantryRoutes from './routes/pantry.routes';
import recipeRoutes from './routes/recipes.routes';
import mealPlanRoutes from './routes/mealPlans.routes';
import favoritesRoutes from './routes/favorites.routes';
import userRoutes from './routes/user.routes';
import pantryHistoryRoutes from './routes/pantry-history.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/pantry', pantryRoutes);
app.use('/api/v1/pantry-history', pantryHistoryRoutes);
app.use('/api/v1/recipes', recipeRoutes);
app.use('/api/v1/meal-plans', mealPlanRoutes);
app.use('/api/v1/favorites', favoritesRoutes);

// Error handling middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
