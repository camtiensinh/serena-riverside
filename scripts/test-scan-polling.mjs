import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();let reads=0,ticks=0,done=0,status='running';
 const scan=()=>({id:'fixture',status,done,errors:0,total:1000,created_at:'2026-09-10T00:00:00Z'});
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path==='/api/admin'){reads++;return r.fulfill({json:{settings:{hashtags:['SerenaRiverside','KickoffSerena'],metric:'likes',time_filter_enabled:false},submissions:[],keys:[],logs:[],scans:[scan()],history:[],jobs:[]}});}
  if(path==='/api/tick'){ticks++;return r.fulfill({json:{ok:true,progress:scan()}});}
  throw new Error('Unexpected API request '+path);
 });
 await page.goto((process.env.TEST_BASE_URL||'http://localhost:3000')+'/admin');
 await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).waitFor();
 await page.waitForTimeout(11000);
 assert.ok(ticks>=3);assert.equal(reads,2,'initial read plus first progress; no repeated full admin reads');
 done=50;await page.waitForTimeout(4000);assert.equal(reads,3);
 status='completed';done=1000;await page.waitForTimeout(4000);
 const stopped=ticks;await page.waitForTimeout(4000);assert.equal(ticks,stopped);
 console.log('PASS: lightweight progress polling, admin reload only on change, stop polling on completion.');
}finally{await browser.close();}
