import MarkdownIt from 'markdown-it';
import { defaultDirectives } from 'myst-directives';
import { defaultRoles } from 'myst-roles';
import type { Plugin } from 'unified';
import { VFile } from 'vfile';
import { MARKDOWN_IT_CONFIG } from './config.js';
import { tokensToMyst } from './tokensToMyst.js';
import {
  mathPlugin,
  convertFrontMatter,
  frontMatterPlugin,
  colonFencePlugin,
  mystBlockPlugin,
  footnotePlugin,
  mystPlugin,
  deflistPlugin,
  tasklistPlugin,
  citationsPlugin,
} from './plugins.js';
import { applyDirectives } from './directives.js';
import { applyRoles } from './roles.js';
import type { AllOptions } from './types.js';
import type { GenericParent } from 'myst-common';

type Options = Partial<AllOptions>;

export const defaultOptions: Omit<AllOptions, 'vfile'> = {
  markdownit: {
    html: true,
  },
  extensions: {
    smartquotes: true,
    colonFences: true,
    frontmatter: true,
    math: true,
    footnotes: true,
    citations: true,
    deflist: true,
    tasklist: true,
    tables: true,
    blocks: true,
  },
  mdast: {},
  directives: defaultDirectives,
  roles: defaultRoles,
};

function parseOptions(opts?: Options): AllOptions {
  const parsedOpts = {
    vfile: opts?.vfile ?? new VFile(),
    mdast: { ...defaultOptions.mdast, ...opts?.mdast },
    markdownit: { ...defaultOptions.markdownit, ...opts?.markdownit },
    extensions: { ...defaultOptions.extensions, ...opts?.extensions },
    directives: [...defaultOptions.directives, ...(opts?.directives ?? [])],
    roles: [...defaultOptions.roles, ...(opts?.roles ?? [])],
  };
  return parsedOpts;
}

export function createTokenizer(opts?: Options) {
  const parsedOpts = parseOptions(opts);
  const { extensions, markdownit } = parsedOpts;
  const tokenizer = MarkdownIt(
    {
      ...MARKDOWN_IT_CONFIG,
      options: {
        ...MARKDOWN_IT_CONFIG.options,
        typographer: extensions.smartquotes ? true : false,
      },
    } as any,
    markdownit,
  );
  if (extensions.smartquotes) tokenizer.enable('smartquotes');
  if (extensions.tables) tokenizer.enable('table');
  if (extensions.colonFences) tokenizer.use(colonFencePlugin);
  if (extensions.frontmatter) tokenizer.use(frontMatterPlugin, () => ({})).use(convertFrontMatter);
  if (extensions.blocks) tokenizer.use(mystBlockPlugin);
  if (extensions.footnotes) tokenizer.use(footnotePlugin).disable('footnote_inline'); // not yet implemented in myst-parser
  if (extensions.citations) tokenizer.use(citationsPlugin);
  tokenizer.use(mystPlugin);
  if (extensions.math) tokenizer.use(mathPlugin, extensions.math);
  if (extensions.deflist) tokenizer.use(deflistPlugin);
  if (extensions.tasklist) tokenizer.use(tasklistPlugin);
  return tokenizer;
}

export function mystParse(content: string, opts?: Options) {
  const { vfile } = opts || {};
  const parsedOpts = parseOptions(opts);
  const tokenizer = createTokenizer(parsedOpts);
  const tree = tokensToMyst(tokenizer.parse(content, { vfile }), parsedOpts.mdast);
  applyDirectives(tree, parsedOpts.directives, parsedOpts.vfile);
  applyRoles(tree, parsedOpts.roles, parsedOpts.vfile);
  return tree;
}

/**
 * MyST Parser as a Unified Plugin
 */
export const mystParser: Plugin<[Options?], string, GenericParent> = function mystParser() {
  this.Parser = (content: string, opts?: Options) => {
    return mystParse(content, opts);
  };
};
