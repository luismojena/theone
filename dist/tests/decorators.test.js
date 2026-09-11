import { test, mock } from 'node:test';
import assert from 'node:assert';
import { Retry } from '../src/core/decorators.js';
class MockPlatform {
    platformName = 'MockPlatform';
    failCount = 0;
    @Retry(3)
    async fetchData(shouldFailCount) {
        if (this.failCount < shouldFailCount) {
            this.failCount++;
            throw new Error('Network error');
        }
        return 'success';
    }
}
test('Retry decorator succeeds immediately if no error', async () => {
    const platform = new MockPlatform();
    const result = await platform.fetchData(0);
    assert.strictEqual(result, 'success');
    assert.strictEqual(platform.failCount, 0);
});
test('Retry decorator recovers after failures', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const platform = new MockPlatform();
    const promise = platform.fetchData(2);
    let resolved = false;
    promise.then(() => resolved = true);
    while (!resolved) {
        mock.timers.tick(1000);
        await new Promise(setImmediate);
    }
    const result = await promise;
    assert.strictEqual(result, 'success');
    assert.strictEqual(platform.failCount, 2);
    mock.timers.reset();
});
test('Retry decorator throws WEBSITE_DOWN after max retries', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const platform = new MockPlatform();
    const promise = platform.fetchData(5);
    let resolved = false;
    let rejectedError = null;
    promise.then(() => resolved = true).catch(e => {
        resolved = true;
        rejectedError = e;
    });
    while (!resolved) {
        mock.timers.tick(1000);
        await new Promise(setImmediate);
    }
    assert.ok(rejectedError);
    assert.strictEqual(rejectedError.message, 'WEBSITE_DOWN');
    assert.strictEqual(platform.failCount, 3);
    mock.timers.reset();
});
