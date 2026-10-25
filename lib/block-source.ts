import { promises as fs } from 'fs';
import path from 'path';
import Prism from 'prismjs';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import type { BlockMeta } from 'blocks/registry';

export type BlockFile = {
  path: string;
  language: string;
  code: string;
  /** Prism token markup, styled by components/theme/prism.tsx. */
  html: string;
  lines: number;
};

const LANGUAGES: Record<string, string> = { ts: 'typescript', tsx: 'tsx', js: 'jsx', jsx: 'jsx', css: 'css' };

/**
 * A block as one Markdown document: what it is, what it needs, and every file in full. Served at
 * /blocks/<name>.md for AI tools, and copied by the viewer's "Copy for AI".
 */
export function blockMarkdown(block: BlockMeta, files: BlockFile[], siteUrl: string): string {
  const fence = (file: BlockFile) => (file.code.includes('```') ? '````' : '```');
  const dependencies = block.dependencies?.length
    ? `## Dependencies\n\n\`\`\`bash\nnpm install ${block.dependencies.join(' ')}\n\`\`\`\n\n`
    : '';
  return `# ${block.title}

${block.description}

- Preview: ${siteUrl}/blocks/${block.category}/${block.name}
- Built with React, TypeScript and CSS modules. The default export of \`${files[0]?.path}\` is the block.

${dependencies}## Files

${files.map((file) => `- \`${block.name}/${file.path}\``).join('\n')}

${files
  .map((file) => `### ${block.name}/${file.path}\n\n${fence(file)}${file.language}\n${file.code}\n${fence(file)}`)
  .join('\n\n')}
`;
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
