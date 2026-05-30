import { Router } from 'express';
import multer from 'multer';
import { sendToDeepSeek } from '../controllers/deepseek.controller';

const router = Router();
const upload = multer(); // Initialize multer for form-data parsing (no file saving needed, just fields)

// POST route for sending message to deepseek via form-data
router.post('/', upload.none(), sendToDeepSeek);

export default router;
