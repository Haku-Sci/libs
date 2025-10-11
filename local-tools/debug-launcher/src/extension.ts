import * as vscode from 'vscode';
import { DebugLauncherPanel } from './webview';

export function activate(context: vscode.ExtensionContext) {
    console.log('Debug Launcher extension is now active!');

    // Commande pour ouvrir le panel
    const openPanelCommand = vscode.commands.registerCommand(
        'debug-launcher.openPanel', 
        () => {
            DebugLauncherPanel.createOrShow(context.extensionUri);
        }
    );

    context.subscriptions.push(openPanelCommand);
}

export function deactivate() {}