import React, { useState } from 'react';
import { Button, Menu, IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';

/** DSH's native menu is the shared selection control; no custom select styling. */
export function Selection({ label, value, options, disabled, onChange }: {
  label: string; value: string; options: readonly { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return <div className="dsg-field"><span>{label}</span><Menu open={open && !disabled} portal autoFocus
    anchor={<Button variant="outline" aria-label={label} aria-haspopup="menu" aria-expanded={open && !disabled} disabled={disabled} onClick={() => setOpen(p => !p)} icon={<IconChevronDownOutlineRegular />}>{options.find(o => o.value === value)?.label ?? value}</Button>}
    items={options.map(o => ({ id: o.value, label: o.label, disabled: o.disabled }))} selectedId={value}
    onSelect={id => { onChange(id); setOpen(false); }} onClose={() => setOpen(false)} />
  </div>;
}
