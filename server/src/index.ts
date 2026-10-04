import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import announcementRouter from './routes/announcements.js';
import { initialiseDatabase } from './db/pool.js';
import { initialiseLocalMailInbox, localMailDirectory } from './services/email.js';

for (const name of ['DATABASE_URL', 'JWT_SECRET', 'CLIENT_URL', 'SCHOOL_EMAIL_DOMAIN']) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use('/dev-emails', express.static(localMailDirectory));
app.use('/api/auth', authRouter);
app.use('/api/announcements', announcementRouter);
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong.' });
});

Promise.all([initialiseDatabase(), initialiseLocalMailInbox()]).then(() => app.listen(process.env.PORT ?? 3000, () => console.log('FindIt API is running.'))).catch((error) => {
  console.error('Database initialisation failed:', error);
  process.exit(1);
});
