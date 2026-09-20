import {
	MarkdownView,
	Plugin,
    Editor,
} from 'obsidian';
import { Extension } from '@codemirror/state'
import { ViewPlugin, ViewUpdate } from '@codemirror/view';
import {
	DEFAULT_SETTINGS,
	ShardSettings,
	ShardSettingTab,
} from './settings';
import { 
	FileExplorerView,
	FILE_EXPLORER,
} from './features/file-explorer/file-explorer-leaf';
import {
	TABLE_EDITOR,
	TableEditorView,
} from './features/table-editor'

export default class ShardPlugin extends Plugin {
	settings!: ShardSettings;

	async onload() {
		await this.loadSettings();
		
		// Add the settings tab under community plugins
		this.addSettingTab(new ShardSettingTab(this.app, this));

		// register custom leaves
		this.registerView(FILE_EXPLORER, (leaf) => new FileExplorerView(leaf));
		this.registerView(TABLE_EDITOR, (leaf) => new TableEditorView(leaf));

		this.updateFeatures();
	}

	onunload() {
		// remove all custom leaves
		this.app.workspace.detachLeavesOfType(TABLE_EDITOR);
		this.app.workspace.detachLeavesOfType(FILE_EXPLORER);

		// add back the original file explorer leaf if removed
		let FileExplorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (!FileExplorerLeaf) {
			FileExplorerLeaf = this.app.workspace.getLeftLeaf(false) ?? undefined;
		}
		if (FileExplorerLeaf) {
			FileExplorerLeaf.setViewState({ type: 'file-explorer'});
		}
	}

	updateFeatures() {
		// ----------------------------------------------------------------------------------------------
		// File Explorer
		// ----------------------------------------------------------------------------------------------
		// Create my file explorer leaf used for all of the file explorer features
		if (
			this.settings.manualFileExplorer || 
			this.settings.folderFile ||
			this.settings.folderTemplate ||
			this.settings.fileColors ||
			this.settings.folderContents
		)
		{
			// remove the original file explorer leaf
			this.app.workspace.getLeavesOfType("file-explorer").forEach(leaf => leaf.detach());
			// add custom file explorer leaf to the left bar if it doesn't exist, otherwise activate it
			let FileExplorerLeaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER)[0];
			if (!FileExplorerLeaf) {
				FileExplorerLeaf = this.app.workspace.getLeftLeaf(false) ?? undefined;
			}
			if (FileExplorerLeaf) {
				FileExplorerLeaf.setViewState({ type: FILE_EXPLORER});
			}

			// add a command to open the custom file explorer leaf
			this.addCommand({
				id: 'open-manaul-file-explorer',
				name: 'Open File Explorer',
				callback: () => {
					let FileExplorerLeaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER)[0];
					if (!FileExplorerLeaf) {
						FileExplorerLeaf = this.app.workspace.getLeftLeaf(false) ?? undefined;
					}
					if (FileExplorerLeaf) {
						FileExplorerLeaf.setViewState({ type: FILE_EXPLORER, active: true});
					}
				}
			});
		}
		// replace file explorer leaf 
		else {
			this.app.workspace.getLeavesOfType(FILE_EXPLORER).forEach(leaf => leaf.detach());
			let FileExplorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
			if (!FileExplorerLeaf) {
				FileExplorerLeaf = this.app.workspace.getLeftLeaf(false) ?? undefined;
			}
			if (FileExplorerLeaf) {
				FileExplorerLeaf.setViewState({ type: 'file-explorer'});
			}
		}
		// ----------------------------------------------------------------------------------------------
		// Table Editor
		// ----------------------------------------------------------------------------------------------
		if (this.settings.tableEditor) {
			let tableEditorLeaf = this.app.workspace.getLeavesOfType(TABLE_EDITOR)[0];
			if (!tableEditorLeaf) {
				tableEditorLeaf = this.app.workspace.getRightLeaf(false) ?? undefined;
			}
			if (tableEditorLeaf) {
				tableEditorLeaf.setViewState({ type: TABLE_EDITOR});
			}
			this.addCommand({
				id: 'open-table-editor',
				name: 'Open Table Editor',
				callback: () => {
					let tableEditorLeaf = this.app.workspace.getLeavesOfType(TABLE_EDITOR)[0];
					if (!tableEditorLeaf) {
						tableEditorLeaf = this.app.workspace.getRightLeaf(false) ?? undefined;
					}
					if (tableEditorLeaf) {
						tableEditorLeaf.setViewState({ type: TABLE_EDITOR, active: true});
					}
				}
			});
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ShardSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}