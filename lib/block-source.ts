import { promises as fs } from 'fs';
import path from 'path';
import Prism from 'prismjs';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import { type BlockMeta, blockRegistryPath } from 'blocks/registry';

export type BlockFile = {
  path: string;
  language: string;
  code: string;
  /** Prism token markup, styled by components/theme/prism.tsx. */
  html: string;
  lines: number;
};

const LANGUAGES: Record<string, string> = { ts: 'typescript', tsx: 'tsx', js: 'jsx', mjs: 'jsx', jsx: 'jsx', css: 'css' };

/**
 * A block as one Markdown document: what it is, what it needs, and every file in full. Served at
 * /blocks/<name>.md for AI tools, which the viewer's "Open in" links point to.
 */
export function blockMarkdown(block: BlockMeta, files: BlockFile[], siteUrl: string): string {
  const fence = (file: BlockFile) => (file.code.includes('```') ? '````' : '```');
  const install = [
    block.dependencies?.length ? `npm install ${block.dependencies.join(' ')}` : '',
    block.devDependencies?.length ? `npm install -D ${block.devDependencies.join(' ')}` : ''
  ].filter(Boolean);
  const dependencies = install.length ? `## Dependencies\n\n\`\`\`bash\n${install.join('\n')}\n\`\`\`\n\n` : '';
  const assets = block.assets ? `## Assets\n\n${block.assets}\n\n` : '';
  return `# ${block.title}

${block.description}

- Preview: ${siteUrl}/blocks/${block.category}/${block.name}
- Built with React, TypeScript and CSS modules. The default export of \`${files[0]?.path}\` is the block.
- Install every file with the shadcn CLI: \`npx shadcn@latest add ${siteUrl}${blockRegistryPath(block)}\` (into \`${REGISTRY_DIR}/${block.name}/\`).

${dependencies}${assets}## Files

${files.map((file) => `- \`${block.name}/${file.path}\``).join('\n')}

${files
  .map((file) => `### ${block.name}/${file.path}\n\n${fence(file)}${file.language}\n${file.code}\n${fence(file)}`)
  .join('\n\n')}
`;
}

/** Where the shadcn CLI and v0 put a block's files in the project that installs it. */
const REGISTRY_DIR = 'components/blocks';

/** `movie-rack` → `MovieRack`: the name the generated page imports a block's default export as. */
const componentName = (name: string) => name.replace(/(^|-)([a-z0-9])/g, (_, __, letter: string) => letter.toUpperCase());

/**
 * A block as a shadcn registry item (https://ui.shadcn.com/schema/registry-item.json): its npm
 * dependencies and every file with its content, kept together in one folder because the files
 * import each other by relative path, plus a page that renders it. v0 opens that page; without
 * one it guesses which file is the component, and can pick a helper module with no default export.
 * Served at /r/<name>.json.
 */
export function blockRegistryItem(block: BlockMeta, files: BlockFile[]) {
  const entry = files[0]?.path.replace(/\.tsx?$/, '');
  const Component = componentName(block.name);
  const page = {
    path: `blocks/${block.name}/page.tsx`,
    type: 'registry:page',
    target: `app/blocks/${block.name}/page.tsx`,
    content: `import ${Component} from '@/${REGISTRY_DIR}/${block.name}/${entry}';\n\nexport default function Page() {\n  return <${Component} />;\n}\n`
  };
  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: block.name,
    type: 'registry:block',
    title: block.title,
    description: block.description,
    dependencies: block.dependencies ?? [],
    devDependencies: block.devDependencies ?? [],
    files: [
      page,
      ...files.map((file) => ({
        path: `blocks/${block.name}/${file.path}`,
        type: 'registry:file',
        target: `${REGISTRY_DIR}/${block.name}/${file.path}`,
        content: file.code
      }))
    ],
    ...(block.assets ? { docs: block.assets } : {})
  };
}

/** Reads and highlights a block's files. Server only: call it from getStaticProps. */
export async function getBlockFiles(block: BlockMeta): Promise<BlockFile[]> {
  return Promise.all(
    block.files.map(async (file) => {
      const code = (await fs.readFile(path.join(process.cwd(), 'blocks', block.name, file), 'utf8')).trimEnd();
      const extension = path.extname(file).slice(1);
      const language = LANGUAGES[extension] ?? 'tsx';
      return {
        path: file,
        language: extension,
        code,
        html: Prism.highlight(code, Prism.languages[language], language),
        lines: code.split('\n').length
      };
    })
  );
}
