import { Response } from 'express';
import { transactionService } from '../services/transaction.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class TransactionController {
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { page, limit, type, startDate, endDate, category } = req.query;

      const result = await transactionService.list({
        userId,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
        type: type as 'INCOME' | 'EXPENSE' | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        category: category as string | undefined,
      });

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      console.error('List transactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list transactions',
      });
    }
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const transaction = await transactionService.getById(id, userId);

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      res.json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction',
      });
    }
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { type, amount, category, description, transaction_date } = req.body;

      if (!type || !amount) {
        res.status(400).json({
          success: false,
          error: 'Type and amount are required',
        });
        return;
      }

      const transaction = await transactionService.create({
        userId,
        type,
        amount: Number(amount),
        category,
        description,
        transactionDate: transaction_date,
      });

      res.status(201).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create transaction',
      });
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { amount, category, description } = req.body;

      const transaction = await transactionService.update(id, userId, {
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
      });

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      res.json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      console.error('Update transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update transaction',
      });
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const deleted = await transactionService.delete(id, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Transaction deleted',
      });
    } catch (error) {
      console.error('Delete transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete transaction',
      });
    }
  }

  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { startDate, endDate } = req.query;

      const stats = await transactionService.getStats(
        userId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
      });
    }
  }
}

export const transactionController = new TransactionController();
