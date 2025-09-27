import * as vscode from 'vscode';
import * as path from 'path';

// ===============================================
// 1. ESTRUTURAS DE DADOS GLOBAIS (EXPORTADAS)
// ===============================================

// Assinaturas de tipos para o nosso mapa de símbolos
export interface SymbolLocation { 
    type: 'variable' | 'function' | 'class';
    fileName: string;
    isExportable: boolean; // Corresponde ao '++'
}

// O mapa global que armazenará todos os símbolos exportáveis e globais do projeto.
export const globalSymbolMap = new Map<string, SymbolLocation>();

// Nova interface para armazenar as relações que serão documentadas
export interface CallRelationship { 
    callerSymbol: string;   // Símbolo que está chamando (Função A)
    calleeSymbol: string;   // Símbolo que está sendo chamado (Função B)
    callerFile: string;     // Arquivo da Função A
    calleeLocation?: SymbolLocation; // Localização de B (para saber se é externo)
}

// Armazena todas as relações de chamada encontradas em todos os arquivos
export const globalRelationshipMap: CallRelationship[] = [];

// Inicialização do Tree-sitter (será feito uma única vez)
const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const parser = new Parser();
parser.setLanguage(JavaScript);


// ===============================================
// 2. LÓGICA DE INDEXAÇÃO E EXTRAÇÃO DE SÍMBOLOS
// ===============================================

/**
 * Analisa um único arquivo para extrair elementos Exportáveis (++) e Globais (+).
 * * @param document O documento de texto do VS Code.
 */
function extractAndIndexSymbols(document: vscode.TextDocument) {
    const code = document.getText();
    const tree = parser.parse(code);
    const fileName = path.basename(document.fileName);

    const symbols = new Map<string, SymbolLocation>();
    
    function traverse(node: any) {
        let isExportable = false;

        // Verifica se há a palavra-chave 'export'
        if (node.type === 'export_statement' && node.childCount > 0) {
            isExportable = true;
            node = node.child(1); // Foca na declaração real
        }

        // A. Funções (inclui Classes em JS moderno)
        if (node.type === 'function_declaration' || node.type === 'class_declaration') {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
                const type = (node.type === 'class_declaration') ? 'class' : 'function';
                symbols.set(nameNode.text, { fileName, type, isExportable });
            }
        }
        
        // B. Variáveis (let/const/var)
        if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
            for (const declarator of node.namedChildren) {
                if (declarator.type === 'variable_declarator') {
                    const nameNode = declarator.childForFieldName('name');
                    if (nameNode) {
                        symbols.set(nameNode.text, { fileName, type: 'variable', isExportable });
                    }
                }
            }
        }

        // Percorre os filhos, mas evita escopos internos para focar no nível de módulo
        for (const child of node.children) {
            if (child.type !== 'function_declaration' && child.type !== 'class_declaration') {
                traverse(child);
            }
        }
    }
    
    traverse(tree.rootNode);

    symbols.forEach((location, name) => {
        globalSymbolMap.set(name, location);
    });
}

/**
 * 3. Rastreia todas as chamadas de função em um arquivo e resolve a dependência.
 */
function traceDependencies(document: vscode.TextDocument) {
    const code = document.getText();
    const tree = parser.parse(code);
    const fileName = path.basename(document.fileName);

    // Identifica as funções locais para diferenciar das externas
    const localFunctions = new Set<string>();
    globalSymbolMap.forEach((loc, name) => {
        if (loc.fileName === fileName && loc.type === 'function') {
            localFunctions.add(name);
        }
    });

    let currentFunctionName: string | null = null;
    
    function traverse(node: any) {
        // A. Rastrear Escopo (Quem é a função 'Pai')
        if (node.type === 'function_declaration' || node.type === 'class_declaration') {
            const nameNode = node.childForFieldName('name');
            const newScope = nameNode ? nameNode.text : 'Anonymous';
            
            const previousScope = currentFunctionName;
            currentFunctionName = newScope;

            for (const child of node.children) {
                traverse(child);
            }
            
            currentFunctionName = previousScope;
            return; 
        }

        // B. Rastrear Chamadas de Função (call_expression)
        if (node.type === 'call_expression' && currentFunctionName) {
            const functionCalledNode = node.child(0);
            let calleeName = '';

            // Tenta obter o nome da função chamada
            if (functionCalledNode.type === 'identifier') {
                calleeName = functionCalledNode.text;
            } 
            // Para chamadas obj.method()
            else if (functionCalledNode.type === 'member_expression') {
                const identifierNode = functionCalledNode.descendantsOfType('identifier').pop();
                if(identifierNode) calleeName = identifierNode.text;
            }
            
            if (calleeName) {
                const isLocal = localFunctions.has(calleeName);
                
                let relationship: CallRelationship = {
                    callerSymbol: currentFunctionName,
                    calleeSymbol: calleeName,
                    callerFile: fileName
                };
                
                // Se NÃO for local, resolve a dependência no Mapa Global
                if (!isLocal) {
                    const calleeLocation = globalSymbolMap.get(calleeName);
                    if (calleeLocation) {
                        relationship.calleeLocation = calleeLocation; 
                    }
                }
                
                globalRelationshipMap.push(relationship);
            }
        }
        
        // Continua a travessia para outros nós
        for (const child of node.children) {
            traverse(child);
        }
    }
    
    traverse(tree.rootNode);
}

// ===============================================
// 4. FUNÇÃO PRINCIPAL DE ORQUESTRAÇÃO (EXPORTADA)
// ===============================================

/**
 * Função principal: Faz a indexação completa e o rastreamento de dependências.
 */
export async function analyzeProject() {
    if (!vscode.workspace.workspaceFolders) return;

    // 1. Limpa e popula o mapa de símbolos (Indexação)
    globalSymbolMap.clear();
    const files = await vscode.workspace.findFiles('**/*.js', '**/node_modules/**', 100);

    for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        extractAndIndexSymbols(document);
    }
    
    console.log("CodeMapper: Indexação de projeto concluída.");

    // 2. Limpa e rastreia as dependências (Rastreamento)
    globalRelationshipMap.length = 0; 
    
    for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        traceDependencies(document);
    }
    
    console.log("CodeMapper: Rastreamento de Dependências Concluído!");
}