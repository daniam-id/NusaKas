import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/settings - Get user settings (JWT required)
router.get('/', authMiddleware, (req, res) => settingsController.get(req, res));

// PUT /api/settings - Update user settings (JWT required)
router.put('/', authMiddleware, (req, res) => settingsController.update(req, res));

export default router;
