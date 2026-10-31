import {contextBridge} from 'electron'
import {createDesktopBrowserBridge} from '@harness/preload-browser'
contextBridge.exposeInMainWorld('dshDesktop',{protocolVersion:1,browser:createDesktopBrowserBridge()})
