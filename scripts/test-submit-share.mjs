import assert from 'node:assert/strict';
import {DISTRIBUTORS} from '../src/lib/distributors.ts';
const base='http://localhost:3002';
const data={name:'QA share form',team:DISTRIBUTORS[0],facebookUrl:'https://www.facebook.com/share/194WQLJnAd/',consent:true};
async function submit(body){return fetch(base+'/api/submit',{method:'POST',headers:{'Content-Type':'application/json',origin:base},body:JSON.stringify(body)});}
const first=await submit(data);assert.equal(first.status,201,await first.text());
const repeat=await submit({...data,facebookUrl:data.facebookUrl+'?mibextid=test'});
assert.equal(repeat.status,409);const error=(await repeat.json()).error;
assert.match(error,/đã được đăng ký/);assert.doesNotMatch(error,/API key|lượt quét/);
const invalid=await submit({...data,facebookUrl:'https://www.facebook.com/profile'});assert.equal(invalid.status,400);
console.log('PASS actual submit API: mobile share accepted, normalized duplicate rejected clearly, profile rejected.');
