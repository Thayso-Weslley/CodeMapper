import * as vscode from 'vscode';
// Importa a função principal do analisador que orquestra tudo
import { analyzeProject } from './analyzer'; 
// Importa a função que gera o arquivo final
import { generateDocumentation } from './mapper'; 

export function activate(context: vscode.ExtensionContext) {
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
        await analyzeProject(); 
        
        // 2. Formata e salva a documentação final
        generateDocumentation(projectRoot);
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

export function deactivate() {}