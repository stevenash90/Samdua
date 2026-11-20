const test = require('node:test');
const assert = require('node:assert');
const { clientIp } = require('../../src/platform/client-ip');
const req = (headers, addr = '10.0.0.5') => ({ headers, socket: { remoteAddress: addr } });

test('không chạy sau proxy: dùng địa chỉ socket, bỏ qua header (người dùng tự ghi được)', () => {
  assert.strictEqual(clientIp(req({ 'x-forwarded-for': '1.2.3.4' }), {}), '10.0.0.5');
  assert.strictEqual(clientIp(req({}, '::ffff:127.0.0.1'), {}), '127.0.0.1');
});
test('trên Render: ưu tiên CF-Connecting-IP, rồi phần tử cuối X-Forwarded-For', () => {
  const env = { RENDER: 'true' };
  assert.strictEqual(clientIp(req({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }), env), '203.0.113.9');
  assert.strictEqual(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 198.51.100.7' }), env), '198.51.100.7');   // 6.6.6.6 là IP giả người dùng tự chèn
  assert.strictEqual(clientIp(req({ 'cf-connecting-ip': 'rác' }), env), '10.0.0.5');
  assert.strictEqual(clientIp(req({ 'x-forwarded-for': '6.6.6.6' }), { RENDER: 'true', TRUST_PROXY: '0' }), '10.0.0.5');
});
