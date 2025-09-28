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
exports.globalRelationshipMap = exports.globalSymbolMap = void 0;
exports.analyzeProject = analyzeProject;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
// Lista de APIs Nativas e Métodos de Array que SÃO RUÍDO ARQUITETURAL
const IGNORED_NATIVE_SYMBOLS = new Set([
    'alert', 'console', 'log', 'Array', 'String', 'Number', 'event',
    'getElementById', 'querySelector', 'querySelectorAll', 'createElement', 'appendChild',
    'remove', 'classList', 'add', 'removeEventListener', 'addEventListener', 'forEach',
    'map', 'filter', 'reduce', 'push', 'pop', 'shift', 'unshift', 'splice',
    'keys', 'values', 'entries', 'prompt', 'confirm', 'find', 'some',
]);
// O mapa global que armazenará todos os símbolos exportáveis e globais do projeto.
exports.globalSymbolMap = new Map();
// Armazena todas as relações de chamada encontradas em todos os arquivos
exports.globalRelationshipMap = [];
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
function extractAndIndexSymbols(document) {
    const code = document.getText();
    const tree = parser.parse(code);
    const fileName = path.basename(document.fileName);
    const symbols = new Map();
    // Verifica se há alguma declaração 'export' no arquivo.
    const hasExports = tree.rootNode.descendantsOfType('export_statement').length > 0;
    function traverse(node) {
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
        exports.globalSymbolMap.set(name, location);
    });
}
/**
 * 3. Rastreia todas as chamadas de função em um arquivo e resolve a dependência.
 * AGORA: Filtra chamadas pelo princípio de White-listing, foca em Símbolos do Projeto (Funções E Variáveis de UI).
 */
function traceDependencies(document) {
    const code = document.getText();
    const tree = parser.parse(code);
    const fileName = path.basename(document.fileName);
    // Set de símbolos locais de Funções/Classes (para identificar se a chamada é interna)
    const localCallableSymbols = new Set();
    exports.globalSymbolMap.forEach((loc, name) => {
        if (loc.fileName === fileName && (loc.type === 'function' || loc.type === 'class')) {
            localCallableSymbols.add(name);
        }
    });
    let currentFunctionName = null;
    function traverse(node) {
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
                if (identifierNode)
                    calleeName = identifierNode.text;
            }
            if (calleeName) {
                // --- NOVA LÓGICA DE RELEVÂNCIA ---
                // 1. O callee é um Símbolo do Projeto (Função/Classe/Variável que indexamos)?
                const calleeLocation = exports.globalSymbolMap.get(calleeName);
                // 2. O callee é Ruído Nativo (forEach, console.log, etc.)?
                const isIgnoredNative = IGNORED_NATIVE_SYMBOLS.has(calleeName);
                // REGRA: Se o símbolo NÃO está indexado (calleeLocation é undefined) E é nativo/ruído, IGNORAMOS.
                // Note que removemos a checagem de 'isImportantGlobal'
                if (isIgnoredNative || (!calleeLocation && !localCallableSymbols.has(calleeName))) {
                    return;
                }
                // Se o símbolo não for um calleeLocation (ex: document), mas for uma função local, ainda rastreamos.
                let relationship = {
                    callerSymbol: currentFunctionName,
                    calleeSymbol: calleeName,
                    callerFile: fileName
                };
                if (calleeLocation) {
                    relationship.calleeLocation = calleeLocation;
                }
                exports.globalRelationshipMap.push(relationship);
            }
        }
        // --- NOVO RASTREAMENTO: ACESSO A VARIÁVEIS DO PROJETO (IDENTIFIER) ---
        // Este é para mapear acessos a 'telaPrincipal', 'clientes', etc.
        if (node.type === 'identifier' && currentFunctionName) {
            const variableName = node.text;
            // 1. A variável deve ser um Símbolo do Projeto (indexada).
            const variableLocation = exports.globalSymbolMap.get(variableName);
            // 2. Não deve ser uma declaração (evita let x = ...) nem a si mesmo.
            const parentType = node.parent ? node.parent.type : null;
            const isDeclaration = parentType === 'variable_declarator' || parentType === 'function_declaration' || parentType === 'class_declaration' || parentType === 'property_identifier';
            // 3. Não deve ser ruído nativo
            const isIgnoredNative = IGNORED_NATIVE_SYMBOLS.has(variableName);
            // 4. Não rastreamos 'document' ou 'window' para este tipo de acesso (se quiser filtrar mesmo o document)
            const isGlobalApi = variableName === 'document' || variableName === 'window';
            if (variableLocation && !isDeclaration && !localCallableSymbols.has(variableName) && !isIgnoredNative && !isGlobalApi) {
                let relationship = {
                    callerSymbol: currentFunctionName,
                    calleeSymbol: variableName,
                    callerFile: fileName,
                };
                exports.globalRelationshipMap.push(relationship);
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
async function analyzeProject() {
    if (!vscode.workspace.workspaceFolders)
        return;
    // 1. Limpa e popula o mapa de símbolos (Indexação)
    exports.globalSymbolMap.clear();
    const files = await vscode.workspace.findFiles('**/*.js', '**/node_modules/**', 100);
    for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        extractAndIndexSymbols(document);
    }
    console.log("CodeMapper: Indexação de projeto concluída.");
    // 2. Limpa e rastreia as dependências (Rastreamento)
    exports.globalRelationshipMap.length = 0;
    for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        traceDependencies(document);
    }
    console.log("CodeMapper: Rastreamento de Dependências Concluído!");
}
//# sourceMappingURL=analyzer.js.map