import { CommandMenu, type CommandMenuSkin } from 'components/command-menu/command-menu';
import styles from '../notebook.module.css';

const SKIN: Partial<CommandMenuSkin> = {
  trigger: styles.searchTrigger,
  kbd: styles.searchKbd,
  backdrop: styles.searchBackdrop,
  panel: styles.searchPanel,
  inputRow: styles.searchInputRow,
  input: styles.searchInput,
  list: styles.searchList,
  group: styles.searchGroup,
  item: styles.searchItem,
  empty: styles.searchEmpty,
  footer: styles.searchFooter,
  icon: styles.searchIcon
};

const SECTIONS = ['github', 'projects', 'work', 'notes', 'education', 'elsewhere'].map(
  (id) => ({ title: id, href: `/themes/notebook#${id}` })
);

export function NotebookSearch() {
  return <CommandMenu skin={SKIN} sections={SECTIONS} />;
}
