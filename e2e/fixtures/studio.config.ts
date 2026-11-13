/**
 * Studio fixture (e2e/studio.spec.ts): the demo site, with its content read from a copy (VVITRINE_STUDIO_CONTENT, made
 * by e2e/studio-server.mjs), so that saving in the tests never changes site/content.
 */
import markdownSource from '@vvitrine/source-markdown';
import yamlSource from '@vvitrine/source-yaml';
import config from '../../site/vvitrine.config.ts';

const folder = process.env.VVITRINE_STUDIO_CONTENT;
if (!folder) throw new Error('studio.config.ts reads VVITRINE_STUDIO_CONTENT: start it with e2e/studio-server.mjs.');
const at = (dir: string) => `${folder.replaceAll('\\', '/')}/${dir}`;

export default {
  ...config,
  plugins: [
    yamlSource({ dir: at(''), file: 'resume' }),
    markdownSource({ dir: at('projects') }),
    markdownSource({ dir: at('blog'), key: 'posts' }),
    ...config.plugins.filter((plugin) => plugin.kind !== 'source'),
  ],
};
