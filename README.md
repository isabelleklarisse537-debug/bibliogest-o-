# Bibliogestão

Aplicação web para gestão de acervo escolar que importa o banco SQLite da
biblioteca, reconhece automaticamente a estrutura das tabelas e distribui os
dados entre as telas de consulta e acompanhamento.

## Funcionalidades

- Importação de arquivos `.db`, `.sqlite` e `.sqlite3` direto no navegador
  (nenhum dado é enviado para servidores).
- Reconhecimento automático das tabelas de **acervo**, **alunos**,
  **empréstimos** e **bibliotecários**, combinando nomes de tabelas e colunas.
- Visão geral com indicadores, distribuição dos empréstimos e alertas de atraso.
- Acervo com busca, disponibilidade, filtros e ordenação.
- Alunos com turma, situação, empréstimos ativos, pendências e atalho de
  WhatsApp.
- Empréstimos com prazos, dias restantes/em atraso, filtros e resumo.
- Pendências priorizadas por atraso e cobrança com mensagem pré-preenchida no
  WhatsApp.
- Bibliotecários com volume de empréstimos registrados.
- Relatórios consolidados com exportação em PDF pela opção **Salvar como
  PDF** da impressão do navegador.
- Explorador de dados brutos do banco importado.

Os requisitos completos, com critérios de aceite, estão em
[`REQUISITOS.md`](REQUISITOS.md).

## Como executar

A aplicação é estática e não precisa de processo de build.

### Opção recomendada: servidor local

```bash
python3 -m http.server 8000
```

Depois abra <http://localhost:8000>.

### Abrir o arquivo diretamente

Também é possível abrir `index.html` no navegador. Nesse caso, a biblioteca
SQLite é carregada pela CDN e o botão **Carregar exemplo** fica indisponível,
porque navegadores bloqueiam a leitura automática de arquivos locais. Use o
botão **Importar banco** para selecionar o arquivo.

## Como importar

1. Clique em **Importar banco** (no topo) ou acesse **Base de Dados**.
2. Selecione o arquivo `sisbac_test.db` ou outro SQLite da biblioteca.
3. Confira, na tela **Base de Dados**, o mapeamento das entidades, as tabelas,
   as colunas e os avisos de campos ausentes.
4. Navegue pelas telas alimentadas automaticamente.

O botão **Carregar exemplo** busca o `sisbac_test.db` incluído no repositório
quando a aplicação está sendo servida por HTTP.

## Como salvar o relatório em PDF

1. Importe um banco de dados.
2. Acesse a tela **Relatórios**.
3. Clique em **🖨️ Salvar relatório em PDF**.
4. Na janela de impressão do navegador, escolha **Salvar como PDF** como
   destino e confirme.

O relatório é formatado em A4 e inclui o banco de origem, a data de geração,
os indicadores gerais e as distribuições do acervo e dos empréstimos.

## Estrutura do banco de referência

| Tabela          | Conteúdo                     | Chave primária     |
| --------------- | ---------------------------- | ------------------ |
| `item`          | Acervo de livros             | `cod_tomb`         |
| `leitor`        | Alunos/leitores              | `matricula_leitor` |
| `emprestimos`   | Movimentações de empréstimo  | `id_emp`           |
| `bibliotecario` | Funcionários da biblioteca   | `matricula_bib`    |

O banco de exemplo contém 12 livros, 8 alunos, 12 empréstimos e 3
bibliotecários.

### Reconhecimento flexível

A aplicação não depende apenas dos nomes do arquivo de exemplo. São
reconhecidas variações como:

- `item`, `livro`, `livros`, `acervo`, `book`;
- `leitor`, `aluno`, `alunos`, `estudante`, `student`;
- `emprestimos`, `emprestimo`, `loans`, `movimentacoes`;
- `bibliotecario`, `funcionarios`, `staff`;
- colunas como `satus`/`status`, `data_aq`/`data_aquisicao`,
  `matricula_leitor`/`matricula`, `cod_tomb`/`tombo`.

Também são aceitos relacionamentos por chave primária ou por matrícula/tombo,
e datas em `dd/mm/aaaa`, `dd-mm-aaaa` e `aaaa-mm-dd`.

## Segurança dos dados

- O arquivo é processado localmente no navegador.
- Senhas, chaves internas e colunas equivalentes são omitidas das telas e
  mascaradas no explorador de dados brutos.
- Nenhum dado é persistido entre recarregamentos da página.

## Estrutura do projeto

```text
index.html              Estrutura das telas
style.css               Estilos e responsividade
js/utils.js             Datas, telefones, WhatsApp e formatação
js/schema.js            Reconhecimento de tabelas e colunas
js/database.js          Leitura do SQLite e montagem do conjunto de dados
js/analytics.js         Indicadores, vínculos e situação dos empréstimos
js/app.js               Navegação, importação e renderização das telas
vendor/sql.js/          SQLite em WebAssembly (uso local)
sisbac_test.db          Banco de exemplo
REQUISITOS.md           Requisitos funcionais e critérios de aceite
```
