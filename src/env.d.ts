/// <reference path="../.astro/types.d.ts" />

declare module 'astro:transitions' {
	import type { ClientRouter as ClientRouterComponent } from 'astro/components';
	export const slide: import('astro').TransitionAnimation;
	export const fade: import('astro').TransitionAnimation;
	export const ClientRouter: typeof ClientRouterComponent;
}
