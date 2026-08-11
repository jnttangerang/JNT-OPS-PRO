import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000');
  
  // Wait a bit for initial render
  await new Promise(r => setTimeout(r, 2000));
  
  // Login as admin
  await page.type('input[type="text"]', 'admin1');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load
  await new Promise(r => setTimeout(r, 3000));
  
  await browser.close();
})();
