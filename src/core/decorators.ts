import { sleep } from "../utils.js";
import { isError } from "./typeGuards.js";

/**
 * Modern Stage 3 Decorator for wrapping asynchronous platform methods with a retry loop.
 */
export function Retry(maxRetries: number = 3) {
	// biome-ignore lint/complexity/noBannedTypes: Decorators require Function fallback
	return (originalMethod: Function, context: ClassMethodDecoratorContext) => {
		if (context.kind !== "method") throw new Error("Retry decorator can only be used on methods");

		// biome-ignore lint/suspicious/noExplicitAny: Decorator bindings require any
		return async function replacementMethod(this: any, ...args: any[]) {
			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					return await originalMethod.apply(this, args);
				} catch (err: unknown) {
					console.warn(
						// biome-ignore lint/suspicious/noExplicitAny: Safely bypass generic typing constraints for platformName
						`[${(this as any).platformName || "System"}] Attempt ${attempt}/${maxRetries} network error: ${isError(err) ? err.message : String(err)}`,
					);
					if (attempt === maxRetries) {
						console.error(`\nWe have tried ${maxRetries} times. The website might be down.\n`);
						throw new Error("WEBSITE_DOWN");
					}
					await sleep(2000 * attempt);
				}
			}
		};
	};
}
