import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('CHO-132: .gitignore audit', () => {
  it('should ignore copy_audit.md and ensure COPY_AUDIT.md is not tracked in git', () => {
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf8');

    expect(content.toLowerCase()).toContain('copy_audit.md');

    // Verify git ls-files does not track COPY_AUDIT.md
    const tracked = execSync('git ls-files COPY_AUDIT.md copy_audit.md', { encoding: 'utf8' }).trim();
    expect(tracked).toBe('');
  });
});
