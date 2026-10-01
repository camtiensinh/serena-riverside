import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const page=await browser.newPage({viewport:{width:1920,height:1080}});let phase=-1;
const entries=Array.from({length:5},(_,i)=>({id:String(i),name:`Người nhận giải ${i+1}`,author:`Facebook ${i+1}`,team:'MAPLELAND',likes:500-i*50,comments:40,shares:20,content:'Khơi dòng Serena Riverside. #SerenaRiverside #KickoffSerena',media:Array.from({length:51},(_,j)=>({thumbnail:`https://qa.invalid/${j}.png`}))}));
await page.route('https://qa.invalid/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><rect width="500" height="300" fill="#159cce"/><circle cx="250" cy="150" r="95" fill="#c2f3ff"/></svg>'}));
await page.route('**/api/public',r=>r.fulfill({json:{settings:{published:phase<0?null:entries,published_at:phase<0?null:new Date(Date.now()-phase).toISOString(),metric:'likes'},leaderboard:phase<0?[]:entries,server_time:new Date().toISOString()}}));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:3001/live');
await page.waitForTimeout(300);assert.equal(await page.locator('.award-post').count(),0);assert.equal(await page.locator('button,a').count(),0);
await page.screenshot({path:'artifacts/awards-waiting.png'});
phase=0;await page.locator('.awards-countdown').waitFor();assert.equal(await page.locator('.award-post').count(),0);
phase=10500;await page.getByRole('heading',{name:'HẠNG 5',exact:true}).waitFor();assert.equal(await page.locator('.revealed').count(),1);await page.getByText('+46',{exact:true}).waitFor();
phase=34500;await page.getByRole('heading',{name:'HẠNG 1',exact:true}).waitFor();assert.equal(await page.locator('.revealed').count(),5);
await page.screenshot({path:'artifacts/awards-top5.png',animations:'disabled'});
phase=41000;await page.waitForTimeout(1200);await page.getByText('VINH DANH TOP 5',{exact:true}).waitFor();
await page.reload();await page.getByText('VINH DANH TOP 5',{exact:true}).waitFor();assert.equal(await page.locator('.awards-countdown').count(),0);
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
console.log('PASS waiting privacy, auto countdown, reveal 5 to 1, collage +46, podium, reload synchronization, no controls/errors.');
}finally{await browser.close()}
