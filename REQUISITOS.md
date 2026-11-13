# Requisitos Funcionais — Bibliogestão

Documento de referência das funcionalidades que devem ser implementadas na
plataforma. Cada requisito corresponde a uma tela alimentada pelos dados do
banco SQLite da biblioteca.

## 1. Contexto

A aplicação é uma interface web estática (HTML, CSS e JavaScript) que deve
importar o arquivo `sisbac_test.db` (SQLite), reconhecer automaticamente a
estrutura das tabelas e distribuir os registros entre as telas do sistema.

O banco de referência possui as seguintes tabelas:

| Tabela          | Conteúdo                                  | Chave primária         |
| --------------- | ----------------------------------------- | ---------------------- |
| `item`          | Acervo de livros                          | `cod_tomb`             |
| `leitor`        | Alunos/leitores cadastrados               | `matricula_leitor`     |
| `emprestimos`   | Movimentações de empréstimo               | `id_emp`               |
| `bibliotecario` | Funcionários responsáveis pelos registros | `matricula_bib`        |

Relacionamentos reconhecidos:

- `emprestimos.cod_tomb` → `item.cod_tomb`
- `emprestimos.matricula_leitor` → `leitor.matricula_leitor`
- `emprestimos.matricula_bib` → `bibliotecario.matricula_bib`

## 2. Regras gerais

- A importação deve aceitar arquivos `.db`, `.sqlite` e `.sqlite3`.
- O reconhecimento deve usar nomes de tabelas **e** nomes de colunas, sem
  depender da ordem física das colunas.
- A aplicação deve tolerar colunas ausentes e informar o que não foi possível
  mapear, sem interromper a importação dos demais registros.
- Datas devem ser lidas nos formatos `dd/mm/aaaa`, `dd-mm-aaaa` e
  `aaaa-mm-dd` e exibidas em `dd/mm/aaaa`.
- A situação dos empréstimos deve ser calculada pela data prevista de
  devolução em relação à data atual: `Em andamento`, `Vence hoje`,
  `Atrasado` ou `Devolvido`.
- Nenhuma senha ou chave interna do banco deve ser exibida nas telas.
- Os filtros e buscas de cada tela devem funcionar em memória, sem recarregar
  a página.

## 3. Requisitos por tela

### RF-01 — Base de Dados: importação e reconhecimento da estrutura

**Descrição:** permitir que o usuário selecione o arquivo SQLite da biblioteca,
valide o arquivo e visualize o resultado do reconhecimento automático da
estrutura antes de usar os dados nas demais telas.

**Critérios de aceite:**

- [ ] Selecionar um arquivo `.db`, `.sqlite` ou `.sqlite3` e carregá-lo no
      navegador usando SQLite em WebAssembly.
- [ ] Listar as tabelas encontradas, a quantidade de registros e as colunas de
      cada uma.
- [ ] Identificar automaticamente as entidades **Acervo**, **Alunos**,
      **Empréstimos** e **Bibliotecários**, inclusive quando os nomes das
      tabelas/colunas variarem (ex.: `item`/`livro`, `leitor`/`aluno`,
      `satus`/`status`).
- [ ] Exibir um resumo do mapeamento: tabela usada, campos reconhecidos e
      campos obrigatórios ausentes.
- [ ] Exibir aviso quando o arquivo não for um SQLite válido ou não possuir
      tabelas reconhecíveis.
- [ ] Permitir consultar os registros brutos de qualquer tabela do arquivo.
- [ ] Permitir fechar o banco e limpar os dados da sessão.
- [ ] Oferecer um botão para carregar o banco de exemplo `sisbac_test.db`
      quando a aplicação estiver publicada em um servidor web.
- [ ] Com o banco de exemplo, reconhecer 12 livros, 8 alunos, 12 empréstimos
      e 3 bibliotecários.

### RF-02 — Visão Geral

**Descrição:** apresentar os principais indicadores do acervo e da circulação
assim que um banco for importado.

**Critérios de aceite:**

- [ ] Exibir cartões com total de livros, alunos, empréstimos ativos,
      empréstimos atrasados e devolvidos.
- [ ] Exibir a distribuição dos empréstimos por situação.
- [ ] Exibir os empréstimos mais recentes com livro, aluno, data prevista e
      situação.
- [ ] Exibir um destaque de alerta com a quantidade de pendências e atalho
      para a tela de Pendências.
- [ ] Exibir a composição do acervo por origem (ex.: doação e compra).
- [ ] Atualizar todos os indicadores automaticamente após cada importação.
- [ ] Mostrar estado vazio orientando a importar um banco quando não houver
      dados.

### RF-03 — Acervo de Livros

**Descrição:** listar e permitir consultar todos os itens do acervo.

**Critérios de aceite:**

- [ ] Listar tombo, título, autor, editora, origem, data de aquisição,
      situação e vínculo com empréstimo ativo.
- [ ] Calcular a disponibilidade do item: `Emprestado` quando houver
      empréstimo ativo, senão refletir a situação cadastrada (`Disponível`,
      `Baixado` etc.).
- [ ] Permitir busca por título, autor, editora ou tombo.
- [ ] Permitir filtrar por situação (todos, disponíveis, emprestados,
      baixados).
- [ ] Permitir ordenação por título, autor ou data de aquisição.
- [ ] Exibir contagem de resultados e estado vazio adequado.

### RF-04 — Alunos

**Descrição:** listar e permitir consultar os alunos/leitores cadastrados.

**Critérios de aceite:**

- [ ] Listar matrícula, nome, turma, e-mail, telefone e situação.
- [ ] Exibir a quantidade de empréstimos ativos e de pendências por aluno.
- [ ] Permitir busca por nome, matrícula, turma, e-mail ou telefone.
- [ ] Permitir filtrar por turma e por situação (ativos/inativos).
- [ ] Exibir contagem de resultados e estado vazio adequado.
- [ ] Disponibilizar atalho de contato por WhatsApp quando houver telefone.

### RF-05 — Empréstimos

**Descrição:** listar e acompanhar todas as movimentações de empréstimo.

**Critérios de aceite:**

- [ ] Listar identificador, livro, aluno, turma, bibliotecário responsável,
      data do empréstimo, data prevista de devolução e situação.
- [ ] Calcular e exibir os dias em atraso ou os dias restantes para devolução.
- [ ] Permitir filtrar por situação (todos, em andamento, vencendo hoje,
      atrasados, devolvidos).
- [ ] Permitir busca por livro, aluno, matrícula ou tombo.
- [ ] Exibir resumo com a contagem de cada situação.
- [ ] Exibir estado vazio adequado quando não houver empréstimos.

### RF-06 — Pendências

**Descrição:** destacar os empréstimos atrasados e facilitar a cobrança dos
alunos.

**Critérios de aceite:**

- [ ] Listar somente empréstimos não devolvidos com data prevista anterior à
      data atual.
- [ ] Exibir nome do aluno, turma, telefone, livro, data prevista, dias em
      atraso e bibliotecário responsável.
- [ ] Ordenar da maior para a menor quantidade de dias em atraso.
- [ ] Gerar link de WhatsApp com mensagem de cobrança pré-preenchida contendo
      nome do aluno, título do livro e data prevista.
- [ ] Exibir total de pendências e média de dias em atraso.
- [ ] Exibir estado vazio de conformidade quando não houver atrasos.

### RF-07 — Bibliotecários

**Descrição:** listar os funcionários responsáveis pelos empréstimos.

**Critérios de aceite:**

- [ ] Listar matrícula, nome, login e telefone.
- [ ] Exibir a quantidade de empréstimos registrados por bibliotecário.
- [ ] Permitir busca por nome, matrícula ou login.
- [ ] Não exibir senha nem chave interna.
- [ ] Exibir estado vazio adequado quando a tabela não existir ou estiver
      vazia.

### RF-08 — Relatórios

**Descrição:** consolidar indicadores para apoio à gestão do acervo e da
circulação.

**Critérios de aceite:**

- [ ] Exibir indicadores gerais: taxa de ocupação do acervo, média de
      empréstimos por aluno e percentual de atrasos.
- [ ] Exibir ranking de autores com mais títulos no acervo.
- [ ] Exibir distribuição de empréstimos por turma.
- [ ] Exibir distribuição do acervo por origem e por situação.
- [ ] Permitir exportar o relatório consolidado em CSV.
- [ ] Atualizar os relatórios automaticamente após cada importação.

## 4. Fora de escopo nesta versão

- Edição, exclusão ou criação de registros no banco importado.
- Login e controle de acesso de bibliotecários.
- Persistência dos dados entre recarregamentos da página.
- Envio automático de mensagens (o WhatsApp é aberto com a mensagem
  pré-preenchida e o envio é confirmado pelo usuário).
