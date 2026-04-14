// electron/preload.js
// Minimal safe bridge exposed to page contexts via contextBridge.
// Keep this file small and never expose Node or arbitrary modules.
const { contextBridge, shell } = require('electron')

const ALLOWED_PROTOCOLS = ['https:', 'http:']

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => {
    if (typeof url !== 'string') return
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      return
    }
    if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      shell.openExternal(url)
    }
  }
})
