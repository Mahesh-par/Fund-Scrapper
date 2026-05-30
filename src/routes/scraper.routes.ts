import { Router } from 'express';
import { extractHtml } from '../controllers/scraper.controller';

const router = Router();

// POST route for extracting HTML
router.post('/extract-html', extractHtml);

export default router;
