'use client';

import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { BY_NAME, partsOf, type Country } from './globe';
import styles from './world-globe.module.css';

/**
 * Countries for a query: the one named exactly first ("Niger" before "Nigeria"), then those whose name
 * starts with it, then those that contain it. An empty query lists them all.
 */
function matchesOf(query: string): Country[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return BY_NAME;
  const rank = (country: Country) => {
    const name = country.name.toLowerCase();
    return name === wanted ? 0 : name.startsWith(wanted) ? 1 : name.includes(wanted) ? 2 : 3;
  };
  return BY_NAME.filter((country) => rank(country) < 3).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** The name with the part that matches the query set in the strong tone. */
function Name({ name, query }: { name: string; query: string }) {
  const wanted = query.trim().toLowerCase();
  const at = wanted ? name.toLowerCase().indexOf(wanted) : -1;
  if (at < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <mark className={styles.findMark}>{name.slice(at, at + wanted.length)}</mark>
      {name.slice(at + wanted.length)}
    </>
  );
}

interface Props {
  /** Pull this country out and turn it to face the viewer. */
  onFind: (index: number) => void;
  /** More controls set after the button, such as Put back. */
  children?: ReactNode;
}

/**
 * Find a country: a text field with its own list (a combobox), in the block's own look rather than the
 * browser's. Typing filters the list; ↑ and ↓ move through it, Enter or a click pulls the country out,
 * and Escape closes the list.
 */
export function CountryFind({ onFind, children }: Props) {
  const id = useId().replace(/:/g, '');
  const listId = `${id}-list`;
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [missing, setMissing] = useState(false);
  const matches = useMemo(() => matchesOf(query), [query]);

  // Keep the active option in view as the arrow keys move it.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (country: Country | undefined) => {
    setMissing(!country);
    if (!country) return;
    setQuery(country.name);
    setOpen(false);
    onFind(country.index);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    choose(open ? matches[active] : matches[0]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (matches.length ? (current + step + matches.length) % matches.length : 0));
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActive(Math.max(0, matches.length - 1));
    }
  };

  return (
    <form className={styles.group} onSubmit={submit} role="search">
      <label className={styles.groupLabel} htmlFor="world-globe-find">
        Find
      </label>
      <div className={styles.findBox}>
        <input
          ref={input}
          id="world-globe-find"
          className={styles.find}
          value={query}
          placeholder="A country"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-option-${matches[active].index}` : undefined}
          aria-invalid={missing || undefined}
          onFocus={(event) => {
            // The last country found is selected, so typing replaces it.
            event.currentTarget.select();
            setOpen(true);
          }}
          onClick={(event) => {
            // Still focused after a country was found: a click starts a new search the same way.
            if (open) return;
            event.currentTarget.select();
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setMissing(false);
            setOpen(true);
          }}
        />
        {open ? (
          // Pressing on the list must not blur the field first, or it would close before the click lands.
          <ul ref={list} id={listId} className={styles.findList} role="listbox" aria-label="Countries" onMouseDown={(event) => event.preventDefault()}>
            {matches.length ? (
              matches.map((country, k) => {
                const parts = partsOf(country);
                return (
                  <li
                    key={country.index}
                    id={`${id}-option-${country.index}`}
                    data-index={k}
                    role="option"
                    aria-selected={k === active}
                    className={styles.findOption}
                    onMouseMove={() => k !== active && setActive(k)}
                    onClick={() => choose(country)}
                  >
                    <span className={styles.findName}>
                      <Name name={country.name} query={query} />
                    </span>
                    {parts ? <span className={styles.findParts}>{parts} parts</span> : null}
                  </li>
                );
              })
            ) : (
              <li className={styles.findEmpty} role="presentation">
                No country matches “{query.trim()}”
              </li>
            )}
          </ul>
        ) : null}
      </div>
      <button type="submit" className={styles.send}>
        Pull out
      </button>
      {children}
    </form>
  );
}
