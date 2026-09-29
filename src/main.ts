import { Plugin, } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	ShardSettings,
	ShardSettingTab,
} from './settings';
import { 
	FileExplorerView,
	FILE_EXPLORER,
} from './features/file-explorer/file-explorer-leaf';

export default class ShardPlugin extends Plugin {
	settings!: ShardSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new ShardSettingTab(this.app, this));

		this.registerView( FILE_EXPLORER, (leaf) => new FileExplorerView(leaf, this) );

		this.app.workspace.onLayoutReady(() => {
			this.updateFeatures();
		});
	}

	onunload() {
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
			// add custom file explorer leaf to the left bar if it doesn't exist, otherwise activate it
			let FileExplorerLeaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER)[0];
			if (!FileExplorerLeaf) {
				FileExplorerLeaf = this.app.workspace.getLeftLeaf(false) ?? undefined;
			}
			if (FileExplorerLeaf) {
				void FileExplorerLeaf.setViewState({ type: FILE_EXPLORER});
			}

			// add a command to open the custom file explorer leaf
			this.addCommand({
				id: 'open-manaul-file-explorer',
				name: 'Open file explorer',
				callback: () => {
					let FileExplorerLeaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER)[0];
					if (!FileExplorerLeaf) {
						FileExplorerLeaf = this.app.workspace.getLeftLeaf(false) ?? undefined;
					}
					if (FileExplorerLeaf) {
						void FileExplorerLeaf.setViewState({ type: FILE_EXPLORER, active: true});
					}
				}
			});
		}
		// replace file explorer leaf 
		else {
			this.app.workspace.getLeavesOfType(FILE_EXPLORER).forEach(leaf => leaf.detach());
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