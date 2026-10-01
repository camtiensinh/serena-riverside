import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'https://serena-kickoff-arena.vercel.app';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext();
 const login=await context.request.post(base+'/api/login',{headers:{origin:base},data:{password:process.env.ADMIN_PASSWORD}});
 assert.equal(login.status(),200);
 const page=await context.newPage();await page.goto(base+'/admin');
 await page.getByRole('button',{name:/Quản lý bài dự thi/}).click();
 await page.getByRole('button',{name:'Import Excel',exact:true}).click();
 await page.getByRole('heading',{name:'Import bài dự thi từ Excel',exact:true}).waitFor();
 assert.equal(await page.getByText('Link trùng trong file hoặc đã có trong database sẽ được bỏ qua.',{exact:false}).count(),1);
 assert.equal(await page.locator('input[type=file][accept*="spreadsheetml"]').count(),1);
 console.log('PASS: production CMS shows Excel import and duplicate-protection guidance.');
}finally{await browser.close();}
