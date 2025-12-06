import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// GET /api/stats - Get income/expense/balance stats
router.get('/', (req, res) => transactionController.getStats(req, res));

export default router;
