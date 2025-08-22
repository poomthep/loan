import { writeFileSync } from 'fs';
import { join } from 'path';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const configContent = `
  export const SUPABASE_URL = "${url}";
  export const SUPABASE_ANON_KEY = "${key}";
`;

const outputPath = join(process.cwd(), 'public', 'config.js');
writeFileSync(outputPath, configContent, 'utf8');
console.log('Successfully created config.js in public directory.');