import { Retry } from './decorators.js';
export class IAnimePlatform {
    defaultHeaders;
    constructor() {
        this.defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
    }
    /**
     * Atomic HTTP client method wrapped with our exponential backoff Retry decorator.
     * Automatically merges default headers like User-Agent and Cookies.
     */
    @Retry(3)
    async request(url, options = {}) {
        const finalOptions = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...(options.headers || {})
            }
        };
        const res = await fetch(url, finalOptions);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return res;
    }
}
