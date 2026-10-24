const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { createApp } = require('../src/app');

test('Session qua một proxy tin cậy: Secure trên HTTPS, HttpOnly, SameSite và Helmet', async () => {
  const config = { secret:'test-secret-not-used-in-deployment-123456789', secure:true, trustProxy:1 };
  const pool = { execute: async () => [[]] };
  const app = createApp({pool,config,sessionStore:new session.MemoryStore()});
  const response = await request(app).get('/login').set('X-Forwarded-Proto','https').expect(200);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie,/; Secure/);
  assert.match(cookie,/; HttpOnly/);
  assert.match(cookie,/; SameSite=Lax/);
  assert.equal(response.headers['x-content-type-options'],'nosniff');
  assert.ok(response.headers['content-security-policy'].includes("script-src 'self'"));
  assert.equal(response.headers['x-powered-by'],undefined);
});
test('trust proxy=1 lấy IP do proxy cuối cung cấp, không lấy mục giả ở đầu chuỗi', async () => {
  const app = express();
  app.set('trust proxy',1);
  app.get('/',(req,res)=>res.json({ip:req.ip}));
  const response = await request(app).get('/').set('X-Forwarded-For','203.0.113.9, 192.0.2.10').expect(200);
  assert.equal(response.body.ip,'192.0.2.10');
});
