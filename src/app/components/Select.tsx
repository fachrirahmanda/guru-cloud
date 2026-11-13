import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import ReactSelect, { type ControlProps, components } from 'react-select';
import { Icon } from './ui';

// Dropdown bergaya Silpasala. Tombol biasa membuka panel (popover native) yang berisi kotak
// pencarian dan daftar opsi. Panelnya react-select, jadi mengetik untuk memfilter, panah, Enter,
// dan Escape bekerja seperti biasa. Elemennya diberi class `rs__*` yang distyling di app.css.

export interface Option<V extends string = string> {
  value: V;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

function OptionLabel({ option, selected }: { option: Option; selected?: boolean }) {
  return (
    <span className="rs-label">
      {option.icon && <span className="rs-icon">{option.icon}</span>}
      <span className="rs-text" title={option.label}>{option.label}</span>
      {selected && <Icon name="check" size={14} className="rs-check" />}
    </span>
  );
}

function SearchControl(props: ControlProps<Option, false>) {
  return (
    <components.Control {...props}>
      <Icon name="search" size={14} className="rs-search-icon" />
      {props.children}
    </components.Control>
  );
}

export function Select<V extends string>({
  value, options, onChange, placeholder = 'Pilih…', disabled, searchable, className, ariaLabel,
}: {
  value: V | null;
  options: Option<V>[];
  onChange: (value: V | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Kotak pencarian di panel. Otomatis aktif jika opsinya lebih dari 6. */
  searchable?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;
  const withSearch = searchable ?? options.length > 6;

  // Letakkan panel di bawah tombol (atau di atasnya jika tidak ada ruang), tetap di dalam jendela.
  const place = () => {
    const t = trigger.current;
    const p = pop.current;
    if (!t || !p) return;
    const r = t.getBoundingClientRect();
    p.style.width = `${Math.max(r.width, 240)}px`;
    const h = p.offsetHeight;
    const w = p.offsetWidth;
    const below = r.bottom + 6 + h <= innerHeight - 8;
    p.style.top = `${below ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`;
    p.style.left = `${Math.min(Math.max(8, r.left), innerWidth - w - 8)}px`;
  };

  useEffect(() => {
    const p = pop.current!;
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === 'open');
    p.addEventListener('toggle', onToggle);
    return () => p.removeEventListener('toggle', onToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const ro = new ResizeObserver(place);
    ro.observe(pop.current!);
    const scroll = (e: Event) => !pop.current?.contains(e.target as Node) && place();
    addEventListener('scroll', scroll, true);
    addEventListener('resize', place);
    return () => {
      ro.disconnect();
      removeEventListener('scroll', scroll, true);
      removeEventListener('resize', place);
    };
  }, [open]);

  const close = () => {
    pop.current?.hidePopover();
    trigger.current?.focus();
  };

  return (
    <div className={`rs rs-sm ${className ?? ''}`}>
      <button
        ref={trigger}
        type="button"
        className={`rs__control${open ? ' rs__control--menu-is-open' : ''}${disabled ? ' rs__control--is-disabled' : ''}`}
        popoverTarget={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${selected?.label ?? placeholder}`}
        title={selected?.label}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            pop.current?.showPopover();
          }
        }}
      >
        <span className="rs__value-container">
          {selected ? <span className="rs__single-value"><OptionLabel option={selected} /></span> : <span className="rs__placeholder">{placeholder}</span>}
        </span>
        <span className="rs__indicators">
          <span className="rs__dropdown-indicator"><Icon name="chevron" size={14} /></span>
        </span>
      </button>

      <div ref={pop} id={id} popover="auto" className={`select-popover${withSearch ? '' : ' is-plain'}`}>
        {open && (
          <ReactSelect<Option<V>, false>
            unstyled
            className="rs-pop"
            classNamePrefix="rs"
            options={options}
            value={selected}
            onChange={(o) => {
              onChange(o ? o.value : null);
              close();
            }}
            isSearchable={withSearch}
            isOptionDisabled={(o) => !!o.disabled}
            placeholder="Cari…"
            aria-label={ariaLabel}
            autoFocus
            menuIsOpen
            controlShouldRenderValue={false}
            backspaceRemovesValue={false}
            tabSelectsValue={false}
            noOptionsMessage={() => 'Tidak ada yang cocok'}
            components={{ Control: SearchControl as never, DropdownIndicator: null, IndicatorSeparator: null }}
            formatOptionLabel={(o, { selectValue }) => <OptionLabel option={o} selected={selectValue.some((s) => s.value === o.value)} />}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
