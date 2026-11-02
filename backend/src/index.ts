import { app } from './app';

// kept apart from app.ts so tests can use the app without opening a real port
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
