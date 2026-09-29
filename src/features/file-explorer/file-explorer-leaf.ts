import {
    ItemView,
    WorkspaceLeaf,
    TFolder,
    TFile,
    TAbstractFile,
    setIcon,
    Notice,
    Menu,
} from 'obsidian';
import ShardPlugin from '../../main';

interface ShardPluginData {
    fileExplorerOrder?: FileExplorerOrder;
}

interface FileExplorerOrder {
    [folderPath: string]: string[];
}

export const FILE_EXPLORER = 'my-file-explorer';

export class FileExplorerView extends ItemView {
    private fileTreeContainer: HTMLElement | null = null;
    private collapsedFoldersPath = new Set<string>();
    private activeFilePath: string | null = null;
    private dragImage: HTMLElement | null = null;
    private customOrder: FileExplorerOrder = {};

    constructor(
        leaf: WorkspaceLeaf,
        private myPlugin: ShardPlugin,
    ) {
        super(leaf);
    }

    getViewType(): string {
        return FILE_EXPLORER;
    }

    getDisplayText(): string {
        return 'File explorer';
    }

    getIcon(): string {
        return 'folder';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];

        if (!(container instanceof HTMLElement)) {
            return;
        }

        // Load the saved custom ordering
        await this.loadCustomOrder();

        container.empty();

        // Render the highest level of the leaf
        this.fileTreeContainer = container.createDiv({ cls: 'my-files-container', attr: {'data-path': '/'}, })!;

        // Register DOM Events
        this.registerEventHandlers();
        
        // render the rest of the tree
        this.renderTree();
    }

    async onClose(): Promise<void> {
        this.fileTreeContainer = null;
    }

    // ---------------------------------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------------------------------

    // start from the root and start recursively rendering each of the items within
    private renderTree(): void {
        if (!this.fileTreeContainer) {
            return;
        }
        this.fileTreeContainer.empty();

        const root = this.app.vault.getRoot();
        for (const child of this.getOrderedChildren(root)) {
            this.renderAbstractFile(child, this.fileTreeContainer);
        }
    }

    private getOrderedChildren(folder: TFolder): TAbstractFile[] {
        const folderPath = folder.path;
        const savedOrder = this.customOrder[folderPath];

        // No custom order exists yet.
        if (!savedOrder) {
            return [...folder.children];
        }

        const childrenByPath = new Map(
            folder.children.map(child => [child.path, child])
        );

        const orderedChildren: TAbstractFile[] = [];

        // Add items according to the saved order.
        for (const path of savedOrder) {
            const child = childrenByPath.get(path);

            if (child) {
                orderedChildren.push(child);
                childrenByPath.delete(path);
            }
        }

        // Add new items that aren't in the saved order yet.
        for (const child of folder.children) {
            if (childrenByPath.has(child.path)) {
                orderedChildren.push(child);
            }
        }

        return orderedChildren;
    }

    // passes the item to it's correspending render method
    private renderAbstractFile( item: TAbstractFile, parentEl: HTMLElement, ): void {
        if (item instanceof TFolder) {
            this.renderFolder(item, parentEl);
        } else if (item instanceof TFile) {
            this.renderFile(item, parentEl);
        }
    }

    // renders the folder and recursively renders any of it's children
    private renderFolder( folder: TFolder, parentEl: HTMLElement, ): void {
        // the node that holds all the information
        const folderNode = parentEl.createDiv({
            cls: 'my-folder',
            attr: { 'data-path': folder.path, },
        });

        // the title which will contain the name of the folder
        const folderTitle = folderNode.createDiv({
            cls: 'my-folder-title',
            attr: { 'data-path': folder.path, 'aria-label': folder.name, 'aria-expanded': 'true', },
        });
        folderTitle.draggable = true;

        // the icon for whether folder is collapsed or expanded
        const collapseIcon = folderTitle.createDiv({
            cls: 'tree-item-icon collapse-icon',
        });
        setIcon( collapseIcon, 'chevron-down', );

        // the text containing the name of the folder
        folderTitle.createDiv({
            cls: 'tree-item-inner my-folder-title-content',
            text: folder.name,
        });

        // folder contents
        const childrenContainer = folderNode.createDiv({
            cls: 'my-folder-children',
        });

        // check the collapsed folders and add class if it is
        if (this.collapsedFoldersPath.has(folderTitle.dataset.path as string)) {
            folderTitle.classList.add('is-collapsed');
            setIcon( collapseIcon, 'chevron-right', );
            childrenContainer.hidden = true;
        }

        // recursively render each of the children items
        for (const child of this.getOrderedChildren(folder)) {
            this.renderAbstractFile( child, childrenContainer, );
        }
    }

    // renders the file 
    private renderFile( file: TFile, parentEl: HTMLElement, ): void {
        const fileNode = parentEl.createDiv({
            cls: 'my-file',
            attr: { 'data-path': file.path, },
        });

        // File name
        const fileTitle = fileNode.createDiv({
            cls: 'my-file-title',
            attr: { 'data-path': file.path, 'aria-label': file.name, },
        });
        fileTitle.draggable = true;
        
        fileTitle.createDiv({
            cls: 'tree-item-inner my-file-title-content',
            text: file.basename,
        });
        
        if (this.activeFilePath === file.path) {
            fileTitle.classList.add('is-active');
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Event Handlers
    // ---------------------------------------------------------------------------------------------

    // function that registers all the event handlers to the tree container
    private registerEventHandlers() {
        if (this.fileTreeContainer) {
            // register an event handler that actives on click
            this.registerDomEvent( this.fileTreeContainer, 'click', this.onTreeClick.bind(this));

            // register all event handlers to deal with drag and drop
            this.registerDomEvent( this.fileTreeContainer, 'dragstart', this.onTreeDragStart.bind(this) );
            this.registerDomEvent( this.fileTreeContainer, 'dragend', this.onTreeDragEnd.bind(this) );
            this.registerDomEvent( this.fileTreeContainer, 'dragover', this.onTreeDragOver.bind(this) );
            this.registerDomEvent( this.fileTreeContainer, 'dragleave', this.onTreeDragLeave.bind(this) );
            this.registerDomEvent( this.fileTreeContainer, 'drop', this.onTreeDrop.bind(this));
            this.registerDomEvent( this.fileTreeContainer, 'contextmenu', this.onTreeContextMenu.bind(this) );
        }
    }

    // function that is called whenver the leaf is clicked on
    private onTreeClick(evt: MouseEvent): void {
        const target = evt.target as HTMLElement;

        // Find the title container closest to the click target
        const titleEl = target.closest('.my-folder-title, .my-file-title') as HTMLElement;
        if (!titleEl) return;

        // Get the path of the item that was clicked
        const path = titleEl.getAttribute('data-path');
        if (!path) return;

        // Get the actual Obsidian file/folder
        const item = this.app.vault.getAbstractFileByPath(path);
        if (!item) return;

        if (item instanceof TFolder) {
            // Update the state instead of directly modifying the DOM
            if (this.collapsedFoldersPath.has(item.path)) {
                this.collapsedFoldersPath.delete(item.path);
            } else {
                this.collapsedFoldersPath.add(item.path);
            }

            // Re-render the tree using the updated state
            this.renderTree();
        }
        else if (item instanceof TFile) {
            // Update the active file state
            this.activeFilePath = item.path;

            // Re-render the tree using the updated state
            this.renderTree();

            // Open the file in Obsidian
            const leaf = this.app.workspace.getLeaf(false);
            void leaf.openFile(item);
        }
    }

    // function that is called whenever the leaf is right clicked
    private onTreeContextMenu(evt: MouseEvent): void {
        evt.preventDefault();
        const target = evt.target as HTMLElement;

        // Find the title container closest to the click target
        const titleEl = target.closest( '.my-folder-title, .my-file-title, .my-files-container' ) as HTMLElement;
        if (!titleEl) return;

        // Get the path of the item that was clicked
        const path = titleEl.getAttribute('data-path');
        if (!path) return;

        // Get the actual Obsidian file/folder
        const item = this.app.vault.getAbstractFileByPath(path);
        
        // Create the right click menu based on what's clicked
        const menu = new Menu();
        if (item?.parent) {
            menu.addItem((item) => {
                item
                    .setTitle('Rename')
                    .setIcon('pencil')
                    .onClick(() => {
                        console.log('Rename:', path);
                    });
            });
            menu.addItem((item) => {
                item
                    .setTitle('Delete')
                    .setIcon('trash')
                    .onClick(() => {
                        console.log('Delete:', path);
                    });
            });

            menu.showAtMouseEvent(evt);
        }
        else {
            console.log('Yes');
        }
    }

    // function that is called whenver a drag is started
    private onTreeDragStart(evt: DragEvent): void {
        const target = evt.target as HTMLElement;

        // Find the title container closest to the click target
        const titleEl = target.closest('.my-folder-title, .my-file-title') as HTMLElement;
        if (!titleEl || !evt.dataTransfer) return;

        // Get the path of the title container clicked on
        const path = titleEl.getAttribute('data-path');
        if (!path) return;

        titleEl.classList.add('is-being-dragged');

        // Store the moving item's path inside the dataTransfer object
        evt.dataTransfer.setData('text/plain', path);
        evt.dataTransfer.effectAllowed = 'move';

        // Create a copy to follow the cursor
        const dragImage = titleEl.cloneNode(true) as HTMLElement;

        dragImage.classList.remove('is-dragging');
        dragImage.classList.add('my-drag-image');

        // It needs to exist in the DOM for setDragImage() to work reliably
        document.body.appendChild(dragImage);

        // Position it somewhere off-screen
        dragImage.classList.add('my-drag-image');

        // Use the cloned element as the drag preview
        evt.dataTransfer.setDragImage(
            dragImage,
            10,
            10
        );

        // Store it so we can remove it after dragging
        this.dragImage = dragImage;
    }

    private onTreeDragEnd(evt: DragEvent): void {
        const target = evt.target as HTMLElement;

        const titleEl = target.closest( '.my-folder-title, .my-file-title' ) as HTMLElement;

        titleEl?.classList.remove('is-being-dragged');

        this.dragImage?.remove();
        this.dragImage = null;
    }

    // function that is called whenver a DOM is dragged over
    private onTreeDragOver(evt: DragEvent): void {
        // Allow a drop event to trigger
        evt.preventDefault();

        const target = evt.target as HTMLElement;
        // Accept dropping either onto a folder title, or the root container itself
        const dropTarget = target.closest('.my-folder-title, .my-file-title, .my-files-container') as HTMLElement;
        
        if (dropTarget) {
            evt.dataTransfer!.dropEffect = 'move';
            dropTarget.parentElement?.classList.add('is-being-dragged-over');
        }
    }

    // function that is called whenver a DOM being dragged leaves another
    private onTreeDragLeave(evt: DragEvent): void {
        const target = evt.target as HTMLElement;
        const dropTarget = target.closest('.my-folder-title, .my-file-title, .my-files-container') as HTMLElement;
        
        if (dropTarget) {
            dropTarget.parentElement?.classList.remove('is-being-dragged-over');
        }
    }

    // function that is called whenver a DOM is dropped after being dragged
    private async onTreeDrop(evt: DragEvent): Promise<void> {
        evt.preventDefault();

        const target = evt.target as HTMLElement;
        const dropTarget = target.closest('.my-folder-title, .my-file-title, .my-files-container') as HTMLElement;
        if (!dropTarget || !evt.dataTransfer) return;

        // Clean up CSS state
        dropTarget.parentElement?.classList.remove('is-being-dragged-over');

        // Retrieve the source item path
        const sourcePath = evt.dataTransfer.getData('text/plain');
        if (!sourcePath) return;

        // Determine destination folder path
        let destFolderPath = dropTarget.getAttribute('data-path');
        if (!destFolderPath) return;

        const sourceItem = this.app.vault.getAbstractFileByPath(sourcePath);
        if (!sourceItem) return;
        const destItem = this.app.vault.getAbstractFileByPath(destFolderPath);
        if (!destItem) return;

        // Handle dropping onto root container
        if (destFolderPath === '/') {
            destFolderPath = '';
        }

        if (destItem instanceof TFolder || destFolderPath === '') {
            // Prevent dropping an item into itself or its direct parent folder
            if (sourceItem.path === destFolderPath || sourceItem.parent?.path === destFolderPath) {
                return;
            }

            // Prevent dropping a folder into one of its own subfolders
            if (sourceItem instanceof TFolder && destFolderPath.startsWith(sourceItem.path + '/')) {
                new Notice('Cannot move a folder inside itself!');
                return;
            }

            // Construct the new final destination path
            const newPath = destFolderPath === '' 
                ? sourceItem.name 
                : `${destFolderPath}/${sourceItem.name}`;

            try {
                // Use Obsidian's File System API to execute the move operation
                await this.app.fileManager.renameFile(sourceItem, newPath);
                
                // Re-render the tree UI to reflect updates
                this.renderTree();
            } catch (error) {
                console.error('Failed to move file:', error);
                new Notice('Error moving file or folder.');
            }
        }
        else if (destItem instanceof TFile) {
            const parentFolder = destItem.parent;
            if (!parentFolder) return;

            // Don't allow an item to be dropped onto itself.
            if (sourceItem.path === destItem.path) {
                return;
            }

            // Reordering only makes sense within the same parent folder.
            if (sourceItem.parent?.path !== parentFolder.path) {
                new Notice('Items can only be reordered within the same folder.');
                return;
            }

            // Get the current order of the folder.
            const children = this.getOrderedChildren(parentFolder);

            // Remove the dragged item from its current position.
            const reorderedChildren = children.filter(
                child => child.path !== sourceItem.path
            );

            // Find the position of the file being dropped onto.
            const destinationIndex = reorderedChildren.findIndex(
                child => child.path === destItem.path
            );

            if (destinationIndex === -1) return;

            // Insert the dragged item immediately before the destination file.
            reorderedChildren.splice(destinationIndex, 0, sourceItem);

            // Save the resulting order.
            this.customOrder[parentFolder.path] = reorderedChildren.map(
                child => child.path
            );

            await this.saveCustomOrder();

            // Re-render the tree.
            this.renderTree();
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Custom Ordering
    // ---------------------------------------------------------------------------------------------



    private async loadCustomOrder(): Promise<void> {
        try {
            const data = await this.myPlugin.loadData() as unknown as ShardPluginData;

            this.customOrder = data.fileExplorerOrder ?? {};
        } catch (error) {
            console.error('Failed to load file explorer order:', error);
            this.customOrder = {};
        }
    }

    private async saveCustomOrder(): Promise<void> {
        try {
            const data = await this.myPlugin.loadData() as unknown as ShardPluginData;

            await this.myPlugin.saveData({
                ...data,
                fileExplorerOrder: this.customOrder,
            });
        } catch (error) {
            console.error('Failed to save file explorer order:', error);
        }
    }
}