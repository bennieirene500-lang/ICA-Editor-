import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();
const checks = {
  OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY?.trim()),
  SUPABASE_URL: Boolean(process.env.SUPABASE_URL?.trim()),
  SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY?.trim()),
  SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY?.trim()),
  FFMPEG: spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
};
for (const [name, ready] of Object.entries(checks)) console.log(`${name}: ${ready ? 'Ready' : 'Missing'}`);
if (Object.values(checks).some(ready => !ready)) process.exitCode = 1;
