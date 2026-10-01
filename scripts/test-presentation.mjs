import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await browser.newPage();let mode='waiting';const entry={id:'demo',name:'TEST',team:'TEST',likes:10,comments:1,shares:1};
await page.route('**/api/public',r=>r.fulfill({json:{settings:{published:[entry],published_at:'2026-01-01T00:00:00Z',display_mode:mode,display_started_at:new Date().toISOString(),metric:'likes'},leaderboard:[entry],server_time:new Date().toISOString()}}));
await page.goto('https://serena-kickoff-arena.vercel.app/live');await page.locator('.awards-waiting').waitFor();assert.equal(await page.locator('.award-post').count(),0);
mode='auto';await page.locator('.awards-countdown').waitFor();
mode='results';await page.locator('.award-post').waitFor();assert.equal(await page.locator('.awards-countdown').count(),0);
mode='waiting';await page.locator('.awards-waiting').waitFor();assert.equal(await page.locator('.award-post').count(),0);
mode='auto';await page.locator('.awards-countdown').waitFor();console.log('PASS: waiting → replay → results → waiting → replay, no page interaction required');
}finally{await browser.close()}
