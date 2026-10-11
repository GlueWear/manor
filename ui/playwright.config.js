import {defineConfig} from '@playwright/test';
const executablePath = process.env.PLAYWRIGHT_CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
export default defineConfig({testDir: './test/browser', workers: 1, use: {baseURL: 'http://127.0.0.1:5184', launchOptions: {executablePath}}, webServer: [
  {command: 'node test/mock-host.mjs', url: 'http://127.0.0.1:8095/health', reuseExistingServer: false},
  {command: 'npm run dev -- --port 5184', url: 'http://127.0.0.1:5184', env: {MANOR_HOST: 'http://127.0.0.1:8095'}, reuseExistingServer: false},
]});
