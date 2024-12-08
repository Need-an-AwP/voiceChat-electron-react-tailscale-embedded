const { app, shell, BrowserWindow, ipcMain, desktopCapturer, session } = require('electron')
const path = require('path')
const { electronApp, optimizer, is } = require('@electron-toolkit/utils')
const koffi = require('koffi');
const dotenv = require('dotenv');
const { throttle, debounce } = require('lodash');
const { exec } = require('child_process')


// generate a random uuid
function generateUUID() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${timestamp}${random}`;
}

const uuid = generateUUID();

dotenv.config({
    path: path.resolve(__dirname, '..', '.env')
});
const dllPath = is.dev || process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', 'tailscale-embed', 'tailscale-embed.dll')
    : path.join(process.resourcesPath, 'tailscale-embed.dll');
const lib = koffi.load(dllPath);
const startTailscale = lib.func('startTailscale', 'void', ['str', 'str', 'str', "..."]);
const getLocalClientStatus = lib.func('getLocalClientStatus', 'str', []);
const sendMessageToClient = lib.func('sendMessageToClient', 'str', ['str', 'str']);
const getWSConnections = lib.func('getWSConnections', 'str', [])

// register ws callback
const WSCallback = koffi.proto('void WSCallback(const char* from, const char* message, int type)');
const registerWSCallback = lib.func('RegisterWSCallback', 'void', [koffi.pointer(WSCallback)]);
const wsHandler = koffi.register((from, message, type) => {
    // transfer all messages to frontend
    mainWindow.webContents.send('ws-server-message', {
        from: from,
        message: message,
        type: type
    });
}, koffi.pointer(WSCallback));
registerWSCallback(wsHandler);

// register http callback
const HTTPCallback = koffi.proto('void HTTPCallback(const char* from, const char* message)');
const registerHTTPCallback = lib.func('RegisterHTTPCallback', 'void', [koffi.pointer(HTTPCallback)]);
const httpHandler = koffi.register((from, message) => {
    mainWindow.webContents.send('http-server-message', {
        from: from,
        message: message,
    });
}, koffi.pointer(HTTPCallback));
registerHTTPCallback(httpHandler);

// start go embedded tailscale and ws server
const randomHostname = `tailscale-embed-test-${Math.random().toString(36).substring(2, 8)}`;

let isTailscaleAuthKey
const authKey = process.env.HEADSCALE_AUTH_KEY
if (authKey.includes('tskey-auth-')) {
    isTailscaleAuthKey = true;
    startTailscale(authKey, randomHostname, uuid);
} else {
    isTailscaleAuthKey = false;
    startTailscale(authKey, randomHostname, uuid, 'str', process.env.CONTROL_URL);
    // control url must be included when using headscale controller and authkey
}


let captureId;
ipcMain.on('capture_id', (e, d) => {
    captureId = d;
})
ipcMain.handle('getScreenSources', async (e, d) => {
    const thumbnailSizeNum = 600
    const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: thumbnailSizeNum, height: thumbnailSizeNum },
        fetchWindowIcons: true
    })

    const serializedSources = sources.map(source => ({
        id: source.id,
        name: source.name,
        display_id: source.display_id,
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));

    return serializedSources;
});
ipcMain.on('ask_uuid', (event, data) => {
    mainWindow.webContents.send('self_uuid', uuid)
    mainWindow.webContents.send('is_tailscale_auth_key', isTailscaleAuthKey)
});

//get electron process id
let cachedElectronPids = [];
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 10000; // 10 seconds
function getElectronProcessIds() {
    return new Promise((resolve, reject) => {
        const currentTime = Date.now();
        if (currentTime - lastUpdateTime < UPDATE_INTERVAL) {
            resolve(cachedElectronPids);
            return;
        }

        const command = process.platform === 'win32'
            ? `wmic process where "CommandLine like '%${process.execPath.replace(/\\/g, '\\\\')}%'" get ProcessId`
            : `pgrep -f "${process.execPath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            const pids = stdout.split('\n')
                .map(line => parseInt(line.trim()))
                .filter(pid => !isNaN(pid));

            cachedElectronPids = pids;
            lastUpdateTime = currentTime;
            resolve(pids);
        });
    });
}
const throttledGetElectronProcessIds = throttle(getElectronProcessIds, UPDATE_INTERVAL);
ipcMain.handle('getElectronPids', (e, d) => {
    return throttledGetElectronProcessIds()
})

let mainWindow;
let statusCallback = null;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1286,
        height: 844 + 32,
        autoHideMenuBar: true,
        frame: false,
        devtools: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            spellcheck: false,
            nodeIntegration: true,// for allowing preload js to use node api
            contextIsolation: true,
            enableScreenCapture: true,
        }
    })

    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({
            types: captureId.startsWith('screen') ? ['screen'] : ['window']
        })
            .then((sources) => {
                const source = sources.find(s => s.id === captureId);
                callback({ video: source, audio: 'loopback' })
            })

        // If true, use the system picker if available.
        // Note: this is currently experimental. If the system picker
        // is available, it will be used and the media request handler
        // will not be invoked.
    }, { useSystemPicker: false })


    ipcMain.on('minimize-window', () => {
        mainWindow.minimize();
    });
    ipcMain.on('maximize-window', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('close-window', () => {
        mainWindow.close();
    });

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.on('closed', () => {
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })

    // accept all certificates in this window
    mainWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
        event.preventDefault()
        callback(true)
    })

    // check tailscale status every second
    statusCallback = setInterval(() => {
        getLocalClientStatus.async((err, res) => {
            const data = JSON.parse(res);
            // console.log(data);
            mainWindow.webContents.send('tailscale-status', data);
        })
    }, 1000);

    if (is.dev || process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools({ mode: 'detach' })
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }
}

app.whenReady().then(() => {

    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
    if (statusCallback) {
        clearInterval(statusCallback);
    }
})