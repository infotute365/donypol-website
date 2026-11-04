import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, comparePassword } from '../src/lib/password.mjs';
test('password hashing stores a salt and never clear text',()=>{const input='some-long-secret-password!!';const a=hashPassword(input);const b=hashPassword(input);assert.notEqual(a,b);assert.equal(comparePassword(input,a),true);assert.equal(comparePassword('wrong-password',a),false);assert.equal(a.includes(input),false);});
