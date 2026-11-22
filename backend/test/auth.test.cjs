const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AuthGuard } = require('../dist/auth/auth.guard');
const { hashPassword, verifyPassword } = require('../dist/auth/auth.util');

const ALICE = '64b8f9e2c4a3b12d4e5f6789';
const hasStatus = (status) => (error) => error.getStatus?.() === status;

function makeContext(header = 'Basic Alice:secret-password-12345', ip = '127.0.0.1') {
  const request = {
    headers: { authorization: header },
    ip,
    method: 'GET',
    path: '/user/profile',
    query: {},
  };
  const headers = {};
  return {
    request,
    headers,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({
        setHeader: (name, value) => {
          headers[name] = value;
        },
      }),
    }),
  };
}

test('rejects existing accounts with null, empty, or missing credentials (bypass prevention)', async () => {
  for (const phone of [null, '', undefined]) {
    const guard = new AuthGuard({
      user: {
        findUnique: async () => ({ id: ALICE, name: 'Alice', phone, passwordHash: null }),
        create: async () => assert.fail('Login must not replace a missing credential with auto-registration'),
      },
    });
    const ctx = makeContext();
    await assert.rejects(guard.canActivate(ctx), hasStatus(401));
    assert.equal(ctx.request.user, undefined);
  }
});

test('registers new account with salted passwordHash when password is at least 15 characters', async () => {
  let createdData = null;
  const guard = new AuthGuard({
    user: {
      findUnique: async () => null,
      create: async ({ data }) => {
        createdData = data;
        return { id: ALICE, ...data };
      },
    },
  });

  const ctx = makeContext('Basic NewUser:long-secure-password-12345');
  const allowed = await guard.canActivate(ctx);
  assert.equal(allowed, true);
  assert.equal(ctx.request.user.name, 'NewUser');
  assert.ok(createdData.passwordHash.startsWith('scrypt$32768$8$3$'));
  assert.equal(await verifyPassword('long-secure-password-12345', createdData.passwordHash), true);
});

test('rejects new account registration when password is less than 15 characters', async () => {
  const guard = new AuthGuard({
    user: {
      findUnique: async () => null,
      create: async () => assert.fail('Should not create user with short password'),
    },
  });

  const ctx = makeContext('Basic ShortUser:short');
  await assert.rejects(guard.canActivate(ctx), hasStatus(401));
  assert.equal(ctx.request.user, undefined);
});

test('authenticates existing account with valid passwordHash', async () => {
  const hash = await hashPassword('correct-horse-battery-staple');
  const guard = new AuthGuard({
    user: {
      findUnique: async () => ({ id: ALICE, name: 'Alice', passwordHash: hash, phone: null }),
    },
  });

  const ctx = makeContext('Basic Alice:correct-horse-battery-staple');
  const allowed = await guard.canActivate(ctx);
  assert.equal(allowed, true);
  assert.deepEqual(ctx.request.user, { id: ALICE, name: 'Alice' });
});

test('rejects existing account when password does not match passwordHash', async () => {
  const hash = await hashPassword('correct-horse-battery-staple');
  const guard = new AuthGuard({
    user: {
      findUnique: async () => ({ id: ALICE, name: 'Alice', passwordHash: hash, phone: null }),
    },
  });

  const ctx = makeContext('Basic Alice:wrong-password-attempt');
  await assert.rejects(guard.canActivate(ctx), hasStatus(401));
  assert.equal(ctx.request.user, undefined);
});

test('migrates legacy account with plaintext phone password on successful login', async () => {
  let updatedData = null;
  const legacyPassword = 'legacy-phone-secret';
  const guard = new AuthGuard({
    user: {
      findUnique: async () => ({ id: ALICE, name: 'Alice', phone: legacyPassword, passwordHash: null }),
      updateMany: async ({ data }) => {
        updatedData = data;
        return { count: 1 };
      },
    },
  });

  const ctx = makeContext(`Basic Alice:${legacyPassword}`);
  const allowed = await guard.canActivate(ctx);
  assert.equal(allowed, true);
  assert.equal(ctx.request.user.name, 'Alice');
  assert.equal(updatedData.phone, null);
  assert.ok(updatedData.passwordHash.startsWith('scrypt$32768$8$3$'));
  assert.equal(await verifyPassword(legacyPassword, updatedData.passwordHash), true);
});

test('blocks any login attempt as FactBot', async () => {
  const guard = new AuthGuard({
    user: {
      findUnique: async () => assert.fail('Should not query DB for FactBot login'),
    },
  });

  const ctx = makeContext('Basic FactBot:any-password');
  await assert.rejects(guard.canActivate(ctx), hasStatus(401));
  assert.equal(ctx.request.user, undefined);
});

test('rate limits IP after 10 consecutive failures', async () => {
  const hash = await hashPassword('secret-valid-pass');
  const guard = new AuthGuard({
    user: {
      findUnique: async () => ({ id: ALICE, name: 'Alice', passwordHash: hash, phone: null }),
    },
  });

  const testIp = '192.168.1.100';
  for (let i = 0; i < 9; i++) {
    const ctx = makeContext('Basic Alice:wrong-pass', testIp);
    await assert.rejects(guard.canActivate(ctx), hasStatus(401));
  }

  // 10th failure
  const ctx10 = makeContext('Basic Alice:wrong-pass', testIp);
  await assert.rejects(guard.canActivate(ctx10), hasStatus(401));

  // 11th attempt is rate-limited with 429 even if password is correct
  const ctx11 = makeContext('Basic Alice:secret-valid-pass', testIp);
  await assert.rejects(guard.canActivate(ctx11), hasStatus(429));
});
