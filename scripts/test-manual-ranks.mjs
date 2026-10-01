import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await browser.newPage();let rank=5;const entries=Array.from({length:5},(_,i)=>({id:String(i),name:'TEST '+(i+1),likes:50-i,comments:0,shares:0}));
await page.route('**/api/public',r=>r.fulfill({json:{settings:{display_mode:'results',display_rank:rank,display_started_at:'2026-01-01T00:00:00Z',metric:'likes'},leaderboard:entries,server_time:new Date().toISOString()}}));
await page.goto('https://serena-kickoff-arena.vercel.app/live');
for(const value of [5,4,3,2,1]){rank=value;await page.getByRole('heading',{name:'HẠNG '+value,exact:true}).waitFor();assert.equal(await page.locator('.revealed').count(),6-value);}
await page.waitForTimeout(11000);await page.getByRole('heading',{name:'HẠNG 1',exact:true}).waitFor();console.log('PASS: manual reveal 5-4-3-2-1 and selected rank stays on screen.');
}finally{await browser.close()}
