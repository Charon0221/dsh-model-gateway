import React, { useState } from 'react';
import { Button, Menu, IconChevronDownOutlineRegular, IconEllipsisOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';

type MenuEntry = { id: string; label: React.ReactNode; disabled?: boolean; danger?: boolean; icon?: React.ReactNode; submenu?: readonly MenuEntry[] };

/** DSH's native menu is the shared selection control; no custom select styling. */
export function Selection({ label, value, options, disabled, onChange }: {
  label: string; value: string; options: readonly { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return <div className="dsg-field"><span>{label}</span><Menu open={open && !disabled} portal autoFocus dense
    anchor={<Button variant="outline" aria-label={label} aria-haspopup="menu" aria-expanded={open && !disabled} disabled={disabled} onClick={() => setOpen(p => !p)} icon={<IconChevronDownOutlineRegular />}>{options.find(o => o.value === value)?.label ?? value}</Button>}
    items={options.map(o => ({ id: o.value, label: o.label, disabled: o.disabled }))} selectedId={value}
    onSelect={id => { onChange(id); setOpen(false); }} onClose={() => setOpen(false)} />
  </div>;
}

/** Native DSH ellipsis menu. Menu owns submenu focus, pointer grace, and Escape. */
export function ActionMenu({ label, items, disabled, onSelect }: {
  label: string; items: readonly MenuEntry[]; disabled?: boolean; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return <Menu open={open && !disabled} portal autoFocus dense align="end" selection="fill"
    anchor={<Button variant="ghost" size="sm" aria-label={label} aria-haspopup="menu" aria-expanded={open && !disabled} disabled={disabled} onClick={() => setOpen(p => !p)} icon={<IconEllipsisOutlineRegular />} />}
    items={items} onSelect={id => { onSelect(id); setOpen(false); }} onClose={() => setOpen(false)} />;
}
