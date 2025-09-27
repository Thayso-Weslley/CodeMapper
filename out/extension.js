"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
// Importa a função principal do analisador que orquestra tudo
const analyzer_1 = require("./analyzer");
// Importa a função que gera o arquivo final
const mapper_1 = require("./mapper");
function activate(context) {
    console.log('CodeMapper está ativo! Iniciando análise do projeto.');
    // Pega a pasta raiz do projeto para saber onde salvar o arquivo
    const projectRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : null;
    if (!projectRoot) {
        vscode.window.showWarningMessage('CodeMapper: Nenhum workspace folder aberto. Não é possível rodar a análise.');
        return;
    }
    // Função unificada para rodar a análise e mapeamento
    const runAnalysisAndMapping = async () => {
        // 1. Roda toda a indexação e rastreamento de chamadas
        await (0, analyzer_1.analyzeProject)();
        // 2. Formata e salva a documentação final
        (0, mapper_1.generateDocumentation)(projectRoot);
    };
    // 1. Inicia a análise completa na ativação
    runAnalysisAndMapping();
    // 2. Re-analisa quando um arquivo JS for salvo
    vscode.workspace.onDidSaveTextDocument(document => {
        if (document.languageId === 'javascript') {
            runAnalysisAndMapping();
        }
    }, null, context.subscriptions);
    // 3. Registra um comando para rodar manualmente
    let disposable = vscode.commands.registerCommand('codemapper.runAnalysis', () => {
        runAnalysisAndMapping();
        vscode.window.showInformationMessage('CodeMapper: Análise Completa Concluída!');
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map