import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { initializeDatabase } from './src/config/db.ts';
import { initializeDatabase as initSeedDatabase } from './src/server/seed.ts';
import authRoutes from './src/routes/auth.routes.ts';
import quizRoutes from './src/routes/quiz.routes.ts';
import attemptRoutes from './src/routes/attempt.routes.ts';
import adminRoutes from './src/routes/admin.routes.ts';
import legacyApiRouter from './src/server/routes.ts';
import { errorHandler } from './src/middleware/errorHandler.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled to allow embedded Vite previews and inline styles
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Initialize Relational SQL database (MySQL / SQLite 3NF fallback)
  await initializeDatabase();
  await initSeedDatabase();
  console.log('Online Quiz System database connection established.');

  // Mount REST API endpoints
  app.use('/api/auth', authRoutes);
  app.use('/api', legacyApiRouter);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api', attemptRoutes);
  app.use('/api/admin', adminRoutes);

  // Serve static assets from public/ directory
  app.use(express.static(path.resolve(__dirname, 'public')));

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  // Mount Vite middleware in development or static assets in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuizPulse backend server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
