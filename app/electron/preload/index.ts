import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => string;
  ping: () => Promise<string>;
  openMatchFileDialog: () => Promise<{ filePath: string; fileName: string; content: string } | null>;
}

const electronAPI: IElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  ping: () => ipcRenderer.invoke('app:ping'),
  openMatchFileDialog: () => ipcRenderer.invoke('dialog:openMatchFile'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
