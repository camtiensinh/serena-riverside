import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const context=await browser.newContext();const base='https://serena-kickoff-arena.vercel.app';
const login=await context.request.post(base+'/api/login',{headers:{origin:base},data:{password:process.env.ADMIN_PASSWORD}});assert.equal(login.status(),200);
const page=await context.newPage();let reads=0,ticks=0;page.on('request',r=>{if(r.url().endsWith('/api/admin'))reads++;if(r.url().endsWith('/api/tick'))ticks++;});
await page.goto(base+'/admin');await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).waitFor();
await page.waitForTimeout(12000);assert.equal(reads,1);assert.equal(ticks,0);
const response=page.waitForResponse(r=>r.url().endsWith('/api/admin'));
await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).click();await response;assert.equal(reads,2);
console.log('PASS: idle admin reads once in 12s, zero tick calls, manual refresh adds exactly one read.');
}finally{await browser.close()}
