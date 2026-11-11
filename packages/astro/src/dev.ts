import config from 'virtual:vvitrine/config';
import { siteKernel } from './runtime.ts';

/**
 * Loaded by the development server only (through Vite, so it reads the site's configuration like the pages do):
 * answers /__vvitrine/ requests with the plugins' development endpoints (US-153). A new kernel per request, so that
 * changes to the configuration, the layout and the content are always seen.
 */
export async function handleDevRequest(request: Request): Promise<Response | undefined> {
  return siteKernel(config).handleDevRequest(request);
}
