
-----

<h1 align="center">
==========================<br>
Documentação CodeMapper
<br>==========================
</h1>

## Elementos Exportáveis (Públicos de Sistema)
Variável ou função declarada com 'export' no nível superior do módulo. Representa a interface pública do arquivo.

## Elementos Globais (Públicos de Módulo)
Qualquer variável ou função declarada no escopo global (nível superior do arquivo) sem a palavra-chave 'export'. Acessível em qualquer escopo dentro do arquivo.

## Elementos Implícitos (Privados)
Variáveis e funções declaradas dentro de um bloco, função ou classe. Não podem ser acessadas fora do escopo de declaração.

---

## Tipagem Declarativa (Hierarquia de Visibilidade e Estrutura)

| Símbolo | Tipo | Definição |
| :--- | :--- | :--- |
| **++** | **Exportável** | Elemento de acesso público para outros arquivos. (Topo da hierarquia visual) |
| **+** | **Público** | Elemento de acesso global, exclusivo do módulo. |
| **-** | **Privado** | Elemento de acesso local dentro do seu escopo. |
| **~** | **Assíncrona** | Tipagem para variáveis que armazenam o *valor resolvido* de uma promise (resultado assíncrono), definida por “~” em sua citação. |

**Regra de Estrutura:** Classes e Funções Agregadoras (Aninhadas) agem como containers: **todos os seus elementos e eventos internos terão recuo visual**, independentemente da tipagem (`+` ou `-`), para mostrar a relação de dependência e encapsulamento.

---

# Sintaxe Especial

| Tipos | Descrição | Exemplo de Sintaxe |
| :--- | :--- | :--- |
| **Classes** | Estrutura para Orientação a Objetos (OO). É definida pela palavra-chave `class` imediatamente após sua tipagem declarativa. | `++ class Classe()` |
| **Funções Assíncronas** | Função não-bloqueante que retorna uma `promise`. É definida pela palavra-chave `async` imediatamente após sua tipagem declarativa | `+ async função()` |

---

# Tipos de Variáveis (Foco em Estrutura)

| Tipo | Regra de Definição |
| :--- | :--- |
| **Simples** | Guardam apenas um valor de tipo primitivo. |
| **Compostos[]** | Contêm mais de um valor atribuído, geralmente como um Array (`[...]`). |
| **Objetos{}** | Valor atributo a palavras-chave e valor, geralmente como um Objeto Literal (`{...}`). |
| **Atributos** | Variáveis declaradas e acessadas através de uma Classe. |
| **Resultado Assíncrono** | Variáveis que armazenam o valor final resolvido de uma promise, sua instância dentro do código é declarada com a palavra reservada **await**, sendo declarada apenas dentro de **funções assíncronas**. |


**Nota:** Variáveis Locais simples de coleta de dados (ex: `let nome = ...value`) são consideradas **irrelevantes** e não são documentadas para reduzir o ruído. A ferramenta foca nas variáveis de agregação estrutural.

---

# Tipos de Função

| Tipo | Regra de Definição |
| :--- | :--- |
| **Simples s. Parâmetros** | Executa uma ação sem a necessidade de parâmetros. |
| **Simples c. Parâmetros** | Executa ações com os parâmetros atribuídos na sua declaração. |
| **Aninhada / Hierárquicas** | Funções que aninham outras funções em seu escopo (funções 'filhas'), podendo gerenciar a execução ou o retorno delas. Podendo ter parâmetros na função pai e/ou no filho, ou sem parâmetros em ambas. |
| **Métodos** | Funções atribuídas dentro de Classe. |
| **Assíncronas** | Função designada para executar operações assíncronas, sempre retornando uma promise Implicitamente. Permite o uso do operador **await** em seu corpo. Sua declaração deve seguir as regras da **Sintaxe Especial**. |

---

# Esquema de Relações (Fluxo de Serviço Bi-Direcional)

**Nota:** A leitura dos eventos é da esquerda para a direita.

| **Notação** | **Conceito** | **Lógica de Análise** |
| :--- | :--- | :--- |
| `variável > variável` | **Atribuição ativa de valor (fornecer)** | Um evento onde a variável à esquerda fornece seu valor para a variável à direita, sendo proibido o envolvimento de `variáveis assíncronas (~)` |
| `variável < variável` | **Atribuição passiva de valor (receber)** | Um evento onde a variável à esquerda recebe seu valor pela variável à direita, sendo proibido o envolvimento de `variáveis assíncronas (~)` |
| `variável > função()` | **Condição de ativação** | Variável é usada como condição para ativar a função. |
| `variável < função()` | **Atribuição de Retorno** | Variável recebe o valor de retorno de uma função. |
| `função() > variável` | **Modificação de Estado** | A função faz uma alteração em uma variável que é **Global/Exportável** (estado do módulo). |
| `função() < variável` | **Recebimento de parâmetro** | Função recebe valor da variável como parâmetro para sua execução |
| `função() > função()` | **Prestação de Serviço (Prestador)** | A função à esquerda (Prestador) **foi chamada** pela função à direita (Cliente). |
| `função() < função()` | **Dependência (Cliente)** | A função à esquerda (Cliente) **chamou** a função à direita (Prestador) em sua execução. |
| `Classe() < variável` | **Construtor** | A instância de uma **classe** recebe o valor de **variável(s)** em seu construtor. |
| `variável < Classe()` | **Destrutor** | A(s) variável(s) à esquerda recebe(m) valor(es) **extraído(s)** de uma instância de classe (objeto). |
| `elemento <- elemento` | **Referência Interna** | Elemento Privado (`-`) é referenciado e ligado ao seu escopo de declaração (dentro do mesmo arquivo). |
| `elemento <= arquivo.extensão` | **Referência Externa** | Elemento é declarado em outro arquivo (resolvido pelo Mapa Global). |
| `( variáveis )` | **Agrupamento de valor** | Usado para agrupar vários valores  |
| `{ evento }` | **Agrupamento Lógico** | Forma usada para isolar ou encadear uma relação na intenção de ligá-la a outra, fazendo com que a relação isolada se comporte como um **único termo**. |

---

**Obs:** A nomenclatura dos elementos será idêntica ao código fonte, com o objetivo de visualizar erros de convenções.

---
