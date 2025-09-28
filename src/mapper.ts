import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs'; // Módulo nativo do Node.js para salvar o arquivo

// Importa TODAS as estruturas de dados necessárias do analyzer.ts
import { 
    globalSymbolMap, 
    globalRelationshipMap, 
    CallRelationship,  // <-- Corrigido: Agora importado
    SymbolLocation     // <-- Corrigido: Agora importado
} from './analyzer';

// ----------------------------------------------------------------------
// 1. Funções de Formatação (Aplicando as Regras de Tipagem e Visibilidade)
// ----------------------------------------------------------------------

function getVisibilitySymbol(isExportable: boolean): string {
    // Regras '++' (Exportável) e '+' (Global de Módulo).
    // Nota: Simplificado, assumindo que se não for '++' mas estiver no globalSymbolMap, é '+'.
    return isExportable ? '++' : '+'; 
}

function getVariableTypeSymbol(type: string): string {
    // Regras de Sufixo de Tipagem
    if (type === 'class') return ' Class'; // Classes são diferenciadas
    if (type.includes('[]')) return '[]'; 
    if (type.includes('{}')) return '{}';
    return ''; // Para variáveis Simples (que filtramos no analyzer, mas é bom manter a regra)
}

// ----------------------------------------------------------------------
// 2. Geração da Relação (Aplicando o Fluxo de Serviço Bi-Direcional)
// ----------------------------------------------------------------------

/**
 * Monta as relações de Serviço (função < função) e Estado (função > variável) para um único símbolo.
 */
function generateRelationships(symbolName: string, currentFile: string): string[] {
    
    // Filtra as relações onde o símbolo atual é o CHAMADOR
    const clientRelations = globalRelationshipMap.filter(
        rel => rel.callerSymbol === symbolName && rel.callerFile === currentFile
    );

    // Usa um Set para garantir que cada relação única (chamador -> callee) seja listada apenas uma vez.
    const uniqueRelationshipLines = new Set<string>();
    
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
export function generateDocumentation(projectRoot: vscode.WorkspaceFolder) {
    let finalDocumentation = "";
    
    // 1. Agrupa os símbolos por arquivo
    const symbolsByFile = new Map<string, Map<string, SymbolLocation>>();
    globalSymbolMap.forEach((location, name) => {
        if (!symbolsByFile.has(location.fileName)) {
            symbolsByFile.set(location.fileName, new Map<string, SymbolLocation>());
        }
        symbolsByFile.get(location.fileName)?.set(name, location);
    });
    
    // 2. Percorre cada arquivo e gera a documentação
    symbolsByFile.forEach((symbols, fileName) => {
        finalDocumentation += `\n===================================================================================\n`;
        finalDocumentation += `                  ${fileName}\n`;
        finalDocumentation += `===================================================================================\n\n`;

        // Armazenadores temporários para ordenar a saída
        const functionDocs: string[] = [];
        const variableDocs: string[] = [];
        
        // Ordena os símbolos para que os '++' venham primeiro
        const sortedSymbols = Array.from(symbols.entries()).sort(([, a], [, b]) => {
            if (a.isExportable && !b.isExportable) return -1;
            if (!a.isExportable && b.isExportable) return 1;
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
            } else {
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