"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugLauncherPanel = void 0;
const vscode = require("vscode");
class DebugLauncherPanel {
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // Si le panel existe déjà, le montrer
        if (DebugLauncherPanel.currentPanel) {
            DebugLauncherPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Créer un nouveau panel
        const panel = vscode.window.createWebviewPanel('debugLauncher', 'Debug Launcher', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [extensionUri]
        });
        DebugLauncherPanel.currentPanel = new DebugLauncherPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Définir le contenu HTML depuis le fichier
        this._updateWebviewContent();
        // Écouter les messages depuis la webview
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'launchDebugConfig':
                    await this._launchDebugConfiguration(message.configName);
                    break;
                case 'getDebugConfigs':
                    await this._sendDebugConfigurations();
                    break;
                case 'getServices':
                    await this._sendServices();
                    break;
            }
        }, null, this._disposables);
        // Nettoyer quand le panel est fermé
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    async _updateWebviewContent() {
        try {
            // Lire la configuration pour le chemin HTML
            const config = vscode.workspace.getConfiguration('debugLauncher');
            const htmlFilePath = config.get('htmlFile', 'src/webview.html');
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this._panel.webview.html = this._getErrorHtml('Aucun workspace ouvert');
                return;
            }
            // Construire le chemin vers le fichier HTML
            const htmlUri = vscode.Uri.joinPath(workspaceFolder.uri, htmlFilePath);
            const htmlContent = await vscode.workspace.fs.readFile(htmlUri);
            this._panel.webview.html = htmlContent.toString();
        }
        catch (error) {
            this._panel.webview.html = this._getErrorHtml(`Erreur: ${error}`);
        }
    }
    async _launchDebugConfiguration(configName) {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Aucun workspace ouvert');
                return;
            }
            // Lancer la configuration de debug
            const success = await vscode.debug.startDebugging(workspaceFolder, configName);
            if (success) {
                vscode.window.showInformationMessage(`Configuration '${configName}' lancée avec succès`);
            }
            else {
                vscode.window.showErrorMessage(`Échec du lancement de '${configName}'`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Erreur : ${error}`);
        }
    }
    async _sendDebugConfigurations() {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }
            // Lire la configuration pour le chemin launch.json
            const config = vscode.workspace.getConfiguration('debugLauncher');
            const launchJsonPath = config.get('launchJsonPath', '.vscode/launch.json');
            const launchJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, launchJsonPath);
            try {
                const launchJsonContent = await vscode.workspace.fs.readFile(launchJsonUri);
                const launchConfig = JSON.parse(launchJsonContent.toString());
                const configurations = launchConfig.configurations || [];
                // Envoyer les configurations à la webview
                this._panel.webview.postMessage({
                    command: 'updateConfigurations',
                    configurations: configurations.map((config) => config.name)
                });
            }
            catch {
                // Pas de fichier launch.json
                this._panel.webview.postMessage({
                    command: 'updateConfigurations',
                    configurations: []
                });
            }
        }
        catch (error) {
            console.error('Erreur lors de la lecture des configurations:', error);
        }
    }
    async _sendServices() {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }
            // Lire la configuration pour le chemin services.json
            const config = vscode.workspace.getConfiguration('debugLauncher');
            const servicesJsonPath = config.get('servicesJsonPath', 'services.json');
            const servicesJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, servicesJsonPath);
            try {
                const servicesJsonContent = await vscode.workspace.fs.readFile(servicesJsonUri);
                const services = JSON.parse(servicesJsonContent.toString());
                // Envoyer les services à la webview
                this._panel.webview.postMessage({
                    command: 'updateServices',
                    services: services
                });
            }
            catch {
                // Pas de fichier services.json
                this._panel.webview.postMessage({
                    command: 'updateServices',
                    services: []
                });
            }
        }
        catch (error) {
            console.error('Erreur lors de la lecture des services:', error);
        }
    }
    _getErrorHtml(error) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Error - Debug Launcher</title>
        </head>
        <body>
            <h1>❌ Error</h1>
            <p>${error}</p>
        </body>
        </html>
        `;
    }
    dispose() {
        DebugLauncherPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.DebugLauncherPanel = DebugLauncherPanel;
//# sourceMappingURL=webview.js.map