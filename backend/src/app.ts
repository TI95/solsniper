import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import router from './routes/index';
import errorMiddleware from './middleware/error-middleware';

const CLIENT_URL = 'http://localhost:5173';

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', router);
  app.use(errorMiddleware);
  return app;
}

export default createApp();
