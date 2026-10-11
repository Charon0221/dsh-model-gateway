import { type GatewayProfile } from '../shared.js';
import { type ClientOperations } from './controller.js';
export interface EditorProps {
    route?: string;
    initial?: GatewayProfile;
    preset?: boolean;
    revision: number;
    taken: readonly string[];
    writable: boolean;
    operations: ClientOperations;
    onClose: () => void;
    onDelete?: () => void;
}
export declare function GatewayEditor(props: EditorProps): import("react/jsx-runtime").JSX.Element;
