/**
 * remark-prism 1.3.6 (MIT, https://github.com/sergioramos/remark-prism) without its runtime
 * filesystem, `vm` and jsdom, so blog posts can be rendered on Cloudflare Workers, where ISR
 * re-renders them. The output is the same: the plugin logic is unchanged, and the highlighter
 * runs the same Prism sources (inlined at build time into lib/generated/prism.js, see
 * scripts/generate-content.mjs) and post-processes and parses their HTML the same way.
 *
 * Only the defaults this site uses are kept: no Prism plugins (remark-prism's `plugins` option).
 */
import classNames from 'classnames';
import { CssSelectorParser } from 'css-selector-parser';
import escapeHtml from 'escape-html';
import rangeParser from 'parse-numeric-range';
import parse5 from 'parse5';
import htmlparser2Adapter from 'parse5-htmlparser2-tree-adapter';
import map from 'unist-util-map';
import { createPrism, PRISM_LANGUAGES } from 'lib/generated/prism';

type Options = { transformInlineCode?: boolean };

/** The parts of Prism the highlighter uses. */
type Prism = {
  languages: Record<string, unknown>;
  highlight: (code: string, grammar: unknown, language: string) => string;
  util: { encode: (code: string) => string };
};
/** A node of the htmlparser2 tree parse5 builds. */
type ParsedNode = { type: string; name?: string; attribs?: Record<string, string>; data?: string; children?: ParsedNode[] };
/** A hast node, with the mdast `data.h*` fields remark-html renders it from. */
type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  data?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};
/** The mdast (or hast) nodes the plugin looks at. */
type CodeNode = {
  type: string;
  tagName?: string;
  lang?: string;
  value?: string;
  properties?: { className?: string[] };
  children?: { type: string; value?: string }[];
};

// --- remark-prism/src/highlight.js ------------------------------------------------------------

/**
 * What remark-prism's jsdom `Prism.highlightElement(code)` left in `code.innerHTML`, before its
 * line post-processing: Prism.highlight's markup, or the escaped code when Prism has no grammar.
 * The language is read from the element's first `language-*` class, lowercased, as Prism does.
 */
const highlightedHTML = (prism: Prism, value: string, attrs: Record<string, string>) => {
  const match = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i.exec(attrs.class ?? '');
  const language = match ? match[1].toLowerCase() : 'none';
  const grammar = prism.languages[language];
  if (!value) return '';
  const html = grammar ? prism.highlight(value, grammar, language) : prism.util.encode(value);
  // jsdom parsed this into the element and serialized it back; HTML parsing turns CR LF and lone CR into LF.
  return html.replace(/\r\n?/g, '\n');
};

const domHighlight = (prism: Prism, value: string, attrs: Record<string, string> = {}, range: number[] = []) => {
  const MULTILINE_TOKEN_SPAN = /<span class="token ([^"]+)">[^<]*\n[^<]*<\/span>/g;

  return highlightedHTML(prism, value, attrs)
    .replace(MULTILINE_TOKEN_SPAN, (match: string, token: string) => {
      return match.replace(/\n/g, `</span>\n<span class="token ${token}">`);
    })
    .split(/\n/)
    .reduce((memo: string, line: string, idx: number) => {
      return memo.concat(
        range.includes(idx + 1) ? `<span class="remark-highlight-code-line">${line}\n</span>` : `${line}\n`
      );
    }, '');
};

const deserialize = (html: string) => {
  const document = parse5.parse(html, {
    treeAdapter: htmlparser2Adapter
  });

  const toHast = ({ type, name, attribs = {}, data: value, children = [] }: ParsedNode): HastNode => {
    const { class: className = '', ...attrs } = attribs;

    const _children = children.map(toHast);
    const properties = {
      ...attrs,
      className: className.split(/\s/).filter(Boolean)
    };

    return {
      type: type === 'tag' ? 'element' : 'text',
      value,
      tagName: name,
      data: {
        hName: name,
        hProperties: properties,
        hChildren: _children
      },
      properties,
      children: _children
    };
  };

  const root = (document as ParsedNode).children.pop();
  return root.children.find(({ name }) => name === 'body').children.map(toHast);
};

const createHighlighter = () => {
  const prism = createPrism() as Prism;

  return ({ lang, value, attrs, range = [] }: { lang: string; value: string; attrs: Record<string, string>; range?: number[] }) => {
    const fallback = () => {
      return [
        {
          type: 'text',
          value: escapeHtml(value)
        }
      ];
    };

    if (!PRISM_LANGUAGES.includes(lang.replace(/^diff-/, '')) && lang !== 'treeview') {
      return fallback();
    }

    return deserialize(domHighlight(prism, value, attrs, range));
  };
};

// --- remark-prism/src/index.js ----------------------------------------------------------------

const h = (type: string, attrs: Record<string, unknown> = {}, children: HastNode[] = []): HastNode => {
  return {
    type: 'element',
    tagName: type,
    data: {
      hName: type,
      hProperties: attrs,
      hChildren: children
    },
    properties: attrs,
    children
  };
};

const selectorToAttrs = (selector: string) => {
  const parser = new CssSelectorParser();
  const { rule } = parser.parse(selector) as { rule: { attrs?: { name: string; operator?: string; value: string }[] } };
  const { attrs = [] } = rule;

  return attrs.reduce((memo: Record<string, string>, { name, operator, value }) => {
    if (operator !== '=') {
      return memo;
    }

    const isClass = name === 'class';
    const newValue = isClass ? [memo[name] || ''].concat(value).join(' ') : value;

    return Object.assign(memo, {
      [name]: newValue
    });
  }, {});
};

const parseLang = (str: string) => {
  const match = (regexp: RegExp) => {
    const m = (str || '').match(regexp);
    return Array.isArray(m) ? m.filter(Boolean) : [];
  };

  const [lang = 'unknown'] = match(/^[a-zA-Z\d-]*/g);
  const selectors = match(/\[(.*?)\]/g).join('');

  const attrs = selectors.length ? selectorToAttrs(selectors) : {};
  const className = classNames(`language-${lang}`, attrs.class);
  const { legend = '', ...restAttrs } = attrs;

  const range = rangeParser(
    match(/\{(.*?)\}$/g)
      .join(',')
      .replace(/^\{/, '')
      .replace(/\}$/, '')
  );

  return {
    lang,
    legend,
    range,
    attrs: {
      ...restAttrs,
      class: className
    }
  };
};

const remarkPrism = (options: Options = {}) => (tree: CodeNode) => {
  const highlight = createHighlighter();
  const { transformInlineCode = false } = options;

  return map(tree, (node: CodeNode) => {
    const { type, tagName } = node;

    if (!['code', 'inlineCode'].includes(type) && !['code', 'inlineCode'].includes(tagName)) {
      return node;
    }

    if ((type === 'inlineCode' && !transformInlineCode) || (type === 'tagName' && !transformInlineCode)) {
      return node;
    }

    const { value, properties = {}, children = [] } = node;
    const { className: classNameArr = [] } = properties;
    const langClassName = classNameArr.map((lang: string) => lang.replace(/language-/, '')).join(' ');

    const langToken = node.lang || langClassName;
    const { lang = 'unknown', attrs, legend, range } = parseLang(langToken);
    const { class: className = '', ...restAttrs } = attrs;

    const code = h(
      'code',
      { className: `language-${lang}` },
      highlight({
        lang,
        value:
          value ||
          children
            .filter(({ type }) => type === 'text')
            .map(({ value }) => value)
            .pop(),
        attrs,
        range
      })
    );

    const pre = h(
      'div',
      { className: `remark-highlight` },
      [
        h(
          'pre',
          {
            ...restAttrs,
            className: className.split(/\s/)
          },
          [code]
        ),
        legend ? h('legend', {}, [{ type: 'text', value: legend }]) : null
      ].filter(Boolean)
    );

    return /^inline/.test(type) ? code : pre;
  });
};

export default remarkPrism;
