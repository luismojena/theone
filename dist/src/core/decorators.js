import { sleep } from '../utils.js';
/**
 * Modern Stage 3 Decorator for wrapping asynchronous platform methods with a retry loop.
 */
export function Retry(maxRetries = 3) {
    return function (originalMethod, context) {
        if (context.kind !== 'method')
            throw new Error('Retry decorator can only be used on methods');
        return async function replacementMethod(...args) {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await originalMethod.apply(this, args);
                }
                catch (err) {
                    console.warn(`[${this.platformName || 'System'}] Attempt ${attempt}/${maxRetries} network error: ${err.message}`);
                    if (attempt === maxRetries) {
                        console.error(`\nWe have tried ${maxRetries} times. The website might be down.\n`);
                        throw new Error('WEBSITE_DOWN');
                    }
                    await sleep(2000 * attempt);
                }
            }
        };
    };
}
