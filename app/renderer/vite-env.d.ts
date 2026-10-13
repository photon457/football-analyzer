/// <reference types="vite/client" />

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

interface Window {
  electronAPI?: {
    getAppVersion: () => Promise<string>;
    getPlatform: () => string;
    ping: () => Promise<string>;
    openMatchFileDialog: () => Promise<{ filePath: string; fileName: string; content: string } | null>;
  };
}
