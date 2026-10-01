import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
try {
 const page = await browser.newPage({viewport:{width:1920,height:1080}});
 let mode='waiting', rank=null, started=new Date().toISOString();
 const entries=Array.from({length:5},(_,i)=>({id:String(i),name:'TEST '+(i+1),team:'SERENA',likes:500-i*50,comments:10,shares:5,media:[]}));
 await page.route('**/api/public',r=>r.fulfill({json:{settings:{display_mode:mode,display_rank:rank,display_started_at:started,metric:'likes',hashtags:['SerenaRiverside','KickoffSerena'],time_filter_enabled:false},leaderboard:entries,server_time:new Date().toISOString()}}));
 await page.goto(base);
 assert.equal(await page.locator('a[href*="admin"],a[href*="live"]').count(),0);
 assert.equal(await page.locator('svg image').getAttribute('href'),'/logo-black-original.png');
 await page.screenshot({path:'artifacts/form-new-logo.png'});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1920,height:1080});
 await page.goto(base+'/live');
 assert.equal(await page.locator('.awards-header image').getAttribute('href'),'/logo-gold-original.png');
 assert.equal((await page.locator('.awards-header').innerText()).trim(),'');
 mode='auto';started=new Date(Date.now()-11000).toISOString();
 await page.waitForTimeout(2200);
 assert.equal(await page.locator('.award-feature').count(),0);
 assert.equal(await page.locator('.awards-waiting').count(),1);
 mode='results';
 for(const value of [5,4,3,2,1]){rank=value;await page.getByRole('heading',{name:'HẠNG '+value,exact:true}).waitFor();}
 rank=3;await page.getByRole('heading',{name:'HẠNG 3',exact:true}).waitFor();
 await page.waitForTimeout(11000);
 await page.getByRole('heading',{name:'HẠNG 3',exact:true}).waitFor();
 await page.screenshot({path:'artifacts/report-new-logo.png'});
 console.log('PASS form links/logo/mobile; report transparent logo/header; countdown waits; manual ranks hold. No Apify calls.');
}finally{await browser.close();}
