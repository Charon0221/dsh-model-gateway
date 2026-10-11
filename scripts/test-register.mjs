import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  return specifier === '@deepseek-ai/dsh-client-ui-primitives'
    ? { url: new URL('../test-results/primitives.cjs', import.meta.url).href, shortCircuit: true }
    : next(specifier, context);
} });
