import { cn } from 'lib/cn';
import styles from '../midnight.module.css';

export function SkillChip({
  name,
  image,
  inline
}: {
  name: string;
  image?: string;
  inline?: boolean;
}) {
  return (
    <span className={cn(styles.chip, inline && styles.chipInline)}>
      {image ? (
        <img src={image} alt="" loading="lazy" />
      ) : (
        <span className={styles.chipLetter} aria-hidden>
          {name.charAt(0)}
        </span>
      )}
      {name}
    </span>
  );
}
