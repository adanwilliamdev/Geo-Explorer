import * as fs from 'node:fs';
import * as path from 'node:path';
import { VERSION } from '../src/version';

describe('versão', () => {
  test('src/version.ts está em sincronia com package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(VERSION).toBe(pkg.version);
  });
});
