import * as vscode from 'vscode';
import * as path from 'path';

// Lista de APIs Nativas e Métodos de Array que SÃO RUÍDO ARQUITETURAL
const IGNORED_NATIVE_SYMBOLS = new Set([
    'alert', 'console', 'log', 'Array', 'String', 'Number', 'event', 
    'getElementById', 'querySelector', 'querySelectorAll', 'createElement', 'appendChild',
    'remove', 'classList', 'add', 'removeEventListener', 'addEventListener', 'forEach',
    'map', 'filter', 'reduce', 'push', 'pop', 'shift', 'unshift', 'splice',
    'keys', 'values', 'entries', 'prompt', 'confirm', 'find', 'some',
]);

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
// 2. LÓGICA DE INDEXAÇÃO E EXTRAÇÃO DE SÍMBOLOS (CORRIGIDA)
// ===============================================

/**
 * Analisa um único arquivo para extrair elementos Exportáveis (++) e Globais (+).
 * @param document O documento de texto do VS Code.
 */
function extractAndIndexSymbols(document: vscode.TextDocument) {
    const code = document.getText();
    const tree = parser.parse(code);
    const fileName = path.basename(document.fileName);

    const symbols = new Map<string, SymbolLocation>();
    
    // Verifica se há alguma declaração 'export' no arquivo.
    const hasExports = tree.rootNode.descendantsOfType('export_statement').length > 0;
    
    function traverse(node: any) {
        let isExplicitlyExported = false;

        // 1. Verifica a palavra-chave 'export'
        if (node.type === 'export_statement' && node.childCount > 0) {
            isExplicitlyExported = true;
            node = node.child(1); // Foca na declaração real
        }

        // ------------------------------------
        // A. Funções e Classes (CORRIGIDO: Processa a declaração principal)
        // ------------------------------------
        if (node.type === 'function_declaration' || node.type === 'class_declaration') {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
                const type = (node.type === 'class_declaration') ? 'class' : 'function';
                
                let isExportable = isExplicitlyExported;

                // Se NÃO TEM NENHUM 'export' no arquivo (Legacy Script), qualquer função/classe global é '++'.
                if (!hasExports && !isExplicitlyExported) {
                    isExportable = true; 
                }
                
                symbols.set(nameNode.text, { fileName, type, isExportable });

                // IMPORTANTE: Não chamamos traverse(child) aqui para evitar descer no escopo da função/classe,
                // já que estamos apenas mapeando a interface do módulo.
                return; 
            }
        }
        
        // ------------------------------------
        // B. Variáveis (let/const/var)
        // ------------------------------------
        if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
            for (const declarator of node.namedChildren) {
                if (declarator.type === 'variable_declarator') {
                    const nameNode = declarator.childForFieldName('name');
                    if (nameNode) {
                        symbols.set(nameNode.text, { fileName, type: 'variable', isExportable: isExplicitlyExported });
                    }
                }
            }
        }

        // Percorre TODOS os filhos para buscar outras declarações no nível de módulo.
        // Já bloqueamos a descida em classes/funções na checagem acima.
        for (const child of node.children) {
             // Removida a checagem 'if (child.type !== 'function_declaration' && child.type !== 'class_declaration')'
             // pois o 'return' no bloco acima já garante que não mergulhamos no escopo interno.
            traverse(child);
        }
    }
    
    traverse(tree.rootNode);

    symbols.forEach((location, name) => {
        globalSymbolMap.set(name, location);
    });
}

/**
 * 3. Rastreia todas as chamadas de função em um arquivo e resolve a dependência.
 * AGORA: Filtra chamadas pelo princípio de White-listing, foca em Símbolos do Projeto (Funções E Variáveis de UI).
 */
function traceDependencies(document: vscode.TextDocument) {
    const code = document.getText();
    const tree = parser.parse(code);
    const fileName = path.basename(document.fileName);

    // Set de símbolos locais de Funções/Classes (para identificar se a chamada é interna)
    const localCallableSymbols = new Set<string>();
    globalSymbolMap.forEach((loc, name) => {
        if (loc.fileName === fileName && (loc.type === 'function' || loc.type === 'class')) {
            localCallableSymbols.add(name);
        }
    });

    let currentFunctionName: string | null = null;
    
    function traverse(node: any) {
        // A. Rastrear Escopo (função 'Pai') - Lógica permanece a mesma
        if (node.type === 'function_declaration' || node.type === 'class_declaration') {
            const nameNode = node.childForFieldName('name');
            const newScope = nameNode ? nameNode.text : null;
            
            const previousScope = currentFunctionName;
            
            if (newScope) {
                currentFunctionName = newScope;
            }

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
            else if (functionCalledNode.type === 'member_expression') {
                const identifierNode = functionCalledNode.descendantsOfType('identifier').pop();
                if (identifierNode) calleeName = identifierNode.text;
            }
            
            if (calleeName) {
                
                // --- NOVA LÓGICA DE RELEVÂNCIA ---
                
                // 1. O callee é um Símbolo do Projeto (Função/Classe/Variável que indexamos)?
                const calleeLocation = globalSymbolMap.get(calleeName);
                
                // 2. O callee é Ruído Nativo (forEach, console.log, etc.)?
                const isIgnoredNative = IGNORED_NATIVE_SYMBOLS.has(calleeName);
                
                // REGRA: Se o símbolo NÃO está indexado (calleeLocation é undefined) E é nativo/ruído, IGNORAMOS.
                // Note que removemos a checagem de 'isImportantGlobal'
                if (isIgnoredNative || (!calleeLocation && !localCallableSymbols.has(calleeName))) {
                    return;
                }
                
                // Se o símbolo não for um calleeLocation (ex: document), mas for uma função local, ainda rastreamos.

                let relationship: CallRelationship = {
                    callerSymbol: currentFunctionName,
                    calleeSymbol: calleeName,
                    callerFile: fileName
                };
                
                if (calleeLocation) {
                    relationship.calleeLocation = calleeLocation;
                }
                
                globalRelationshipMap.push(relationship);
            }
        }
        
        // --- NOVO RASTREAMENTO: ACESSO A VARIÁVEIS DO PROJETO (IDENTIFIER) ---
        // Este é para mapear acessos a 'telaPrincipal', 'clientes', etc.
        if (node.type === 'identifier' && currentFunctionName) {
            const variableName = node.text;

            // 1. A variável deve ser um Símbolo do Projeto (indexada).
            const variableLocation = globalSymbolMap.get(variableName);

            // 2. Não deve ser uma declaração, nem o nome de uma propriedade.
            const parentType = node.parent ? node.parent.type : null;
            const isDeclarationOrProperty = parentType === 'variable_declarator' || 
                                            parentType === 'function_declaration' || 
                                            parentType === 'class_declaration' || 
                                            parentType === 'property_identifier';
            
            // 3. Não deve ser ruído nativo ou global API
            const isIgnored = IGNORED_NATIVE_SYMBOLS.has(variableName) || variableName === 'document' || variableName === 'window';

            // 4. CRUCIAL: Evita duplicar se esta variável for o *alvo* de uma MemberExpression ou CallExpression
            // Se o pai é uma call_expression, já processamos o nome da função/variável no bloco B.
            // Se o pai é uma member_expression (ex: clientes.find), já processamos o nome da função no bloco B.
            const isCalleeTarget = parentType === 'call_expression' || parentType === 'member_expression';

            if (variableLocation && !isDeclarationOrProperty && !localCallableSymbols.has(variableName) && !isIgnored && !isCalleeTarget) {

                 let relationship: CallRelationship = {
                    callerSymbol: currentFunctionName,
                    calleeSymbol: variableName, 
                    callerFile: fileName,
                };
                globalRelationshipMap.push(relationship);
            }
        }


        // Continua a travessia
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
