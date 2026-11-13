/*
 * Bibliogestão — leitura do arquivo SQLite com sql.js.
 * Inspeciona tabelas, reconhece o schema e monta o conjunto de dados
 * consumido por todas as telas.
 */
(function () {
  "use strict";

  const BG = (window.BG = window.BG || {});
  const { cleanText, parseDate } = BG.utils;
  const { detectSchema, pick } = BG.schema;

  const SQLJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";

  let SQL = null;

  const state = {
    db: null,
    fileName: null,
    fileSize: 0,
    importedAt: null,
    integrity: null,
    tables: [],
    schema: null,
    raw: new Map(),
    data: emptyData()
  };

  function emptyData() {
    return {
      books: [],
      readers: [],
      librarians: [],
      loans: []
    };
  }

  function isLoaded() {
    return Boolean(state.db);
  }

  function sqlBaseUrl() {
    if (window.location.protocol === "file:") return SQLJS_CDN;
    return new URL("vendor/sql.js/", window.location.href).href;
  }

  async function ensureSQLite() {
    if (SQL) return SQL;

    if (typeof window.initSqlJs !== "function") {
      throw new Error(
        "A biblioteca SQLite não foi carregada. Verifique a conexão ou os arquivos em vendor/sql.js."
      );
    }

    const bases =
      window.location.protocol === "file:"
        ? [SQLJS_CDN]
        : [sqlBaseUrl(), SQLJS_CDN];

    let lastError = null;
    for (const base of bases) {
      try {
        SQL = await window.initSqlJs({
          locateFile: file => `${base}${file}`
        });
        return SQL;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Não foi possível iniciar o SQLite.");
  }

  function quoteIdentifier(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
  }

  function resultToObjects(result) {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const object = {};
      columns.forEach((column, index) => {
        object[column] = row[index];
      });
      return object;
    });
  }

  function inspectTables(db) {
    const listing = db.exec(`
      SELECT name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name COLLATE NOCASE
    `);

    if (!listing.length) return [];

    const tables = [];

    listing[0].values.forEach(([name, type]) => {
      const safeName = quoteIdentifier(name);
      let columns = [];
      let rowCount = 0;
      let rows = [];

      try {
        const info = db.exec(`PRAGMA table_info(${safeName})`);
        if (info.length) {
          columns = info[0].values.map(row => ({
            cid: row[0],
            name: row[1],
            type: row[2] || "",
            notNull: Boolean(row[3]),
            defaultValue: row[4],
            primaryKey: Number(row[5]) > 0
          }));
        }

        const count = db.exec(`SELECT COUNT(*) AS total FROM ${safeName}`);
        rowCount = count.length ? Number(count[0].values[0][0]) : 0;

        const data = db.exec(`SELECT * FROM ${safeName}`);
        rows = resultToObjects(data);
      } catch (error) {
        console.warn(`Não foi possível ler a tabela ${name}:`, error);
        rowCount = 0;
        rows = [];
      }

      tables.push({ name, type, columns, rowCount, rows });
    });

    return tables;
  }

  function buildDataset(schema, tables) {
    const data = emptyData();
    const rowsFor = entityKey => {
      const entity = schema.entities[entityKey];
      if (!entity) return [];
      const table = tables.find(item => item.name === entity.table);
      return table ? table.rows : [];
    };

    const bookEntity = schema.entities.books;
    if (bookEntity) {
      data.books = rowsFor("books").map((row, index) => {
        const code = cleanText(pick(row, null, bookEntity.fields, "code"));
        return {
          key: `book:${code || index}`,
          code,
          title: cleanText(pick(row, null, bookEntity.fields, "title")) || "Sem título",
          author: cleanText(pick(row, null, bookEntity.fields, "author")),
          publisher: cleanText(pick(row, null, bookEntity.fields, "publisher")),
          origin: cleanText(pick(row, null, bookEntity.fields, "origin")),
          acquiredAt: parseDate(pick(row, null, bookEntity.fields, "acquiredAt")),
          acquiredAtRaw: cleanText(pick(row, null, bookEntity.fields, "acquiredAt")),
          status: cleanText(pick(row, null, bookEntity.fields, "status")),
          category: cleanText(pick(row, null, bookEntity.fields, "category")),
          year: cleanText(pick(row, null, bookEntity.fields, "year")),
          raw: row
        };
      });
    }

    const readerEntity = schema.entities.readers;
    if (readerEntity) {
      data.readers = rowsFor("readers").map((row, index) => {
        const registration = cleanText(
          pick(row, null, readerEntity.fields, "registration")
        );
        return {
          key: `reader:${registration || index}`,
          registration,
          name: cleanText(pick(row, null, readerEntity.fields, "name")) || "Sem nome",
          email: cleanText(pick(row, null, readerEntity.fields, "email")),
          gender: cleanText(pick(row, null, readerEntity.fields, "gender")),
          status: cleanText(pick(row, null, readerEntity.fields, "status")),
          className: cleanText(pick(row, null, readerEntity.fields, "className")),
          phone: cleanText(pick(row, null, readerEntity.fields, "phone")),
          raw: row
        };
      });
    }

    const librarianEntity = schema.entities.librarians;
    if (librarianEntity) {
      data.librarians = rowsFor("librarians").map((row, index) => {
        const registration = cleanText(
          pick(row, null, librarianEntity.fields, "registration")
        );
        return {
          key: `librarian:${registration || index}`,
          registration,
          name: cleanText(pick(row, null, librarianEntity.fields, "name")) || "Sem nome",
          login: cleanText(pick(row, null, librarianEntity.fields, "login")),
          phone: cleanText(pick(row, null, librarianEntity.fields, "phone")),
          keyCode: cleanText(pick(row, null, librarianEntity.fields, "key")),
          raw: row
        };
      });
    }

    const loanEntity = schema.entities.loans;
    if (loanEntity) {
      data.loans = rowsFor("loans").map((row, index) => {
        const id = cleanText(pick(row, null, loanEntity.fields, "id"));
        return {
          key: `loan:${id || index}`,
          id: id || String(index + 1),
          loanDate: parseDate(pick(row, null, loanEntity.fields, "loanDate")),
          dueDate: parseDate(pick(row, null, loanEntity.fields, "dueDate")),
          returnDate: parseDate(pick(row, null, loanEntity.fields, "returnDate")),
          bookCode: cleanText(pick(row, null, loanEntity.fields, "bookCode")),
          readerRegistration: cleanText(
            pick(row, null, loanEntity.fields, "readerRegistration")
          ),
          librarianRegistration: cleanText(
            pick(row, null, loanEntity.fields, "librarianRegistration")
          ),
          book: null,
          reader: null,
          librarian: null,
          raw: row
        };
      });
    }

    const booksByCode = new Map();
    data.books.forEach(book => {
      if (book.code && !booksByCode.has(book.code)) booksByCode.set(book.code, book);
    });

    const readersByRegistration = new Map();
    data.readers.forEach(reader => {
      if (reader.registration && !readersByRegistration.has(reader.registration)) {
        readersByRegistration.set(reader.registration, reader);
      }
    });

    const librariansByRegistration = new Map();
    data.librarians.forEach(librarian => {
      if (librarian.registration && !librariansByRegistration.has(librarian.registration)) {
        librariansByRegistration.set(librarian.registration, librarian);
      }
    });

    data.loans.forEach(loan => {
      loan.book = booksByCode.get(loan.bookCode) || null;
      loan.reader = readersByRegistration.get(loan.readerRegistration) || null;
      loan.librarian =
        librariansByRegistration.get(loan.librarianRegistration) || null;
    });

    return data;
  }

  async function loadBytes(bytes, fileName) {
    const sqlite = await ensureSQLite();
    let newDatabase = null;

    try {
      newDatabase = new sqlite.Database(bytes);
    } catch (error) {
      throw new Error(
        "O arquivo selecionado não é um banco SQLite válido ou está corrompido."
      );
    }

    let integrity = "ok";
    try {
      const check = newDatabase.exec("PRAGMA integrity_check");
      integrity =
        check.length && check[0].values.length
          ? String(check[0].values[0][0])
          : "desconhecido";
    } catch (error) {
      integrity = "não verificado";
    }

    let tables = [];
    try {
      tables = inspectTables(newDatabase);
    } catch (error) {
      newDatabase.close();
      throw new Error("Não foi possível ler as tabelas do banco de dados.");
    }

    if (!tables.length) {
      newDatabase.close();
      throw new Error(
        "O arquivo não possui tabelas legíveis. Verifique se é o banco da biblioteca."
      );
    }

    const schema = detectSchema(tables);
    if (!Object.keys(schema.entities).length) {
      newDatabase.close();
      throw new Error(
        "Nenhuma tabela compatível com acervo, alunos, empréstimos ou bibliotecários foi encontrada."
      );
    }

    if (state.db) {
      try {
        state.db.close();
      } catch (error) {
        console.warn("Falha ao fechar o banco anterior:", error);
      }
    }

    state.db = newDatabase;
    state.fileName = fileName || "banco-importado.db";
    state.fileSize = bytes.byteLength || bytes.length || 0;
    state.importedAt = new Date();
    state.integrity = integrity;
    state.tables = tables;
    state.schema = schema;
    state.raw = new Map(tables.map(table => [table.name, table.rows]));
    state.data = buildDataset(schema, tables);

    return getState();
  }

  async function loadFile(file) {
    if (!file) throw new Error("Nenhum arquivo selecionado.");
    const buffer = await file.arrayBuffer();
    return loadBytes(new Uint8Array(buffer), file.name);
  }

  async function loadSample() {
    const url = new URL("sisbac_test.db", window.location.href);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        "Banco de exemplo indisponível. Use o botão de importação para selecionar o arquivo."
      );
    }
    const buffer = await response.arrayBuffer();
    return loadBytes(new Uint8Array(buffer), "sisbac_test.db");
  }

  function close() {
    if (state.db) {
      try {
        state.db.close();
      } catch (error) {
        console.warn("Falha ao fechar o banco:", error);
      }
    }

    state.db = null;
    state.fileName = null;
    state.fileSize = 0;
    state.importedAt = null;
    state.integrity = null;
    state.tables = [];
    state.schema = null;
    state.raw = new Map();
    state.data = emptyData();
  }

  function getState() {
    return state;
  }

  function rawRows(tableName) {
    return state.raw.get(tableName) || [];
  }

  BG.database = {
    ensureSQLite,
    loadFile,
    loadSample,
    loadBytes,
    close,
    getState,
    rawRows,
    emptyData,
    isLoaded
  };
})();
