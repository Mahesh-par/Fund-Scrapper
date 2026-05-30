import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean) as string[];

const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));

if (!chromePath) {
  console.error('Chrome was not found. Set CHROME_PATH in .env to your chrome.exe path.');
  process.exit(1);
}

const userDataDir = path.resolve('./user_data');
fs.mkdirSync(userDataDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    `--user-data-dir=${userDataDir}`,
    '--profile-directory=Default',
    '--no-first-run',
    '--no-default-browser-check',
    'https://chat.deepseek.com/',
  ],
  {
    detached: true,
    stdio: 'ignore',
  },
);

chrome.unref();

console.log('====================================================');
console.log('CHROME IS OPEN!');
console.log('Please log in to DeepSeek manually with Google.');
console.log('After login succeeds, close that Chrome window.');
console.log('Your session will be saved in the /user_data folder.');
console.log('====================================================');
