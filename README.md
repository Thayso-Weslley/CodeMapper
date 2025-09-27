
-----

## Documento de Regras Finalizadas: CodeMapper

# ========================<br>NomeDoArquivo.extensão<br>========================

# Elementos: Visibilidade e Escopo

# Elementos Exportáveis (Públicos de Sistema)
    Variável ou função declarada com 'export' no nível superior do módulo. Representa a interface pública do arquivo.

# Elementos Globais (Públicos de Módulo)
    Qualquer variável ou função declarada no escopo global (nível superior do arquivo) sem a palavra-chave 'export'. Acessível em qualquer escopo dentro do arquivo.

# Elementos Implícitos (Privados)
    Variáveis e funções declaradas dentro de um bloco, função ou classe. Não podem ser acessadas fora do escopo de declaração.

---

# Tipagem Declarativa (Hierarquia de Visibilidade e Estrutura)

| Símbolo | Tipo | Definição |
| :--- | :--- | :--- |
| **++** | **Exportável** | Elemento de acesso público para outros arquivos. (Topo da hierarquia visual) |
| **+** | **Público** | Elemento de acesso global, exclusivo do módulo. |
| **-** | **Privado** | Elemento de acesso local dentro do seu escopo. |

**Regra de Estrutura:** Classes e Funções Agregadoras (Aninhadas) agem como containers: **todos os seus elementos e eventos internos terão recuo visual**, independentemente da tipagem (`+` ou `-`), para mostrar a relação de dependência e encapsulamento.

---

# Tipos de Variáveis (Foco em Estrutura)

**Nota:** Variáveis Locais simples de coleta de dados (ex: `let nome = ...value`) são consideradas **irrelevantes** e não são documentadas para reduzir o ruído. A ferramenta foca nas variáveis de **agregação estrutural**.

| Tipo | Regra de Definição |
| :--- | :--- |
| **Simples** | Guardam apenas um valor de tipo primitivo. |
| **Compostos** | Contêm mais de um valor atribuído, geralmente como um Array (`[...]`). |
| **Objetos** | Valor atributo a palavras-chave e valor, geralmente como um Objeto Literal (`{...}`). |
| **Atributos\*** | Variáveis declaradas e acessadas através de uma Classe\*. |

---

# Tipos de Função

| Tipo | Regra de Definição |
| :--- | :--- |
| **Simples s. Parâmetros** | Executa uma ação sem a necessidade de parâmetros. |
| **Simples c. Parâmetros** | Executa ações com os parâmetros atribuídos na sua declaração. |
| **Aninhada s. Parâmetros** | Funções que retornam ações ou valores de outras funções declaradas dentro de seu escopo, sem parâmetros. |
| **Aninhadas c. Parâmetro** | O mesmo da anterior, mas exige parâmetro para sua execução (pai ou filho). |
| **Métodos\*** | Funções atribuídas dentro de Classe\*. |

---

# Classes e Funções Agregadoras (Aninhadas)

* **Classes:** Função declarativa para orientação de objetos.
    * **Atributos\***: Variáveis internas (regra de recuo se aplica).
    * **Métodos\***: Funções internas (regra de recuo se aplica).

* **Funções Agregadoras (Aninhadas):** Funções que retornam um Objeto com métodos. Seus elementos internos seguem as regras de Classe.

---

# Esquema de Relações (Fluxo de Serviço Bi-Direcional)

**Nota:** A leitura dos eventos é da esquerda para a direita.

| Notação | Conceito | Lógica de Análise |
| :--- | :--- | :--- |
| **variável < função()** | Atribuição de Retorno. | Variável recebe o valor de retorno de uma função. |
| **variável > função()** | Condição/Parâmetro. | Variável é usada como condição ou parâmetro para ativar a função. |
| **função() < função()** | **Dependência (Cliente).** | A função à esquerda (Cliente) **chamou** a função à direita (Prestador) em sua execução. |
| **função() > função()** | **Prestação de Serviço (Prestador).** | A função à esquerda (Prestador) **foi chamada** pela função à direita (Cliente). |
| **função() > variável** | **Modificação de Estado.** | A função faz uma alteração em uma variável que é **Global/Exportável** (estado do módulo). |
| **elemento <- elemento** | **Referência Interna.** | Elemento Privado (`-`) é referenciado e ligado ao seu escopo de declaração (dentro do mesmo arquivo). |
| **elemento <= arquivo.extensão** | **Referência Externa.** | Elemento é declarado em outro arquivo (resolvido pelo Mapa Global). |
| **{ evento }** | **Agrupamento Lógico.** | Usada para isolar um evento ou *callback* complexo e ligá-lo a outro fluxo. |

---

**Obs:** A nomenclatura dos elementos será idêntica ao código fonte, com o objetivo de visualizar erros de convenções.

---
