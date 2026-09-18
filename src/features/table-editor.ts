import { ItemView, WorkspaceLeaf } from 'obsidian';

export const TABLE_EDITOR = 'table-editor';

export interface TableData {
    headers: string[];
    rows: string[][];
    startLine: number;
    endLine: number;
}

export class TableEditorView extends ItemView {
    private table: TableData | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return TABLE_EDITOR;
    }

    getDisplayText(): string {
        return 'Table Editor';
    }

    getIcon(): string {
        return 'table';
    }

    async onOpen(): Promise<void> {
        this.render();
    }

    async onClose(): Promise<void> {
    }

    setTable(table: TableData | null) {
        if (
            table &&
            this.table &&
            table.startLine === this.table.startLine &&
            table.endLine === this.table.endLine
        ) {
            return;
        }

        this.table = table;
        this.render();
    }

    private render() {
        const container = this.containerEl.children[1];
        container?.empty();

        const heading = container?.createEl("h2", {
            text: "Table Editor"
        });

        if (!this.table) {
            container?.createEl("p", {
                text: "Hover over a table to edit it."
            });

            return;
        }

        const tableEl = container?.createEl("table");

        // Header
        const headerRow = tableEl?.createEl("tr");

        for (const header of this.table.headers) {
            headerRow?.createEl("th", {
                text: header
            });
        }

        // Rows
        for (const row of this.table.rows) {
            const rowEl = tableEl?.createEl("tr");

            for (const cell of row) {
                rowEl?.createEl("td", {
                    text: cell
                });
            }
        }
    }
}
