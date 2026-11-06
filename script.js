// Navegação entre as telas

function goToScreen(id, botao) {
  document.querySelectorAll(".screen").forEach(tela => {
    tela.classList.remove("active");
  });

  const destino = document.getElementById(id);

  if (destino) {
    destino.classList.add("active");
  }

  document.querySelectorAll(".sidebar-menu .nav-item").forEach(item => {
    item.classList.remove("active");
  });

  if (botao) {
    botao.classList.add("active");
  }

  const titulos = {
    "screen-inicio": [
      "Visão Geral",
      "Acompanhe métricas e gerencie as informações do acervo"
    ],
    "screen-pendencias": [
      "Pendências",
      "Consulte os empréstimos que precisam de atenção"
    ],
    "screen-cadastros": [
      "Cadastros",
      "Consulte os alunos cadastrados"
    ],
    "screen-emprestimos": [
      "Empréstimos",
      "Acompanhe os livros emprestados"
    ]
  };

  if (titulos[id]) {
    document.getElementById("screen-heading").textContent = titulos[id][0];
    document.getElementById("screen-subheading").textContent = titulos[id][1];
  }
}

function goToScreenByName(id) {
  const botao = document.querySelector(
    `.sidebar-menu button[onclick*="${id}"]`
  );

  goToScreen(id, botao);
}


// Importação de arquivos JSON e CSV

document.addEventListener("DOMContentLoaded", () => {
  const uploader = document.getElementById("fileUploader");

  if (!uploader) return;

  uploader.addEventListener("change", async event => {
    const arquivo = event.target.files[0];

    if (!arquivo) return;

    try {
      const texto = await arquivo.text();
      let registros;

      if (arquivo.name.toLowerCase().endsWith(".json")) {
        const json = JSON.parse(texto);

        registros = Array.isArray(json)
          ? json
          : Object.values(json).find(Array.isArray);

      } else {
        registros = csvParaObjetos(texto);
      }

      if (!Array.isArray(registros) || registros.length === 0) {
        throw new Error("O arquivo não contém uma lista de registros.");
      }

      preencherTabelas(registros);

      document.getElementById("sidebar-filename").textContent = arquivo.name;

      alert("Arquivo importado. Confira os dados nas telas do sistema.");

    } catch (erro) {
      console.error(erro);

      alert(
        "Não foi possível importar o arquivo. Verifique se o JSON ou CSV está válido."
      );
    }

    event.target.value = "";
  });
});


// Converter CSV em objetos

function csvParaObjetos(texto) {
  const linhas = texto.trim().split(/\r?\n/).filter(Boolean);

  if (linhas.length < 2) return [];

  const separar = linha =>
    linha.split(";").length > linha.split(",").length
      ? linha.split(";")
      : linha.split(",");

  const cabecalhos = separar(linhas[0]).map(v =>
    v.trim().replace(/^"|"$/g, "")
  );

  return linhas.slice(1).map(linha => {
    const valores = separar(linha).map(v =>
      v.trim().replace(/^"|"$/g, "")
    );

    return Object.fromEntries(
      cabecalhos.map((c, i) => [c, valores[i] || ""])
    );
  });
}


// Preencher as tabelas do sistema

function preencherTabelas(registros) {
  const normalizar = valor => String(valor || "").toLowerCase();

  const classificar = obj => {
    const texto = Object.keys(obj).map(normalizar).join(" ");

    if (/livro|devolu|emprest|data/.test(texto)) {
      return "emprestimos";
    }

    if (/penden|atras|venc/.test(texto)) {
      return "pendencias";
    }

    return "cadastro";
  };

  const grupos = {
    cadastro: [],
    emprestimos: [],
    pendencias: []
  };

  registros.forEach(obj => {
    grupos[classificar(obj)].push(obj);
  });

  const desenhar = (id, lista) => {
    const corpo = document.getElementById(id);

    if (!corpo) return;

    if (!lista.length) {
      corpo.innerHTML =
        '<tr><td colspan="6" class="empty-state">Nenhum registro identificado para esta tela.</td></tr>';

      return;
    }

    corpo.innerHTML = "";

    lista.forEach(obj => {
      const tr = document.createElement("tr");

      Object.values(obj).forEach(valor => {
        const td = document.createElement("td");

        td.textContent = valor == null ? "" : String(valor);

        tr.appendChild(td);
      });

      corpo.appendChild(tr);
    });
  };

  desenhar("grid-cadastro", grupos.cadastro);
  desenhar("grid-emprestimos", grupos.emprestimos);
  desenhar("grid-pendencias", grupos.pendencias);

  document.getElementById("kpi-total").textContent =
    grupos.cadastro.length;

  document.getElementById("kpi-loans").textContent =
    grupos.emprestimos.length;

  document.getElementById("kpi-pending").textContent =
    grupos.pendencias.length;
}


// Banco de dados SQLite

let SQL = null;
let bancoDados = null;

async function iniciarSQLite() {
  if (SQL) return SQL;

  if (typeof initSqlJs !== "function") {
    throw new Error("Biblioteca SQLite não foi carregada.");
  }

  SQL = await initSqlJs({
    locateFile: arquivo =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${arquivo}`
  });

  return SQL;
}


// Eventos do banco de dados

document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("btnAbrirBancoSQL")
    ?.addEventListener("click", () => {
      document.getElementById("sqlDatabaseUploader")?.click();
    });


  document.getElementById("sqlDatabaseUploader")
    ?.addEventListener("change", async event => {

      const arquivo = event.target.files[0];

      if (!arquivo) return;

      const status = document.getElementById("statusBanco");

      status.textContent = "Carregando banco de dados...";

      try {
        await iniciarSQLite();

        const dados = await arquivo.arrayBuffer();

        const novoBanco = new SQL.Database(
          new Uint8Array(dados)
        );

        const resultado = novoBanco.exec(`
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `);

        if (bancoDados) {
          bancoDados.close();
        }

        bancoDados = novoBanco;

        document.getElementById("sidebar-filename").textContent =
          arquivo.name;

        document.getElementById("areaBanco").style.display = "block";

        status.textContent =
          "Banco carregado com sucesso: " + arquivo.name;

        const seletor = document.getElementById("selecionarTabela");

        seletor.innerHTML = "";

        if (resultado.length && resultado[0].values.length) {

          resultado[0].values.forEach(([nome]) => {
            const opcao = document.createElement("option");

            opcao.value = nome;
            opcao.textContent = nome;

            seletor.appendChild(opcao);
          });

          mostrarTabela(seletor.value);

        } else {
          seletor.innerHTML =
            '<option value="">Nenhuma tabela encontrada</option>';

          document.querySelector("#tabelaVisualizacao thead").innerHTML = "";

          document.querySelector("#tabelaVisualizacao tbody").innerHTML =
            "<tr><td>Nenhuma tabela encontrada.</td></tr>";

          document.getElementById("totalRegistros").textContent =
            "O banco não possui tabelas disponíveis.";
        }

      } catch (erro) {
        console.error("Erro SQLite:", erro);

        status.textContent =
          "Não foi possível carregar o banco de dados.";

        alert(
          "Erro ao abrir o banco. Verifique se o arquivo é SQLite válido."
        );
      }

      event.target.value = "";
    });


  // Selecionar uma tabela

  document.getElementById("selecionarTabela")
    ?.addEventListener("change", function() {
      if (this.value) {
        mostrarTabela(this.value);
      }
    });


  // Fechar banco de dados

  document.getElementById("btnFecharBanco")
    ?.addEventListener("click", () => {

      if (bancoDados) {
        bancoDados.close();
        bancoDados = null;
      }

      document.getElementById("areaBanco").style.display = "none";

      document.getElementById("sidebar-filename").textContent =
        "Nenhum carregado";

      document.getElementById("statusBanco").textContent =
        "Nenhum banco de dados carregado.";

      document.getElementById("selecionarTabela").innerHTML =
        '<option value="">Nenhuma tabela disponível</option>';

      document.getElementById("totalRegistros").textContent = "";

      document.querySelector("#tabelaVisualizacao thead").innerHTML = "";

      document.querySelector("#tabelaVisualizacao tbody").innerHTML =
        "<tr><td>Carregue um banco SQLite para visualizar os registros.</td></tr>";
    });

});


// Mostrar dados da tabela selecionada

function mostrarTabela(nomeTabela) {
  if (!bancoDados || !nomeTabela) return;

  try {
    const nomeSeguro = nomeTabela.replace(/"/g, '""');

    const resultado = bancoDados.exec(
      `SELECT * FROM "${nomeSeguro}" LIMIT 100`
    );

    const cabecalho =
      document.querySelector("#tabelaVisualizacao thead");

    const corpo =
      document.querySelector("#tabelaVisualizacao tbody");

    cabecalho.innerHTML = "";
    corpo.innerHTML = "";

    if (!resultado.length) {
      corpo.innerHTML =
        "<tr><td>Esta tabela não possui registros.</td></tr>";

      document.getElementById("totalRegistros").textContent =
        "Nenhum registro encontrado.";

      return;
    }

    const { columns, values } = resultado[0];

    const trCabecalho = document.createElement("tr");

    columns.forEach(coluna => {
      const th = document.createElement("th");

      th.textContent = coluna;

      trCabecalho.appendChild(th);
    });

    cabecalho.appendChild(trCabecalho);

    values.forEach(linha => {
      const tr = document.createElement("tr");

      linha.forEach(valor => {
        const td = document.createElement("td");

        td.textContent = valor === null ? "" : String(valor);

        tr.appendChild(td);
      });

      corpo.appendChild(tr);
    });

    const contagem = bancoDados.exec(
      `SELECT COUNT(*) FROM "${nomeSeguro}"`
    );

    const total = contagem[0].values[0][0];

    document.getElementById("totalRegistros").textContent =
      `Mostrando ${values.length} de ${total} registros da tabela "${nomeTabela}".`;

  } catch (erro) {
    console.error("Erro ao mostrar tabela:", erro);

    alert("Não foi possível visualizar essa tabela.");
  }
}