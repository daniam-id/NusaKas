import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

// Common validation schemas
export const schemas = {
  // Auth schemas
  login: z.object({
    body: z.object({
      wa_number: z.string().min(10, 'WhatsApp number must be at least 10 digits'),
    }),
  }),

  verify: z.object({
    body: z.object({
      wa_number: z.string().min(10),
      code: z.string().length(4, 'OTP must be 4 digits'),
    }),
  }),

  // Transaction schemas
  createTransaction: z.object({
    body: z.object({
      type: z.enum(['INCOME', 'EXPENSE']),
      amount: z.number().positive('Amount must be positive'),
      category: z.string().optional(),
      description: z.string().max(200).optional(),
      transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  }),

  updateTransaction: z.object({
    params: z.object({
      id: z.string().uuid(),
    }),
    body: z.object({
      amount: z.number().positive().optional(),
      category: z.string().optional(),
      description: z.string().max(200).optional(),
    }),
  }),

  listTransactions: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).optional(),
      limit: z.string().regex(/^\d+$/).optional(),
      type: z.enum(['INCOME', 'EXPENSE']).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      category: z.string().optional(),
    }),
  }),

  // Report schemas
  downloadReport: z.object({
    query: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    }),
  }),
};
