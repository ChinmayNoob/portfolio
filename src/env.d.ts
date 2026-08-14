/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
	readonly ASTRO_DB_REMOTE_URL: string;
	readonly ASTRO_DB_APP_TOKEN: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module 'astro:transitions' {
	import type { ClientRouter as ClientRouterComponent } from 'astro/components';
	export const slide: import('astro').TransitionAnimation;
	export const fade: import('astro').TransitionAnimation;
	export const ClientRouter: typeof ClientRouterComponent;
}
