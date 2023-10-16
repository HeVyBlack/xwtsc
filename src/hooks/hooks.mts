import { env } from 'process';
import { HookLoader } from './hook.loader.js';
import { HookResolver } from './hook.resolver.js';

const hookLoader = new HookLoader(env);
export const load = hookLoader.load.bind(hookLoader);

const hookResolver = new HookResolver(env);
export const resolve = hookResolver.resolve.bind(hookResolver);
