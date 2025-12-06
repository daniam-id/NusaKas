import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// GET /api/transactions - List transactions with pagination & filters
router.get('/', validate(schemas.listTransactions), (req, res) => 
  transactionController.list(req, res)
);

// GET /api/transactions/:id - Get single transaction
router.get('/:id', (req, res) => 
  transactionController.getById(req, res)
);

// POST /api/transactions - Create transaction
router.post('/', validate(schemas.createTransaction), (req, res) => 
  transactionController.create(req, res)
);

// PATCH /api/transactions/:id - Update transaction
router.patch('/:id', validate(schemas.updateTransaction), (req, res) => 
  transactionController.update(req, res)
);

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', (req, res) => 
  transactionController.delete(req, res)
);

export default router;
