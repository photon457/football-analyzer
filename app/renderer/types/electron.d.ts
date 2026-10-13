export interface IElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => string;
  ping: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
