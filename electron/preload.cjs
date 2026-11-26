'use strict'

/**
 * Reserved preload bridge; v1 exposes no Node APIs. contextIsolation + sandbox.
 */
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('yggitDesktop', {
  runtime: 'electron',
  serviceMode: 'app',
})
