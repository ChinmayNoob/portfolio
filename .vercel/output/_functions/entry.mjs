import { renderers } from './renderers.mjs';
import { c as createExports } from './chunks/entrypoint_C9AfULUa.mjs';
import { manifest } from './manifest_Bgq44kMR.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/404.astro.mjs');
const _page2 = () => import('./pages/api/check-embeddable.astro.mjs');
const _page3 = () => import('./pages/blogroll.astro.mjs');
const _page4 = () => import('./pages/bookmarks.astro.mjs');
const _page5 = () => import('./pages/bookshelf.astro.mjs');
const _page6 = () => import('./pages/directory.astro.mjs');
const _page7 = () => import('./pages/now.astro.mjs');
const _page8 = () => import('./pages/posts.astro.mjs');
const _page9 = () => import('./pages/posts/_---slug_.astro.mjs');
const _page10 = () => import('./pages/projects.astro.mjs');
const _page11 = () => import('./pages/robots.txt.astro.mjs');
const _page12 = () => import('./pages/rss.xml.astro.mjs');
const _page13 = () => import('./pages/zibaldone.astro.mjs');
const _page14 = () => import('./pages/_id_.astro.mjs');
const _page15 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/.pnpm/astro@5.11.0_@types+node@22_51e65c00b5995254bc3f78e8adf101e1/node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/404.astro", _page1],
    ["src/pages/api/check-embeddable.ts", _page2],
    ["src/pages/blogroll.astro", _page3],
    ["src/pages/bookmarks.astro", _page4],
    ["src/pages/bookshelf.astro", _page5],
    ["src/pages/directory.astro", _page6],
    ["src/pages/now.astro", _page7],
    ["src/pages/posts/index.astro", _page8],
    ["src/pages/posts/[...slug].astro", _page9],
    ["src/pages/projects.astro", _page10],
    ["src/pages/robots.txt.ts", _page11],
    ["src/pages/rss.xml.ts", _page12],
    ["src/pages/zibaldone.astro", _page13],
    ["src/pages/[id].astro", _page14],
    ["src/pages/index.astro", _page15]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "b127cb58-e736-4b71-8cf4-dd28e2a89636",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;

export { __astrojsSsrVirtualEntry as default, pageMap };
