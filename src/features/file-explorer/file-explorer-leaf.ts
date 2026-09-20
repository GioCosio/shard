import {
    ItemView,
    WorkspaceLeaf,
    TFolder,
    TFile,
    TAbstractFile,
    Menu,
    setIcon,
    Notice,
} from 'obsidian';

export const FILE_EXPLORER = 'my-file-explorer';

export class FileExplorerView extends ItemView {
    // the div that holds the entire leaf
    private fileTreeContainer: HTMLElement | null = null;
    // a set that contains the path to folders that have been expanded
    private expandedFolders = new Set<string>();
    // the current selected folder
    private selectedFolder: TFolder | null = null;
    // used to handle when multiple command requests come in
    private renderQueued = false;
    private dragOverFolder: HTMLElement | null = null;

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
    const container = this.containerEl.children[1];

    if (!(container instanceof HTMLElement)) {
        return;
    }

    container.empty();

    this.addHeader(container);

    const fileExplorer = container.createDiv({
        cls: 'my-files',
    });

    this.fileTreeContainer = fileExplorer.createDiv({
        cls: 'my-files-container',
    });

    this.registerRootDropEvents(fileExplorer);
    this.registerDragEvents();

    this.registerVaultEvents();
    this.registerWorkspaceEvents();

    this.renderTree();
}

    async onClose(): Promise<void> {
        this.fileTreeContainer = null;
    }

    // -------------------------------------------------------------------------
    // Header
    // -------------------------------------------------------------------------

    private addHeader(container: HTMLElement): void {
        const header = container.createDiv({
            cls: 'nav-header',
        });

        const buttons = header.createDiv({
            cls: 'nav-buttons-container',
        });

        // New note
        this.createHeaderButton(
            buttons,
            'square-pen',
            'New note',
            () => {
                void this.createNewNote();
            },
        );

        // New folder
        this.createHeaderButton(
            buttons,
            'folder-plus',
            'New folder',
            () => {
                void this.createNewFolder();
            },
        );
    }

    private createHeaderButton(
        parent: HTMLElement,
        icon: string,
        label: string,
        callback: () => void,
    ): HTMLElement {
        const button = parent.createDiv({
            cls: 'clickable-icon nav-action-button',
            attr: {
                'aria-label': label,
            },
        });

        setIcon(button, icon);

        this.registerDomEvent(button, 'click', (event) => {
            event.stopPropagation();
            callback();
        });

        return button;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    private registerRootDropEvents(
        fileExplorer: HTMLElement,
    ): void {
        this.registerDomEvent(
            fileExplorer,
            'dragover',
            (event: DragEvent) => {
                const target = event.target;

                const folder =
                    target instanceof HTMLElement
                        ? target.closest('.my-folder')
                        : null;

                if (folder instanceof HTMLElement) {
                    this.updateDragHighlight(
                        fileExplorer,
                        folder,
                    );
                    return;
                }

                event.preventDefault();

                this.updateDragHighlight(
                    fileExplorer,
                    null,
                );

                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                }
            },
        );

        this.registerDomEvent(
            fileExplorer,
            'drop',
            (event: DragEvent) => {
                const target = event.target;

                const folder =
                    target instanceof HTMLElement
                        ? target.closest('.my-folder')
                        : null;

                // Let the folder's own drop handler deal with
                // drops on folders.
                if (folder instanceof HTMLElement) {
                    this.clearDragHighlight();
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                this.clearDragHighlight();

                void this.handleRootDrop(event);
            },
        );
    }

    private registerDragEvents(): void {
        this.registerDomEvent(
            document,
            'dragend',
            () => {
                this.clearDragHighlight();
            },
        );

        this.registerDomEvent(
            document,
            'drop',
            () => {
                this.clearDragHighlight();
            },
        );
    }

    private async handleRootDrop(
        event: DragEvent,
    ): Promise<void> {
        const sourcePath =
            event.dataTransfer?.getData(
                'text/plain',
            );

        if (!sourcePath) {
            return;
        }

        const source =
            this.app.vault.getAbstractFileByPath(
                sourcePath,
            );

        if (!source) {
            return;
        }

        const root =
            this.app.vault.getRoot();

        // Already at the root.
        if (source.parent === root) {
            return;
        }

        const newPath = source.name;

        // Don't overwrite an existing item.
        if (
            this.app.vault.getAbstractFileByPath(
                newPath,
            )
        ) {
            new Notice(
                'A file or folder with that name already exists at the root.',
            );

            return;
        }

        try {
            await this.app.fileManager.renameFile(
                source,
                newPath,
            );

            this.selectedFolder = null;

            this.queueRender();
        } catch (error) {
            console.error(
                'Failed to move item to root:',
                error,
            );

            new Notice(
                'Failed to move item to root.',
            );
        }
    }

    private registerVaultEvents(): void {
        this.registerEvent(
            this.app.vault.on('create', () => {
                this.queueRender();
            }),
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                this.handleDeletedFile(file);
                this.queueRender();
            }),
        );

        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                this.handleRenamedFile(file, oldPath);
                this.queueRender();
            }),
        );

        this.registerEvent(
            this.app.vault.on('modify', () => {
                this.updateActiveFile();
            }),
        );
    }

    private registerWorkspaceEvents(): void {
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.updateActiveFile();
            }),
        );

        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                this.updateActiveFile();
            }),
        );
    }

    private handleDeletedFile(file: TAbstractFile): void {
        if (file instanceof TFolder) {
            this.expandedFolders.delete(file.path);

            if (
                this.selectedFolder &&
                (
                    this.selectedFolder === file ||
                    this.selectedFolder.path.startsWith(`${file.path}/`)
                )
            ) {
                this.selectedFolder = null;
            }
        }

        if (file instanceof TFile) {
            // Nothing else required.
            // The active-file state will be refreshed after rendering.
        }
    }

    private handleRenamedFile(
        file: TAbstractFile,
        oldPath: string,
    ): void {
        if (file instanceof TFolder) {
            const oldExpanded = this.expandedFolders.has(oldPath);

            this.expandedFolders.delete(oldPath);

            if (oldExpanded) {
                this.expandedFolders.add(file.path);
            }

            if (this.selectedFolder?.path === oldPath) {
                this.selectedFolder = file;
            }
        }
    }

    private queueRender(): void {
        if (this.renderQueued) {
            return;
        }

        this.renderQueued = true;

        window.requestAnimationFrame(() => {
            this.renderQueued = false;
            this.renderTree();
        });
    }

    // -------------------------------------------------------------------------
    // Tree
    // -------------------------------------------------------------------------

    private renderTree(): void {
        if (!this.fileTreeContainer) {
            return;
        }

        this.fileTreeContainer.empty();

        const root = this.app.vault.getRoot();

        const children = this.sortFiles(root.children);

        for (const child of children) {
            this.renderAbstractFile(
                child,
                this.fileTreeContainer,
            );
        }

        this.updateActiveFile();
    }

    private renderAbstractFile(
        file: TAbstractFile,
        parentEl: HTMLElement,
    ): void {
        if (this.shouldHide(file)) {
            return;
        }

        if (file instanceof TFolder) {
            this.renderFolder(file, parentEl);
            return;
        }

        if (file instanceof TFile) {
            this.renderFile(file, parentEl);
        }
    }

    private shouldHide(file: TAbstractFile): boolean {
        /*
         * Obsidian's visible vault API doesn't expose files inside
         * hidden/system directories in the same way as the underlying
         * filesystem.
         *
         * We deliberately only hide dot-prefixed folders here.
         */
        return (
            file instanceof TFolder &&
            file.name.startsWith('.')
        );
    }

    private sortFiles(
        files: TAbstractFile[],
    ): TAbstractFile[] {
        return [...files].sort((a, b) => {
            const aFolder = a instanceof TFolder;
            const bFolder = b instanceof TFolder;

            if (aFolder && !bFolder) {
                return -1;
            }

            if (!aFolder && bFolder) {
                return 1;
            }

            return a.name.localeCompare(
                b.name,
                undefined,
                {
                    sensitivity: 'base',
                    numeric: true,
                },
            );
        });
    }

    // -------------------------------------------------------------------------
    // Folder
    // -------------------------------------------------------------------------

    private renderFolder(
        folder: TFolder,
        parentEl: HTMLElement,
    ): void {
        const folderNode = parentEl.createDiv({
            cls: 'my-folder',
            attr: {
                'data-path': folder.path,
            },
        });

        const isExpanded = this.expandedFolders.has(folder.path);

        const folderTitle = folderNode.createDiv({
            cls: [
                'my-folder-title',
                'is-clickable',
                'mod-collapsible',
            ].join(' '),
            attr: {
                'data-path': folder.path,
                'aria-expanded': String(isExpanded),
                'aria-label': folder.name,
            },
        });

        folderTitle.draggable = true;

        // Collapse / expand icon
        const collapseIcon = folderTitle.createDiv({
            cls: 'tree-item-icon collapse-icon',
        });

        setIcon(
            collapseIcon,
            isExpanded ? 'chevron-down' : 'chevron-right',
        );

        // Folder name
        folderTitle.createDiv({
            cls: 'tree-item-inner my-folder-title-content',
            text: folder.name,
        });

        this.registerFolderEvents(
            folder,
            folderTitle,
            folderNode,
        );

        if (!isExpanded) {
            return;
        }

        const childrenContainer = folderNode.createDiv({
            cls: 'my-folder-children',
        });

        const children = this.sortFiles(folder.children);

        for (const child of children) {
            this.renderAbstractFile(
                child,
                childrenContainer,
            );
        }
    }

    private registerFolderEvents(
        folder: TFolder,
        element: HTMLElement,
        folderNode: HTMLElement,
    ): void {
        // Click: select + toggle
        this.registerDomEvent(
            element,
            'click',
            (event: MouseEvent) => {
                event.stopPropagation();

                if (event.button !== 0) {
                    return;
                }

                this.selectedFolder = folder;

                if (this.expandedFolders.has(folder.path)) {
                    this.expandedFolders.delete(folder.path);
                } else {
                    this.expandedFolders.add(folder.path);
                }

                this.renderTree();
            },
        );

        // Double click
        this.registerDomEvent(
            element,
            'dblclick',
            (event: MouseEvent) => {
                event.stopPropagation();

                this.selectedFolder = folder;

                if (!this.expandedFolders.has(folder.path)) {
                    this.expandedFolders.add(folder.path);
                    this.renderTree();
                }
            },
        );

        // Context menu
        this.registerDomEvent(
            element,
            'contextmenu',
            (event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();

                this.selectedFolder = folder;

                this.showFolderMenu(
                    folder,
                    event,
                );
            },
        );

        // Drag start
                // Drag start
        this.registerDomEvent(
            element,
            'dragstart',
            (event: DragEvent) => {
                if (!event.dataTransfer) {
                    return;
                }

                event.stopPropagation();

                event.dataTransfer.effectAllowed = 'move';

                event.dataTransfer.setData(
                    'text/plain',
                    folder.path,
                );

                element.addClass(
                    'is-being-dragged',
                );
            },
        );

        // Drag end
        this.registerDomEvent(
            element,
            'dragend',
            () => {
                element.removeClass(
                    'is-being-dragged',
                );

                this.clearDragHighlight();
            },
        );

        // Drag over folder
        this.registerDomEvent(
            folderNode,
            'dragover',
            (event: DragEvent) => {
                event.preventDefault();
                event.stopPropagation();

                const fileExplorer =
                    folderNode.closest('.my-files');

                if (
                    fileExplorer instanceof HTMLElement
                ) {
                    this.updateDragHighlight(
                        fileExplorer,
                        folderNode,
                    );
                }

                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                }
            },
        );

        // Drop on folder
        this.registerDomEvent(
            folderNode,
            'drop',
            (event: DragEvent) => {
                event.preventDefault();
                event.stopPropagation();

                this.clearDragHighlight();

                void this.handleDrop(
                    folder,
                    event,
                );
            },
        );
    }

    // -------------------------------------------------------------------------
    // File
    // -------------------------------------------------------------------------

    private renderFile(
        file: TFile,
        parentEl: HTMLElement,
    ): void {
        const fileNode = parentEl.createDiv({
            cls: 'my-file',
            attr: {
                'data-path': file.path,
            },
        });

        const fileTitle = fileNode.createDiv({
            cls: [
                'my-file-title',
                'tappable',
                'is-clickable',
            ].join(' '),
            attr: {
                'data-path': file.path,
                'aria-label': file.name,
            },
        });

        fileTitle.draggable = true;

        // File name
        fileTitle.createDiv({
            cls: 'tree-item-inner my-file-title-content',
            text: file.basename,
        });

        this.registerFileEvents(
            file,
            fileTitle,
            fileNode,
        );
    }

    private registerFileEvents(
        file: TFile,
        element: HTMLElement,
        fileNode: HTMLElement,
    ): void {
        // Open
        this.registerDomEvent(
            element,
            'click',
            (event: MouseEvent) => {
                event.stopPropagation();

                if (event.button !== 0) {
                    return;
                }

                void this.openFile(file, event);
            },
        );

        // Context menu
        this.registerDomEvent(
            element,
            'contextmenu',
            (event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();

                this.showFileMenu(
                    file,
                    event,
                );
            },
        );

        // Drag
        this.registerDomEvent(
            element,
            'dragstart',
            (event: DragEvent) => {
                if (!event.dataTransfer) {
                    return;
                }

                event.stopPropagation();

                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData(
                    'text/plain',
                    file.path,
                );

                element.addClass('is-being-dragged');
            },
        );

        this.registerDomEvent(
            element,
            'dragend',
            () => {
                element.removeClass('is-being-dragged');
            },
        );

        // Allow dropping onto a file's parent tree item without
        // treating the file itself as a folder.
        this.registerDomEvent(
            fileNode,
            'dragover',
            (event: DragEvent) => {
                event.stopPropagation();
            },
        );
    }

    private getFileIcon(file: TFile): string {
        switch (file.extension.toLowerCase()) {
            case 'md':
                return 'file-text';

            case 'canvas':
                return 'layout-dashboard';

            case 'pdf':
                return 'file-text';

            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'webp':
            case 'svg':
                return 'image';

            case 'mp3':
            case 'wav':
            case 'm4a':
            case 'ogg':
                return 'music';

            case 'mp4':
            case 'webm':
            case 'mov':
                return 'film';

            default:
                return 'file';
        }
    }

    // -------------------------------------------------------------------------
    // File opening
    // -------------------------------------------------------------------------

    private async openFile(
        file: TFile,
        event?: MouseEvent,
    ): Promise<void> {
        const newLeaf = this.app.workspace.getLeaf(
            event?.ctrlKey ||
            event?.metaKey ||
            event?.shiftKey
                ? 'tab'
                : false,
        );

        await newLeaf.openFile(file);
    }

    // -------------------------------------------------------------------------
    // Context menus
    // -------------------------------------------------------------------------

    private showFileMenu(
        file: TFile,
        event: MouseEvent,
    ): void {
        const menu = new Menu();

        menu.addItem((item) => {
            item
                .setTitle('Open')
                .setIcon('file')
                .onClick(() => {
                    void this.openFile(file);
                });
        });

        menu.addSeparator();

        menu.addItem((item) => {
            item
                .setTitle('Rename')
                .setIcon('pencil')
                .onClick(() => {
                    void this.renameFile(file);
                });
        });

        menu.addItem((item) => {
            item
                .setTitle('Delete')
                .setIcon('trash')
                .onClick(() => {
                    void this.trashFile(file);
                });
        });

        menu.addSeparator();

        menu.addItem((item) => {
            item
                .setTitle('New note')
                .setIcon('square-pen')
                .onClick(() => {
                    void this.createNewNote(
                        file.parent instanceof TFolder
                            ? file.parent
                            : null,
                    );
                });
        });

        menu.showAtMouseEvent(event);
    }

    private showFolderMenu(
        folder: TFolder,
        event: MouseEvent,
    ): void {
        const menu = new Menu();

        menu.addItem((item) => {
            item
                .setTitle('New note')
                .setIcon('square-pen')
                .onClick(() => {
                    void this.createNewNote(folder);
                });
        });

        menu.addItem((item) => {
            item
                .setTitle('New folder')
                .setIcon('folder-plus')
                .onClick(() => {
                    void this.createNewFolder(folder);
                });
        });

        menu.addSeparator();

        menu.addItem((item) => {
            item
                .setTitle('Rename')
                .setIcon('pencil')
                .onClick(() => {
                    void this.renameFile(folder);
                });
        });

        menu.addItem((item) => {
            item
                .setTitle('Delete')
                .setIcon('trash')
                .onClick(() => {
                    void this.trashFile(folder);
                });
        });

        menu.showAtMouseEvent(event);
    }

    // -------------------------------------------------------------------------
    // Create
    // -------------------------------------------------------------------------

    private async createNewNote(
        folder: TFolder | null = this.selectedFolder,
    ): Promise<void> {
        const parentPath = folder?.path ?? '';

        const name = await this.getUniquePath(
            parentPath,
            'Untitled',
            'md',
        );

        try {
            const file = await this.app.vault.create(
                name,
                '',
            );

            await this.openFile(file);
        } catch (error) {
            console.error(
                'Failed to create note:',
                error,
            );

            new Notice(
                'Failed to create note.',
            );
        }
    }

    private async createNewFolder(
        folder: TFolder | null = this.selectedFolder,
    ): Promise<void> {
        const parentPath = folder?.path ?? '';

        const path = await this.getUniquePath(
            parentPath,
            'Untitled Folder',
            '',
        );

        try {
            const newFolder = await this.app.vault.createFolder(
                path,
            );

            this.selectedFolder = newFolder;

            this.expandedFolders.add(
                newFolder.path,
            );

            this.queueRender();
        } catch (error) {
            console.error(
                'Failed to create folder:',
                error,
            );

            new Notice(
                'Failed to create folder.',
            );
        }
    }

    private async getUniquePath(
        parentPath: string,
        baseName: string,
        extension: string,
    ): Promise<string> {
        const separator = parentPath ? '/' : '';

        const suffix = extension
            ? `.${extension}`
            : '';

        let index = 0;

        while (true) {
            const name =
                index === 0
                    ? baseName
                    : `${baseName} ${index}`;

            const path =
                `${parentPath}${separator}${name}${suffix}`;

            if (
                !this.app.vault.getAbstractFileByPath(path)
            ) {
                return path;
            }

            index++;
        }
    }

    // -------------------------------------------------------------------------
    // Rename / delete
    // -------------------------------------------------------------------------

    private async renameFile(
        file: TAbstractFile,
    ): Promise<void> {
        const currentName = file.name;

        const newName = window.prompt(
            'Rename',
            currentName,
        );

        if (
            newName === null ||
            newName.trim() === '' ||
            newName === currentName
        ) {
            return;
        }

        const parent = file.parent;

        if (!parent) {
            return;
        }

        const newPath =
            parent.path === ''
                ? newName.trim()
                : `${parent.path}/${newName.trim()}`;

        if (
            this.app.vault.getAbstractFileByPath(newPath)
        ) {
            new Notice(
                'A file or folder with that name already exists.',
            );

            return;
        }

        try {
            await this.app.fileManager.renameFile(
                file,
                newPath,
            );
        } catch (error) {
            console.error(
                'Failed to rename:',
                error,
            );

            new Notice(
                'Failed to rename.',
            );
        }
    }

    private async trashFile(
        file: TAbstractFile,
    ): Promise<void> {
        try {
            await this.app.fileManager.trashFile(
                file,
            );
        } catch (error) {
            console.error(
                'Failed to delete:',
                error,
            );

            new Notice(
                'Failed to delete.',
            );
        }
    }

    // -------------------------------------------------------------------------
    // Drag & drop
    // -------------------------------------------------------------------------

    private async handleDrop(
        targetFolder: TFolder,
        event: DragEvent,
    ): Promise<void> {
        const sourcePath =
            event.dataTransfer?.getData(
                'text/plain',
            );

        if (!sourcePath) {
            return;
        }

        const source =
            this.app.vault.getAbstractFileByPath(
                sourcePath,
            );

        if (!source) {
            return;
        }

        // Can't move a folder into itself or one of its descendants.
        if (
            source instanceof TFolder &&
            (
                targetFolder.path === source.path ||
                targetFolder.path.startsWith(
                    `${source.path}/`,
                )
            )
        ) {
            return;
        }

        if (source.parent === targetFolder) {
            return;
        }

        const newPath =
            targetFolder.path === ''
                ? source.name
                : `${targetFolder.path}/${source.name}`;

        if (
            this.app.vault.getAbstractFileByPath(
                newPath,
            )
        ) {
            new Notice(
                'A file or folder with that name already exists.',
            );

            return;
        }

        try {
            await this.app.fileManager.renameFile(
                source,
                newPath,
            );

            this.selectedFolder = targetFolder;
            this.expandedFolders.add(
                targetFolder.path,
            );

            this.queueRender();
        } catch (error) {
            console.error(
                'Failed to move item:',
                error,
            );

            new Notice(
                'Failed to move item.',
            );
        }
    }

    private updateDragHighlight(
        fileExplorer: HTMLElement,
        folderElement: HTMLElement | null,
    ): void {
        // Remove the previous folder highlight.
        if (
            this.dragOverFolder &&
            this.dragOverFolder !== folderElement
        ) {
            this.dragOverFolder.removeClass(
                'is-being-dragged-over',
            );
        }

        this.dragOverFolder = folderElement;

        if (folderElement) {
            // Folder is the drop target.
            fileExplorer.removeClass(
                'is-being-dragged-over',
            );

            folderElement.addClass(
                'is-being-dragged-over',
            );
        } else {
            // Root is the drop target.
            fileExplorer.addClass(
                'is-being-dragged-over',
            );
        }
    }

    private clearDragHighlight(): void {
        if (this.dragOverFolder) {
            this.dragOverFolder.removeClass(
                'is-being-dragged-over',
            );

            this.dragOverFolder = null;
        }

        const fileExplorer =
            this.fileTreeContainer?.closest('.my-files');

        if (fileExplorer instanceof HTMLElement) {
            fileExplorer.removeClass(
                'is-being-dragged-over',
            );
        }
    }


    // -------------------------------------------------------------------------
    // Active file
    // -------------------------------------------------------------------------

    private updateActiveFile(): void {
        if (!this.fileTreeContainer) {
            return;
        }

        const activeFile =
            this.app.workspace.getActiveFile();

        const items =
            this.fileTreeContainer.querySelectorAll(
                '.my-file-title',
            );

        for (const item of items) {
            if (!(item instanceof HTMLElement)) {
                continue;
            }

            const path =
                item.dataset.path;

            const isActive =
                !!activeFile &&
                path === activeFile.path;

            item.toggleClass(
                'is-active',
                isActive,
            );

            item.setAttribute(
                'aria-current',
                isActive
                    ? 'page'
                    : 'false',
            );
        }
    }

    // -------------------------------------------------------------------------
    // Layout
    // -------------------------------------------------------------------------
}