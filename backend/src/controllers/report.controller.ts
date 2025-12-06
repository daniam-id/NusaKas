import { Response } from 'express';
import { reportService } from '../services/report.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class ReportController {
  async downloadPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const storeName = (req.user as any)?.store_name || 'NusaKas';
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required',
        });
        return;
      }

      const pdfBuffer = await reportService.generatePdf({
        userId,
        startDate: startDate as string,
        endDate: endDate as string,
        storeName,
      });

      const filename = `laporan_${startDate}_${endDate}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Download PDF error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF report',
      });
    }
  }
}

export const reportController = new ReportController();
