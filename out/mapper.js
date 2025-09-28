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
exports.generateDocumentation = generateDocumentation;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs")); // Módulo nativo do Node.js para salvar o arquivo
// Importa TODAS as estruturas de dados necessárias do analyzer.ts
const analyzer_1 = require("./analyzer");
// ----------------------------------------------------------------------
// 1. Funções de Formatação (Aplicando as Regras de Tipagem e Visibilidade)
// ----------------------------------------------------------------------
function getVisibilitySymbol(isExportable) {
    // Regras '++' (Exportável) e '+' (Global de Módulo).
    // Nota: Simplificado, assumindo que se não for '++' mas estiver no globalSymbolMap, é '+'.
    return isExportable ? '++' : '+';
}
function getVariableTypeSymbol(type) {
    // Regras de Sufixo de Tipagem
    if (type === 'class')
        return ' Class'; // Classes são diferenciadas
    if (type.includes('[]'))
        return '[]';
    if (type.includes('{}'))
        return '{}';
    return ''; // Para variáveis Simples (que filtramos no analyzer, mas é bom manter a regra)
}
// ----------------------------------------------------------------------
// 2. Geração da Relação (Aplicando o Fluxo de Serviço Bi-Direcional)
// ----------------------------------------------------------------------
/**
 * Monta as relações de Serviço (função < função) e Estado (função > variável) para um único símbolo.
 */
function generateRelationships(symbolName, currentFile) {
    // Filtra as relações onde o símbolo atual é o CHAMADOR
    const clientRelations = analyzer_1.globalRelationshipMap.filter(rel => rel.callerSymbol === symbolName && rel.callerFile === currentFile);
    // Usa um Set para garantir que cada relação única (chamador -> callee) seja listada apenas uma vez.
    const uniqueRelationshipLines = new Set();
    for (const rel of clientRelations) {
        let line = `${rel.callerSymbol}() < ${rel.calleeSymbol}()`;
        if (rel.calleeLocation && rel.calleeLocation.fileName !== currentFile) {
            line += ` <= ${rel.calleeLocation.fileName}`;
        }
        // Adiciona a linha (SEM tabulação) ao Set para garantir a unicidade
        uniqueRelationshipLines.add(line);
    }
    // Converte o Set de volta para um array de strings e adiciona a tabulação e o hífen.
    return Array.from(uniqueRelationshipLines).map(line => `\t\t- ${line}`);
}
// ----------------------------------------------------------------------
// 3. Função Principal: Geração do Documento
// ----------------------------------------------------------------------
/**
 * Gera o documento final para todos os arquivos analisados e salva em um arquivo de texto.
 */
function generateDocumentation(projectRoot) {
    let finalDocumentation = "";
    // 1. Agrupa os símbolos por arquivo
    const symbolsByFile = new Map();
    analyzer_1.globalSymbolMap.forEach((location, name) => {
        if (!symbolsByFile.has(location.fileName)) {
            symbolsByFile.set(location.fileName, new Map());
        }
        symbolsByFile.get(location.fileName)?.set(name, location);
    });
    // 2. Percorre cada arquivo e gera a documentação
    symbolsByFile.forEach((symbols, fileName) => {
        finalDocumentation += `\n===================================================================================\n`;
        finalDocumentation += `                  ${fileName}\n`;
        finalDocumentation += `===================================================================================\n\n`;
        // Armazenadores temporários para ordenar a saída
        const functionDocs = [];
        const variableDocs = [];
        // Ordena os símbolos para que os '++' venham primeiro
        const sortedSymbols = Array.from(symbols.entries()).sort(([, a], [, b]) => {
            if (a.isExportable && !b.isExportable)
                return -1;
            if (!a.isExportable && b.isExportable)
                return 1;
            return 0;
        });
        // 3. Processa cada símbolo no arquivo
        for (const [symbolName, location] of sortedSymbols) {
            const typeSuffix = getVariableTypeSymbol(location.type);
            const symbol = `${symbolName}${typeSuffix}`;
            const visibility = getVisibilitySymbol(location.isExportable);
            // Inicia a linha com a tipagem e o nome
            let docLine = `    ${visibility} ${symbol}`; // Recuo inicial para melhor legibilidade
            // Adiciona relações (fluxo de serviço/estado)
            const relations = generateRelationships(symbolName, fileName);
            if (relations.length > 0) {
                // Adiciona as relações abaixo do símbolo principal (com recuo extra)
                docLine += `\n${relations.map(rel => `        - ${rel}`).join('\n')}`;
            }
            // Separa por tipo
            if (location.type === 'variable') {
                variableDocs.push(docLine);
            }
            else {
                functionDocs.push(docLine);
            }
        }
        // 4. Adiciona as seções ao documento, garantindo o título das seções
        finalDocumentation += `# Variáveis\n\n${variableDocs.join('\n')}\n\n`;
        finalDocumentation += `# Funções e Classes\n\n${functionDocs.join('\n')}\n`;
    });
    // 5. Salva o arquivo de documentação final
    const outputFilePath = path.join(projectRoot.uri.fsPath, 'CODE_ARCHITECTURE.md');
    fs.writeFileSync(outputFilePath, finalDocumentation);
    vscode.window.showInformationMessage(`CodeMapper: Documentação gerada em ${path.basename(outputFilePath)}`);
}
//# sourceMappingURL=mapper.js.map