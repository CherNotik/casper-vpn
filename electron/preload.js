const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("casper", {
  fetchSub: (url) => ipcRenderer.invoke("sub:fetch", url),
  ping: (host, port) => ipcRenderer.invoke("ping", host, port),
  connect: (link, split) => ipcRenderer.invoke("vpn:connect", link, split),
  disconnect: () => ipcRenderer.invoke("vpn:disconnect"),
  apps: () => ipcRenderer.invoke("apps:list"),
});
