import { ItemView, WorkspaceLeaf } from 'obsidian';
import ShardPlugin from '../../main';

export const FILE_EXPLORER = 'my-file-explorer'

export class FileExplorerView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return FILE_EXPLORER;
    }

    getDisplayText(): string {
        return 'File Explorer';
    }

    getIcon(): string {
        return 'folder';
    }

    async onOpen(): Promise<void> {
    }

    async onClose(): Promise<void> {
    }
}