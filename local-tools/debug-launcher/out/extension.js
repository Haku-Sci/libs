"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const webview_1 = require("./webview");
function activate(context) {
    console.log('Debug Launcher extension is now active!');
    // Commande pour ouvrir le panel
    const openPanelCommand = vscode.commands.registerCommand('debug-launcher.openPanel', () => {
        webview_1.DebugLauncherPanel.createOrShow(context.extensionUri);
    });
    context.subscriptions.push(openPanelCommand);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map