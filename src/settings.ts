import { App, PluginSettingTab, Setting } from 'obsidian';
import ShardPlugin from './main';

export interface ShardSettings {
	manualFileExplorer: boolean;
	folderFile: boolean;
	folderTemplate: boolean;
	fileColors: boolean;
	folderContents: boolean;

	stickyHeadings: boolean;
	autoLink: boolean;

	tableEditor: boolean;
}

export const DEFAULT_SETTINGS: ShardSettings = {
	manualFileExplorer: false,
	folderFile: false,
	folderTemplate: false,
	fileColors: false,
	folderContents: false,

	stickyHeadings: false,
	autoLink: false,

	tableEditor: false,
};

export class ShardSettingTab extends PluginSettingTab {
	plugin: ShardPlugin;

	constructor(app: App, plugin: ShardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {text: "Shard",});
		containerEl.createEl("hr");

		// ---------------------------------------------------------------
		// File Explorer
		// ---------------------------------------------------------------
		
		containerEl.createEl("h3", { text: "File Explorer", });

		new Setting(containerEl)
			.setName("Manual file ordering")
			.setDesc(
				"Allow notes and folders in the File Explorer to be manually ordered using drag and drop."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.manualFileExplorer)
					.onChange(async (value) => {
						this.plugin.settings.manualFileExplorer = value;

						await this.plugin.saveSettings();
						await this.plugin.updateFeatures();
					})
			);
		
		new Setting(containerEl)
			.setName("Folder files")
			.setDesc(
				"Allow folders to have their own associated note that can be edited."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.folderFile)
					.onChange(async (value) => {
						this.plugin.settings.folderFile = value;

						await this.plugin.saveSettings();
						await this.plugin.updateFeatures();
					})
			);
		
		new Setting(containerEl)
			.setName("Folder templates")
			.setDesc(
				"Allow user to set a template to a folder that will automatically be applied to new notes."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.folderTemplate)
					.onChange(async (value) => {
						this.plugin.settings.folderTemplate = value;

						await this.plugin.saveSettings();
						await this.plugin.updateFeatures();
					})
			);
		
		new Setting(containerEl)
			.setName("File colors")
			.setDesc(
				"Allow folders and notes to be colored in the file explorer."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.fileColors)
					.onChange(async (value) => {
						this.plugin.settings.fileColors = value;

						await this.plugin.saveSettings();
						await this.plugin.updateFeatures();
					})
			);
		
		new Setting(containerEl)
			.setName("Folder contents")
			.setDesc(
				"Display the number of items within a folder."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.folderContents)
					.onChange(async (value) => {
						this.plugin.settings.folderContents = value;

						await this.plugin.saveSettings();
						await this.plugin.updateFeatures();
					})
			);
		
		containerEl.createEl("hr");

		// ---------------------------------------------------------------
		// Editor
		// ---------------------------------------------------------------

		containerEl.createEl("h3", { text: "Editor", });

		new Setting(containerEl)
			.setName("Sticky headers")
			.setDesc(
				"Keep the current Markdown heading visible at the top while scrolling."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stickyHeadings)
					.onChange(async (value) => {
						this.plugin.settings.stickyHeadings = value;

						await this.plugin.saveSettings();
						await this.plugin.updateFeatures();
					})
			);
		
		new Setting(containerEl)
			.setName("Automatic links")
			.setDesc(
				"Will automatically add a link to your note if it matches"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoLink)
					.onChange(async (value) => {
						this.plugin.settings.autoLink = value;

						await this.plugin.saveSettings();
						await this.plugin.updateFeatures();
					})
			);
		
		containerEl.createEl("hr")

		// ---------------------------------------------------------------
		// Tables
		// ---------------------------------------------------------------

		new Setting(containerEl)
			.setName("Easier table formatting")
			.setDesc(
				"Makes it easier to format your tables"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tableEditor)
					.onChange(async (value) => {
						this.plugin.settings.tableEditor = value;

						await this.plugin.saveSettings();
						await this.plugin.updateFeatures();
					})
			);
	}
}
