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
