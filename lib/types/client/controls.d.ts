import React from 'react';
type MenuEntry = {
    id: string;
    label: React.ReactNode;
    disabled?: boolean;
    danger?: boolean;
    icon?: React.ReactNode;
    submenu?: readonly MenuEntry[];
};
/** DSH's native menu is the shared selection control; no custom select styling. */
export declare function Selection({ label, value, options, disabled, onChange }: {
    label: string;
    value: string;
    options: readonly {
        value: string;
        label: string;
        disabled?: boolean;
    }[];
    disabled?: boolean;
    onChange: (value: string) => void;
}): import("react/jsx-runtime").JSX.Element;
/** Native DSH ellipsis menu. Menu owns submenu focus, pointer grace, and Escape. */
export declare function ActionMenu({ label, items, disabled, onSelect }: {
    label: string;
    items: readonly MenuEntry[];
    disabled?: boolean;
    onSelect: (id: string) => void;
}): import("react/jsx-runtime").JSX.Element;
export {};
