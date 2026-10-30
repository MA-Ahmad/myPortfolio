import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getBlock } from 'blocks/registry';
import { cn } from 'lib/cn';
import { MIDNIGHT_CONTENT } from '../content';
import styles from '../midnight.module.css';

export function ProjectCards() {
  return (
    <>
      <p className={styles.sectionLine}>
        Recent <span className={styles.strong}>builds</span>
      </p>
      <div className={styles.cards}>
        {MIDNIGHT_CONTENT.projects.map(({ block: name, text }) => {
          const block = getBlock(name)!;
          return (
            <Link
              key={name}
              className={styles.card}
              href={`/blocks/${block.category}/${block.name}`}
            >
              {[0, 1, 2, 3].map((corner) => (
                <span key={corner} className={styles.corner} aria-hidden />
              ))}
              <span className={styles.cardPreview} aria-hidden>
                {block.images ? (
                  <img src={block.images.og} alt="" width={1200} height={630} loading="lazy" />
                ) : (
                  <span className={styles.cardMark}>{block.title}</span>
                )}
              </span>
              <span className={styles.cardHead}>
                <span>{block.title}</span>
                <span className={styles.cardMeta}>
                  Interactive <ArrowUpRight size={13} />
                </span>
              </span>
              <p className={cn(styles.cardText, styles.mono)}>{text}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
