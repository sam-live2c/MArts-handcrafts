import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import sendOtpHandler from './api/send-otp';
import verifyOtpHandler from './api/verify-otp';
import resendStatusHandler from './api/resend-status';
import apiIndexHandler from './api/index';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// ================= API ROUTES =================
app.all('/api/send-otp', (req, res) => sendOtpHandler(req, res));
app.all('/api/verify-otp', (req, res) => verifyOtpHandler(req, res));
app.all('/api/resend-status', (req, res) => resendStatusHandler(req, res));
app.all('/api', (req, res) => apiIndexHandler(req, res));

// ================= FRONTEND MOUNTING =================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite dev server middleware in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] MArts Express + Vite running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[Server Error] Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
