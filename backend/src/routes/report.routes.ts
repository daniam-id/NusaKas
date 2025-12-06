import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// GET /api/report/download - Download PDF report
router.get('/download', validate(schemas.downloadReport), (req, res) => 
  reportController.downloadPdf(req, res)
);

export default router;
