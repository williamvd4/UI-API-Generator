// electron/main.js
const { app, BrowserWindow, BrowserView, session } = require('electron')
const path = require('path')

function createMainWindow () {
  // Persisted partition so cookies / localStorage survive across app restarts
  const partitionName = 'persist:browserview-profile'
  const ses = session.fromPartition(partitionName, { cache: true })

  const mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // Create the BrowserView that acts as the full embedded browser
  const view = new BrowserView({
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      nativeWindowOpen: true  // makes window.open / target=_blank create real windows
    }
  })

  mainWin.setBrowserView(view)

  // Fill the entire window with the BrowserView and auto-resize on window resize
  const { width, height } = mainWin.getContentBounds()
  view.setBounds({ x: 0, y: 0, width, height })
  view.setAutoResize({ width: true, height: true })

  // Respect START_URL env var so developers can point at a local dev server
  const startUrl = process.env.START_URL || 'https://example.com'
  view.webContents.loadURL(startUrl)

  // Attach DevTools to the BrowserView for easy debugging
  view.webContents.openDevTools({ mode: 'right' })

  // Handle window.open / popups: create real BrowserWindows sharing the same session
  view.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 900,
        height: 700,
        webPreferences: {
          session: ses,
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js'),
          nativeWindowOpen: true
        }
      }
    }
  })

  // Permission policy: allow notifications, deny everything else by default
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications') {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Download handler: save to the system Downloads folder and log progress
  ses.on('will-download', (event, item) => {
    const savePath = path.join(app.getPath('downloads'), item.getFilename())
    item.setSavePath(savePath)

    item.on('updated', (e, state) => {
      if (state === 'progressing' && !item.isPaused()) {
        console.log(`Downloading: ${item.getReceivedBytes()} / ${item.getTotalBytes()} bytes`)
      }
    })

    item.once('done', (e, state) => {
      console.log(`Download ${state}: ${savePath}`)
    })
  })

  // Expose the view globally so it can be used programmatically from the main process
  global.browserView = view

  return mainWin
}

app.whenReady().then(() => {
  // Uncomment to enable remote DevTools Protocol access (e.g. for Puppeteer/Playwright)
  // app.commandLine.appendSwitch('remote-debugging-port', '9222')

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
