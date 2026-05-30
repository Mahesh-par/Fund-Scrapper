import { Router } from 'express';
import healthRoutes from './health.routes';
import scraperRoutes from './scraper.routes';
import deepseekRoutes from './deepseek.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/', scraperRoutes); // /extract-html will be directly available
router.use('/deepseek', deepseekRoutes);

export default router;
