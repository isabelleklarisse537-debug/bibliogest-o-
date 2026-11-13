/*
 * Bibliogestão — reconhecimento da estrutura do banco.
 * Identifica entidades (acervo, alunos, empréstimos, bibliotecários)
 * combinando o nome da tabela com a assinatura das colunas.
 */
(function () {
  "use strict";

  const BG = (window.BG = window.BG || {});
  const { normalize, normalizeSearch, cleanText } = BG.utils;

  const ENTITY_DEFINITIONS = {
    books: {
      label: "Acervo",
      icon: "📚",
      aliases: [
        "item",
        "items",
        "itens",
        "livro",
        "livros",
        "acervo",
        "obra",
        "obras",
        "book",
        "books",
        "catalogo",
        "catalog"
      ],
      required: ["title", "code"],
      fields: {
        code: {
          label: "Tombo",
          names: ["codtomb", "codtombamento", "tombamento", "tombo", "numerotombo", "codigotombo", "codigolivro", "codigodoitem"],
          patterns: [/cod.*tomb/, /tomb/, /^id$/, /^codigo$/]
        },
        title: {
          label: "Título",
          names: ["titulo", "titulodolivro", "titulodolivro", "nomedolivro", "nomeobra", "obra", "nome", "title"],
          patterns: [/titulo/, /^obra$/, /^title$/]
        },
        author: {
          label: "Autor",
          names: ["autor", "autores", "nomedoautor", "author", "authors"],
          patterns: [/autor/, /author/]
        },
        publisher: {
          label: "Editora",
          names: ["editora", "editoras", "publisher", "imprensa"],
          patterns: [/editor/, /publisher/]
        },
        origin: {
          label: "Origem",
          names: ["origem", "origemitem", "fonte", "aquisicao", "formaaquisicao", "origin", "source"],
          patterns: [/origem/, /aquisic/, /^fonte$/, /origin/]
        },
        acquiredAt: {
          label: "Data de aquisição",
          names: ["dataaq", "dataaquisicao", "dataentrada", "dtaquisicao", "datacadastro", "acquiredat"],
          patterns: [/data.*aq/, /data.*entrada/, /data.*cadastro/]
        },
        status: {
          label: "Situação",
          names: ["satus", "status", "situacao", "disponibilidade", "estado"],
          patterns: [/status/, /situac/, /satus/, /disponib/]
        },
        category: {
          label: "Categoria",
          names: ["categoria", "genero", "classe", "assunto", "category", "genre"],
          patterns: [/categoria/, /genero/, /assunto/]
        },
        year: {
          label: "Ano",
          names: ["ano", "anopublicacao", "anoedicao", "year"],
          patterns: [/^ano/, /year/]
        }
      }
    },
    readers: {
      label: "Alunos",
      icon: "👥",
      aliases: [
        "leitor",
        "leitores",
        "aluno",
        "alunos",
        "estudante",
        "estudantes",
        "student",
        "students",
        "usuario",
        "usuarios",
        "member",
        "members",
        "pessoa",
        "pessoas"
      ],
      required: ["name", "registration"],
      fields: {
        registration: {
          label: "Matrícula",
          names: ["matriculaleitor", "matriculaaluno", "matricula", "mat", "ra", "rm", "registro", "registration", "codigoaluno"],
          patterns: [/matricul/, /^ra$/, /^rm$/, /registration/]
        },
        name: {
          label: "Nome",
          names: ["nomeleitor", "nomealuno", "nomecompleto", "nome", "aluno", "leitor", "name", "student"],
          patterns: [/nome/, /^name$/]
        },
        email: {
          label: "E-mail",
          names: ["emailleitor", "emailaluno", "email", "eemail", "mail"],
          patterns: [/email/, /e.?mail/]
        },
        gender: {
          label: "Sexo",
          names: ["sexo", "genero", "gender"],
          patterns: [/sexo/, /genero/, /gender/]
        },
        status: {
          label: "Situação",
          names: ["satus", "status", "situacao", "ativo", "estado"],
          patterns: [/status/, /situac/, /satus/, /^ativo$/]
        },
        className: {
          label: "Turma",
          names: ["turma", "serie", "classe", "anoescolar", "class", "grade"],
          patterns: [/turma/, /serie/, /classe/, /^ano/]
        },
        phone: {
          label: "Telefone",
          names: ["telefoneleitor", "telefonealuno", "telefone", "celular", "whatsapp", "fone", "phone", "telephone"],
          patterns: [/telefone/, /celular/, /whatsapp/, /^fone$/, /phone/]
        }
      }
    },
    librarians: {
      label: "Bibliotecários",
      icon: "🧑‍💼",
      aliases: [
        "bibliotecario",
        "bibliotecarios",
        "bibliotecaria",
        "bibliotecarias",
        "funcionario",
        "funcionarios",
        "colaborador",
        "colaboradores",
        "staff",
        "employee",
        "employees"
      ],
      required: ["name", "registration"],
      fields: {
        registration: {
          label: "Matrícula",
          names: ["matriculabib", "matriculabibliotecario", "matricula", "registro", "registration"],
          patterns: [/matricul/, /registration/]
        },
        name: {
          label: "Nome",
          names: ["nomebib", "nomebibliotecario", "nomecompleto", "nome", "name"],
          patterns: [/nome/, /^name$/]
        },
        login: {
          label: "Login",
          names: ["login", "usuario", "user", "username"],
          patterns: [/login/, /usuario/, /user/]
        },
        phone: {
          label: "Telefone",
          names: ["telefonebib", "telefonebibliotecario", "telefone", "celular", "fone", "phone"],
          patterns: [/telefone/, /celular/, /^fone$/, /phone/]
        },
        key: {
          label: "Chave interna",
          names: ["chave", "key", "codigochave"],
          patterns: [/chave/, /^key$/]
        }
      }
    },
    loans: {
      label: "Empréstimos",
      icon: "📖",
      aliases: [
        "emprestimo",
        "emprestimos",
        "loan",
        "loans",
        "movimentacao",
        "movimentacoes",
        "circulacao",
        "retirada",
        "retiradas",
        "emprestimolivro"
      ],
      required: ["bookCode", "readerRegistration", "dueDate"],
      fields: {
        id: {
          label: "Identificador",
          names: ["idemp", "idemprestimo", "codemprestimo", "codigoemprestimo", "id", "codigo"],
          patterns: [/^id/, /cod.*emp/]
        },
        bookCode: {
          label: "Tombo do livro",
          names: ["codtomb", "codigolivro", "codigotombo", "tombo", "item", "livro", "exemplar", "bookcode", "bookid"],
          patterns: [/cod.*tomb/, /tomb/, /.*livro.*cod/, /^item$/, /^livro$/]
        },
        readerRegistration: {
          label: "Matrícula do aluno",
          names: ["matriculaleitor", "matriculaaluno", "matriculaleitora", "matricula", "leitor", "aluno", "readercode", "readerid"],
          patterns: [/matricul.*leitor/, /matricul.*aluno/, /^leitor$/, /^aluno$/]
        },
        librarianRegistration: {
          label: "Matrícula do bibliotecário",
          names: ["matriculabib", "matriculabibliotecario", "bibliotecario", "bibliotecaria", "funcionario", "librarian"],
          patterns: [/matricul.*bib/, /bib/, /funcionario/]
        },
        loanDate: {
          label: "Data do empréstimo",
          names: ["datemp", "dataemp", "dataemprestimo", "dtemprestimo", "dataretirada", "loanDate", "loandate"],
          patterns: [/data.*emp/, /dt.*emp/, /data.*retirada/]
        },
        dueDate: {
          label: "Data prevista de devolução",
          names: ["datdev", "datadevolucao", "dataprevistadevolucao", "dataprevisao", "vencimento", "datavencimento", "duedate"],
          patterns: [/data.*dev/, /previs/, /vencimento/]
        },
        returnDate: {
          label: "Data de devolução",
          names: ["datretorno", "dataretorno", "datadevolvido", "datadeentrega", "dataentrega", "datareal", "devolvidoem", "returndate"],
          patterns: [/retorno/, /entrega/, /real/, /devolvido/]
        }
      }
    }
  };

  function tableNameScore(tableName, aliases) {
    const name = normalize(tableName);
    if (!name) return 0;
    if (aliases.includes(name)) return 140;

    let best = 0;
    aliases.forEach(alias => {
      if (name.startsWith(alias) || name.endsWith(alias)) {
        best = Math.max(best, 85);
      } else if (name.includes(alias)) {
        best = Math.max(best, 65);
      }
    });
    return best;
  }

  function mapColumns(columns, fieldDefinitions) {
    const used = new Set();
    const fields = {};
    const labels = {};

    Object.entries(fieldDefinitions).forEach(([field, definition]) => {
      let best = null;

      columns.forEach(column => {
        if (used.has(column.name)) return;
        const name = normalize(column.name);
        if (!name) return;

        let score = 0;
        const exactIndex = definition.names.findIndex(candidate => normalize(candidate) === name);
        if (exactIndex >= 0) score = 110 - exactIndex;

        if (!score && definition.patterns) {
          definition.patterns.forEach((pattern, index) => {
            if (pattern.test(name)) {
              score = Math.max(score, 78 - index * 3);
            }
          });
        }

        if (score > 0 && (!best || score > best.score)) {
          best = { column: column.name, score };
        }
      });

      if (best) {
        fields[field] = best.column;
        labels[field] = definition.label;
        used.add(best.column);
      }
    });

    return { fields, labels, used };
  }

  function scoreCandidate(entityKey, definition, table) {
    const nameScore = tableNameScore(table.name, definition.aliases);
    const mapped = mapColumns(table.columns, definition.fields);
    const mappedCount = Object.keys(mapped.fields).length;
    const requiredFound = definition.required.filter(field => mapped.fields[field]).length;
    const requiredTotal = definition.required.length;

    let score = nameScore + mappedCount * 8 + requiredFound * 18;
    if (requiredFound === requiredTotal && requiredTotal > 0) score += 20;

    const plausible =
      nameScore > 0 ||
      (mappedCount >= 3 && requiredFound === requiredTotal);

    return {
      entityKey,
      definition,
      table,
      score: plausible ? score : 0,
      mapped,
      mappedCount,
      requiredFound,
      requiredTotal
    };
  }

  /**
   * Recebe a lista de tabelas inspecionadas e devolve o mapeamento das
   * entidades. A atribuição é gulosa: a melhor combinação tabela/entidade
   * vence, evitando usar a mesma tabela em duas telas.
   */
  function detectSchema(tables) {
    const candidates = [];

    tables.forEach(table => {
      Object.entries(ENTITY_DEFINITIONS).forEach(([entityKey, definition]) => {
        const candidate = scoreCandidate(entityKey, definition, table);
        if (candidate.score > 0) candidates.push(candidate);
      });
    });

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entityKey.localeCompare(b.entityKey);
    });

    const entities = {};
    const usedTables = new Set();
    const usedEntities = new Set();

    candidates.forEach(candidate => {
      if (usedTables.has(candidate.table.name) || usedEntities.has(candidate.entityKey)) {
        return;
      }

      usedTables.add(candidate.table.name);
      usedEntities.add(candidate.entityKey);

      const missingRequired = candidate.definition.required.filter(
        field => !candidate.mapped.fields[field]
      );

      entities[candidate.entityKey] = {
        key: candidate.entityKey,
        label: candidate.definition.label,
        icon: candidate.definition.icon,
        table: candidate.table.name,
        fields: candidate.mapped.fields,
        labels: candidate.mapped.labels,
        required: candidate.definition.required,
        missingRequired,
        ignoredColumns: candidate.table.columns
          .map(column => column.name)
          .filter(column => !candidate.mapped.used.has(column)),
        score: candidate.score,
        rowCount: candidate.table.rowCount
      };
    });

    const warnings = [];
    Object.entries(ENTITY_DEFINITIONS).forEach(([entityKey, definition]) => {
      if (!entities[entityKey]) {
        warnings.push(
          `Tabela de ${definition.label.toLowerCase()} não reconhecida. A tela ficará sem dados.`
        );
        return;
      }

      const missing = entities[entityKey].missingRequired;
      if (missing.length) {
        const labels = missing.map(field => definition.fields[field].label);
        warnings.push(
          `A tabela "${entities[entityKey].table}" não possui: ${labels.join(", ")}.`
        );
      }
    });

    return {
      entities,
      usedTables,
      unmatchedTables: tables
        .filter(table => !usedTables.has(table.name))
        .map(table => table.name),
      warnings
    };
  }

  function valueOf(row, fields, field) {
    const column = fields[field];
    return column ? row[column] : undefined;
  }

  /** Resolve colunas duplicadas/maiúsculas ao ler uma linha bruta. */
  function rowReader(row, table) {
    const map = new Map();
    Object.keys(row).forEach(key => {
      map.set(normalize(key), row[key]);
    });
    const columns = table.columns.map(column => ({
      column,
      key: normalize(column.name)
    }));

    return field => {
      const column = columns.find(item => normalize(item.column.name) === normalize(field));
      if (!column) return undefined;
      return map.get(column.key);
    };
  }

  /**
   * Normaliza uma linha bruta usando o mapeamento, mantendo o registro
   * original em `raw` para a aba de exploração.
   */
  function pick(row, tableInfo, fields, field) {
    const columnName = fields[field];
    if (!columnName) return "";
    const columnKey = Object.keys(row).find(
      key => normalize(key) === normalize(columnName)
    );
    return columnKey === undefined ? "" : row[columnKey];
  }

  BG.schema = {
    ENTITY_DEFINITIONS,
    detectSchema,
    valueOf,
    rowReader,
    pick,
    tableNameScore
  };
})();
