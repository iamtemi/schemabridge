import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_ClIKp9ZZ.mjs';
import { manifest } from './manifest_DALYaeRZ.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/404.astro.mjs');
const _page2 = () => import('./pages/api/convert.astro.mjs');
const _page3 = () => import('./pages/playground.astro.mjs');
const _page4 = () => import('./pages/_---slug_.astro.mjs');
const pageMap = new Map([
    ["../../node_modules/.pnpm/astro@5.16.3_@types+node@22.19.1_@vercel+functions@2.2.13_db0@0.3.4_ioredis@5.8.2_jiti@_2f3b69fecf374639edf4932ae550c942/node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["../../node_modules/.pnpm/@astrojs+starlight@0.37.0_astro@5.16.3_@types+node@22.19.1_@vercel+functions@2.2.13_db0_5a8f7fb83fe2497ea59566c5f12ec9b0/node_modules/@astrojs/starlight/routes/static/404.astro", _page1],
    ["src/pages/api/convert.ts", _page2],
    ["src/pages/playground.astro", _page3],
    ["../../node_modules/.pnpm/@astrojs+starlight@0.37.0_astro@5.16.3_@types+node@22.19.1_@vercel+functions@2.2.13_db0_5a8f7fb83fe2497ea59566c5f12ec9b0/node_modules/@astrojs/starlight/routes/static/index.astro", _page4]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = {
    "middlewareSecret": "95d87dde-a2ef-41f6-9698-c2677f1a1dee",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
