import config from '../site.config.ts';
import { siteConfigSchema } from './cfg-schema';

export const cfg = siteConfigSchema.parse(config);
