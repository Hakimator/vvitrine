import config from 'virtual:vvitrine/config';
import type { APIRoute, GetStaticPaths } from 'astro';
import { contentType, getSite } from '../runtime.ts';

/** Serves files produced by generator plugins (sitemap.xml, robots.txt, cv.pdf...). */
export const getStaticPaths: GetStaticPaths = async () => {
  const site = await getSite(config);
  return site.files.map((file) => ({
    params: { file: file.path.replace(/^\//, '') },
    props: { path: file.path, contents: file.contents },
  }));
};

export const GET: APIRoute = ({ props }) =>
  new Response(props.contents as BodyInit, { headers: { 'Content-Type': contentType(props.path as string) } });
