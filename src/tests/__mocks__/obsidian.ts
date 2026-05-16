export class Plugin {}
export class PluginSettingTab {}
export class Modal {}
export class FuzzySuggestModal<T> {
  constructor(public app: unknown) {}
  open() {}
  close() {}
}
export class Setting {}
export class Notice {
  constructor(public message: string, public timeout?: number) {}
  hide() {}
}
export class Editor {}
export class MarkdownView {}
export class Menu {}
export class App {}
