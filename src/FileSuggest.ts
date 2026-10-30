import { AbstractInputSuggest, App, TFile } from "obsidian";

/** Suggests the vault's markdown files for a text input. */
export class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, inputEl: HTMLInputElement, private onPick: (file: TFile) => void) {
    super(app, inputEl);
  }

  getSuggestions(query: string) {
    const q = query.toLowerCase();
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.toLowerCase().includes(q))
      .slice(0, 20);
  }

  renderSuggestion(file: TFile, el: HTMLElement) {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile) {
    this.onPick(file);
    this.close();
  }
}
