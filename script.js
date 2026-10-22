/* ==========================================================================
   CADERNO DE ESTUDOS — script.js
   Etapa 1/5: estrutura, IndexedDB, navegação, CRUD de assuntos, tema.
   (Materiais, Questões, Pesquisa e Backup vêm nas próximas etapas)
   ========================================================================== */

/* ============================================================
   1. CONFIGURAÇÃO GERAL / CONSTANTES
   ============================================================ */

const DB_NAME = "caderno_estudos_db";
const DB_VERSION = 4;

// Matérias do roteiro da POLÍCIA MILITAR (ids originais, não mudar)
const MATERIAS_PM = [
  { id: "portugues",   nome: "Língua Portuguesa",                       icone: "🅰️", cor: "#7C5CFC" },
  { id: "historia_pe", nome: "História de Pernambuco",                  icone: "🏛️", cor: "#C98A1A" },
  { id: "raciocinio",  nome: "Raciocínio Lógico",                       icone: "🧮", cor: "#2F9E6E" },
  { id: "informatica", nome: "Informática",                             icone: "💻", cor: "#2F80ED" },
  { id: "dir_const",   nome: "Direito Constitucional",                  icone: "⚖️", cor: "#E0403F" },
  { id: "dir_hum",     nome: "Direitos Humanos e Legislação Extravagante", icone: "📜", cor: "#B84DCC" },
];

// Roteiros (concursos) e matérias do roteiro ATUAL. Carregados do banco na inicialização.
let CONCURSOS = [];
let MATERIAS = [];

// Estado da aplicação em memória
const state = {
  db: null,
  currentConcursoId: null,
  currentMateriaId: null,
  currentAssuntoId: null,
  currentTab: "materiais",
  currentPagina: 1,
  objectURLs: [], // URLs de imagens criadas com createObjectURL, para revogar depois
  filtros: { status: "todos", dificuldade: "todos", favorito: false, desempenho: "todos", respondidas: "todos" },
  respostasVisiveis: new Map(), // id da questão -> true/false (resposta e comentários visíveis)
  ordem: "sequencial",          // "sequencial" (ordem em que foram inseridas) ou "aleatoria"
  ordemAleatoria: null,         // lista de ids na ordem embaralhada atual
  desempPeriodo: "hoje",        // painel de desempenho: hoje | ontem | 7d | 30d | tudo | data
  desempData: "",               // "AAAA-MM-DD" quando o período é uma data específica
  desempOrdem: "assunto",       // assunto | pior | melhor | mais
  desempAba: "questoes",        // painel de desempenho: questoes | flash
};

const QUESTOES_POR_PAGINA = 10;

// Dias da semana no índice do Date.getDay() (0 = Domingo ... 6 = Sábado)
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Tópicos do edital sugeridos para popular o checklist na primeira vez que o app roda.
// O usuário pode editar/excluir/adicionar livremente depois — isso é só o ponto de partida.
const TOPICOS_SUGERIDOS = {
  portugues: [
    "Compreensão e interpretação de textos",
    "Tipologias e gêneros textuais",
    "Ortografia oficial",
    "Acentuação gráfica",
    "Emprego das classes de palavras",
    "Emprego do sinal indicativo de crase",
    "Sintaxe da oração e do período",
    "Mecanismos de coesão textual",
    "Pontuação",
    "Concordância nominal e verbal",
    "Regência nominal e verbal",
    "Colocação pronominal",
    "Significação das palavras",
    "Variação linguística",
    "Redação oficial (Manual de Redação da Presidência da República/2018)",
  ],
  historia_pe: [
    "Ocupação e colonização — capitanias hereditárias e Duarte Coelho",
    "A importância do açúcar para a economia local",
    "Formação de Olinda e Recife",
    "A presença holandesa e o governo de Maurício de Nassau",
    "Movimentos de resistência e emancipacionistas (Quilombos, Insurreição Pernambucana, Guerra dos Mascates, Revolução Pernambucana, Confederação do Equador, Guerra dos Cabanos, Revolução Praieira)",
    "Pernambuco e a República",
    "Manifestações da cultura popular pernambucana (Frevo, Maracatu, culinária, festas populares)",
    "Herança afrodescendente em Pernambuco",
  ],
  raciocinio: [
    "Estruturas lógicas: proposições, conectivos, quantificadores e falácias",
    "Lógica de argumentação: analogias, inferências, deduções e equivalência lógica",
    "Diagramas lógicos",
    "Princípios de contagem, arranjos, combinações, permutações e probabilidade",
  ],
  informatica: [
    "Conceito de internet e intranet",
    "Tecnologias, ferramentas e aplicativos de internet/intranet",
    "Conceitos de proteção e segurança",
    "Armazenamento de dados e backup",
    "Organização de arquivos, pastas, programas e instalação de periféricos",
    "Sistema operacional Windows (básico)",
    "Pacotes Office 2019 e LibreOffice 7 (Word/Writer, Excel/Calc, PowerPoint/Impress)",
  ],
  dir_const: [
    "Princípios fundamentais",
    "Direitos e garantias fundamentais e remédios constitucionais",
    "Organização do Estado — repartição de competências e Administração Pública",
    "Dos militares dos Estados, do Distrito Federal e dos Territórios",
    "Organização dos Poderes (Legislativo, Executivo, Judiciário)",
    "Defesa do Estado e das instituições democráticas",
    "Súmulas e jurisprudência dominante dos Tribunais Superiores",
  ],
  dir_hum: [
    "Teoria geral dos Direitos Humanos",
    "Evolução histórica e gerações de direitos humanos",
    "Incorporação de normas internacionais de Direitos Humanos ao direito interno",
    "Declaração Universal dos Direitos Humanos (ONU, 1948)",
    "Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)",
    "Lei do Abuso de Autoridade (Lei nº 13.869/2019)",
    "Lei de Tortura (Lei nº 9.455/1997)",
    "Lei Maria da Penha (Lei nº 11.340/2006)",
    "Lei de Crimes de Preconceito de Raça ou Cor (Lei nº 7.716/1989)",
    "Lei de Crimes Ambientais (Lei nº 9.605/1998)",
    "Lei de Crimes Hediondos (Lei nº 8.072/1990)",
    "Lei de Drogas (Lei nº 11.343/2006)",
    "Estatuto dos Policiais Militares de Pernambuco (Lei Estadual nº 6.783/1974)",
    "Súmulas e jurisprudência relacionadas aos direitos humanos",
  ],
};

// ---------- Roteiro: POLÍCIA CIVIL (Agente de Polícia) ----------
// Matérias com ids próprios ("pc_...") para ficarem 100% separadas do roteiro da PM.
const MATERIAS_PC = [
  { id: "pc_leg_estadual",    nome: "Legislação Estadual (PE)",     curto: "Leg. Estadual",  icone: "📚", cor: "#C98A1A" },
  { id: "pc_dir_const",       nome: "Direito Constitucional",       curto: "Constitucional", icone: "⚖️", cor: "#E0403F" },
  { id: "pc_dir_adm",         nome: "Direito Administrativo",       curto: "Administrativo", icone: "🏢", cor: "#2F80ED" },
  { id: "pc_dir_penal",       nome: "Direito Penal",                curto: "Penal",          icone: "🔨", cor: "#B84DCC" },
  { id: "pc_dir_proc_penal",  nome: "Direito Processual Penal",     curto: "Proc. Penal",    icone: "📜", cor: "#E07B39" },
  { id: "pc_portugues",       nome: "Língua Portuguesa",            curto: "Português",      icone: "🅰️", cor: "#7C5CFC" },
  { id: "pc_informatica",     nome: "Informática",                  curto: "Informática",    icone: "💻", cor: "#16A5A5" },
  { id: "pc_raciocinio",      nome: "Raciocínio Lógico",            curto: "Raciocínio",     icone: "🧮", cor: "#2F9E6E" },
  { id: "pc_contabilidade",   nome: "Contabilidade Geral",          curto: "Contabilidade",  icone: "📊", cor: "#8A6D3B" },
  { id: "pc_estatistica",     nome: "Estatística",                  curto: "Estatística",    icone: "📈", cor: "#5B7083" },
  { id: "pc_atualidades",     nome: "Atualidades (prova discursiva)", curto: "Atualidades",  icone: "📰", cor: "#D6457A" },
];

// Tópicos do edital da Polícia Civil — viram o checklist do roteiro E os assuntos de cada matéria.
const TOPICOS_PC = {
  pc_leg_estadual: [
    "Constituição do Estado de Pernambuco (artigos 101 a 105-B)",
    "Lei nº 6.425/1972 (Estatuto do Policial Civil)",
    "Lei nº 6.123/1968 (Estatuto do Servidor do Estado de Pernambuco)",
    "Lei Complementar nº 137/2008",
    "Lei Complementar nº 317/2015",
  ],
  pc_dir_const: [
    "Constituição Federal de 1988 — princípios fundamentais",
    "Poderes constituintes originário, derivado e decorrente",
    "Aplicabilidade das normas constitucionais",
    "Direitos e garantias fundamentais",
    "Organização político-administrativa do Estado (Estado federal, União, estados, DF, municípios e territórios)",
    "Administração pública (disposições gerais e servidores públicos)",
    "Poder Executivo",
    "Poder Legislativo",
    "Poder Judiciário",
    "Funções essenciais à justiça (Ministério Público, Advocacia pública e Defensoria Pública)",
    "Defesa do Estado e das instituições democráticas",
    "Segurança pública na Constituição do Estado de Pernambuco",
  ],
  pc_dir_adm: [
    "Estado, governo e administração pública",
    "Direito administrativo",
    "Ato administrativo",
    "Poderes da administração pública (hierárquico, disciplinar, regulamentar e de polícia; uso e abuso do poder)",
    "Regime jurídico-administrativo e princípios expressos e implícitos",
    "Responsabilidade civil do Estado",
    "Serviços públicos",
    "Organização administrativa (centralização, descentralização, concentração, desconcentração; administração direta e indireta)",
    "Controle da administração pública (administrativo, judicial e legislativo)",
    "Improbidade administrativa",
    "Processo administrativo",
    "Licitações e contratos administrativos",
    "Agente público (legislação pertinente e disposições constitucionais aplicáveis)",
    "Cargo, emprego e função pública",
  ],
  pc_dir_penal: [
    "Princípios básicos",
    "Crime e contravenção penal",
    "Aplicação da lei penal (tempo, espaço, tempo e lugar do crime, territorialidade, extraterritorialidade, contagem de prazo)",
    "Crimes contra a pessoa",
    "Crimes contra o patrimônio",
    "Crimes contra a dignidade sexual",
    "Crimes contra a administração pública",
    "Crimes hediondos (Lei nº 8.072/1990)",
    "Crimes resultantes de preconceito de raça ou de cor (Lei nº 7.716/1989)",
    "Crimes de abuso de autoridade (Lei nº 13.869/2019)",
    "Crimes de tortura (Lei nº 9.455/1997)",
    "Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)",
    "Organizações criminosas (Lei nº 12.850/2013)",
    "Crimes de trânsito (Lei nº 9.503/1997)",
    "Violência doméstica e familiar contra a mulher (Lei nº 11.340/2006)",
    "Lei de drogas (Lei nº 11.343/2006)",
    "Violência doméstica e familiar contra a criança e o adolescente (Lei nº 14.344/2022)",
    "Crimes ambientais (Lei nº 9.605/1998)",
    "Estatuto do Desarmamento (Lei nº 10.826/2003)",
    "Disposições constitucionais aplicáveis ao direito penal",
  ],
  pc_dir_proc_penal: [
    "Aplicação da lei processual no tempo, no espaço e em relação às pessoas",
    "Inquérito policial",
    "Prova: exame de corpo de delito e perícias, interrogatório, confissão do ofendido e testemunhas",
    "Prova: reconhecimento de pessoas e coisas, acareação, documentos, indícios e busca e apreensão",
    "Prisão e liberdade provisória",
    "Medidas cautelares diversas da prisão",
    "Lei nº 7.960/1989 (prisão temporária)",
    "Juizados especiais criminais (Lei nº 9.099/1995)",
    "Investigação criminal (Lei nº 12.830/2013)",
    "Disposições constitucionais aplicáveis ao direito processual penal",
  ],
  pc_portugues: [
    "Compreensão e interpretação de textos de gêneros variados",
    "Tipos e gêneros textuais",
    "Ortografia oficial",
    "Coesão textual (referenciação, substituição, repetição, conectores; tempos e modos verbais)",
    "Classes de palavras",
    "Coordenação e subordinação (entre orações e entre termos da oração)",
    "Sinais de pontuação",
    "Concordância verbal e nominal",
    "Regência verbal e nominal",
    "Emprego do sinal indicativo de crase",
    "Colocação dos pronomes átonos",
    "Reescrita de frases e parágrafos (significação, substituição, reorganização, níveis de formalidade)",
    "Correspondência oficial (Manual de Redação da Presidência da República)",
  ],
  pc_informatica: [
    "Windows: janelas, menus, barra de tarefas, área de trabalho e Windows Explorer",
    "Pastas e arquivos: localizar, mover, copiar, criar e excluir",
    "Configurações básicas do Windows",
    "Microsoft 365 — Word (formatação, listas, colunas, tabelas, estilos, cabeçalhos, rodapés, configuração de página)",
    "Microsoft 365 — Excel (fórmulas, referências, funções, formatação, classificação de dados, gráficos)",
    "Microsoft 365 — PowerPoint (slides, objetos, slide mestre, animações, integração com Word e Excel)",
    "Redes: internet e intranet, redes sociais, computação na nuvem, deep web e dark web",
    "Correio eletrônico, navegadores e sítios de busca",
    "Segurança: acessos, programas maliciosos, antivírus e criptografia",
    "Backup e armazenamento de dados na nuvem",
  ],
  pc_raciocinio: [
    "Conjuntos numéricos (inteiros, racionais e reais) e sistema legal de medidas",
    "Razões e proporções, divisão proporcional, regras de três e porcentagens",
    "Equações e inequações de 1º e 2º graus",
    "Sistemas lineares",
    "Funções e gráficos",
    "Princípios de contagem e probabilidade",
    "Progressões aritméticas e geométricas",
    "Compreensão de estruturas lógicas",
    "Lógica de argumentação (analogias, inferências, deduções e conclusões)",
    "Lógica sentencial (proposições, tabelas-verdade, equivalências, leis de De Morgan, diagramas lógicos)",
    "Lógica de primeira ordem",
    "Operações com conjuntos",
    "Problemas aritméticos, geométricos e matriciais",
  ],
  pc_contabilidade: [
    "Conceitos, objetivos e finalidades da contabilidade",
    "Patrimônio (componentes, equação fundamental, situação líquida)",
    "Atos e fatos administrativos (permutativos, modificativos e mistos)",
    "Contas (débito, crédito e saldos)",
    "Plano de contas",
    "Escrituração (lançamentos, livros, regime de competência e de caixa)",
    "Contabilização de operações diversas (juros, descontos, tributos, aluguéis, variação cambial, folha, compras, vendas, provisões, depreciação)",
    "Balancete de verificação",
    "Balanço patrimonial",
    "Demonstração do resultado do exercício (DRE)",
    "Normas Brasileiras de Contabilidade",
  ],
  pc_estatistica: [
    "Estatística descritiva e análise exploratória (gráficos, tabelas, medidas de posição, dispersão, assimetria e curtose)",
    "Probabilidade (definições, axiomas, probabilidade condicional e independência)",
    "Técnicas de amostragem (aleatória simples, estratificada, sistemática e por conglomerados)",
    "Tamanho amostral",
  ],
  pc_atualidades: [
    "Tópicos relevantes e atuais na área de segurança pública",
  ],
};

// Roteiros que já vêm prontos. A PM mantém os ids antigos (nada muda nos seus dados).
const CONCURSOS_PADRAO = [
  { id: "pm", nome: "Polícia Militar", icone: "🪖", materias: MATERIAS_PM, topicos: null, assuntos: false },
  { id: "pc", nome: "Polícia Civil",   icone: "🚓", materias: MATERIAS_PC, topicos: TOPICOS_PC, assuntos: true },
];

// cores sugeridas para matérias criadas manualmente
const PALETA_CORES = ["#7C5CFC", "#C98A1A", "#2F9E6E", "#2F80ED", "#E0403F", "#B84DCC", "#E07B39", "#16A5A5", "#8A6D3B", "#D6457A"];

// controla qual matéria está expandida no accordion do checklist
let accordionAberto = null;

// sessão de revisão de flashcards em andamento (null = fora da revisão)
let flashSessao = null;

// seleção múltipla na lista de flashcards (null = modo normal)
// formato: { assuntoId, ids: Set<number> }
let flashSelecao = null;

/* ============================================================
   2. INDEXEDDB — abertura e helpers genéricos
   ============================================================ */

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // assuntos: tópicos dentro de cada matéria
      if (!db.objectStoreNames.contains("assuntos")) {
        const store = db.createObjectStore("assuntos", { keyPath: "id", autoIncrement: true });
        store.createIndex("materiaId", "materiaId", { unique: false });
      }

      // materiais: PDFs vinculados a um assunto
      if (!db.objectStoreNames.contains("materiais")) {
        const store = db.createObjectStore("materiais", { keyPath: "id", autoIncrement: true });
        store.createIndex("assuntoId", "assuntoId", { unique: false });
      }

      // questoes: cada questão vinculada a um assunto
      if (!db.objectStoreNames.contains("questoes")) {
        const store = db.createObjectStore("questoes", { keyPath: "id", autoIncrement: true });
        store.createIndex("assuntoId", "assuntoId", { unique: false });
      }

      // anotacoes: uma anotação (texto livre) por assunto
      if (!db.objectStoreNames.contains("anotacoes")) {
        db.createObjectStore("anotacoes", { keyPath: "assuntoId" });
      }

      // topicos: itens do checklist do edital (roteiro de estudos), por matéria
      if (!db.objectStoreNames.contains("topicos")) {
        const store = db.createObjectStore("topicos", { keyPath: "id", autoIncrement: true });
        store.createIndex("materiaId", "materiaId", { unique: false });
      }

      // cronograma: matérias atribuídas a cada dia da semana (0=Domingo ... 6=Sábado)
      if (!db.objectStoreNames.contains("cronograma")) {
        db.createObjectStore("cronograma", { keyPath: "dia" });
      }

      // concursos: roteiros separados (PM, PC...), cada um com suas matérias
      if (!db.objectStoreNames.contains("concursos")) {
        db.createObjectStore("concursos", { keyPath: "id" });
      }

      // flashcards: cartões frente/verso vinculados a um assunto
      if (!db.objectStoreNames.contains("flashcards")) {
        const store = db.createObjectStore("flashcards", { keyPath: "id", autoIncrement: true });
        store.createIndex("assuntoId", "assuntoId", { unique: false });
      }
    };

    // outra aba com a versão antiga aberta impede a atualização do banco
    request.onblocked = () => {
      mostrarAvisoBanco("⚠️ O banco de dados precisa ser atualizado, mas há outra aba ou janela deste app aberta. Feche as outras abas do Caderno de Estudos e esta tela continua sozinha.");
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      // se outra aba atualizar o banco no futuro, esta libera a conexão em vez de travar a outra
      db.onversionchange = () => {
        db.close();
        mostrarAvisoBanco("O app foi atualizado em outra aba. Recarregue esta página (F5).");
      };
      removerAvisoBanco();
      resolve(db);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

// aviso fixo no topo da página (diferente do toast, não some sozinho)
function mostrarAvisoBanco(texto) {
  let el = document.getElementById("aviso-banco");
  if (!el) {
    el = document.createElement("div");
    el.id = "aviso-banco";
    el.className = "aviso-banco";
    document.body.prepend(el);
  }
  el.textContent = texto;
}

function removerAvisoBanco() {
  const el = document.getElementById("aviso-banco");
  if (el) el.remove();
}

function dbGetAll(storeName, indexName, indexValue) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const source = indexName ? store.index(indexName) : store;
    const request = indexValue !== undefined ? source.getAll(indexValue) : source.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(storeName, "readwrite");
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(storeName, "readwrite");
    const request = tx.objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* ============================================================
   3. UTILITÁRIOS DE UI (toast, modal)
   ============================================================ */

let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.remove("toast"); // reforça reanimação
  void toast.offsetWidth;
  toast.classList.add("toast");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 2200);
}

function openModal(innerHTML) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  box.innerHTML = innerHTML;
  overlay.hidden = false;
  const firstInput = box.querySelector("input, textarea");
  if (firstInput) setTimeout(() => firstInput.focus(), 30);
}

function closeModal() {
  document.getElementById("modal-overlay").hidden = true;
  const box = document.getElementById("modal-box");
  box.innerHTML = "";
  box.classList.remove("modal-wide", "modal-editor");
}

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ============================================================
   4. NAVEGAÇÃO ENTRE TELAS
   ============================================================ */

function showView(viewId) {
  if (viewId !== "view-assunto" && typeof fecharPlayerAudio === "function") fecharPlayerAudio(); // para o áudio ao sair do assunto
  document.querySelectorAll(".view").forEach(v => v.hidden = true);
  document.getElementById(viewId).hidden = false;

  const btnVoltar = document.getElementById("btn-voltar");
  btnVoltar.hidden = viewId === "view-home";
}

document.getElementById("btn-voltar").addEventListener("click", () => {
  if (!document.getElementById("view-desempenho").hidden) {
    // volta do painel de desempenho para a lista de assuntos da matéria
    goToMateria(state.currentMateriaId);
  } else if (!document.getElementById("view-assunto").hidden) {
    // volta da tela de assunto para a lista de assuntos da matéria
    document.getElementById("app-title").textContent = "📘 Caderno de Estudos";
    goToMateria(state.currentMateriaId);
  } else {
    goToHome();
  }
});

async function goToHome() {
  state.currentMateriaId = null;
  state.currentAssuntoId = null;
  document.getElementById("app-title").textContent = "📘 Caderno de Estudos";
  showView("view-home");
  await renderHome();
}

async function goToMateria(materiaId) {
  const materia = getMateriaById(materiaId);
  if (!materia) { goToHome(); return; }
  ativarConcursoDaMateria(materiaId);
  state.currentMateriaId = materiaId;
  state.currentAssuntoId = null;
  document.getElementById("app-title").textContent = `${materia.icone} ${materia.nome}`;
  showView("view-materia");
  await renderMateria(materiaId);
}

async function goToRoteiro() {
  state.currentMateriaId = null;
  state.currentAssuntoId = null;
  const concursoRoteiro = getConcursoAtual();
  document.getElementById("app-title").textContent = concursoRoteiro ? `🗺️ Roteiro — ${concursoRoteiro.nome}` : "🗺️ Roteiro de Estudos";
  showView("view-roteiro");
  await renderRoteiro();
}

document.getElementById("btn-roteiro").addEventListener("click", goToRoteiro);

async function goToAssunto(assuntoId) {
  state.currentAssuntoId = assuntoId;
  state.currentPagina = 1;
  state.filtros = { status: "todos", dificuldade: "todos", favorito: false, desempenho: "todos", respondidas: "todos" };
  const assunto = await dbGet("assuntos", assuntoId);
  document.getElementById("app-title").textContent = `📄 ${assunto.nome}`;
  showView("view-assunto");
  setActiveTab("materiais");
}

/* ============================================================
   5. TELA INICIAL — CARTÕES DE MATÉRIAS
   ============================================================ */

async function getMateriaStats(materiaId) {
  const assuntos = await dbGetAll("assuntos", "materiaId", materiaId);
  let totalQuestoes = 0;
  let totalPdfs = 0;
  let totalRevisadas = 0;
  let totalAcertos = 0;
  let totalTentativas = 0;

  for (const assunto of assuntos) {
    const questoes = await dbGetAll("questoes", "assuntoId", assunto.id);
    const materiais = await dbGetAll("materiais", "assuntoId", assunto.id);
    totalQuestoes += questoes.length;
    totalPdfs += materiais.length;
    totalRevisadas += questoes.filter(q => q.status === "revisada").length;
    for (const q of questoes) {
      const r = resumoTentativas(q);
      totalTentativas += r.total;
      totalAcertos += r.acertos;
    }
  }

  return {
    assuntos: assuntos.length,
    questoes: totalQuestoes,
    pdfs: totalPdfs,
    revisadas: totalRevisadas,
    tentativas: totalTentativas,
    taxaAcerto: totalTentativas ? Math.round((totalAcertos / totalTentativas) * 100) : null,
  };
}

async function renderHome() {
  renderConcursoBar();
  await renderRoteiroBanner();

  const grid = document.getElementById("materias-grid");
  grid.innerHTML = "";

  if (!getConcursoAtual()) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <span class="empty-emoji">🗺️</span>
        <p>Nenhum roteiro criado ainda.</p>
        <p>Clique em "+ Novo roteiro" para começar.</p>
      </div>`;
    return;
  }

  if (MATERIAS.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <span class="empty-emoji">📚</span>
        <p>Este roteiro ainda não tem matérias.</p>
        <button class="btn-primary" id="btn-vazio-add-materia" style="margin-top:10px;">+ Adicionar matérias</button>
      </div>`;
    document.getElementById("btn-vazio-add-materia").addEventListener("click", abrirModalGerenciarConcurso);
    return;
  }

  for (const materia of MATERIAS) {
    const stats = await getMateriaStats(materia.id);
    const pct = stats.questoes > 0 ? Math.round((stats.revisadas / stats.questoes) * 100) : 0;
    const card = document.createElement("div");
    card.className = "materia-card";
    card.style.setProperty("--card-color", materia.cor);
    card.style.setProperty("--card-color-soft", hexToSoft(materia.cor));
    card.innerHTML = `
      <div class="materia-card-icon">${materia.icone}</div>
      <h3 class="materia-card-title">${escapeHTML(materia.nome)}</h3>
      <div class="materia-card-stats">
        <span class="stat-pill">📂 <b>${stats.assuntos}</b> assuntos</span>
        <span class="stat-pill">❓ <b>${stats.questoes}</b> questões</span>
        <span class="stat-pill">📎 <b>${stats.pdfs}</b> materiais</span>
        ${stats.taxaAcerto !== null ? `<span class="stat-pill" title="${stats.tentativas} revisões registradas">🎯 <b>${stats.taxaAcerto}%</b> de acerto</span>` : ""}
      </div>
      ${stats.questoes > 0 ? `
        <div class="progresso-revisao" title="${stats.revisadas} de ${stats.questoes} questões revisadas">
          <div class="progresso-revisao-barra" style="width:${pct}%;"></div>
        </div>
        <span class="progresso-revisao-label">${pct}% revisado</span>
      ` : ""}
    `;
    card.addEventListener("click", () => goToMateria(materia.id));
    grid.appendChild(card);
  }
}

function hexToSoft(hex) {
  // gera uma versão "soft" (translúcida) da cor para fundo de ícone
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}

/* ============================================================
   6. TELA DA MATÉRIA — LISTA DE ASSUNTOS (CRUD)
   ============================================================ */

async function renderMateria(materiaId) {
  const list = document.getElementById("assuntos-list");
  const subtitle = document.getElementById("materia-subtitle");
  const assuntos = await dbGetAll("assuntos", "materiaId", materiaId);
  assuntos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  subtitle.textContent = `${assuntos.length} assunto${assuntos.length === 1 ? "" : "s"} cadastrado${assuntos.length === 1 ? "" : "s"}`;

  if (assuntos.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">🗂️</span>
        <p>Nenhum assunto cadastrado ainda.</p>
        <p>Clique em "Adicionar assunto" para começar.</p>
      </div>`;
    return;
  }

  list.innerHTML = "";
  for (const [i, assunto] of assuntos.entries()) {
    const stats = await getAssuntoStats(assunto.id);
    const row = document.createElement("div");
    row.className = "assunto-row";
    row.innerHTML = `
      <div class="assunto-row-main">
        <span class="assunto-index">${String(i + 1).padStart(2, "0")}</span>
        <span class="assunto-name">${escapeHTML(assunto.nome)}</span>
      </div>
      <div class="assunto-row-main" style="flex-shrink:0; gap:10px;">
        <span class="assunto-meta">❓ ${stats.questoes} · 📎 ${stats.pdfs}${stats.taxaAcerto !== null ? ` · 🎯 ${stats.taxaAcerto}%` : ""}</span>
        <div class="assunto-row-actions">
          <button class="btn-icon btn-edit-assunto" title="Editar">✏️</button>
          <button class="btn-icon btn-delete-assunto" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
    row.addEventListener("click", (e) => {
      if (e.target.closest(".assunto-row-actions")) return;
      goToAssunto(assunto.id);
    });
    row.querySelector(".btn-edit-assunto").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditAssuntoModal(assunto);
    });
    row.querySelector(".btn-delete-assunto").addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDeleteAssunto(assunto);
    });
    list.appendChild(row);
  }
}

async function getAssuntoStats(assuntoId) {
  const questoes = await dbGetAll("questoes", "assuntoId", assuntoId);
  const materiais = await dbGetAll("materiais", "assuntoId", assuntoId);
  let tentativas = 0, acertos = 0;
  for (const q of questoes) {
    const r = resumoTentativas(q);
    tentativas += r.total;
    acertos += r.acertos;
  }
  return {
    questoes: questoes.length,
    pdfs: materiais.length,
    taxaAcerto: tentativas ? Math.round((acertos / tentativas) * 100) : null,
  };
}

document.getElementById("btn-add-assunto").addEventListener("click", () => {
  openModal(`
    <h3 class="modal-title">Adicionar assunto</h3>
    <div class="modal-field">
      <label for="input-assunto-nome">Nome do assunto</label>
      <input type="text" id="input-assunto-nome" class="modal-input" placeholder="Ex: Crase" maxlength="120">
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-save-assunto">Adicionar</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  const input = document.getElementById("input-assunto-nome");
  const save = async () => {
    const nome = input.value.trim();
    if (!nome) { input.focus(); return; }
    const existentes = await dbGetAll("assuntos", "materiaId", state.currentMateriaId);
    await dbPut("assuntos", {
      materiaId: state.currentMateriaId,
      nome,
      ordem: existentes.length,
    });
    closeModal();
    showToast("Assunto adicionado.");
    renderMateria(state.currentMateriaId);
  };
  document.getElementById("btn-save-assunto").addEventListener("click", save);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
});

function openEditAssuntoModal(assunto) {
  openModal(`
    <h3 class="modal-title">Editar assunto</h3>
    <div class="modal-field">
      <label for="input-assunto-nome">Nome do assunto</label>
      <input type="text" id="input-assunto-nome" class="modal-input" value="${escapeHTML(assunto.nome)}" maxlength="120">
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-save-assunto">Salvar</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  const input = document.getElementById("input-assunto-nome");
  const save = async () => {
    const nome = input.value.trim();
    if (!nome) { input.focus(); return; }
    assunto.nome = nome;
    await dbPut("assuntos", assunto);
    closeModal();
    showToast("Assunto atualizado.");
    renderMateria(state.currentMateriaId);
  };
  document.getElementById("btn-save-assunto").addEventListener("click", save);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
}

function confirmDeleteAssunto(assunto) {
  openModal(`
    <h3 class="modal-title">Excluir "${escapeHTML(assunto.nome)}"?</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 4px;">
      Isso também excluirá todos os PDFs, questões e flashcards deste assunto. Essa ação não pode ser desfeita.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-delete">Excluir</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    await deleteAssuntoCascade(assunto.id);
    closeModal();
    showToast("Assunto excluído.");
    renderMateria(state.currentMateriaId);
  });
}

async function deleteAssuntoCascade(assuntoId) {
  const materiais = await dbGetAll("materiais", "assuntoId", assuntoId);
  for (const m of materiais) await dbDelete("materiais", m.id);

  const questoes = await dbGetAll("questoes", "assuntoId", assuntoId);
  for (const q of questoes) await dbDelete("questoes", q.id);

  const flashcards = await dbGetAll("flashcards", "assuntoId", assuntoId);
  for (const f of flashcards) await dbDelete("flashcards", f.id);

  await dbDelete("anotacoes", assuntoId).catch(() => {});
  await dbDelete("assuntos", assuntoId);
}

/* ============================================================
   6B. DESEMPENHO DA MATÉRIA — acertos e erros por assunto e por dia
   Usa o histórico que já existe em questao.tentativas = [{ em, acertou }].
   ============================================================ */

document.getElementById("btn-desempenho").addEventListener("click", () => {
  if (state.currentMateriaId) goToDesempenho(state.currentMateriaId);
});

async function goToDesempenho(materiaId) {
  const materia = getMateriaById(materiaId);
  if (!materia) { goToHome(); return; }
  state.currentMateriaId = materiaId;
  state.currentAssuntoId = null;
  document.getElementById("app-title").textContent = `📊 Desempenho — ${materia.nome}`;
  showView("view-desempenho");
  await renderDesempenho(materiaId);
}

// "AAAA-MM-DD" no fuso local
function chaveDia(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function intervaloDesempenho() {
  const p = state.desempPeriodo;
  if (p === "hoje") return [inicioDoDia(0), inicioDoDia(1)];
  if (p === "ontem") return [inicioDoDia(-1), inicioDoDia(0)];
  if (p === "7d") return [inicioDoDia(-6), inicioDoDia(1)];
  if (p === "30d") return [inicioDoDia(-29), inicioDoDia(1)];
  if (p === "data" && state.desempData) {
    const [a, m, d] = state.desempData.split("-").map(Number);
    return [new Date(a, m - 1, d).getTime(), new Date(a, m - 1, d + 1).getTime()];
  }
  return [0, Infinity];
}

function rotuloPeriodoDesempenho() {
  const fmt = (ts) => new Date(ts).toLocaleDateString("pt-BR");
  const p = state.desempPeriodo;
  if (p === "hoje") return `Hoje (${fmt(inicioDoDia(0))})`;
  if (p === "ontem") return `Ontem (${fmt(inicioDoDia(-1))})`;
  if (p === "7d") return `Últimos 7 dias (${fmt(inicioDoDia(-6))} a ${fmt(inicioDoDia(0))})`;
  if (p === "30d") return `Últimos 30 dias (${fmt(inicioDoDia(-29))} a ${fmt(inicioDoDia(0))})`;
  if (p === "data" && state.desempData) {
    const [a, m, d] = state.desempData.split("-").map(Number);
    return fmt(new Date(a, m - 1, d).getTime());
  }
  return "Todo o período";
}

function classeTaxa(taxa) {
  if (taxa === null) return "";
  if (taxa >= 70) return "taxa-boa";
  if (taxa >= 50) return "taxa-media";
  return "taxa-ruim";
}

// ---------- coleta de atividade: questões (tentativas) + flashcards (revisões) ----------
function revisoesDoFlashcard(f) {
  if (Array.isArray(f.historico) && f.historico.length) return f.historico.filter(h => typeof h.em === "number");
  // cartão antigo (antes do histórico): só sabemos a última revisão
  if (typeof f.ultimaRevisao === "number") return [{ em: f.ultimaRevisao, nota: null }];
  return [];
}

// uma "unidade" por assunto da matéria: { id, nome, assuntoId, tent: [...], revs: [...] }
async function coletarUnidadesDaMateria(materiaId) {
  const assuntos = await dbGetAll("assuntos", "materiaId", materiaId);
  assuntos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const unidades = [];
  for (const a of assuntos) {
    const questoes = await dbGetAll("questoes", "assuntoId", a.id);
    const cards = await dbGetAll("flashcards", "assuntoId", a.id);
    const tent = [];
    for (const q of questoes) for (const t of (q.tentativas || [])) if (typeof t.em === "number") tent.push(t);
    const revs = [];
    for (const f of cards) revs.push(...revisoesDoFlashcard(f));
    unidades.push({ id: a.id, nome: a.nome, assuntoId: a.id, tent, revs });
  }
  return unidades;
}

// uma "unidade" por matéria do roteiro atual (soma de todos os assuntos)
async function coletarUnidadesPorMateria() {
  const unidades = [];
  for (const m of MATERIAS) {
    const subs = await coletarUnidadesDaMateria(m.id);
    unidades.push({
      id: m.id, materiaId: m.id, nome: `${m.icone} ${m.nome}`,
      tent: subs.flatMap(u => u.tent),
      revs: subs.flatMap(u => u.revs),
    });
  }
  return unidades;
}

async function renderDesempenho(materiaId) {
  const el = document.getElementById("desempenho-container");
  const unidades = await coletarUnidadesDaMateria(materiaId);
  montarPainelDesempenho(el, unidades, {
    rotuloUnidade: "Assunto",
    mostrarZeros: false,
    vazioHTML: `
      <div class="empty-state">
        <span class="empty-emoji">📊</span>
        <p>Ainda não há questões respondidas nem flashcards revisados nesta matéria.</p>
        <p>Nas questões, clique em "Acertei" ou "Errei"; nos flashcards, faça uma revisão para o desempenho aparecer aqui.</p>
      </div>`,
    dicaQuestoes: "Abrir as questões deste assunto",
    dicaFlash: "Abrir os flashcards deste assunto",
    rerender: () => renderDesempenho(materiaId),
    aoClicar: async (u, tipo) => {
      await goToAssunto(u.assuntoId);
      setActiveTab(tipo === "flash" ? "flashcards" : "questoes");
    },
  });
}

/* ---------- DESEMPENHO GERAL (todas as matérias do roteiro atual) ---------- */
document.getElementById("btn-desempenho-geral").addEventListener("click", goToDesempenhoGeral);

async function goToDesempenhoGeral() {
  if (!getConcursoAtual() || MATERIAS.length === 0) {
    showToast("Este roteiro ainda não tem matérias.");
    return;
  }
  state.currentMateriaId = null;
  state.currentAssuntoId = null;
  const c = getConcursoAtual();
  document.getElementById("app-title").textContent = `📊 Desempenho geral — ${c.nome}`;
  showView("view-desempenho");
  await renderDesempenhoGeral();
}

async function renderDesempenhoGeral() {
  const el = document.getElementById("desempenho-container");
  const unidades = await coletarUnidadesPorMateria();
  montarPainelDesempenho(el, unidades, {
    rotuloUnidade: "Matéria",
    mostrarZeros: true, // mostra também as matérias sem atividade, para ver onde falta estudar
    vazioHTML: `
      <div class="empty-state">
        <span class="empty-emoji">📊</span>
        <p>Ainda não há questões respondidas nem flashcards revisados neste roteiro.</p>
        <p>Assim que você estudar, o desempenho de todas as matérias aparece aqui.</p>
      </div>`,
    dicaQuestoes: "Ver o desempenho desta matéria",
    dicaFlash: "Ver o desempenho desta matéria",
    rerender: renderDesempenhoGeral,
    aoClicar: (u) => goToDesempenho(u.materiaId),
  });
}

/* ---------- painel compartilhado (matéria e geral), com abas Questões / Flashcards ---------- */
function montarPainelDesempenho(el, unidadesTodas, cfg) {
  const aba = state.desempAba === "flash" ? "flash" : "questoes";
  const ehFlash = aba === "flash";

  // só os dados da aba escolhida: tudo abaixo (cards, faixa de dias, tabela) usa apenas eles
  const unidades = unidadesTodas.map(u => ({ ...u, tent: ehFlash ? [] : u.tent, revs: ehFlash ? u.revs : [] }));

  const abasHTML = `
    <div class="tabs-bar desemp-abas">
      <button class="desemp-aba ${!ehFlash ? "active" : ""}" data-aba="questoes">❓ Questões</button>
      <button class="desemp-aba ${ehFlash ? "active" : ""}" data-aba="flash">🃏 Flashcards</button>
    </div>`;

  const ligarAbas = () => {
    el.querySelectorAll(".desemp-aba").forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.desempAba === btn.dataset.aba) return;
        state.desempAba = btn.dataset.aba;
        cfg.rerender();
      });
    });
  };

  // atividade por dia na aba escolhida: n = itens, ok = acertos / lembrados
  const dias = new Map(); // "AAAA-MM-DD" -> { n, ok }
  const doDia = (k) => {
    let o = dias.get(k);
    if (!o) { o = { n: 0, ok: 0 }; dias.set(k, o); }
    return o;
  };
  for (const u of unidades) {
    for (const t of u.tent) { const o = doDia(chaveDia(t.em)); o.n++; if (t.acertou) o.ok++; }
    for (const r of u.revs) { const o = doDia(chaveDia(r.em)); o.n++; if (r.nota && r.nota !== "errei") o.ok++; }
  }

  if (dias.size === 0) {
    el.innerHTML = abasHTML + (ehFlash ? `
      <div class="empty-state">
        <span class="empty-emoji">🃏</span>
        <p>Ainda não há flashcards revisados ${cfg.rotuloUnidade === "Matéria" ? "neste roteiro" : "nesta matéria"}.</p>
        <p>Faça uma revisão na aba Flashcards de um assunto para o desempenho aparecer aqui.</p>
      </div>` : `
      <div class="empty-state">
        <span class="empty-emoji">❓</span>
        <p>Ainda não há questões respondidas ${cfg.rotuloUnidade === "Matéria" ? "neste roteiro" : "nesta matéria"}.</p>
        <p>Nas questões, clique em "Acertei" ou "Errei" para o desempenho aparecer aqui.</p>
      </div>`);
    ligarAbas();
    return;
  }

  // ---- números do período escolhido ----
  const [ini, fim] = intervaloDesempenho();
  const noPeriodo = (x) => x.em >= ini && x.em < fim;
  const linhas = unidades.map(u => {
    if (!ehFlash) {
      const tp = u.tent.filter(noPeriodo);
      const ac = tp.filter(t => t.acertou).length;
      return { u, total: tp.length, acertos: ac, erros: tp.length - ac, semNota: 0, taxa: tp.length ? Math.round((ac / tp.length) * 100) : null };
    }
    const rp = u.revs.filter(noPeriodo);
    const err = rp.filter(r => r.nota === "errei").length;
    const ok = rp.filter(r => r.nota && r.nota !== "errei").length;
    const den = ok + err;
    return { u, total: rp.length, acertos: ok, erros: err, semNota: rp.length - den, taxa: den ? Math.round((ok / den) * 100) : null };
  });
  const soma = (campo) => linhas.reduce((n, l) => n + l[campo], 0);
  const total = soma("total"), acertos = soma("acertos"), erros = soma("erros"), semNota = soma("semNota");
  const den = ehFlash ? acertos + erros : total;
  const taxaGeral = den ? Math.round((acertos / den) * 100) : null;

  const ordem = state.desempOrdem;
  let lista = cfg.mostrarZeros ? linhas.slice() : linhas.filter(l => l.total > 0);
  const ocultas = linhas.length - lista.length;
  if (ordem === "pior") lista.sort((a, b) => (a.taxa ?? 101) - (b.taxa ?? 101) || b.total - a.total);
  else if (ordem === "melhor") lista.sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.total - a.total);
  else if (ordem === "mais") lista.sort((a, b) => b.total - a.total);
  // "assunto" mantém a ordem do cadastro

  // ---- sequência de dias estudando (na aba escolhida) ----
  let sequencia = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!dias.has(chaveDia(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (dias.has(chaveDia(cursor.getTime()))) {
    sequencia++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // ---- faixa dos últimos 14 dias ----
  const nivel = (n) => (n === 0 ? 0 : n < 5 ? 1 : n < 10 ? 2 : n < 20 ? 3 : 4);
  let faixaHTML = "";
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const k = chaveDia(d.getTime());
    const info = dias.get(k) || { n: 0, ok: 0 };
    const selecionado = state.desempPeriodo === "data" && state.desempData === k;
    const dica = info.n
      ? (ehFlash
          ? `${d.toLocaleDateString("pt-BR")}: ${info.n} flashcard(s) revisado(s)`
          : `${d.toLocaleDateString("pt-BR")}: ${info.n} respondida(s) — ${info.ok} acerto(s), ${info.n - info.ok} erro(s)`)
      : `${d.toLocaleDateString("pt-BR")}: nenhuma atividade`;
    faixaHTML += `
      <button class="desemp-dia nivel-${nivel(info.n)} ${selecionado ? "selecionado" : ""}" data-dia="${k}" title="${dica}">
        <span class="desemp-dia-sem">${DIAS_SEMANA[d.getDay()].slice(0, 3)}</span>
        <span class="desemp-dia-num">${d.getDate()}</span>
        <span class="desemp-dia-qtd">${info.n || "·"}</span>
      </button>`;
  }

  const pills = [["hoje", "Hoje"], ["ontem", "Ontem"], ["7d", "7 dias"], ["30d", "30 dias"], ["tudo", "Tudo"]]
    .map(([v, t]) => `<button class="pagina-pill desemp-pill ${state.desempPeriodo === v ? "active" : ""}" data-periodo="${v}">${t}</button>`)
    .join("");

  const barra = (taxa) => taxa === null
    ? `<span class="desemp-barra"></span><b>—</b>`
    : `<span class="desemp-barra"><span class="desemp-barra-ok" style="width:${taxa}%"></span></span><b>${taxa}%</b>`;

  const linhaHTML = (l) => `
    <div class="desemp-linha ${l.total === 0 ? "desemp-linha-vazia" : ""}" data-unidade="${l.u.id}" data-tipo="${aba}" title="${escapeHTML(ehFlash ? cfg.dicaFlash : cfg.dicaQuestoes)}">
      <span class="desemp-nome">${escapeHTML(l.u.nome)}</span>
      <span class="desemp-num">${l.total}</span>
      <span class="desemp-num desemp-acerto">${l.acertos}</span>
      <span class="desemp-num desemp-erro">${l.erros}</span>
      <span class="desemp-taxa ${classeTaxa(l.taxa)}">${barra(l.taxa)}</span>
    </div>`;

  const cab = ehFlash ? ["Revis.", "Lembrei", "Errei", "% lembrança"] : ["Resp.", "Acertos", "Erros", "% de acerto"];
  const nomeUnidades = cfg.rotuloUnidade === "Matéria" ? ["matéria", "matérias"] : ["assunto", "assuntos"];

  const cardsHTML = ehFlash ? `
      <div class="desemp-card"><span class="desemp-card-valor">${total}</span><span class="desemp-card-rotulo">revisões</span></div>
      <div class="desemp-card ok"><span class="desemp-card-valor">${acertos}</span><span class="desemp-card-rotulo">lembrei ✅</span></div>
      <div class="desemp-card erro"><span class="desemp-card-valor">${erros}</span><span class="desemp-card-rotulo">errei ❌</span></div>
      <div class="desemp-card ${classeTaxa(taxaGeral)}"><span class="desemp-card-valor">${taxaGeral === null ? "—" : taxaGeral + "%"}</span><span class="desemp-card-rotulo">de lembrança</span></div>`
    : `
      <div class="desemp-card"><span class="desemp-card-valor">${total}</span><span class="desemp-card-rotulo">respondidas</span></div>
      <div class="desemp-card ok"><span class="desemp-card-valor">${acertos}</span><span class="desemp-card-rotulo">acertos ✅</span></div>
      <div class="desemp-card erro"><span class="desemp-card-valor">${erros}</span><span class="desemp-card-rotulo">erros ❌</span></div>
      <div class="desemp-card ${classeTaxa(taxaGeral)}"><span class="desemp-card-valor">${taxaGeral === null ? "—" : taxaGeral + "%"}</span><span class="desemp-card-rotulo">de acerto</span></div>`;

  el.innerHTML = `
    ${abasHTML}

    <div class="desemp-controles">
      <div class="desemp-pills">${pills}</div>
      <label class="desemp-data">
        <span>📅 Dia específico:</span>
        <input type="date" id="desemp-data" value="${state.desempPeriodo === "data" ? state.desempData : ""}" max="${chaveDia(Date.now())}">
      </label>
    </div>

    <h3 class="desemp-titulo">${escapeHTML(rotuloPeriodoDesempenho())} <small>· ${sequencia} ${sequencia === 1 ? "dia seguido" : "dias seguidos"} ${ehFlash ? "revisando" : "resolvendo questões"} 🔥</small></h3>

    <div class="desemp-resumo quatro">${cardsHTML}</div>

    <h3 class="desemp-titulo">Últimos 14 dias <small>(clique em um dia para filtrar)</small></h3>
    <div class="desemp-faixa">${faixaHTML}</div>

    <div class="view-header-row desemp-tabela-topo">
      <h3 class="desemp-titulo" style="margin:0;">Detalhes por ${cfg.rotuloUnidade.toLowerCase()}</h3>
      <select class="select-mini" id="desemp-ordem" title="Ordenar">
        <option value="assunto" ${ordem === "assunto" ? "selected" : ""}>Ordem do cadastro</option>
        <option value="pior" ${ordem === "pior" ? "selected" : ""}>Pior desempenho primeiro</option>
        <option value="melhor" ${ordem === "melhor" ? "selected" : ""}>Melhor desempenho primeiro</option>
        <option value="mais" ${ordem === "mais" ? "selected" : ""}>Mais atividade primeiro</option>
      </select>
    </div>

    ${lista.length === 0 ? `
      <div class="empty-state">
        <span class="empty-emoji">🗓️</span>
        <p>${ehFlash ? "Nenhum flashcard revisado neste período." : "Nenhuma questão respondida neste período."}</p>
      </div>` : `
      <div class="desemp-tabela">
        <div class="desemp-linha desemp-cabecalho">
          <span class="desemp-nome">${cfg.rotuloUnidade}</span>
          <span class="desemp-num">${cab[0]}</span>
          <span class="desemp-num desemp-acerto">${cab[1]}</span>
          <span class="desemp-num desemp-erro">${cab[2]}</span>
          <span class="desemp-taxa">${cab[3]}</span>
        </div>
        ${lista.map(linhaHTML).join("")}
      </div>
      ${ocultas > 0 ? `<p class="desemp-rodape">${ocultas} ${ocultas === 1 ? nomeUnidades[0] : nomeUnidades[1]} sem atividade neste período.</p>` : ""}
      ${ehFlash && semNota > 0 ? `<p class="desemp-rodape">${semNota} revisão(ões) antiga(s), feitas antes do histórico existir, entram só na coluna "Revis." (a nota não foi registrada).</p>` : ""}
    `}
  `;

  // ---- eventos ----
  ligarAbas();
  el.querySelectorAll(".desemp-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      state.desempPeriodo = btn.dataset.periodo;
      state.desempData = "";
      cfg.rerender();
    });
  });
  el.querySelectorAll(".desemp-dia").forEach(btn => {
    btn.addEventListener("click", () => {
      state.desempPeriodo = "data";
      state.desempData = btn.dataset.dia;
      cfg.rerender();
    });
  });
  document.getElementById("desemp-data").addEventListener("change", (e) => {
    if (!e.target.value) return;
    state.desempPeriodo = "data";
    state.desempData = e.target.value;
    cfg.rerender();
  });
  document.getElementById("desemp-ordem").addEventListener("change", (e) => {
    state.desempOrdem = e.target.value;
    cfg.rerender();
  });
  el.querySelectorAll(".desemp-linha[data-unidade]").forEach(linha => {
    linha.addEventListener("click", () => {
      const u = unidades.find(x => String(x.id) === linha.dataset.unidade);
      if (u) cfg.aoClicar(u, linha.dataset.tipo);
    });
  });
}

/* ============================================================
   7. TELA DO ASSUNTO — ABAS (esqueleto; conteúdo nas próximas etapas)
   ============================================================ */

function setActiveTab(tabName) {
  state.currentTab = tabName;
  flashSessao = null; // trocar de aba encerra qualquer revisão em andamento
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.hidden = panel.dataset.panel !== tabName;
  });

  if (tabName === "questoes") {
    renderQuestoesTab(state.currentAssuntoId);
  } else if (tabName === "materiais") {
    renderMateriaisTab(state.currentAssuntoId);
  } else if (tabName === "flashcards") {
    renderFlashcardsTab(state.currentAssuntoId);
  }
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
});

/* ============================================================
   7B. ABA QUESTÕES — páginas de 10, imagem, resposta, comentários,
        status, favorito, dificuldade. Tudo com autosave.
   ============================================================ */

function revogarObjectURLs() {
  state.objectURLs.forEach(url => URL.revokeObjectURL(url));
  state.objectURLs = [];
}

// Resumo de desempenho de uma questão a partir do histórico de tentativas:
// questao.tentativas = [{ em: timestamp, acertou: true/false }, ...]
function resumoTentativas(questao) {
  const t = questao.tentativas || [];
  const acertos = t.filter(x => x.acertou).length;
  const erros = t.length - acertos;
  return {
    total: t.length,
    acertos,
    erros,
    taxa: t.length ? Math.round((acertos / t.length) * 100) : null,
    ultima: t.length ? t[t.length - 1] : null,
  };
}

async function getQuestoesOrdenadas(assuntoId) {
  const questoes = await dbGetAll("questoes", "assuntoId", assuntoId);
  questoes.sort((a, b) => (a.criadoEm ?? 0) - (b.criadoEm ?? 0));
  return questoes;
}

async function renderQuestoesTab(assuntoId) {
  if (!assuntoId) return;
  revogarObjectURLs();

  const container = document.getElementById("questoes-container");
  const todasOrdenadas = await getQuestoesOrdenadas(assuntoId);

  // anexa o número global (posição real, 1-based) antes de filtrar,
  // assim a numeração da questão nunca muda quando um filtro está ativo
  const comNumero = todasOrdenadas.map((q, i) => ({ ...q, numeroGlobal: i + 1 }));

  const { status, dificuldade, favorito } = state.filtros;
  const desempenho = state.filtros.desempenho || "todos";
  const respondidas = state.filtros.respondidas || "todos";
  const filtroAtivo = status !== "todos" || dificuldade !== "todos" || favorito || desempenho !== "todos" || respondidas !== "todos";

  const filtradas = comNumero.filter(q => {
    if (status !== "todos" && q.status !== status) return false;
    if (dificuldade !== "todos" && q.dificuldade !== dificuldade) return false;
    if (favorito && !q.favorito) return false;
    if (desempenho !== "todos") {
      const r = resumoTentativas(q);
      if (desempenho === "nunca" && r.total > 0) return false;
      if (desempenho === "errei_ultima" && !(r.ultima && !r.ultima.acertou)) return false;
      if (desempenho === "ja_errei" && r.erros === 0) return false;
    }
    if (respondidas !== "todos") {
      const n = resumoTentativas(q).total; // quantas vezes a questão foi respondida
      if (respondidas === "1-3" && !(n >= 1 && n <= 3)) return false;
      if (respondidas === "3-5" && !(n >= 3 && n <= 5)) return false;
      if (respondidas === "5-7" && !(n >= 5 && n <= 7)) return false;
      if (respondidas === "7+" && !(n >= 7)) return false;
    }
    return true;
  });

  // ordem: sequencial (padrão, como foram inseridas) ou aleatória (embaralhada)
  if (state.ordem === "aleatoria") ordenarAleatoriamente(filtradas, comNumero);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / QUESTOES_POR_PAGINA));
  if (state.currentPagina > totalPaginas) state.currentPagina = totalPaginas;
  if (state.currentPagina < 1) state.currentPagina = 1;

  container.innerHTML = `
    <div class="questoes-toolbar">
      <div class="filtros-questoes">
        <select class="select-mini" id="select-ordem" title="Ordem das questões">
          <option value="sequencial" ${state.ordem === "sequencial" ? "selected" : ""}>Ordem: sequencial</option>
          <option value="aleatoria" ${state.ordem === "aleatoria" ? "selected" : ""}>Ordem: aleatória</option>
        </select>
        ${state.ordem === "aleatoria" ? `<button class="btn-toggle-favorito" id="btn-embaralhar" title="Sortear uma nova ordem">🔀 Embaralhar de novo</button>` : ""}
        <select class="select-mini" id="filtro-status">
          <option value="todos" ${status === "todos" ? "selected" : ""}>Todos os status</option>
          <option value="nao_respondida" ${status === "nao_respondida" ? "selected" : ""}>Não respondida</option>
          <option value="respondida" ${status === "respondida" ? "selected" : ""}>Respondida</option>
          <option value="revisada" ${status === "revisada" ? "selected" : ""}>Revisada</option>
        </select>
        <select class="select-mini" id="filtro-dificuldade">
          <option value="todos" ${dificuldade === "todos" ? "selected" : ""}>Todas as dificuldades</option>
          <option value="facil" ${dificuldade === "facil" ? "selected" : ""}>Fácil</option>
          <option value="media" ${dificuldade === "media" ? "selected" : ""}>Média</option>
          <option value="dificil" ${dificuldade === "dificil" ? "selected" : ""}>Difícil</option>
        </select>
        <select class="select-mini" id="filtro-desempenho">
          <option value="todos" ${desempenho === "todos" ? "selected" : ""}>Todo o desempenho</option>
          <option value="nunca" ${desempenho === "nunca" ? "selected" : ""}>Nunca revisadas</option>
          <option value="errei_ultima" ${desempenho === "errei_ultima" ? "selected" : ""}>Errei na última vez</option>
          <option value="ja_errei" ${desempenho === "ja_errei" ? "selected" : ""}>Já errei alguma vez</option>
        </select>
        <select class="select-mini" id="filtro-respondidas" title="Quantas vezes a questão foi respondida">
          <option value="todos" ${respondidas === "todos" ? "selected" : ""}>Qtd. respondida: todas</option>
          <option value="1-3" ${respondidas === "1-3" ? "selected" : ""}>Respondida 1 a 3 vezes</option>
          <option value="3-5" ${respondidas === "3-5" ? "selected" : ""}>Respondida 3 a 5 vezes</option>
          <option value="5-7" ${respondidas === "5-7" ? "selected" : ""}>Respondida 5 a 7 vezes</option>
          <option value="7+" ${respondidas === "7+" ? "selected" : ""}>Respondida 7 vezes ou mais</option>
        </select>
        <button class="btn-toggle-favorito ${favorito ? "active" : ""}" id="filtro-favorito" title="Só favoritas">⭐ Favoritas</button>
        ${filtroAtivo ? `<button class="btn-ghost" id="btn-limpar-filtros">Limpar filtros</button>` : ""}
      </div>
      <div class="questoes-add-btns">
        <label class="btn-secondary" style="cursor:pointer;" title="Selecione várias imagens de uma vez, ou cole prints com Ctrl+V, ou arraste para cá">
          🖼️ Adicionar várias imagens
          <input type="file" id="input-imagens-lote" accept="image/png,image/jpeg,image/jpg,image/webp" multiple hidden>
        </label>
        <button class="btn-secondary" id="btn-pdf-questoes" title="Exportar as imagens das questões em um único PDF">📄 PDF</button>
        <button class="btn-primary" id="btn-add-questao">+ Nova questão</button>
      </div>
    </div>
    <div class="questoes-dica">💡 Dica: cole prints com <b>Ctrl+V</b> (um atrás do outro) ou arraste várias imagens para cá. Cada imagem vira uma questão; as respostas e comentários você preenche depois.</div>
    <div class="paginacao" id="paginacao"></div>
    <div class="questoes-lista" id="questoes-lista"></div>
  `;

  document.getElementById("select-ordem").addEventListener("change", (e) => {
    state.ordem = e.target.value;
    if (state.ordem === "aleatoria") state.ordemAleatoria = null; // sorteia uma ordem nova
    state.currentPagina = 1;
    renderQuestoesTab(assuntoId);
  });
  const btnEmbaralhar = document.getElementById("btn-embaralhar");
  if (btnEmbaralhar) {
    btnEmbaralhar.addEventListener("click", () => {
      state.ordemAleatoria = null;
      state.currentPagina = 1;
      renderQuestoesTab(assuntoId);
      showToast("Questões embaralhadas 🔀");
    });
  }
  document.getElementById("filtro-status").addEventListener("change", (e) => {
    state.filtros.status = e.target.value;
    state.currentPagina = 1;
    renderQuestoesTab(assuntoId);
  });
  document.getElementById("filtro-dificuldade").addEventListener("change", (e) => {
    state.filtros.dificuldade = e.target.value;
    state.currentPagina = 1;
    renderQuestoesTab(assuntoId);
  });
  document.getElementById("filtro-desempenho").addEventListener("change", (e) => {
    state.filtros.desempenho = e.target.value;
    state.currentPagina = 1;
    renderQuestoesTab(assuntoId);
  });
  document.getElementById("filtro-respondidas").addEventListener("change", (e) => {
    state.filtros.respondidas = e.target.value;
    state.currentPagina = 1;
    renderQuestoesTab(assuntoId);
  });
  document.getElementById("filtro-favorito").addEventListener("click", () => {
    state.filtros.favorito = !state.filtros.favorito;
    state.currentPagina = 1;
    renderQuestoesTab(assuntoId);
  });
  const btnLimpar = document.getElementById("btn-limpar-filtros");
  if (btnLimpar) {
    btnLimpar.addEventListener("click", () => {
      state.filtros = { status: "todos", dificuldade: "todos", favorito: false, desempenho: "todos", respondidas: "todos" };
      state.currentPagina = 1;
      renderQuestoesTab(assuntoId);
    });
  }
  document.getElementById("btn-add-questao").addEventListener("click", () => adicionarQuestao(assuntoId));
  document.getElementById("btn-pdf-questoes").addEventListener("click", () => abrirModalExportarPdfQuestoes(assuntoId));
  document.getElementById("input-imagens-lote").addEventListener("change", (e) => {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = "";
    // ordena pelo nome (prints costumam ter data/hora no nome) para manter a sequência
    arquivos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    adicionarQuestoesEmLote(assuntoId, arquivos);
  });

  // paginação
  const paginacaoEl = document.getElementById("paginacao");
  if (filtradas.length === 0) {
    paginacaoEl.innerHTML = "";
  } else {
    for (let p = 1; p <= totalPaginas; p++) {
      const pill = document.createElement("button");
      pill.className = "pagina-pill" + (p === state.currentPagina ? " active" : "");
      pill.textContent = p;
      pill.addEventListener("click", () => {
        state.currentPagina = p;
        renderQuestoesTab(assuntoId);
      });
      paginacaoEl.appendChild(pill);
    }
  }

  // lista da página atual
  const listaEl = document.getElementById("questoes-lista");

  if (todasOrdenadas.length === 0) {
    listaEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">❓</span>
        <p>Nenhuma questão cadastrada ainda.</p>
        <p>Clique em "Nova questão" para adicionar a primeira.</p>
      </div>`;
    return;
  }

  if (filtradas.length === 0) {
    listaEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">🔎</span>
        <p>Nenhuma questão corresponde a esse filtro.</p>
      </div>`;
    return;
  }

  const inicio = (state.currentPagina - 1) * QUESTOES_POR_PAGINA;
  const questoesPagina = filtradas.slice(inicio, inicio + QUESTOES_POR_PAGINA);

  questoesPagina.forEach((questao) => {
    listaEl.appendChild(criarQuestaoCard(questao, questao.numeroGlobal));
  });
  listaEl.querySelectorAll(".questao-textarea").forEach(autoAjustarTextarea);
}

// Embaralha (Fisher-Yates) e mantém a mesma ordem enquanto você navega/edita,
// só sorteia de novo quando você pede (ou troca para "aleatória").
function ordenarAleatoriamente(lista, todas) {
  const idsAtuais = todas.map(q => q.id);
  let ordem = state.ordemAleatoria;
  if (!ordem) {
    ordem = idsAtuais.slice();
    for (let i = ordem.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    }
  } else {
    // questões novas entram no fim; questões apagadas saem
    const existentes = new Set(idsAtuais);
    ordem = ordem.filter(id => existentes.has(id));
    const jaTem = new Set(ordem);
    idsAtuais.forEach(id => { if (!jaTem.has(id)) ordem.push(id); });
  }
  state.ordemAleatoria = ordem;
  const posicao = new Map(ordem.map((id, i) => [id, i]));
  lista.sort((a, b) => posicao.get(a.id) - posicao.get(b.id));
}

// Faz a caixa de texto crescer até mostrar tudo, sem barra de rolagem interna.
function autoAjustarTextarea(ta) {
  if (!ta) return;
  ta.style.height = "auto";
  if (ta.scrollHeight > 0) ta.style.height = (ta.scrollHeight + 2) + "px";
}
window.addEventListener("resize", () => {
  document.querySelectorAll(".questao-textarea").forEach(autoAjustarTextarea);
});

async function adicionarQuestao(assuntoId) {
  const novaQuestao = {
    assuntoId,
    criadoEm: Date.now(),
    imagem: null,
    resposta: "",
    comentario: "",
    tentativas: [],
    status: "nao_respondida",
    favorito: false,
    dificuldade: "media",
  };
  await dbPut("questoes", novaQuestao);
  const questoes = await getQuestoesOrdenadas(assuntoId);
  state.filtros = { status: "todos", dificuldade: "todos", favorito: false, desempenho: "todos", respondidas: "todos" };
  state.currentPagina = Math.max(1, Math.ceil(questoes.length / QUESTOES_POR_PAGINA));
  showToast("Questão adicionada.");
  renderQuestoesTab(assuntoId);
}

const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
let adicionandoLote = false;

// Cria uma questão para cada imagem recebida (seleção múltipla, colar ou arrastar)
async function adicionarQuestoesEmLote(assuntoId, arquivos) {
  const imagens = arquivos.filter(f => TIPOS_IMAGEM.includes(f.type));
  if (!imagens.length) {
    if (arquivos.length) showToast("Nenhuma imagem válida. Use PNG, JPG, JPEG ou WEBP.");
    return;
  }
  if (adicionandoLote) return;
  adicionandoLote = true;
  try {
    const base = Date.now();
    for (let i = 0; i < imagens.length; i++) {
      await dbPut("questoes", {
        assuntoId,
        criadoEm: base + i, // mantém a ordem de chegada
        imagem: imagens[i],
        resposta: "",
        comentario: "",
        tentativas: [],
        status: "nao_respondida",
        favorito: false,
        dificuldade: "media",
      });
    }
    const questoes = await getQuestoesOrdenadas(assuntoId);
    state.filtros = { status: "todos", dificuldade: "todos", favorito: false, desempenho: "todos", respondidas: "todos" };
    state.currentPagina = Math.max(1, Math.ceil(questoes.length / QUESTOES_POR_PAGINA));
    showToast(imagens.length === 1 ? "1 questão adicionada." : `${imagens.length} questões adicionadas.`);
    renderQuestoesTab(assuntoId);
  } finally {
    adicionandoLote = false;
  }
}

// Colar prints (Ctrl+V) na aba Questões
document.addEventListener("paste", (e) => {
  if (state.currentTab !== "questoes" || !state.currentAssuntoId) return;
  const itens = Array.from(e.clipboardData?.items || []);
  const arquivos = itens.filter(it => it.kind === "file" && it.type.startsWith("image/"))
                        .map(it => it.getAsFile()).filter(Boolean);
  if (!arquivos.length) return; // colagem de texto continua normal
  e.preventDefault();
  adicionarQuestoesEmLote(state.currentAssuntoId, arquivos);
});

// Arrastar e soltar imagens na aba Questões
(function () {
  const painel = document.getElementById("tab-questoes");
  if (!painel) return;
  const temArquivo = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
  painel.addEventListener("dragover", (e) => {
    if (!temArquivo(e)) return;
    e.preventDefault();
    painel.classList.add("drag-ativo");
  });
  painel.addEventListener("dragleave", (e) => {
    if (e.target === painel || !painel.contains(e.relatedTarget)) painel.classList.remove("drag-ativo");
  });
  painel.addEventListener("drop", (e) => {
    if (!temArquivo(e)) return;
    e.preventDefault();
    painel.classList.remove("drag-ativo");
    const arquivos = Array.from(e.dataTransfer.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    adicionarQuestoesEmLote(state.currentAssuntoId, arquivos);
  });
})();

function criarQuestaoCard(questao, numeroGlobal) {
  const card = document.createElement("div");
  card.className = "questao-card" + (questao.favorito ? " favorita" : "");

  card.innerHTML = `
    <div class="questao-header">
      <span class="questao-numero">Questão ${numeroGlobal}</span>
      <div class="questao-header-controls">
        <button class="btn-favorito ${questao.favorito ? "ativo" : ""}" title="Favoritar">⭐</button>
        <select class="select-mini select-dificuldade" data-value="${questao.dificuldade}" title="Dificuldade">
          <option value="facil" ${questao.dificuldade === "facil" ? "selected" : ""}>Fácil</option>
          <option value="media" ${questao.dificuldade === "media" ? "selected" : ""}>Média</option>
          <option value="dificil" ${questao.dificuldade === "dificil" ? "selected" : ""}>Difícil</option>
        </select>
        <select class="select-mini select-status" data-value="${questao.status}" title="Status">
          <option value="nao_respondida" ${questao.status === "nao_respondida" ? "selected" : ""}>Não respondida</option>
          <option value="respondida" ${questao.status === "respondida" ? "selected" : ""}>Respondida</option>
          <option value="revisada" ${questao.status === "revisada" ? "selected" : ""}>Revisada</option>
        </select>
        <button class="btn-icon btn-delete-questao" title="Excluir questão">🗑️</button>
      </div>
    </div>

    <div class="questao-imagem-area" id="img-area-${questao.id}"></div>

    <div class="questao-metricas"></div>

    <button type="button" class="btn-toggle-resposta"></button>

    <div class="questao-revelavel">
    <div class="questao-leitura-bar">
      <button type="button" class="btn-ler-tela-cheia" title="Abrir resposta e comentários em tela cheia">🔍 Ler em tela cheia</button>
    </div>
    <div class="questao-campos">
      <div>
        <label class="campo-label">Resposta</label>
        <textarea class="questao-textarea textarea-resposta" placeholder="Digite sua resposta...">${escapeHTML(questao.resposta)}</textarea>
      </div>
      <div>
        <label class="campo-label">Comentários</label>
        <textarea class="questao-textarea textarea-comentario" placeholder="Anotações sobre essa questão...">${escapeHTML(questao.comentario)}</textarea>
      </div>
    </div>

    <div class="questao-revisao">
      <span class="questao-revisao-titulo">Como foi dessa vez?</span>
      <div class="questao-revisao-botoes">
        <button type="button" class="btn-acertei">✅ Acertei</button>
        <button type="button" class="btn-errei">❌ Errei</button>
        <button type="button" class="btn-desfazer-tentativa" title="Desfazer o último registro">↩ Desfazer</button>
      </div>
    </div>
    </div>
  `;

  // ---- imagem ----
  renderImagemArea(card.querySelector(`#img-area-${questao.id}`), questao);

  // ---- mostrar / esconder resposta e comentários ----
  // Se a questão já tem resposta ou comentário, começa escondida (bom para treinar).
  // Se está vazia, começa aberta para você poder preencher.
  const btnToggle = card.querySelector(".btn-toggle-resposta");
  const camposEl = card.querySelector(".questao-revelavel");
  const visivelPadrao = !(questao.resposta || "").trim() && !(questao.comentario || "").trim();
  let visivel = state.respostasVisiveis.has(questao.id)
    ? state.respostasVisiveis.get(questao.id)
    : visivelPadrao;

  const ajustarCampos = () => card.querySelectorAll(".questao-textarea").forEach(autoAjustarTextarea);
  function aplicarVisibilidade() {
    camposEl.hidden = !visivel;
    if (visivel) requestAnimationFrame(ajustarCampos);
    btnToggle.textContent = visivel ? "🙈 Esconder resposta e comentários" : "👁️ Mostrar resposta e comentários";
    btnToggle.classList.toggle("ativo", visivel);
  }
  aplicarVisibilidade();

  btnToggle.addEventListener("click", () => {
    visivel = !visivel;
    state.respostasVisiveis.set(questao.id, visivel);
    aplicarVisibilidade();
  });

  // ---- contador de revisões + acertos/erros ----
  const metricasEl = card.querySelector(".questao-metricas");
  const btnDesfazer = card.querySelector(".btn-desfazer-tentativa");

  function atualizarMetricas() {
    const r = resumoTentativas(questao);
    if (r.total === 0) {
      metricasEl.innerHTML = `<span class="metrica metrica-vazia">Ainda sem revisões</span>`;
    } else {
      const classeTaxa = r.taxa >= 70 ? "bom" : r.taxa >= 40 ? "medio" : "ruim";
      metricasEl.innerHTML = `
        <span class="metrica" title="Quantas vezes você registrou essa questão">🔁 <b>${r.total}</b> ${r.total === 1 ? "revisão" : "revisões"}</span>
        <span class="metrica metrica-acerto">✅ <b>${r.acertos}</b></span>
        <span class="metrica metrica-erro">❌ <b>${r.erros}</b></span>
        <span class="metrica metrica-taxa ${classeTaxa}" title="Taxa de acerto">🎯 <b>${r.taxa}%</b></span>
        <span class="metrica metrica-data">Última: ${formatarData(r.ultima.em)} ${r.ultima.acertou ? "✅" : "❌"}</span>
      `;
    }
    btnDesfazer.hidden = r.total === 0;
  }
  atualizarMetricas();

  async function registrarTentativa(acertou) {
    questao.tentativas = questao.tentativas || [];
    questao.tentativas.push({ em: Date.now(), acertou });
    let statusMudou = false;
    if (questao.status === "nao_respondida") {
      questao.status = "respondida";
      statusMudou = true;
    }
    await dbPut("questoes", questao);
    if (statusMudou && state.filtros.status !== "todos") {
      renderQuestoesTab(questao.assuntoId);
      return;
    }
    if (statusMudou) {
      const sel = card.querySelector(".select-status");
      sel.value = questao.status;
      sel.dataset.value = questao.status;
    }
    atualizarMetricas();
    showToast(acertou ? "Acerto registrado ✅" : "Erro registrado ❌");
  }

  card.querySelector(".btn-acertei").addEventListener("click", () => registrarTentativa(true));
  card.querySelector(".btn-errei").addEventListener("click", () => registrarTentativa(false));
  btnDesfazer.addEventListener("click", async () => {
    if (!(questao.tentativas || []).length) return;
    questao.tentativas.pop();
    await dbPut("questoes", questao);
    atualizarMetricas();
    showToast("Último registro desfeito.");
  });

  // ---- favorito ----
  card.querySelector(".btn-favorito").addEventListener("click", async () => {
    questao.favorito = !questao.favorito;
    await dbPut("questoes", questao);
    if (state.filtros.favorito || state.filtros.status !== "todos" || state.filtros.dificuldade !== "todos") {
      renderQuestoesTab(questao.assuntoId);
    } else {
      card.classList.toggle("favorita", questao.favorito);
      card.querySelector(".btn-favorito").classList.toggle("ativo", questao.favorito);
    }
  });

  // ---- dificuldade ----
  const selectDif = card.querySelector(".select-dificuldade");
  selectDif.addEventListener("change", async () => {
    questao.dificuldade = selectDif.value;
    selectDif.dataset.value = selectDif.value;
    await dbPut("questoes", questao);
    if (state.filtros.dificuldade !== "todos") {
      renderQuestoesTab(questao.assuntoId);
    }
  });

  // ---- status ----
  const selectStatus = card.querySelector(".select-status");
  selectStatus.addEventListener("change", async () => {
    questao.status = selectStatus.value;
    selectStatus.dataset.value = selectStatus.value;
    await dbPut("questoes", questao);
    if (state.filtros.status !== "todos") {
      renderQuestoesTab(questao.assuntoId);
    }
  });

  // ---- excluir questão ----
  card.querySelector(".btn-delete-questao").addEventListener("click", () => {
    confirmDeleteQuestao(questao);
  });

  // ---- resposta / comentário (autosave com debounce) ----
  let debounceResposta = null;
  card.querySelector(".textarea-resposta").addEventListener("input", (e) => {
    autoAjustarTextarea(e.target);
    clearTimeout(debounceResposta);
    debounceResposta = setTimeout(async () => {
      questao.resposta = e.target.value;
      await dbPut("questoes", questao);
    }, 500);
  });

  let debounceComentario = null;
  card.querySelector(".textarea-comentario").addEventListener("input", (e) => {
    autoAjustarTextarea(e.target);
    clearTimeout(debounceComentario);
    debounceComentario = setTimeout(async () => {
      questao.comentario = e.target.value;
      await dbPut("questoes", questao);
    }, 500);
  });

  // ---- ler resposta e comentários em tela cheia ----
  card.querySelector(".btn-ler-tela-cheia").addEventListener("click", () => {
    abrirLeitorQuestao(
      questao,
      numeroGlobal,
      card.querySelector(".textarea-resposta").value,
      card.querySelector(".textarea-comentario").value
    );
  });

  return card;
}

function renderImagemArea(areaEl, questao) {
  if (questao.imagem) {
    const url = URL.createObjectURL(questao.imagem);
    state.objectURLs.push(url);
    areaEl.innerHTML = `
      <div class="questao-imagem-wrap">
        <img src="${url}" alt="Imagem da questão ${questao.id}">
      </div>
    `;
    areaEl.querySelector("img").addEventListener("click", () => abrirLightbox(url));
  } else {
    areaEl.innerHTML = `
      <label class="upload-placeholder">
        <span class="upload-icon">🖼️</span>
        <span>Adicionar imagem (PNG, JPG, JPEG ou WEBP)</span>
        <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden class="input-imagem">
      </label>
    `;
    areaEl.querySelector(".input-imagem").addEventListener("change", (e) => {
      handleImagemSelecionada(e, areaEl, questao);
    });
  }
}

async function handleImagemSelecionada(event, areaEl, questao) {
  const file = event.target.files[0];
  if (!file) return;
  const tiposAceitos = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!tiposAceitos.includes(file.type)) {
    showToast("Formato inválido. Use PNG, JPG, JPEG ou WEBP.");
    return;
  }
  questao.imagem = file;
  await dbPut("questoes", questao);
  renderImagemArea(areaEl, questao);
  showToast("Imagem salva.");
}

// Leitor em tela cheia: mostra imagem, resposta e comentários em letra grande,
// sem caixas pequenas — só a página rola. A, A− e A+ ajustam o tamanho da letra.
const LEITOR_FONTE_MIN = 15, LEITOR_FONTE_MAX = 34;
function abrirLeitorQuestao(questao, numero, resposta, comentario) {
  let fonte = 20;
  try { fonte = parseInt(localStorage.getItem("caderno-leitor-fonte"), 10) || 20; } catch (e) {}

  const bloco = (titulo, texto) => `
    <section class="leitor-bloco">
      <h3 class="leitor-bloco-titulo">${titulo}</h3>
      ${(texto || "").trim()
        ? `<div class="leitor-texto">${escapeHTML(texto)}</div>`
        : `<p class="leitor-vazio">Nada preenchido aqui ainda.</p>`}
    </section>`;

  let imgUrl = null;
  if (questao.imagem) imgUrl = URL.createObjectURL(questao.imagem);

  const overlay = document.createElement("div");
  overlay.className = "leitor-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="leitor-painel">
      <div class="leitor-topo">
        <span class="leitor-titulo">Questão ${numero}</span>
        <div class="leitor-controles">
          <button type="button" class="leitor-btn" data-acao="menos" title="Diminuir letra">A−</button>
          <button type="button" class="leitor-btn" data-acao="mais" title="Aumentar letra">A+</button>
          <button type="button" class="leitor-btn leitor-fechar" data-acao="fechar">Fechar ✕</button>
        </div>
      </div>
      ${imgUrl ? `<div class="leitor-imagem"><img src="${imgUrl}" alt="Imagem da questão ${numero}"></div>` : ""}
      ${bloco("Resposta", resposta)}
      ${bloco("Comentários", comentario)}
    </div>
  `;

  function aplicarFonte() {
    overlay.style.setProperty("--leitor-fonte", fonte + "px");
    try { localStorage.setItem("caderno-leitor-fonte", String(fonte)); } catch (e) {}
  }
  aplicarFonte();

  function fechar() {
    document.removeEventListener("keydown", onKey, true);
    document.body.style.overflow = prevOverflow;
    overlay.remove();
    if (imgUrl) URL.revokeObjectURL(imgUrl);
  }
  function onKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); fechar(); }
  }
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKey, true);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { fechar(); return; }
    const acao = e.target.closest("[data-acao]")?.dataset.acao;
    if (acao === "fechar") fechar();
    if (acao === "mais") { fonte = Math.min(LEITOR_FONTE_MAX, fonte + 2); aplicarFonte(); }
    if (acao === "menos") { fonte = Math.max(LEITOR_FONTE_MIN, fonte - 2); aplicarFonte(); }
  });

  document.body.appendChild(overlay);
  overlay.querySelector(".leitor-fechar").focus();
}

function abrirLightbox(url) {
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = `<img src="${url}" alt="Imagem ampliada">`;
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

function confirmDeleteQuestao(questao) {
  openModal(`
    <h3 class="modal-title">Excluir esta questão?</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 4px;">
      A imagem, resposta e comentários dessa questão serão apagados. Essa ação não pode ser desfeita.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-delete">Excluir</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    await dbDelete("questoes", questao.id);
    closeModal();
    showToast("Questão excluída.");
    renderQuestoesTab(questao.assuntoId);
  });
}

/* ============================================================
   7C. ABA MATERIAIS — upload de PDF, listar, abrir no navegador, excluir
   ============================================================ */

async function renderMateriaisTab(assuntoId) {
  if (!assuntoId) return;
  const container = document.getElementById("materiais-container");
  fecharPlayerAudio();

  const materiais = await dbGetAll("materiais", "assuntoId", assuntoId);
  materiais.sort((a, b) => (a.adicionadoEm ?? 0) - (b.adicionadoEm ?? 0));

  container.innerHTML = `
    <div class="materiais-toolbar">
      <span style="font-size:13px; color:var(--text-secondary);">
        ${resumoMateriais(materiais)}
      </span>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn-secondary" id="btn-add-link">🔗 Adicionar link</button>
        <label class="btn-secondary" style="cursor:pointer;" title="MP3, M4A, WAV, OGG... (ex.: Resumo em áudio do NotebookLM)">
          🎧 Adicionar áudio
          <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.oga,.aac,.opus,.flac,.weba" hidden id="input-audio">
        </label>
        <label class="btn-primary" style="cursor:pointer;">
          + Adicionar PDF
          <input type="file" accept="application/pdf,.pdf" hidden id="input-pdf">
        </label>
      </div>
    </div>
    <div class="materiais-lista" id="materiais-lista"></div>
  `;

  document.getElementById("input-pdf").addEventListener("change", (e) => {
    handlePdfSelecionado(e, assuntoId);
  });
  document.getElementById("btn-add-link").addEventListener("click", () => abrirModalLink(assuntoId));
  document.getElementById("input-audio").addEventListener("change", (e) => {
    handleAudioSelecionado(e, assuntoId);
  });

  const listaEl = document.getElementById("materiais-lista");

  if (materiais.length === 0) {
    listaEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">📎</span>
        <p>Nenhum material adicionado ainda.</p>
        <p>Use "Adicionar PDF", "Adicionar link" ou "Adicionar áudio" para guardar seus materiais.</p>
      </div>`;
    return;
  }

  materiais.forEach(material => {
    const ehLink = material.tipo === "link";
    const ehAudio = material.tipo === "audio";
    const row = document.createElement("div");
    row.className = "material-row";
    row.innerHTML = `
      <div class="material-row-main">
        <span class="material-icon">${ehLink ? "🔗" : ehAudio ? "🎧" : "📄"}</span>
        <div class="material-info">
          <div class="material-nome">${escapeHTML(material.nome)}</div>
          <div class="material-meta">${ehLink
            ? `${escapeHTML(dominioDoLink(material.url))} · adicionado em ${formatarData(material.adicionadoEm)}`
            : ehAudio
              ? `${material.duracao ? formatarDuracao(material.duracao) + " · " : ""}${formatarTamanho(material.arquivo ? material.arquivo.size : 0)} · adicionado em ${formatarData(material.adicionadoEm)}`
              : `${formatarTamanho(material.arquivo ? material.arquivo.size : 0)} · adicionado em ${formatarData(material.adicionadoEm)}`}</div>
        </div>
      </div>
      <div class="material-row-actions">
        ${ehLink ? `<button class="btn-icon btn-editar-link" title="Editar link">✏️</button>` : ""}
        ${ehAudio ? `<button class="btn-icon btn-renomear-audio" title="Renomear">✏️</button>` : ""}
        <button class="btn-icon btn-excluir-pdf" title="${ehLink ? "Excluir link" : ehAudio ? "Excluir áudio" : "Excluir PDF"}">🗑️</button>
      </div>
    `;
    row.addEventListener("click", (e) => {
      if (e.target.closest(".material-row-actions")) return;
      if (ehLink) abrirLink(material.url);
      else if (ehAudio) alternarPlayerAudio(row, material);
      else abrirPdf(material.arquivo);
    });
    if (ehAudio) {
      row.querySelector(".btn-renomear-audio").addEventListener("click", (e) => {
        e.stopPropagation();
        abrirModalRenomearAudio(material);
      });
    }
    if (ehLink) {
      row.querySelector(".btn-editar-link").addEventListener("click", (e) => {
        e.stopPropagation();
        abrirModalLink(assuntoId, material);
      });
    }
    row.querySelector(".btn-excluir-pdf").addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDeletePdf(material);
    });
    listaEl.appendChild(row);
  });
}

/* ---------- links nos materiais ---------- */

function resumoMateriais(materiais) {
  const links = materiais.filter(m => m.tipo === "link").length;
  const audios = materiais.filter(m => m.tipo === "audio").length;
  const pdfs = materiais.length - links - audios;
  const partes = [];
  partes.push(`${pdfs} PDF${pdfs === 1 ? "" : "s"}`);
  partes.push(`${links} link${links === 1 ? "" : "s"}`);
  partes.push(`${audios} áudio${audios === 1 ? "" : "s"}`);
  return partes.join(" · ") + " nesse assunto";
}

// aceita "site.com/pagina" (sem https://) e só permite http/https
function normalizarLink(txt) {
  let t = (txt || "").trim();
  if (!t) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) t = "https://" + t;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.href;
  } catch (e) {
    return null;
  }
}

function dominioDoLink(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url || ""; }
}

function abrirLink(url) {
  window.open(url, "_blank", "noopener");
}

function abrirModalLink(assuntoId, material = null) {
  const editando = !!material;
  openModal(`
    <h3 class="modal-title">${editando ? "Editar link" : "Adicionar link"}</h3>
    <div class="modal-field">
      <label for="link-url">Endereço (URL)</label>
      <input type="text" id="link-url" class="modal-input" placeholder="https://..." autocomplete="off" inputmode="url">
    </div>
    <div class="modal-field">
      <label for="link-nome">Nome (opcional)</label>
      <input type="text" id="link-nome" class="modal-input" placeholder="Ex.: Videoaula de Princípios da Administração" autocomplete="off">
    </div>
    <p id="link-erro" style="font-size:13px; color:var(--danger, #d64545); margin:0;" hidden></p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-salvar-link">${editando ? "Salvar" : "Adicionar"}</button>
    </div>
  `);

  const inUrl = document.getElementById("link-url");
  const inNome = document.getElementById("link-nome");
  const erro = document.getElementById("link-erro");
  if (editando) {
    inUrl.value = material.url || "";
    inNome.value = material.nome === dominioDoLink(material.url) ? "" : material.nome;
  }

  const salvar = async () => {
    const url = normalizarLink(inUrl.value);
    if (!url) {
      erro.hidden = false;
      erro.textContent = "Digite um endereço válido (ex.: https://exemplo.com/pagina).";
      inUrl.focus();
      return;
    }
    const nome = inNome.value.trim() || dominioDoLink(url);
    if (editando) {
      material.url = url;
      material.nome = nome;
      await dbPut("materiais", material);
    } else {
      await dbPut("materiais", {
        assuntoId,
        tipo: "link",
        nome,
        url,
        arquivo: null,
        adicionadoEm: Date.now(),
      });
    }
    closeModal();
    showToast(editando ? "Link atualizado." : "Link adicionado.");
    renderMateriaisTab(assuntoId);
  };

  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-salvar-link").addEventListener("click", salvar);
  [inUrl, inNome].forEach(el => el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); salvar(); }
  }));
}

async function handlePdfSelecionado(event, assuntoId) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Apenas arquivos PDF são aceitos.");
    return;
  }
  await dbPut("materiais", {
    assuntoId,
    nome: file.name,
    arquivo: file,
    adicionadoEm: Date.now(),
  });
  showToast("PDF adicionado.");
  renderMateriaisTab(assuntoId);
}

function abrirPdf(arquivoBlob) {
  const url = URL.createObjectURL(arquivoBlob);
  window.open(url, "_blank");
  // não revogamos imediatamente para não quebrar a aba recém-aberta com o PDF
}

/* ---------- áudios nos materiais (ex.: resumo em áudio do NotebookLM) ---------- */

let audioPlayerAtual = null;       // { row, box, url } — só um player aberto por vez
let audioVelocidade = 1;           // lembra a velocidade escolhida

function fecharPlayerAudio() {
  if (!audioPlayerAtual) return;
  const { row, box, url } = audioPlayerAtual;
  const audio = box.querySelector("audio");
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
  box.remove();
  URL.revokeObjectURL(url);
  if (row) row.classList.remove("material-tocando");
  audioPlayerAtual = null;
}

function alternarPlayerAudio(row, material) {
  const eraEste = audioPlayerAtual && audioPlayerAtual.material === material.id;
  fecharPlayerAudio();
  if (eraEste || !material.arquivo) return;

  const url = URL.createObjectURL(material.arquivo);
  const box = document.createElement("div");
  box.className = "audio-player-box";
  box.style.cssText = "margin:-4px 0 4px; padding:12px 14px; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-md); display:flex; align-items:center; gap:12px; flex-wrap:wrap;";
  box.innerHTML = `
    <audio controls preload="metadata" style="flex:1; min-width:200px; max-width:100%;"></audio>
    <label style="font-size:12.5px; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
      Velocidade
      <select class="select-mini audio-vel">
        ${[0.75, 1, 1.25, 1.5, 1.75, 2].map(v => `<option value="${v}" ${v === audioVelocidade ? "selected" : ""}>${v}x</option>`).join("")}
      </select>
    </label>
  `;
  const audio = box.querySelector("audio");
  audio.src = url;
  audio.playbackRate = audioVelocidade;
  audio.addEventListener("loadedmetadata", () => { audio.playbackRate = audioVelocidade; });
  box.querySelector(".audio-vel").addEventListener("change", (e) => {
    audioVelocidade = parseFloat(e.target.value) || 1;
    audio.playbackRate = audioVelocidade;
  });
  audio.addEventListener("error", () => {
    showToast("Não consegui tocar esse áudio neste aparelho. Tente converter para MP3.");
  });

  row.after(box);
  row.classList.add("material-tocando");
  audioPlayerAtual = { row, box, url, material: material.id };
  audio.play().catch(() => {});
}

function formatarDuracao(seg) {
  seg = Math.round(seg);
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// descobre a duração do arquivo (se o navegador conseguir ler); não trava se falhar
function lerDuracaoAudio(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    let fim = false;
    const terminar = (v) => {
      if (fim) return;
      fim = true;
      URL.revokeObjectURL(url);
      resolve(v);
    };
    a.preload = "metadata";
    a.onloadedmetadata = () => terminar(isFinite(a.duration) ? a.duration : null);
    a.onerror = () => terminar(null);
    setTimeout(() => terminar(null), 4000);
    a.src = url;
  });
}

async function handleAudioSelecionado(event, assuntoId) {
  const files = [...event.target.files];
  event.target.value = "";
  if (!files.length) return;
  const validos = files.filter(f => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|oga|aac|opus|flac|weba|mp4)$/i.test(f.name));
  if (!validos.length) {
    showToast("Escolha um arquivo de áudio (MP3, M4A, WAV, OGG...).");
    return;
  }
  showToast(validos.length === 1 ? "Salvando áudio..." : `Salvando ${validos.length} áudios...`);
  for (const file of validos) {
    const duracao = await lerDuracaoAudio(file);
    await dbPut("materiais", {
      assuntoId,
      tipo: "audio",
      nome: file.name.replace(/\.[^.]+$/, ""),
      arquivo: file,
      duracao,
      adicionadoEm: Date.now(),
    });
  }
  showToast(validos.length === 1 ? "Áudio adicionado 🎧" : `${validos.length} áudios adicionados 🎧`);
  renderMateriaisTab(assuntoId);
}

function abrirModalRenomearAudio(material) {
  openModal(`
    <h3 class="modal-title">Renomear áudio</h3>
    <div class="modal-field">
      <label for="audio-nome">Nome</label>
      <input type="text" id="audio-nome" class="modal-input" autocomplete="off">
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-salvar-audio">Salvar</button>
    </div>
  `);
  const inp = document.getElementById("audio-nome");
  inp.value = material.nome;
  inp.select();
  const salvar = async () => {
    const nome = inp.value.trim();
    if (!nome) { inp.focus(); return; }
    material.nome = nome;
    await dbPut("materiais", material);
    closeModal();
    showToast("Áudio renomeado.");
    renderMateriaisTab(material.assuntoId);
  };
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-salvar-audio").addEventListener("click", salvar);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); salvar(); } });
}

function confirmDeletePdf(material) {
  openModal(`
    <h3 class="modal-title">Excluir "${escapeHTML(material.nome)}"?</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 4px;">
      Essa ação não pode ser desfeita.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-delete">Excluir</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    if (audioPlayerAtual && audioPlayerAtual.material === material.id) fecharPlayerAudio();
    await dbDelete("materiais", material.id);
    closeModal();
    showToast(material.tipo === "link" ? "Link excluído." : material.tipo === "audio" ? "Áudio excluído." : "PDF excluído.");
    renderMateriaisTab(material.assuntoId);
  });
}

function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatarDataHora(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ============================================================
   7E. ABA FLASHCARDS — criar cartões (frente/verso) por assunto
        e revisar com repetição espaçada (sistema de caixas).
   ============================================================ */

// Intervalo (em dias) de cada caixa. Quanto mais alta a caixa, mais espaçada a revisão.
const INTERVALOS_DIAS = [0, 1, 3, 7, 15, 30, 60];

function inicioDoDia(offsetDias = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDias);
  return d.getTime();
}

function flashcardPendente(f) {
  return (f.proximaRevisao ?? 0) <= Date.now();
}

// nota: "errei" | "dificil" | "bom" | "facil"
function calcularProximaRevisao(caixaAtual, nota) {
  const max = INTERVALOS_DIAS.length - 1;
  let caixa;
  if (nota === "errei") caixa = 0;
  else if (nota === "dificil") caixa = caixaAtual;
  else if (nota === "bom") caixa = Math.min(max, caixaAtual + 1);
  else caixa = Math.min(max, caixaAtual + 2);
  const dias = nota === "errei" ? 0 : Math.max(1, INTERVALOS_DIAS[caixa]);
  return { caixa, dias };
}

function formatarIntervalo(dias) {
  if (dias === 0) return "de novo";
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function rotuloFlashcard(f) {
  if (!f.revisoes) return { texto: "Novo", classe: "novo" };
  if (flashcardPendente(f)) return { texto: "Revisar hoje", classe: "pendente" };
  const dias = Math.round((f.proximaRevisao - inicioDoDia()) / 86400000);
  return { texto: dias === 1 ? "Amanhã" : `Em ${dias} dias`, classe: "" };
}

async function getFlashcardsOrdenados(assuntoId) {
  const lista = await dbGetAll("flashcards", "assuntoId", assuntoId);
  lista.sort((a, b) => (a.criadoEm ?? 0) - (b.criadoEm ?? 0));
  return lista;
}

/* ---------- lista / gerenciamento ---------- */

async function renderFlashcardsTab(assuntoId) {
  if (!assuntoId) return;
  const container = document.getElementById("flashcards-container");
  const cards = await getFlashcardsOrdenados(assuntoId);

  // descarta seleção de outro assunto e ids que não existem mais
  if (flashSelecao && flashSelecao.assuntoId !== assuntoId) flashSelecao = null;
  if (flashSelecao) {
    const existentes = new Set(cards.map(c => c.id));
    flashSelecao.ids.forEach(id => { if (!existentes.has(id)) flashSelecao.ids.delete(id); });
  }

  const desenhar = () => {
    const pendentes = cards.filter(flashcardPendente);
    const selecionando = !!flashSelecao;
    const nSel = selecionando ? flashSelecao.ids.size : 0;
    const todosMarcados = selecionando && cards.length > 0 && nSel === cards.length;

    const info = selecionando
      ? `<b>${nSel}</b> selecionado${nSel === 1 ? "" : "s"} de <b>${cards.length}</b>`
      : `<b>${cards.length}</b> flashcard${cards.length === 1 ? "" : "s"} ·
         <b>${pendentes.length}</b> para revisar hoje`;

    const acoes = selecionando
      ? `
        <button class="btn-ghost" id="btn-sel-todos">${todosMarcados ? "Desmarcar todos" : "Selecionar todos"}</button>
        <button class="btn-secondary" id="btn-exportar-sel" ${nSel === 0 ? "disabled" : ""}>🗂️ Exportar (${nSel})</button>
        <button class="btn-secondary" id="btn-pdf-sel" ${nSel === 0 ? "disabled" : ""}>📄 PDF (${nSel})</button>
        <button class="btn-danger" id="btn-excluir-sel" ${nSel === 0 ? "disabled" : ""}>🗑️ Excluir (${nSel})</button>
        <button class="btn-secondary" id="btn-sel-cancelar">Cancelar</button>`
      : `
        ${cards.length > 0 && pendentes.length < cards.length
          ? `<button class="btn-ghost" id="btn-revisar-todos">Revisar todos</button>` : ""}
        ${pendentes.length > 0
          ? `<button class="btn-primary" id="btn-revisar">▶ Revisar (${pendentes.length})</button>` : ""}
        ${cards.length > 0
          ? `<button class="btn-secondary" id="btn-selecionar-flash" title="Selecionar vários flashcards para excluir ou exportar">☑ Selecionar</button>
             <button class="btn-secondary" id="btn-exportar-assunto" title="Exportar os flashcards deste assunto para o Anki (.apkg)">🗂️ Exportar</button>
             <button class="btn-secondary" id="btn-pdf-assunto" title="Exportar os flashcards deste assunto em PDF">📄 PDF</button>` : ""}
        <button class="btn-secondary" id="btn-import-flashcards" title="Importar flashcards de um texto ou arquivo (ex.: gerados por uma IA)">⭱ Importar</button>
        <button class="${pendentes.length > 0 ? "btn-secondary" : "btn-primary"}" id="btn-add-flashcard">+ Novo flashcard</button>`;

    container.innerHTML = `
      <div class="flash-toolbar">
        <span class="flash-toolbar-info">${info}</span>
        <div class="flash-toolbar-actions">${acoes}</div>
      </div>
      <div class="flash-lista" id="flash-lista"></div>
    `;

    const $ = (id) => document.getElementById(id);
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

    on("btn-add-flashcard", () => abrirModalFlashcard(assuntoId));
    on("btn-import-flashcards", () => abrirModalImportarFlashcards(assuntoId));
    on("btn-revisar", () => iniciarRevisao(assuntoId, false));
    on("btn-revisar-todos", () => iniciarRevisao(assuntoId, true));
    on("btn-exportar-assunto", () => abrirModalExportarAnki({ assuntoId }));
    on("btn-pdf-assunto", () => abrirModalExportarPdf({ assuntoId }));

    on("btn-selecionar-flash", () => { flashSelecao = { assuntoId, ids: new Set() }; desenhar(); });
    on("btn-sel-cancelar", () => { flashSelecao = null; desenhar(); });
    on("btn-sel-todos", () => {
      if (todosMarcados) flashSelecao.ids.clear();
      else cards.forEach(c => flashSelecao.ids.add(c.id));
      desenhar();
    });
    on("btn-excluir-sel", () => confirmDeleteFlashcardsEmLote(assuntoId, [...flashSelecao.ids]));
    on("btn-exportar-sel", () => abrirModalExportarAnki({ assuntoId, flashIds: [...flashSelecao.ids] }));
    on("btn-pdf-sel", () => abrirModalExportarPdf({ assuntoId, flashIds: [...flashSelecao.ids] }));

    const listaEl = $("flash-lista");

    if (cards.length === 0) {
      listaEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-emoji">🃏</span>
          <p>Nenhum flashcard cadastrado ainda.</p>
          <p>Clique em "Novo flashcard" para criar o primeiro ou em "Importar" para trazer vários de uma vez.</p>
        </div>`;
      return;
    }

    cards.forEach((f, i) => {
      const rotulo = rotuloFlashcard(f);
      const marcado = selecionando && flashSelecao.ids.has(f.id);
      const row = document.createElement("div");
      row.className = "flash-item" + (selecionando ? " selecionavel" : "") + (marcado ? " selecionado" : "");
      row.innerHTML = `
        ${selecionando ? `<input type="checkbox" class="flash-check" ${marcado ? "checked" : ""} aria-label="Selecionar flashcard ${i + 1}">` : ""}
        <span class="assunto-index">${String(i + 1).padStart(2, "0")}</span>
        <div class="flash-item-texto">
          <div class="flash-item-frente">${escapeHTML(f.frente)}</div>
          <div class="flash-item-verso">${escapeHTML(f.verso)}</div>
        </div>
        <div class="flash-item-lado">
          <span class="flash-badge ${rotulo.classe}">${rotulo.texto}</span>
          ${selecionando ? "" : `
            <button class="btn-icon btn-edit-flash" title="Editar">✏️</button>
            <button class="btn-icon btn-delete-flash" title="Excluir">🗑️</button>`}
        </div>
      `;

      if (selecionando) {
        row.addEventListener("click", (e) => {
          e.preventDefault(); // evita o checkbox alternar sozinho e ficar fora de sincronia
          if (flashSelecao.ids.has(f.id)) flashSelecao.ids.delete(f.id);
          else flashSelecao.ids.add(f.id);
          desenhar();
        });
      } else {
        row.addEventListener("click", (e) => {
          if (e.target.closest(".btn-icon")) return;
          abrirModalFlashcard(assuntoId, f);
        });
        row.querySelector(".btn-edit-flash").addEventListener("click", () => abrirModalFlashcard(assuntoId, f));
        row.querySelector(".btn-delete-flash").addEventListener("click", () => confirmDeleteFlashcard(f));
      }
      listaEl.appendChild(row);
    });
  };

  desenhar();
}

/* ---------- importar flashcards (texto colado ou arquivo, ex.: gerados por IA) ---------- */

function normalizarTextoCard(v) {
  return String(v ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\r\n?/g, "\n")
    .trim();
}
function chaveDuplicado(frente) {
  return frente.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

// Aceita: JSON (lista de {frente, verso}), blocos "Frente: ... Verso: ..." ou linhas "frente ::: verso".
function interpretarFlashcardsImportados(bruto) {
  let t = String(bruto ?? "").replace(/^\uFEFF/, "").trim();
  if (!t) return { cards: [], invalidos: 0, erro: null };
  t = t.replace(/^```[a-zA-Z]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();

  const cards = [];
  let invalidos = 0;
  const addCard = (frente, verso) => {
    frente = normalizarTextoCard(frente);
    verso = normalizarTextoCard(verso);
    if (frente && verso) cards.push({ frente, verso }); else invalidos++;
  };

  // ---- JSON ----
  if (t[0] === "[" || t[0] === "{") {
    let dados;
    try { dados = JSON.parse(t); }
    catch (e) {
      const i = t.indexOf("["), j = t.lastIndexOf("]");
      try { dados = JSON.parse(t.slice(i, j + 1)); }
      catch (e2) { return { cards: [], invalidos: 0, erro: "O texto parece JSON, mas está com erro de formatação. Peça para a IA responder só com o JSON válido." }; }
    }
    if (!Array.isArray(dados)) {
      dados = dados.flashcards || dados.cards || dados.cartoes || dados["cartões"] || dados.items || dados.data || [];
    }
    if (!Array.isArray(dados)) return { cards: [], invalidos: 0, erro: "Não encontrei uma lista de flashcards no JSON." };
    const pega = (o, chaves) => {
      for (const k of chaves) if (o[k] != null && String(o[k]).trim() !== "") return o[k];
      return "";
    };
    dados.forEach(item => {
      if (Array.isArray(item)) addCard(item[0], item[1]);
      else if (item && typeof item === "object") {
        addCard(
          pega(item, ["frente", "Frente", "pergunta", "Pergunta", "front", "Front", "question", "q"]),
          pega(item, ["verso", "Verso", "resposta", "Resposta", "back", "Back", "answer", "a"])
        );
      } else invalidos++;
    });
    return { cards, invalidos, erro: null };
  }

  // ---- blocos com marcadores Frente:/Verso: (ou P:/R:, Pergunta:/Resposta:) ----
  const reFrente = /^\s*(?:\d+[.)]\s*)?(?:frente|pergunta|front|question|p|q)\s*[:：]\s*(.*)$/i;
  const reVerso = /^\s*(?:verso|resposta|back|answer|r|a)\s*[:：]\s*(.*)$/i;
  const linhas = t.split("\n");
  if (linhas.some(l => reFrente.test(l)) && linhas.some(l => reVerso.test(l))) {
    let atual = null, campo = null;
    const fecha = () => { if (atual) addCard(atual.frente, atual.verso); atual = null; };
    for (const linha of linhas) {
      let m;
      if ((m = linha.match(reFrente))) { fecha(); atual = { frente: m[1], verso: "" }; campo = "frente"; }
      else if ((m = linha.match(reVerso)) && atual) { atual.verso = m[1]; campo = "verso"; }
      else if (/^\s*(-{3,}|\*{3,}|={3,})\s*$/.test(linha)) { fecha(); campo = null; }
      else if (atual && campo) atual[campo] += "\n" + linha;
    }
    fecha();
    return { cards, invalidos, erro: null };
  }

  // ---- uma linha por card: "frente ::: verso" ou separado por TAB ----
  for (const linha of linhas) {
    if (!linha.trim()) continue;
    let partes = null;
    if (linha.includes(":::")) partes = linha.split(":::");
    else if (linha.includes("\t")) partes = linha.split("\t");
    if (partes && partes.length >= 2) addCard(partes[0], partes.slice(1).join(" "));
    else invalidos++;
  }
  return { cards, invalidos, erro: null };
}

async function copiarParaAreaDeTransferencia(texto) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch (e) {
    const ta = document.createElement("textarea");
    ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) {}
    ta.remove();
    return ok;
  }
}

async function abrirModalImportarFlashcards(assuntoId) {
  let tema = "[ESCREVA AQUI O ASSUNTO]";
  try {
    const a = await dbGet("assuntos", assuntoId);
    if (a && a.nome) tema = a.nome;
  } catch (e) {}

  const prompt =
`Crie flashcards de estudo para concurso sobre o tema: ${tema}.

Responda SOMENTE com um array JSON válido, sem nenhum texto antes ou depois e sem bloco de código, exatamente neste formato:
[
  {"frente": "pergunta curta e objetiva", "verso": "resposta direta e completa"}
]

Regras:
- Uma única ideia por card.
- A frente deve ser uma pergunta ou uma frase com lacuna.
- O verso deve ser objetivo e, quando houver, citar o artigo/lei (ex.: "Art. 5º, XI, CF/88").
- Texto puro: sem markdown e sem HTML. Para quebra de linha dentro de um campo, use \\n.
- Não repita cards.

Gere 20 flashcards.`;

  openModal(`
    <h3 class="modal-title">Importar flashcards</h3>
    <p class="import-flash-intro">Cole abaixo os flashcards gerados pela IA ou escolha um arquivo. Eles serão adicionados a este assunto.</p>
    <div class="import-flash-acoes">
      <button type="button" class="btn-secondary" id="btn-copiar-prompt">📋 Copiar prompt para a IA</button>
      <button type="button" class="btn-secondary" id="btn-escolher-arquivo">📄 Escolher arquivo</button>
      <input type="file" id="input-arquivo-flash" accept=".json,.txt,.csv,.tsv,.md,text/plain,application/json" hidden>
    </div>
    <div class="modal-field">
      <label for="import-flash-texto">Conteúdo</label>
      <textarea id="import-flash-texto" class="modal-input flash-textarea import-flash-textarea" spellcheck="false"
        placeholder='[{"frente": "Pergunta?", "verso": "Resposta."}]&#10;&#10;ou&#10;&#10;Frente: Pergunta?&#10;Verso: Resposta.&#10;&#10;ou uma linha por card:&#10;Pergunta? ::: Resposta.'></textarea>
    </div>
    <label class="import-flash-check">
      <input type="checkbox" id="import-flash-ignorar" checked> Pular cards que já existem neste assunto (mesma frente)
    </label>
    <div id="import-flash-preview" class="import-flash-preview"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-confirmar-import" disabled>Importar</button>
    </div>
  `);
  document.getElementById("modal-box").classList.add("modal-wide");

  const existentes = await dbGetAll("flashcards", "assuntoId", assuntoId);
  const chavesExistentes = new Set(existentes.map(f => chaveDuplicado(f.frente || "")));

  const txt = document.getElementById("import-flash-texto");
  const chk = document.getElementById("import-flash-ignorar");
  const prev = document.getElementById("import-flash-preview");
  const btnOk = document.getElementById("btn-confirmar-import");
  let paraImportar = [];

  function atualizar() {
    const r = interpretarFlashcardsImportados(txt.value);
    const vistos = new Set();
    let duplicados = 0;
    paraImportar = [];
    r.cards.forEach(c => {
      const k = chaveDuplicado(c.frente);
      const dup = vistos.has(k) || (chk.checked && chavesExistentes.has(k));
      vistos.add(k);
      if (dup) duplicados++; else paraImportar.push(c);
    });

    if (!txt.value.trim()) {
      prev.innerHTML = "";
    } else if (r.erro) {
      prev.innerHTML = `<p class="import-flash-erro">${escapeHTML(r.erro)}</p>`;
    } else if (r.cards.length === 0) {
      prev.innerHTML = `<p class="import-flash-erro">Não consegui reconhecer nenhum flashcard. Use JSON, blocos "Frente:/Verso:" ou "pergunta ::: resposta".</p>`;
    } else {
      const notas = [];
      if (duplicados) notas.push(`${duplicados} repetido${duplicados === 1 ? "" : "s"} (pulado${duplicados === 1 ? "" : "s"})`);
      if (r.invalidos) notas.push(`${r.invalidos} incompleto${r.invalidos === 1 ? "" : "s"} (sem frente ou verso)`);
      const amostra = paraImportar.slice(0, 3).map(c => `
        <div class="import-flash-amostra">
          <b>${escapeHTML(c.frente.length > 140 ? c.frente.slice(0, 140) + "…" : c.frente)}</b>
          <span>${escapeHTML(c.verso.length > 180 ? c.verso.slice(0, 180) + "…" : c.verso)}</span>
        </div>`).join("");
      prev.innerHTML = `
        <p class="import-flash-ok"><b>${paraImportar.length}</b> flashcard${paraImportar.length === 1 ? "" : "s"} pronto${paraImportar.length === 1 ? "" : "s"} para importar${notas.length ? " · " + notas.join(" · ") : ""}</p>
        ${amostra}
        ${paraImportar.length > 3 ? `<p class="import-flash-mais">… e mais ${paraImportar.length - 3}</p>` : ""}`;
    }
    btnOk.disabled = paraImportar.length === 0;
    btnOk.textContent = paraImportar.length ? `Importar ${paraImportar.length}` : "Importar";
  }

  txt.addEventListener("input", atualizar);
  chk.addEventListener("change", atualizar);

  document.getElementById("btn-copiar-prompt").addEventListener("click", async () => {
    const ok = await copiarParaAreaDeTransferencia(prompt);
    showToast(ok ? "Prompt copiado! Cole na IA 📋" : "Não consegui copiar o prompt.");
  });

  const inputArq = document.getElementById("input-arquivo-flash");
  document.getElementById("btn-escolher-arquivo").addEventListener("click", () => inputArq.click());
  inputArq.addEventListener("change", async () => {
    const arq = inputArq.files && inputArq.files[0];
    if (!arq) return;
    txt.value = await arq.text();
    inputArq.value = "";
    atualizar();
  });

  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  btnOk.addEventListener("click", async () => {
    if (!paraImportar.length) return;
    btnOk.disabled = true;
    const base = Date.now();
    for (let i = 0; i < paraImportar.length; i++) {
      await dbPut("flashcards", {
        assuntoId,
        frente: paraImportar[i].frente,
        verso: paraImportar[i].verso,
        criadoEm: base + i,     // mantém a ordem do arquivo
        caixa: 0,
        proximaRevisao: 0,
        revisoes: 0,
        erros: 0,
      });
    }
    const n = paraImportar.length;
    closeModal();
    showToast(`${n} flashcard${n === 1 ? "" : "s"} importado${n === 1 ? "" : "s"} ✅`);
    renderFlashcardsTab(assuntoId);
  });
}

function abrirModalFlashcard(assuntoId, flashcard = null) {
  const editando = !!flashcard;
  openModal(`
    <h3 class="modal-title">${editando ? "Editar flashcard" : "Novo flashcard"}</h3>
    <div class="modal-field">
      <label for="input-flash-frente">Frente (pergunta)</label>
      <textarea id="input-flash-frente" class="modal-input flash-textarea" maxlength="3000" placeholder="Ex: Quando NÃO se usa crase?"></textarea>
    </div>
    <div class="modal-field">
      <label for="input-flash-verso">Verso (resposta)</label>
      <textarea id="input-flash-verso" class="modal-input flash-textarea" maxlength="8000" placeholder="Ex: Antes de palavras masculinas, verbos, pronomes pessoais..."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      ${editando ? "" : `<button class="btn-secondary" id="btn-save-flash-novo">Salvar e novo</button>`}
      <button class="btn-primary" id="btn-save-flash">Salvar</button>
    </div>
    <p class="flash-dica">Dica: Ctrl + Enter salva o cartão.</p>
  `);

  const inFrente = document.getElementById("input-flash-frente");
  const inVerso = document.getElementById("input-flash-verso");
  // janela larga + caixas que crescem conforme o texto (sem rolar dentro da caixa)
  document.getElementById("modal-box").classList.add("modal-wide", "modal-editor");
  const ajustar = () => { autoAjustarTextarea(inFrente); autoAjustarTextarea(inVerso); };
  [inFrente, inVerso].forEach(el => el.addEventListener("input", ajustar));
  if (editando) {
    inFrente.value = flashcard.frente;
    inVerso.value = flashcard.verso;
  }
  ajustar();
  requestAnimationFrame(ajustar);

  const salvar = async (continuar) => {
    const frente = inFrente.value.trim();
    const verso = inVerso.value.trim();
    if (!frente) { inFrente.focus(); return; }
    if (!verso) { inVerso.focus(); return; }

    if (editando) {
      flashcard.frente = frente;
      flashcard.verso = verso;
      await dbPut("flashcards", flashcard);
    } else {
      await dbPut("flashcards", {
        assuntoId,
        frente,
        verso,
        criadoEm: Date.now(),
        caixa: 0,
        proximaRevisao: 0,
        revisoes: 0,
        erros: 0,
      });
    }

    showToast(editando ? "Flashcard atualizado." : "Flashcard salvo.");
    if (continuar) {
      inFrente.value = "";
      inVerso.value = "";
      ajustar();
      inFrente.focus();
    } else {
      closeModal();
    }
    renderFlashcardsTab(assuntoId);
  };

  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-save-flash").addEventListener("click", () => salvar(false));
  const btnNovo = document.getElementById("btn-save-flash-novo");
  if (btnNovo) btnNovo.addEventListener("click", () => salvar(true));

  [inFrente, inVerso].forEach(el => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        salvar(false);
      }
    });
  });
}

function confirmDeleteFlashcard(flashcard) {
  openModal(`
    <h3 class="modal-title">Excluir este flashcard?</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 4px;">
      Essa ação não pode ser desfeita.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-delete">Excluir</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    await dbDelete("flashcards", flashcard.id);
    closeModal();
    showToast("Flashcard excluído.");
    renderFlashcardsTab(flashcard.assuntoId);
  });
}

function confirmDeleteFlashcardsEmLote(assuntoId, ids) {
  if (!ids.length) return;
  const n = ids.length;
  openModal(`
    <h3 class="modal-title">Excluir ${n} flashcard${n === 1 ? "" : "s"}?</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 4px;">
      ${n === 1 ? "O flashcard selecionado será excluído" : `Os ${n} flashcards selecionados serão excluídos`}.
      Essa ação não pode ser desfeita.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-delete">Excluir ${n}</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-confirm-delete").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    for (const id of ids) await dbDelete("flashcards", id);
    flashSelecao = null;
    closeModal();
    showToast(`${n} flashcard${n === 1 ? "" : "s"} excluído${n === 1 ? "" : "s"}.`);
    renderFlashcardsTab(assuntoId);
  });
}

/* ---------- modo revisão ---------- */

function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function iniciarRevisao(assuntoId, todos) {
  const cards = await getFlashcardsOrdenados(assuntoId);
  const fila = embaralhar(todos ? cards : cards.filter(flashcardPendente));
  if (fila.length === 0) {
    showToast("Nenhum flashcard para revisar agora.");
    return;
  }
  flashSessao = {
    assuntoId,
    fila,
    indice: 0,
    virada: false,
    ocupado: false,
    stats: { errei: 0, dificil: 0, bom: 0, facil: 0 },
  };
  renderRevisao();
}

function renderRevisao() {
  const s = flashSessao;
  if (!s) return;
  if (s.indice >= s.fila.length) {
    renderResumoRevisao();
    return;
  }

  const container = document.getElementById("flashcards-container");
  const f = s.fila[s.indice];
  const pct = Math.round((s.indice / s.fila.length) * 100);

  container.innerHTML = `
    <div class="flash-revisao">
      <div class="flash-revisao-topo">
        <span>Cartão <b>${s.indice + 1}</b> de ${s.fila.length}</span>
        <button class="btn-ghost" id="btn-sair-revisao">Sair da revisão</button>
      </div>
      <div class="progresso-revisao" style="height:6px;">
        <div class="progresso-revisao-barra" style="width:${pct}%; background:var(--accent);"></div>
      </div>
      <div class="flash-scene">
        <div class="flash-card ${s.virada ? "virado" : ""}" id="flash-card">
          <div class="flash-face">
            <span class="flash-face-label">Pergunta</span>
            <div class="flash-face-texto">${escapeHTML(f.frente)}</div>
          </div>
          <div class="flash-face verso">
            <span class="flash-face-label">Resposta</span>
            <div class="flash-face-texto">${escapeHTML(f.verso)}</div>
          </div>
        </div>
      </div>
      <div id="flash-acoes"></div>
      <p class="flash-dica" style="text-align:center;">Espaço vira o cartão · 1 Errei · 2 Difícil · 3 Bom · 4 Fácil</p>
    </div>
  `;

  document.getElementById("flash-card").addEventListener("click", virarFlashcard);
  document.getElementById("btn-sair-revisao").addEventListener("click", sairDaRevisao);
  renderAcoesRevisao();
}

function renderAcoesRevisao() {
  const s = flashSessao;
  const el = document.getElementById("flash-acoes");
  if (!s || !el) return;

  if (!s.virada) {
    el.innerHTML = `<button class="btn-primary flash-mostrar" id="btn-mostrar-resposta">Mostrar resposta</button>`;
    document.getElementById("btn-mostrar-resposta").addEventListener("click", virarFlashcard);
    return;
  }

  const f = s.fila[s.indice];
  const caixa = f.caixa ?? 0;
  const notas = [
    { id: "errei", label: "Errei" },
    { id: "dificil", label: "Difícil" },
    { id: "bom", label: "Bom" },
    { id: "facil", label: "Fácil" },
  ];
  el.innerHTML = `
    <div class="flash-notas">
      ${notas.map(n => `
        <button class="flash-nota ${n.id}" data-nota="${n.id}">
          ${n.label}
          <small>${formatarIntervalo(calcularProximaRevisao(caixa, n.id).dias)}</small>
        </button>
      `).join("")}
    </div>
  `;
  el.querySelectorAll(".flash-nota").forEach(btn => {
    btn.addEventListener("click", () => avaliarFlashcard(btn.dataset.nota));
  });
}

function virarFlashcard() {
  const s = flashSessao;
  if (!s) return;
  s.virada = !s.virada;
  const card = document.getElementById("flash-card");
  if (card) card.classList.toggle("virado", s.virada);
  renderAcoesRevisao();
}

async function avaliarFlashcard(nota) {
  const s = flashSessao;
  if (!s || !s.virada || s.ocupado) return;
  s.ocupado = true;
  try {
    const f = s.fila[s.indice];
    const { caixa, dias } = calcularProximaRevisao(f.caixa ?? 0, nota);
    f.caixa = caixa;
    f.proximaRevisao = inicioDoDia(dias);
    // histórico de revisões (alimenta o painel de desempenho). Cartões antigos, que só
    // tinham "ultimaRevisao", ganham uma entrada inicial sem nota.
    if (!Array.isArray(f.historico)) {
      f.historico = [];
      if (typeof f.ultimaRevisao === "number") f.historico.push({ em: f.ultimaRevisao, nota: null });
    }
    f.historico.push({ em: Date.now(), nota });
    f.ultimaRevisao = Date.now();
    f.revisoes = (f.revisoes ?? 0) + 1;
    if (nota === "errei") f.erros = (f.erros ?? 0) + 1;
    await dbPut("flashcards", f);

    s.stats[nota]++;
    if (nota === "errei") s.fila.push(f); // volta no fim da sessão até acertar
    s.indice++;
    s.virada = false;
  } finally {
    s.ocupado = false;
  }
  renderRevisao();
}

function renderResumoRevisao() {
  const s = flashSessao;
  const container = document.getElementById("flashcards-container");
  const { errei, dificil, bom, facil } = s.stats;
  const total = errei + dificil + bom + facil;

  container.innerHTML = `
    <div class="flash-revisao">
      <div class="empty-state">
        <span class="empty-emoji">🎉</span>
        <p><b>Revisão concluída!</b></p>
        <p>${total} avaliaç${total === 1 ? "ão" : "ões"} nesta sessão.</p>
      </div>
      <div class="flash-resumo-stats">
        <span class="flash-badge" style="background:var(--danger-soft); color:var(--danger);">Errei: ${errei}</span>
        <span class="flash-badge" style="background:var(--warning-soft); color:var(--warning);">Difícil: ${dificil}</span>
        <span class="flash-badge" style="background:var(--success-soft); color:var(--success);">Bom: ${bom}</span>
        <span class="flash-badge novo">Fácil: ${facil}</span>
      </div>
      <div style="display:flex; justify-content:center; margin-top:18px;">
        <button class="btn-primary" id="btn-fim-revisao">Voltar aos flashcards</button>
      </div>
    </div>
  `;
  document.getElementById("btn-fim-revisao").addEventListener("click", sairDaRevisao);
}

function sairDaRevisao() {
  const assuntoId = flashSessao ? flashSessao.assuntoId : state.currentAssuntoId;
  flashSessao = null;
  renderFlashcardsTab(assuntoId);
}

// atalhos de teclado durante a revisão
document.addEventListener("keydown", (e) => {
  if (!flashSessao || state.currentTab !== "flashcards") return;
  if (document.getElementById("view-assunto").hidden) return;
  if (!document.getElementById("modal-overlay").hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (flashSessao.indice >= flashSessao.fila.length) return;

  if (e.key === " " || e.key === "Enter") {
    if (tag === "BUTTON") return; // deixa o botão focado agir sozinho
    e.preventDefault();
    virarFlashcard();
    return;
  }
  if (!flashSessao.virada) return;
  const mapa = { "1": "errei", "2": "dificil", "3": "bom", "4": "facil" };
  if (mapa[e.key]) avaliarFlashcard(mapa[e.key]);
});

/* ============================================================
   8. TEMA CLARO / ESCURO
   ============================================================ */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("btn-theme").textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("caderno_theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("caderno_theme");
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
}

document.getElementById("btn-theme").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

/* ============================================================
   9. PESQUISA (versão básica — será expandida na etapa de Questões/Anotações)
   ============================================================ */

let searchDebounce = null;
document.getElementById("search-input").addEventListener("input", (e) => {
  clearTimeout(searchDebounce);
  const termo = e.target.value.trim();
  searchDebounce = setTimeout(() => runSearch(termo), 250);
});

async function runSearch(termo) {
  if (!termo) {
    if (!document.getElementById("view-busca").hidden) goToHome();
    return;
  }
  showView("view-busca");
  const container = document.getElementById("busca-results");
  container.innerHTML = `<div class="empty-state"><span class="empty-emoji">🔍</span><p>Buscando...</p></div>`;

  const termoLower = termo.toLowerCase();

  const [todosAssuntos, todasQuestoes] = await Promise.all([
    dbGetAll("assuntos"),
    dbGetAll("questoes"),
  ]);

  const mapaAssuntos = new Map(todosAssuntos.map(a => [a.id, a]));

  const assuntosMatch = todosAssuntos.filter(a => a.nome.toLowerCase().includes(termoLower));

  const questoesMatch = todasQuestoes.filter(q =>
    (q.resposta && q.resposta.toLowerCase().includes(termoLower)) ||
    (q.comentario && q.comentario.toLowerCase().includes(termoLower))
  );

  const totalResultados = assuntosMatch.length + questoesMatch.length;

  if (totalResultados === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">🔍</span>
        <p>Nenhum resultado encontrado para "${escapeHTML(termo)}".</p>
      </div>`;
    return;
  }

  container.innerHTML = "";

  // --- assuntos ---
  if (assuntosMatch.length > 0) {
    container.appendChild(criarGrupoBusca("📂 Assuntos", assuntosMatch.map(assunto => {
      const materia = getMateriaById(assunto.materiaId);
      return criarLinhaBusca({
        icone: materia ? materia.icone : "📄",
        titulo: assunto.nome,
        meta: rotuloMateria(materia),
        onClick: () => {
          document.getElementById("search-input").value = "";
          ativarConcursoDaMateria(assunto.materiaId);
          state.currentMateriaId = assunto.materiaId;
          goToAssunto(assunto.id);
        },
      });
    })));
  }

  // --- questões (resposta/comentário) ---
  if (questoesMatch.length > 0) {
    container.appendChild(criarGrupoBusca("❓ Questões (respostas e comentários)", questoesMatch.map(questao => {
      const assunto = mapaAssuntos.get(questao.assuntoId);
      const materia = assunto ? getMateriaById(assunto.materiaId) : null;
      const trechoOrigem = (questao.resposta && questao.resposta.toLowerCase().includes(termoLower)) ? questao.resposta : questao.comentario;
      return criarLinhaBusca({
        icone: "❓",
        titulo: assunto ? assunto.nome : "Questão",
        meta: (materia ? rotuloMateria(materia) + " · " : "") + trechoDestaque(trechoOrigem, termoLower),
        onClick: async () => {
          if (!assunto) return;
          ativarConcursoDaMateria(assunto.materiaId);
          state.currentMateriaId = assunto.materiaId;
          const ordenadas = await getQuestoesOrdenadas(assunto.id);
          const idx = ordenadas.findIndex(q => q.id === questao.id);
          state.currentPagina = idx >= 0 ? Math.ceil((idx + 1) / QUESTOES_POR_PAGINA) : 1;
          state.filtros = { status: "todos", dificuldade: "todos", favorito: false, desempenho: "todos", respondidas: "todos" };
          document.getElementById("search-input").value = "";
          await goToAssunto(assunto.id);
          setActiveTab("questoes");
        },
      });
    })));
  }
}

function criarGrupoBusca(titulo, linhas) {
  const grupo = document.createElement("div");
  grupo.className = "busca-grupo";
  grupo.innerHTML = `<h4 class="busca-grupo-titulo">${titulo}</h4>`;
  const lista = document.createElement("div");
  lista.className = "assuntos-list";
  linhas.forEach(linha => lista.appendChild(linha));
  grupo.appendChild(lista);
  return grupo;
}

function criarLinhaBusca({ icone, titulo, meta, onClick }) {
  const row = document.createElement("div");
  row.className = "assunto-row";
  row.innerHTML = `
    <div class="assunto-row-main">
      <span class="assunto-index">${icone}</span>
      <span class="assunto-name">${escapeHTML(titulo)}</span>
    </div>
    <span class="assunto-meta" style="max-width:50%; text-align:right; white-space:normal;">${escapeHTML(meta)}</span>
  `;
  row.addEventListener("click", onClick);
  return row;
}

function trechoDestaque(texto, termoLower) {
  if (!texto) return "";
  const idx = texto.toLowerCase().indexOf(termoLower);
  if (idx === -1) return texto.slice(0, 80) + (texto.length > 80 ? "..." : "");
  const inicio = Math.max(0, idx - 30);
  const fim = Math.min(texto.length, idx + termoLower.length + 30);
  return (inicio > 0 ? "..." : "") + texto.slice(inicio, fim) + (fim < texto.length ? "..." : "");
}

/* ============================================================
   10. ROTEIRO DE ESTUDOS — checklist do edital, cronograma semanal
       e sugestão do dia
   ============================================================ */

async function seedTopicosIniciais() {
  const jaSeedado = localStorage.getItem("caderno_topicos_seed_v1");
  if (jaSeedado) return;
  try {
    const existentes = await dbGetAll("topicos");
    if (existentes.length === 0) {
      for (const materiaId in TOPICOS_SUGERIDOS) {
        const nomes = TOPICOS_SUGERIDOS[materiaId];
        for (let i = 0; i < nomes.length; i++) {
          await dbPut("topicos", { materiaId, nome: nomes[i], concluido: false, ordem: i });
        }
      }
    }
    localStorage.setItem("caderno_topicos_seed_v1", "1");
  } catch (err) {
    console.error("Erro ao popular tópicos iniciais:", err);
  }
}

async function getProgressoPorMateria() {
  const topicos = await dbGetAll("topicos");
  const resultado = {};
  for (const materia of MATERIAS) {
    const doMateria = topicos
      .filter(t => t.materiaId === materia.id)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const feitos = doMateria.filter(t => t.concluido).length;
    resultado[materia.id] = {
      total: doMateria.length,
      feitos,
      pct: doMateria.length > 0 ? Math.round((feitos / doMateria.length) * 100) : 0,
      topicos: doMateria,
    };
  }
  return resultado;
}

async function renderRoteiro() {
  const progresso = await getProgressoPorMateria();
  renderRoteiroResumo(progresso);
  renderChecklist(progresso);
}

async function renderRoteiroBanner() {
  const banner = document.getElementById("roteiro-banner");
  if (!banner) return;
  const concursoBanner = getConcursoAtual();
  if (!concursoBanner) { banner.innerHTML = ""; return; }
  const progresso = await getProgressoPorMateria();
  const { totalGeral, feitosGeral, pctGeral } = totalizarProgresso(progresso);

  banner.innerHTML = `
    <div class="roteiro-banner-texto">
      <span class="roteiro-banner-titulo">🗺️ Roteiro — ${escapeHTML(concursoBanner.nome)}</span>
      <span class="roteiro-banner-sub">${pctGeral}% do edital concluído · ${feitosGeral}/${totalGeral} tópicos</span>
    </div>
    <div class="progresso-revisao" style="flex:1; min-width:140px; max-width:220px; height:8px;">
      <div class="progresso-revisao-barra" style="width:${pctGeral}%; background:var(--accent);"></div>
    </div>
    <button class="btn-primary" id="btn-banner-roteiro">Ver roteiro</button>
  `;
  document.getElementById("btn-banner-roteiro").addEventListener("click", goToRoteiro);
}

function totalizarProgresso(progresso) {
  const totalGeral = MATERIAS.reduce((s, m) => s + progresso[m.id].total, 0);
  const feitosGeral = MATERIAS.reduce((s, m) => s + progresso[m.id].feitos, 0);
  const pctGeral = totalGeral > 0 ? Math.round((feitosGeral / totalGeral) * 100) : 0;
  return { totalGeral, feitosGeral, pctGeral };
}

function renderRoteiroResumo(progresso) {
  const { totalGeral, feitosGeral, pctGeral } = totalizarProgresso(progresso);
  const el = document.getElementById("roteiro-resumo");

  el.innerHTML = `
    <div class="resumo-card">
      <div class="resumo-card-topo">
        <span class="resumo-pct">${pctGeral}%</span>
        <span class="resumo-label">do edital concluído · ${feitosGeral}/${totalGeral} tópicos marcados</span>
      </div>
      <div class="progresso-revisao" style="height:8px;">
        <div class="progresso-revisao-barra" style="width:${pctGeral}%; background:var(--accent);"></div>
      </div>
    </div>
  `;
}

function renderChecklist(progresso) {
  const container = document.getElementById("checklist-container");

  container.innerHTML = MATERIAS.map(m => {
    const prog = progresso[m.id];
    const aberto = accordionAberto === m.id;
    return `
      <div class="checklist-materia" style="--card-color:${m.cor};">
        <button type="button" class="checklist-materia-header" data-materia="${m.id}">
          <span class="checklist-materia-titulo">${m.icone} ${escapeHTML(m.nome)}</span>
          <span class="checklist-materia-info">
            <span class="checklist-materia-pct">${prog.feitos}/${prog.total} · ${prog.pct}%</span>
            <span class="checklist-chevron">${aberto ? "▾" : "▸"}</span>
          </span>
        </button>
        <div class="progresso-revisao" style="height:4px;">
          <div class="progresso-revisao-barra" style="width:${prog.pct}%;"></div>
        </div>
        <div class="checklist-materia-body" ${aberto ? "" : "hidden"}>
          ${prog.topicos.map(t => `
            <label class="checklist-item">
              <input type="checkbox" data-id="${t.id}" ${t.concluido ? "checked" : ""}>
              <span class="${t.concluido ? "checklist-item-feito" : ""}">${escapeHTML(t.nome)}</span>
              <button type="button" class="btn-icon checklist-item-delete" data-id="${t.id}" title="Excluir tópico" style="width:26px; height:26px; font-size:12px;">🗑️</button>
            </label>
          `).join("")}
          ${prog.topicos.length === 0 ? `<p class="view-subtitle" style="margin:8px 0 4px;">Nenhum tópico cadastrado ainda.</p>` : ""}
          <button type="button" class="btn-ghost checklist-add-btn" data-materia="${m.id}">+ Adicionar tópico</button>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".checklist-materia-header").forEach(header => {
    header.addEventListener("click", () => {
      const materiaId = header.dataset.materia;
      accordionAberto = accordionAberto === materiaId ? null : materiaId;
      renderRoteiro();
    });
  });

  container.querySelectorAll(".checklist-item input[type=checkbox]").forEach(cb => {
    cb.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", async () => {
      const id = Number(cb.dataset.id);
      const topico = await dbGet("topicos", id);
      topico.concluido = cb.checked;
      await dbPut("topicos", topico);
      renderRoteiro();
      renderRoteiroBanner();
    });
  });

  container.querySelectorAll(".checklist-item-delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      await dbDelete("topicos", id);
      showToast("Tópico removido.");
      renderRoteiro();
      renderRoteiroBanner();
    });
  });

  container.querySelectorAll(".checklist-add-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalAddTopico(btn.dataset.materia);
    });
  });
}

function abrirModalAddTopico(materiaId) {
  openModal(`
    <h3 class="modal-title">Adicionar tópico ao checklist</h3>
    <div class="modal-field">
      <label for="input-topico-nome">Nome do tópico</label>
      <input type="text" id="input-topico-nome" class="modal-input" placeholder="Ex: Crase" maxlength="160">
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-save-topico">Adicionar</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  const input = document.getElementById("input-topico-nome");
  const salvar = async () => {
    const nome = input.value.trim();
    if (!nome) { input.focus(); return; }
    const existentes = await dbGetAll("topicos", "materiaId", materiaId);
    await dbPut("topicos", { materiaId, nome, concluido: false, ordem: existentes.length });
    closeModal();
    showToast("Tópico adicionado.");
    accordionAberto = materiaId;
    renderRoteiro();
    renderRoteiroBanner();
  };
  document.getElementById("btn-save-topico").addEventListener("click", salvar);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") salvar(); });
}

/* ============================================================
   11. BACKUP — EXPORTAR / IMPORTAR (JSON completo, com PDFs e imagens)
   ============================================================ */

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data URL (inclui o mime type)
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function base64ToBlob(dataURL) {
  const res = await fetch(dataURL);
  return res.blob();
}

function dbClear(storeName) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(storeName, "readwrite");
    const request = tx.objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function lerDadosBackupBruto() {
  return {
    assuntos: await dbGetAll("assuntos"),
    materiais: await dbGetAll("materiais"),
    questoes: await dbGetAll("questoes"),
    anotacoes: await dbGetAll("anotacoes"),
    flashcards: await dbGetAll("flashcards"),
    concursos: await dbGetAll("concursos"),
    topicos: await dbGetAll("topicos"),
    cronograma: await dbGetAll("cronograma"),
  };
}

// Formato principal (v3): arquivo .zip com o backup.json (só texto/dados) + cada PDF e cada
// imagem como arquivo separado. Assim nada vira uma string gigante (o JSON único estourava o
// limite do navegador, ~512 MB, quando havia muitos PDFs/imagens) e o backup fica ~30% menor.
async function gerarBackupZip() {
  const d = await lerDadosBackupBruto();
  const zip = new JSZip();

  const separar = (lista, campo, pasta) => lista.map(item => {
    const { [campo]: blob, ...resto } = item;
    if (!blob) return { ...resto, [campo]: null };
    const caminho = `arquivos/${pasta}/${item.id}`;
    zip.file(caminho, blob, { compression: "STORE" }); // PDFs e imagens já são comprimidos
    return { ...resto, [campo + "Ref"]: caminho, [campo + "Tipo"]: blob.type || "" };
  });

  const materiais = separar(d.materiais, "arquivo", "materiais");
  const questoes = separar(d.questoes, "imagem", "questoes");

  const backup = {
    app: "caderno-estudos-concursos",
    versao: 3,
    exportadoEm: new Date().toISOString(),
    dados: { assuntos: d.assuntos, materiais, questoes, anotacoes: d.anotacoes, flashcards: d.flashcards, concursos: d.concursos, topicos: d.topicos, cronograma: d.cronograma },
  };
  zip.file("backup.json", JSON.stringify(backup), { compression: "DEFLATE" });
  return zip.generateAsync({ type: "blob", streamFiles: true });
}

// Reserva (sem internet para carregar o JSZip): .json montado em pedaços, sem criar uma única
// string gigante. Para backups muito grandes prefira o .zip.
async function gerarBackupJsonBlob() {
  const d = await lerDadosBackupBruto();
  const partes = [`{"app":"caderno-estudos-concursos","versao":2,"exportadoEm":${JSON.stringify(new Date().toISOString())},"dados":{`];
  const comArquivos = async (lista, campo) => {
    partes.push("[");
    for (let i = 0; i < lista.length; i++) {
      const { [campo]: blob, ...resto } = lista[i];
      const base = JSON.stringify(resto).slice(0, -1); // tira a "}" final
      partes.push((i ? "," : "") + base + `,${JSON.stringify(campo)}:`);
      partes.push(blob ? JSON.stringify(await blobToBase64(blob)) : "null");
      partes.push("}");
    }
    partes.push("]");
  };
  const simples = ["assuntos", "anotacoes", "flashcards", "concursos", "topicos", "cronograma"];
  partes.push(simples.map(k => `${JSON.stringify(k)}:${JSON.stringify(d[k])}`).join(",") + ",");
  partes.push('"materiais":'); await comArquivos(d.materiais, "arquivo");
  partes.push(',"questoes":'); await comArquivos(d.questoes, "imagem");
  partes.push("}}");
  return new Blob(partes, { type: "application/json" });
}

async function exportarBackup() {
  showToast("Gerando backup...");
  try {
    let usarZip = true;
    try {
      if (!window.JSZip) await carregarScriptExterno(ANKI_JSZIP_URL);
    } catch (e) {
      usarZip = false; // sem internet e a biblioteca ainda não está no cache
    }
    const blob = usarZip ? await gerarBackupZip() : await gerarBackupJsonBlob();
    const url = URL.createObjectURL(blob);

    const dataFormatada = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-caderno-estudos-${dataFormatada}.${usarZip ? "zip" : "json"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);

    showToast(usarZip ? "Backup exportado com sucesso." : "Backup exportado (.json, pois a biblioteca de .zip não carregou).");
  } catch (err) {
    console.error("Erro ao exportar backup:", err);
    showToast("Erro ao gerar o backup.");
  }
}

document.getElementById("btn-export").addEventListener("click", exportarBackup);

document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-file-input").click();
});

document.getElementById("import-file-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = ""; // permite selecionar o mesmo arquivo de novo depois
  if (!file) return;

  let backup;
  try {
    if (/\.zip$/i.test(file.name)) {
      if (!window.JSZip) await carregarScriptExterno(ANKI_JSZIP_URL);
      const zip = await JSZip.loadAsync(file);
      const entrada = zip.file("backup.json");
      if (!entrada) throw new Error("backup.json não encontrado no .zip");
      backup = JSON.parse(await entrada.async("string"));
      backup._zip = zip; // os PDFs e imagens são lidos daqui na hora de restaurar
    } else {
      const texto = await file.text();
      backup = JSON.parse(texto);
    }
  } catch (err) {
    showToast("Arquivo de backup inválido.");
    return;
  }

  if (!backup || !backup.dados || !backup.dados.assuntos) {
    showToast("Esse arquivo não parece ser um backup válido.");
    return;
  }

  confirmarImportacao(backup);
});

function confirmarImportacao(backup) {
  const { assuntos = [], materiais = [], questoes = [], anotacoes = [], flashcards = [] } = backup.dados;
  openModal(`
    <h3 class="modal-title">Importar backup?</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 10px;">
      Esse arquivo contém <b>${assuntos.length}</b> assunto(s), <b>${materiais.length}</b> material(is),
      <b>${questoes.length}</b> questão(ões) e <b>${flashcards.length}</b> flashcard(s).
    </p>
    <p style="font-size:13.5px; color:var(--danger); margin:0 0 4px;">
      ⚠️ Isso vai <b>substituir todos os dados atuais</b> do aplicativo. Essa ação não pode ser desfeita.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-import">Substituir tudo</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-confirm-import").addEventListener("click", async () => {
    closeModal();
    await importarBackup(backup);
  });
}

// devolve o Blob de um PDF/imagem do backup: do .zip (v3) ou do base64 dentro do .json (v1/v2)
async function blobDoBackup(backup, item, campo) {
  const ref = item[campo + "Ref"];
  if (ref && backup._zip) {
    const f = backup._zip.file(ref);
    if (!f) return null;
    const blob = await f.async("blob");
    const tipo = item[campo + "Tipo"];
    return tipo ? blob.slice(0, blob.size, tipo) : blob;
  }
  return item[campo] ? base64ToBlob(item[campo]) : null;
}

async function importarBackup(backup) {
  showToast("Importando backup...");
  try {
    const { assuntos = [], materiais = [], questoes = [], anotacoes = [], flashcards = [] } = backup.dados;

    await dbClear("assuntos");
    await dbClear("materiais");
    await dbClear("questoes");
    await dbClear("anotacoes");
    await dbClear("flashcards");

    for (const a of assuntos) {
      await dbPut("assuntos", a);
    }
    for (const m of materiais) {
      const { arquivoRef, arquivoTipo, ...resto } = m;
      await dbPut("materiais", { ...resto, arquivo: await blobDoBackup(backup, m, "arquivo") });
    }
    for (const q of questoes) {
      const { imagemRef, imagemTipo, ...resto } = q;
      await dbPut("questoes", { ...resto, imagem: await blobDoBackup(backup, q, "imagem") });
    }
    for (const n of anotacoes) {
      await dbPut("anotacoes", n);
    }
    for (const f of flashcards) {
      await dbPut("flashcards", f);
    }

    // roteiros, checklist e cronograma (backups antigos não têm; nesse caso mantém os atuais)
    const { concursos, topicos, cronograma } = backup.dados;
    if (Array.isArray(concursos)) {
      await dbClear("concursos");
      for (const c of concursos) await dbPut("concursos", c);
    }
    if (Array.isArray(topicos)) {
      await dbClear("topicos");
      for (const t of topicos) await dbPut("topicos", t);
    }
    if (Array.isArray(cronograma)) {
      await dbClear("cronograma");
      for (const d of cronograma) await dbPut("cronograma", d);
    }
    await carregarConcursos();

    showToast("Backup importado com sucesso.");
    goToHome();
  } catch (err) {
    console.error("Erro ao importar backup:", err);
    showToast("Erro ao importar o backup.");
  }
}

/* ============================================================
   11A. EXPORTAR PARA O ANKI (.apkg)
        - Flashcards viram cartões Frente/Verso.
        - Questões viram cartões: frente = imagem da questão,
          verso = resposta + comentários.
        - Cada cartão tem um ID fixo: se você exportar de novo e
          importar no Anki, os cartões já existentes não são duplicados.
   ============================================================ */

const ANKI_SQLJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/";
const ANKI_JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

// IDs fixos dos tipos de nota (assim o Anki reaproveita o mesmo tipo a cada importação)
const ANKI_MODELO_FLASH_ID = 1700000000001;
const ANKI_MODELO_QUESTAO_ID = 1700000000002;

const ANKI_CSS = `.card {
  font-family: Arial, sans-serif;
  font-size: 20px;
  text-align: left;
  color: #1f2430;
  background-color: #ffffff;
  line-height: 1.45;
}
.card img { max-width: 100%; height: auto; }
.nightMode .card, .night_mode .card { color: #e8eaf0; background-color: #1e2128; }
hr#answer { margin: 16px 0; }
.comentario { margin-top: 14px; padding-top: 10px; border-top: 1px dashed #999; font-size: 17px; opacity: 0.9; }`;

const ANKI_SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

async function ankiSha1Hex(texto) {
  const buf = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ID numérico estável a partir de um texto (usado nos baralhos)
async function ankiIdEstavel(texto) {
  const hex = await ankiSha1Hex(texto);
  return 1000000000000 + parseInt(hex.slice(0, 11), 16);
}

function ankiTextoParaHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>");
}

function ankiTirarHtml(html) {
  return String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// tags do Anki não podem ter espaços
function ankiLimparTag(nome) {
  return String(nome ?? "").trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_\-.]/gu, "");
}

// nomes de baralho: "::" cria sub-baralhos
function ankiLimparBaralho(nome) {
  return String(nome ?? "").replace(/["\\]/g, "").trim() || "Sem nome";
}

function ankiBaralhoJson(id, nome, agora) {
  return {
    id, name: nome, mod: agora, usn: -1,
    lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
    collapsed: false, browserCollapsed: false, desc: "", dyn: 0, conf: 1,
    extendedNew: 0, extendedRev: 0,
  };
}

function ankiModeloJson(id, nome, agora) {
  const campo = (name, ord) => ({ name, ord, sticky: false, rtl: false, font: "Arial", size: 20, media: [] });
  return {
    id, name: nome, type: 0, mod: agora, usn: -1, sortf: 0, did: 1, tags: [], vers: [],
    req: [[0, "all", [0]]],
    flds: [campo("Frente", 0), campo("Verso", 1)],
    tmpls: [{
      name: "Cartão 1", ord: 0,
      qfmt: "{{Frente}}",
      afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Verso}}",
      bqfmt: "", bafmt: "", did: null, bfont: "", bsize: 0,
    }],
    css: ANKI_CSS,
    latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
  };
}

/*
  construirApkg({ SQL, JSZip, notas, saida })
  notas: [{
    modelo: "flash" | "questao",
    baralho: "Matéria::Assunto",
    frente: "<html>", verso: "<html>",
    tags: ["Assunto"],
    chave: "flash-12",                // identifica o cartão (reimportar atualiza)
    midias: [{ nome: "x.jpg", dados: Uint8Array }]
  }]
  saida: "blob" (navegador) | "uint8array" (testes)
*/
async function construirApkg({ SQL, JSZip, notas, saida = "blob" }) {
  const agoraMs = Date.now();
  const agora = Math.floor(agoraMs / 1000);

  const db = new SQL.Database();
  db.run(ANKI_SCHEMA);

  // ---- baralhos ----
  const baralhos = { "1": ankiBaralhoJson(1, "Default", agora) };
  const idBaralho = {};
  for (const n of notas) {
    const nome = ankiLimparBaralho(n.baralho);
    n.baralho = nome;
    if (idBaralho[nome]) continue;
    const id = await ankiIdEstavel("baralho:" + nome);
    idBaralho[nome] = id;
    baralhos[String(id)] = ankiBaralhoJson(id, nome, agora);
  }

  // ---- tipos de nota ----
  const modelos = {};
  modelos[String(ANKI_MODELO_FLASH_ID)] = ankiModeloJson(ANKI_MODELO_FLASH_ID, "Caderno - Flashcard", agora);
  modelos[String(ANKI_MODELO_QUESTAO_ID)] = ankiModeloJson(ANKI_MODELO_QUESTAO_ID, "Caderno - Questão", agora);

  const dconf = {
    "1": {
      id: 1, mod: 0, name: "Default", usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true,
      new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
      lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
      rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 },
    },
  };

  const conf = {
    activeDecks: [1], addToCur: true, collapseTime: 1200, curDeck: 1,
    curModel: String(ANKI_MODELO_FLASH_ID), dueCounts: true, estTimes: true,
    newBury: true, newSpread: 0, nextPos: notas.length + 1,
    sortBackwards: false, sortType: "noteFld", timeLim: 0,
  };

  db.run("INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')", [
    agora, agoraMs, agoraMs,
    JSON.stringify(conf), JSON.stringify(modelos), JSON.stringify(baralhos), JSON.stringify(dconf),
  ]);

  // ---- notas e cartões ----
  const stNota = db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const stCartao = db.prepare("INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

  const midias = []; // { nome, dados }
  const midiasVistas = new Set();

  for (let i = 0; i < notas.length; i++) {
    const n = notas[i];
    const nid = agoraMs + i;
    const cid = agoraMs + i;
    const mid = n.modelo === "questao" ? ANKI_MODELO_QUESTAO_ID : ANKI_MODELO_FLASH_ID;
    const guid = (await ankiSha1Hex("caderno:" + n.chave)).slice(0, 10);
    const sfld = ankiTirarHtml(n.frente) || n.frente;
    const csum = parseInt((await ankiSha1Hex(sfld)).slice(0, 8), 16);
    const tags = n.tags && n.tags.length ? " " + n.tags.join(" ") + " " : "";

    stNota.run([nid, guid, mid, agora, -1, tags, n.frente + "\x1f" + n.verso, sfld, csum, 0, ""]);
    stCartao.run([cid, nid, idBaralho[n.baralho], 0, agora, -1, 0, 0, i + 1, 0, 0, 0, 0, 0, 0, 0, 0, ""]);

    for (const m of (n.midias || [])) {
      if (midiasVistas.has(m.nome)) continue;
      midiasVistas.add(m.nome);
      midias.push(m);
    }
  }
  stNota.free();
  stCartao.free();

  const bancoBytes = db.export();
  db.close();

  // ---- zip (.apkg) ----
  const zip = new JSZip();
  zip.file("collection.anki2", bancoBytes);
  const mapaMidia = {};
  midias.forEach((m, idx) => {
    mapaMidia[String(idx)] = m.nome;
    zip.file(String(idx), m.dados);
  });
  zip.file("media", JSON.stringify(mapaMidia));

  return zip.generateAsync({ type: saida, compression: "DEFLATE" });
}

/* ---------- monta os cartões a partir dos dados do app ---------- */

function ankiExtensaoImagem(tipo) {
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";
  return "jpg";
}

async function coletarNotasAnki({ somenteConcursoAtual, incluirFlash, incluirQuestoes, subbaralhos, assuntoId = null, flashIds = null }) {
  const assuntos = await dbGetAll("assuntos");
  const notas = [];
  const resumo = { flashcards: 0, questoes: 0, questoesSemConteudo: 0 };

  assuntos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  for (const assunto of assuntos) {
    if (assuntoId !== null && assunto.id !== assuntoId) continue; // exportação de um assunto só
    const materia = getMateriaById(assunto.materiaId);
    const concurso = concursoDaMateria(assunto.materiaId);
    if (!materia || !concurso) continue; // assunto órfão (matéria apagada)
    if (assuntoId === null && somenteConcursoAtual && concurso.id !== state.currentConcursoId) continue;

    let baralho = (CONCURSOS.length > 1 ? concurso.nome + "::" : "") + materia.nome.replace(/::/g, ":");
    if (subbaralhos) baralho += "::" + assunto.nome.replace(/::/g, ":");
    const tags = [ankiLimparTag(assunto.nome)].filter(Boolean);

    if (incluirFlash) {
      const cards = await dbGetAll("flashcards", "assuntoId", assunto.id);
      cards.sort((a, b) => (a.criadoEm ?? 0) - (b.criadoEm ?? 0));
      for (const f of cards) {
        if (!f.frente || !f.verso) continue;
        if (flashIds && !flashIds.includes(f.id)) continue; // só os selecionados
        notas.push({
          modelo: "flash", baralho,
          frente: ankiTextoParaHtml(f.frente),
          verso: ankiTextoParaHtml(f.verso),
          tags, chave: "flash-" + f.id, midias: [],
        });
        resumo.flashcards++;
      }
    }

    if (incluirQuestoes) {
      const questoes = await getQuestoesOrdenadas(assunto.id);
      for (let i = 0; i < questoes.length; i++) {
        const q = questoes[i];
        const temImagem = !!q.imagem;
        const temTexto = !!((q.resposta || "").trim() || (q.comentario || "").trim());
        if (!temImagem && !temTexto) { resumo.questoesSemConteudo++; continue; }

        const midias = [];
        let frente = `<b>Questão ${i + 1}</b>`;
        if (temImagem) {
          const nomeArq = `caderno-q${q.id}.${ankiExtensaoImagem(q.imagem.type)}`;
          midias.push({ nome: nomeArq, dados: new Uint8Array(await q.imagem.arrayBuffer()) });
          frente = `<img src="${nomeArq}">`;
        } else {
          frente += " (sem imagem)";
        }

        let verso = (q.resposta || "").trim()
          ? ankiTextoParaHtml(q.resposta.trim())
          : "<i>(sem resposta registrada)</i>";
        if ((q.comentario || "").trim()) {
          verso += `<div class="comentario">${ankiTextoParaHtml(q.comentario.trim())}</div>`;
        }

        const tagsQ = [...tags, "questao"];
        if (q.dificuldade) tagsQ.push("dificuldade_" + q.dificuldade);
        if (q.favorito) tagsQ.push("favorita");

        notas.push({
          modelo: "questao", baralho, frente, verso,
          tags: tagsQ, chave: "questao-" + q.id, midias,
        });
        resumo.questoes++;
      }
    }
  }
  return { notas, resumo };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { construirApkg, ankiTextoParaHtml, ankiLimparTag, ankiSha1Hex };
}

/* ---------- interface: botão do cabeçalho + janela de opções ---------- */

let ankiSQLCache = null;

function carregarScriptExterno(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Falha ao carregar " + url));
    document.head.appendChild(s);
  });
}

// As bibliotecas (JSZip + sql.js) só são baixadas quando você exporta pela primeira vez.
async function carregarBibliotecasAnki() {
  if (ankiSQLCache) return ankiSQLCache;
  if (!window.JSZip) await carregarScriptExterno(ANKI_JSZIP_URL);
  if (!window.initSqlJs) await carregarScriptExterno(ANKI_SQLJS_BASE + "sql-wasm.js");
  ankiSQLCache = await window.initSqlJs({ locateFile: (arquivo) => ANKI_SQLJS_BASE + arquivo });
  return ankiSQLCache;
}

function abrirModalExportarAnki(opts = {}) {
  const assuntoId = opts.assuntoId ?? null;       // se vier, exporta só esse assunto
  const flashIds = opts.flashIds ?? null;         // se vier, exporta só esses flashcards
  const modoAssunto = assuntoId !== null;
  const concursoAtual = getConcursoAtual();
  const temVarios = CONCURSOS.length > 1 && !modoAssunto;
  openModal(`
    <h3 class="modal-title">${flashIds ? `Exportar ${flashIds.length} flashcard${flashIds.length === 1 ? "" : "s"} selecionado${flashIds.length === 1 ? "" : "s"}`
      : modoAssunto ? "Exportar este assunto para o Anki" : "Exportar tudo para o Anki"}</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 14px;">
      Gera um arquivo <b>.apkg</b>. No Anki, use <b>Arquivo → Importar</b> e escolha o arquivo.
      Cada matéria vira um baralho e cada assunto vira uma tag.
    </p>

    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
        <input type="checkbox" id="anki-flash" checked ${flashIds ? "disabled" : ""}> 🃏 Flashcards (frente / verso)
      </label>
    </div>
    ${flashIds ? `<input type="checkbox" id="anki-questoes" hidden>` : `
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
        <input type="checkbox" id="anki-questoes" ${modoAssunto ? "" : "checked"}> ❓ Questões (imagem na frente, resposta e comentários no verso)
      </label>
    </div>`}
    ${modoAssunto ? `<input type="checkbox" id="anki-sub" hidden>` : `
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
        <input type="checkbox" id="anki-sub"> Separar cada assunto em um sub-baralho
      </label>
    </div>`}
    ${temVarios ? `
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
        <input type="checkbox" id="anki-so-atual" checked> Só o roteiro atual (${escapeHTML(concursoAtual ? concursoAtual.nome : "")})
      </label>
    </div>` : ""}

    <p id="anki-status" style="font-size:13px; color:var(--text-secondary); margin:0 0 4px;" hidden></p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-gerar-anki">Gerar .apkg</button>
    </div>
  `);

  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-gerar-anki").addEventListener("click", async (e) => {
    const incluirFlash = document.getElementById("anki-flash").checked;
    const incluirQuestoes = document.getElementById("anki-questoes").checked;
    const subbaralhos = document.getElementById("anki-sub").checked;
    const soAtualEl = document.getElementById("anki-so-atual");
    const somenteConcursoAtual = soAtualEl ? soAtualEl.checked : true;
    const status = document.getElementById("anki-status");

    if (!incluirFlash && !incluirQuestoes) {
      status.hidden = false;
      status.textContent = "Marque pelo menos uma opção.";
      return;
    }

    const btn = e.currentTarget;
    btn.disabled = true;
    status.hidden = false;
    status.textContent = "Montando os cartões...";

    try {
      const { notas, resumo } = await coletarNotasAnki({ somenteConcursoAtual, incluirFlash, incluirQuestoes, subbaralhos, assuntoId, flashIds });
      if (notas.length === 0) {
        status.textContent = "Não encontrei nada para exportar com essas opções.";
        btn.disabled = false;
        return;
      }

      status.textContent = "Carregando bibliotecas (precisa de internet na primeira vez)...";
      let SQL;
      try {
        SQL = await carregarBibliotecasAnki();
      } catch (err) {
        console.error(err);
        status.textContent = "Não consegui baixar as bibliotecas de exportação. Confira sua conexão e tente de novo.";
        btn.disabled = false;
        return;
      }

      status.textContent = "Gerando o arquivo...";
      const blob = await construirApkg({ SQL, JSZip: window.JSZip, notas, saida: "blob" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let sufixo = "";
      if (modoAssunto) {
        const ass = await dbGet("assuntos", assuntoId);
        const slug = ((ass && ass.nome) || "assunto")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40);
        sufixo = "-" + (slug || "assunto");
      }
      a.download = `caderno-estudos-anki${sufixo}-${new Date().toISOString().slice(0, 10)}.apkg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      closeModal();
      let msg = `Exportado: ${resumo.flashcards} flashcard(s) e ${resumo.questoes} questão(ões).`;
      if (resumo.questoesSemConteudo > 0) msg += ` (${resumo.questoesSemConteudo} questão vazia ignorada)`;
      showToast(msg);
    } catch (err) {
      console.error("Erro ao exportar para o Anki:", err);
      status.textContent = "Erro ao gerar o arquivo. Abra o console (F12) para ver os detalhes.";
      btn.disabled = false;
    }
  });
}

document.getElementById("btn-anki").addEventListener("click", () => abrirModalExportarAnki());

/* ============================================================
   11A-2. EXPORTAR FLASHCARDS PARA PDF (por assunto)
          Dois formatos: lista para estudar e cartões para imprimir.
          A biblioteca jsPDF só é baixada na primeira exportação
          (depois o service worker a mantém no cache).
   ============================================================ */

const PDF_JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const PDF_COR_DESTAQUE = [124, 92, 252]; // #7C5CFC

async function carregarJsPDF() {
  if (!window.jspdf) await carregarScriptExterno(PDF_JSPDF_URL);
  return window.jspdf.jsPDF;
}

// As fontes padrão do PDF suportam acentos do português (Latin-1), mas não emojis
// nem símbolos especiais: troca os mais comuns e remove o que não for suportado.
function pdfLimparTexto(s) {
  return String(s ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[→⇒➜➔➡]/g, "->").replace(/[←⇐]/g, "<-")
    .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≠/g, "!=")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/[\u2022\u25CF]/g, "-")
    .replace(/\t/g, "  ")
    .replace(/[^\n\u0020-\u007E\u00A0-\u00FF]/g, "")
    .trim();
}

function pdfSlug(txt) {
  return (txt || "assunto")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40) || "assunto";
}

/* ---------- formato 1: lista (número, frente em negrito, verso embaixo) ---------- */
function pdfMontarLista(doc, cards, titulo, subtitulo) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16, recuo = 10, larg = W - 2 * M - recuo;
  let y = M;

  const novaPagina = () => { doc.addPage(); y = M; };
  const garantir = (altura) => { if (y + altura > H - M) novaPagina(); };

  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(30);
  const linhasTitulo = doc.splitTextToSize(titulo, W - 2 * M);
  doc.text(linhasTitulo, M, y + 5);
  y += linhasTitulo.length * 7 + 2;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(130);
  doc.text(subtitulo, M, y + 3);
  y += 7;
  doc.setDrawColor(...PDF_COR_DESTAQUE).setLineWidth(0.6).line(M, y, W - M, y);
  y += 8;

  const LH_FRENTE = 5.4, LH_VERSO = 5;
  cards.forEach((f, i) => {
    const frente = doc.setFont("helvetica", "bold").setFontSize(11.5) && doc.splitTextToSize(pdfLimparTexto(f.frente) || "-", larg);
    const verso = doc.setFont("helvetica", "normal").setFontSize(10.5) && doc.splitTextToSize(pdfLimparTexto(f.verso) || "-", larg);
    const total = frente.length * LH_FRENTE + 2 + verso.length * LH_VERSO + 9;
    // se o cartão cabe numa página, não deixa ele ser cortado ao meio
    if (total <= H - 2 * M) garantir(total);

    const numero = String(i + 1).padStart(2, "0");
    let primeiraLinha = true;
    frente.forEach((ln) => {
      garantir(LH_FRENTE);
      if (primeiraLinha) {
        doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...PDF_COR_DESTAQUE);
        doc.text(numero, M, y + 4);
        primeiraLinha = false;
      }
      doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(25);
      doc.text(ln, M + recuo, y + 4);
      y += LH_FRENTE;
    });
    y += 2;
    verso.forEach((ln) => {
      garantir(LH_VERSO);
      doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(75);
      doc.text(ln, M + recuo, y + 4);
      y += LH_VERSO;
    });
    y += 4;
    if (i < cards.length - 1) {
      garantir(6);
      doc.setDrawColor(225).setLineWidth(0.2).line(M + recuo, y, W - M, y);
      y += 5;
    }
  });
}

/* ---------- formato 2: cartões para imprimir (frente/verso em páginas espelhadas) ---------- */
function pdfDesenharCelula(doc, x, y, w, h, texto, rotulo, numero, ehVerso) {
  doc.setDrawColor(170).setLineWidth(0.25).setLineDashPattern([2, 2], 0);
  doc.rect(x, y, w, h);
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...PDF_COR_DESTAQUE);
  doc.text(`${rotulo} ${numero}`, x + 4, y + 5.5);

  const areaW = w - 12, areaH = h - 16;
  let tam = 14, linhas = [], altLinha = 0;
  for (; tam >= 7; tam -= 0.5) {
    doc.setFont("helvetica", ehVerso ? "normal" : "bold").setFontSize(tam);
    linhas = doc.splitTextToSize(texto || "-", areaW);
    altLinha = tam * 0.3528 * 1.25;
    if (linhas.length * altLinha <= areaH) break;
  }
  const maxLinhas = Math.max(1, Math.floor(areaH / altLinha));
  if (linhas.length > maxLinhas) {
    linhas = linhas.slice(0, maxLinhas);
    linhas[maxLinhas - 1] = linhas[maxLinhas - 1].replace(/\s*\S{0,3}$/, "") + "...";
  }
  doc.setTextColor(ehVerso ? 60 : 20);
  doc.setLineHeightFactor(1.25);
  const topo = y + 9 + (areaH - linhas.length * altLinha) / 2;
  doc.text(linhas, x + w / 2, topo, { align: "center", baseline: "top" });
}

function pdfMontarCartoes(doc, cards) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10, COLS = 2, LINS = 4;
  const cw = (W - 2 * M) / COLS, ch = (H - 2 * M) / LINS;
  const porPagina = COLS * LINS;
  let primeira = true;

  for (let ini = 0; ini < cards.length; ini += porPagina) {
    const grupo = cards.slice(ini, ini + porPagina);
    // página das frentes
    if (!primeira) doc.addPage();
    primeira = false;
    grupo.forEach((f, k) => {
      const col = k % COLS, lin = Math.floor(k / COLS);
      pdfDesenharCelula(doc, M + col * cw, M + lin * ch, cw, ch, pdfLimparTexto(f.frente), "FRENTE", ini + k + 1, false);
    });
    // página dos versos (colunas espelhadas: alinha ao imprimir frente e verso na borda longa)
    doc.addPage();
    grupo.forEach((f, k) => {
      const col = (COLS - 1) - (k % COLS), lin = Math.floor(k / COLS);
      pdfDesenharCelula(doc, M + col * cw, M + lin * ch, cw, ch, pdfLimparTexto(f.verso), "VERSO", ini + k + 1, true);
    });
  }
}

async function gerarPdfFlashcards({ assuntoId, flashIds, formato }) {
  const JsPDF = await carregarJsPDF();
  const assunto = await dbGet("assuntos", assuntoId);
  const materia = assunto ? getMateriaById(assunto.materiaId) : null;
  let cards = await getFlashcardsOrdenados(assuntoId);
  if (flashIds) {
    const set = new Set(flashIds);
    cards = cards.filter(c => set.has(c.id));
  }
  if (cards.length === 0) return null;

  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const nome = (assunto && assunto.nome) || "Flashcards";
  const hoje = new Date().toLocaleDateString("pt-BR");

  if (formato === "cartoes") {
    pdfMontarCartoes(doc, cards);
  } else {
    const sub = `${materia ? pdfLimparTexto(materia.nome) + "  |  " : ""}${cards.length} flashcard${cards.length === 1 ? "" : "s"}  |  ${hoje}`;
    pdfMontarLista(doc, cards, pdfLimparTexto(nome) || "Flashcards", sub);
  }

  // rodapé com numeração
  const total = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150);
    doc.text(`Pagina ${p} de ${total}`, W / 2, H - 5, { align: "center" });
  }

  return {
    blob: doc.output("blob"),
    nomeArquivo: `flashcards-${pdfSlug(nome)}-${formato === "cartoes" ? "cartoes-" : ""}${new Date().toISOString().slice(0, 10)}.pdf`,
    quantidade: cards.length,
  };
}

function abrirModalExportarPdf({ assuntoId, flashIds = null }) {
  const n = flashIds ? flashIds.length : null;
  openModal(`
    <h3 class="modal-title">${n ? `Exportar ${n} flashcard${n === 1 ? "" : "s"} em PDF` : "Exportar flashcards em PDF"}</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 14px;">
      Escolha como quer o arquivo:
    </p>
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:flex-start; cursor:pointer;">
        <input type="radio" name="pdf-formato" value="lista" checked style="margin-top:3px;">
        <span><b>📄 Lista para estudar</b><br><span style="font-size:12.5px; color:var(--text-secondary);">Pergunta e resposta, uma abaixo da outra.</span></span>
      </label>
    </div>
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:flex-start; cursor:pointer;">
        <input type="radio" name="pdf-formato" value="cartoes" style="margin-top:3px;">
        <span><b>✂️ Cartões para imprimir</b><br><span style="font-size:12.5px; color:var(--text-secondary);">8 por página, com páginas de frente e verso alternadas. Imprima em frente e verso (borda longa) e recorte.</span></span>
      </label>
    </div>
    <p id="pdf-status" style="font-size:13px; color:var(--text-secondary); margin:0 0 4px;" hidden></p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-gerar-pdf">Gerar PDF</button>
    </div>
  `);

  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-gerar-pdf").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const status = document.getElementById("pdf-status");
    const formato = document.querySelector('input[name="pdf-formato"]:checked').value;
    btn.disabled = true;
    status.hidden = false;
    status.textContent = "Gerando o PDF (precisa de internet na primeira vez)...";
    try {
      let resultado;
      try {
        resultado = await gerarPdfFlashcards({ assuntoId, flashIds, formato });
      } catch (err) {
        if (!window.jspdf) {
          console.error(err);
          status.textContent = "Não consegui baixar a biblioteca de PDF. Confira sua conexão e tente de novo.";
          btn.disabled = false;
          return;
        }
        throw err;
      }
      if (!resultado) {
        status.textContent = "Não há flashcards para exportar.";
        btn.disabled = false;
        return;
      }
      const url = URL.createObjectURL(resultado.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resultado.nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      closeModal();
      showToast(`PDF gerado com ${resultado.quantidade} flashcard${resultado.quantidade === 1 ? "" : "s"} 📄`);
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
      status.textContent = "Erro ao gerar o PDF. Abra o console (F12) para ver os detalhes.";
      btn.disabled = false;
    }
  });
}

/* ---------- PDF das questões: todas as imagens em um único arquivo ---------- */

// Converte a imagem salva (PNG/JPG/WEBP) em JPEG para o PDF, reduzindo imagens gigantes.
async function pdfImagemParaDataURL(blob, maxLado = 2200) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Imagem ilegível"));
      i.src = url;
    });
    const esc = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * esc));
    const h = Math.max(1, Math.round(img.naturalHeight * esc));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: c.toDataURL("image/jpeg", 0.9), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// itens: [{ grupo, rotulo, img: {data,w,h} | null, resposta, comentario }]
function pdfMontarQuestoes(doc, itens, { titulo, subtitulo, umaPorPagina, incluirTexto }) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12, larg = W - 2 * M, fundo = H - M - 4;
  let y = M;

  const novaPagina = () => { doc.addPage(); y = M; };
  const garantir = (alt) => { if (y + alt > fundo) novaPagina(); };

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(30);
  const lt = doc.splitTextToSize(titulo, larg);
  doc.text(lt, M, y + 5);
  y += lt.length * 7 + 2;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(130);
  doc.text(subtitulo, M, y + 3);
  y += 7;
  doc.setDrawColor(...PDF_COR_DESTAQUE).setLineWidth(0.6).line(M, y, W - M, y);
  y += 7;

  const escreverTexto = (rotulo, txt) => {
    const t = pdfLimparTexto(txt);
    if (!t) return;
    doc.setFont("helvetica", "bold").setFontSize(10);
    const linhas = doc.splitTextToSize(`${rotulo}: ${t}`, larg);
    linhas.forEach((ln) => {
      garantir(5);
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(70);
      doc.text(ln, M, y + 3.5);
      y += 4.8;
    });
    y += 1.5;
  };

  let grupoAtual = null, primeiro = true;
  itens.forEach((it) => {
    if (umaPorPagina && !primeiro) novaPagina();
    primeiro = false;

    if (it.grupo && it.grupo !== grupoAtual) {
      grupoAtual = it.grupo;
      garantir(24);
      doc.setFont("helvetica", "bold").setFontSize(12.5).setTextColor(...PDF_COR_DESTAQUE);
      doc.text(doc.splitTextToSize(grupoAtual, larg), M, y + 4);
      y += 9;
    }

    let dw = 0, dh = 0;
    if (it.img) {
      dw = Math.min(larg, it.img.w * 25.4 / 96); // não aumenta imagens pequenas além do tamanho natural
      dh = dw * it.img.h / it.img.w;
      const maxH = fundo - M - 8;
      if (dh > maxH) { dh = maxH; dw = dh * it.img.w / it.img.h; }
    }
    garantir(7 + (it.img ? dh : 6));

    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...PDF_COR_DESTAQUE);
    doc.text(it.rotulo, M, y + 4);
    y += 6.5;

    if (it.img) {
      doc.addImage(it.img.data, "JPEG", M, y, dw, dh, undefined, "FAST");
      doc.setDrawColor(225).setLineWidth(0.2).rect(M, y, dw, dh);
      y += dh + 3;
    } else if (!it.imgErro) {
      doc.setFont("helvetica", "italic").setFontSize(9.5).setTextColor(150);
      doc.text("(sem imagem)", M, y + 3.5);
      y += 6;
    } else {
      doc.setFont("helvetica", "italic").setFontSize(9.5).setTextColor(180, 60, 60);
      doc.text("(nao foi possivel ler a imagem)", M, y + 3.5);
      y += 6;
    }

    if (incluirTexto) {
      escreverTexto("Resposta", it.resposta);
      escreverTexto("Comentario", it.comentario);
    }
    y += 6;
  });
}

async function gerarPdfQuestoes({ assuntoId, escopo, incluirTexto, umaPorPagina, onProgresso }) {
  const JsPDF = await carregarJsPDF();
  const assunto = await dbGet("assuntos", assuntoId);
  const materia = assunto ? getMateriaById(assunto.materiaId) : null;

  let assuntos = [assunto];
  if (escopo === "materia" && assunto) {
    assuntos = await dbGetAll("assuntos", "materiaId", assunto.materiaId);
    assuntos.sort((a, b) => (a.ordem ?? a.criadoEm ?? a.id) - (b.ordem ?? b.criadoEm ?? b.id));
  }

  const itens = [];
  let comImagem = 0;
  for (const ass of assuntos) {
    const questoes = await getQuestoesOrdenadas(ass.id);
    for (let i = 0; i < questoes.length; i++) {
      const q = questoes[i];
      const temTexto = !!((q.resposta || "").trim() || (q.comentario || "").trim());
      if (!q.imagem && !(incluirTexto && temTexto)) continue;
      const item = {
        grupo: escopo === "materia" ? pdfLimparTexto(ass.nome) : null,
        rotulo: `Questao ${i + 1}`,
        img: null, resposta: q.resposta, comentario: q.comentario,
      };
      if (q.imagem) {
        try {
          item.img = await pdfImagemParaDataURL(q.imagem);
          comImagem++;
        } catch (err) {
          console.warn("Imagem ignorada:", err);
          item.imgErro = true;
        }
      }
      itens.push(item);
      if (onProgresso) onProgresso(itens.length);
    }
  }
  if (itens.length === 0) return null;

  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const nomeBase = escopo === "materia" ? (materia ? materia.nome : "Questoes") : ((assunto && assunto.nome) || "Questoes");
  const hoje = new Date().toLocaleDateString("pt-BR");
  pdfMontarQuestoes(doc, itens, {
    titulo: pdfLimparTexto(nomeBase) || "Questoes",
    subtitulo: `${materia && escopo !== "materia" ? pdfLimparTexto(materia.nome) + "  |  " : ""}${itens.length} questao(oes)  |  ${hoje}`,
    umaPorPagina, incluirTexto,
  });

  const total = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150);
    doc.text(`Pagina ${p} de ${total}`, W / 2, H - 5, { align: "center" });
  }

  return {
    blob: doc.output("blob"),
    nomeArquivo: `questoes-${pdfSlug(nomeBase)}-${new Date().toISOString().slice(0, 10)}.pdf`,
    quantidade: itens.length,
    comImagem,
  };
}

function abrirModalExportarPdfQuestoes(assuntoId) {
  openModal(`
    <h3 class="modal-title">Exportar questões em PDF</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 14px;">
      Todas as imagens das questões juntas em um único PDF, na ordem em que foram cadastradas
      (os filtros da tela não são aplicados).
    </p>
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
        <input type="radio" name="pdfq-escopo" value="assunto" checked> Só este assunto
      </label>
    </div>
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
        <input type="radio" name="pdfq-escopo" value="materia"> Todos os assuntos desta matéria
      </label>
    </div>
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
        <input type="checkbox" id="pdfq-texto"> Incluir resposta e comentário abaixo de cada imagem
      </label>
    </div>
    <div class="modal-field">
      <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
        <input type="checkbox" id="pdfq-pagina"> Uma questão por página
      </label>
    </div>
    <p id="pdfq-status" style="font-size:13px; color:var(--text-secondary); margin:0 0 4px;" hidden></p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-gerar-pdfq">Gerar PDF</button>
    </div>
  `);

  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  document.getElementById("btn-gerar-pdfq").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const status = document.getElementById("pdfq-status");
    const escopo = document.querySelector('input[name="pdfq-escopo"]:checked').value;
    const incluirTexto = document.getElementById("pdfq-texto").checked;
    const umaPorPagina = document.getElementById("pdfq-pagina").checked;
    btn.disabled = true;
    status.hidden = false;
    status.textContent = "Preparando o PDF (precisa de internet na primeira vez)...";
    try {
      let r;
      try {
        r = await gerarPdfQuestoes({
          assuntoId, escopo, incluirTexto, umaPorPagina,
          onProgresso: (n) => { status.textContent = `Processando questão ${n}...`; },
        });
      } catch (err) {
        if (!window.jspdf) {
          console.error(err);
          status.textContent = "Não consegui baixar a biblioteca de PDF. Confira sua conexão e tente de novo.";
          btn.disabled = false;
          return;
        }
        throw err;
      }
      if (!r) {
        status.textContent = "Não encontrei questões com imagem para exportar.";
        btn.disabled = false;
        return;
      }
      const url = URL.createObjectURL(r.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      closeModal();
      showToast(`PDF gerado com ${r.quantidade} questão${r.quantidade === 1 ? "" : "ões"} 📄`);
    } catch (err) {
      console.error("Erro ao exportar PDF das questões:", err);
      status.textContent = "Erro ao gerar o PDF. Se forem muitas imagens, tente por assunto. Veja o console (F12).";
      btn.disabled = false;
    }
  });
}

/* ============================================================
   11B. ROTEIROS (CONCURSOS) — vários roteiros separados
        (ex.: Polícia Militar, Polícia Civil, ou qualquer outro)
   ============================================================ */

function getConcursoAtual() {
  return CONCURSOS.find(c => c.id === state.currentConcursoId) || null;
}

function setConcursoAtual(id) {
  const c = CONCURSOS.find(x => x.id === id) || CONCURSOS[0] || null;
  state.currentConcursoId = c ? c.id : null;
  MATERIAS = c ? c.materias : [];
  if (c) localStorage.setItem("caderno_concurso_atual", c.id);
  else localStorage.removeItem("caderno_concurso_atual");
}

async function carregarConcursos() {
  const todos = await dbGetAll("concursos");
  todos.sort((a, b) => (a.criadoEm ?? 0) - (b.criadoEm ?? 0));
  CONCURSOS = todos;
  setConcursoAtual(state.currentConcursoId || localStorage.getItem("caderno_concurso_atual"));
}

// procura a matéria em TODOS os roteiros (a busca pode achar itens de outro roteiro)
function getMateriaById(id) {
  for (const c of CONCURSOS) {
    const m = c.materias.find(x => x.id === id);
    if (m) return m;
  }
  return null;
}

function concursoDaMateria(materiaId) {
  return CONCURSOS.find(c => c.materias.some(m => m.id === materiaId)) || null;
}

// se a matéria é de outro roteiro, troca para ele
function ativarConcursoDaMateria(materiaId) {
  const c = concursoDaMateria(materiaId);
  if (c && c.id !== state.currentConcursoId) setConcursoAtual(c.id);
}

function rotuloMateria(materia) {
  if (!materia) return "";
  if (CONCURSOS.length > 1) {
    const c = concursoDaMateria(materia.id);
    if (c) return `${c.nome} · ${materia.nome}`;
  }
  return materia.nome;
}

// Cria os roteiros prontos (PM e PC) uma única vez.
// PM: só registra o roteiro (os tópicos dela já foram criados antes).
// PC: cria o roteiro, o checklist do edital e os assuntos de cada matéria.
async function seedConcursos() {
  try {
    const existentes = await dbGetAll("concursos");
    for (let i = 0; i < CONCURSOS_PADRAO.length; i++) {
      const padrao = CONCURSOS_PADRAO[i];
      const chave = "caderno_seed_concurso_" + padrao.id;
      if (localStorage.getItem(chave)) continue;

      if (!existentes.some(c => c.id === padrao.id)) {
        await dbPut("concursos", {
          id: padrao.id,
          nome: padrao.nome,
          icone: padrao.icone,
          materias: padrao.materias.map(m => ({ ...m })),
          criadoEm: Date.now() + i,
        });
        if (padrao.topicos) {
          for (const materiaId in padrao.topicos) {
            const nomes = padrao.topicos[materiaId];
            for (let j = 0; j < nomes.length; j++) {
              await dbPut("topicos", { materiaId, nome: nomes[j], concluido: false, ordem: j });
              if (padrao.assuntos) {
                await dbPut("assuntos", { materiaId, nome: nomes[j], ordem: j });
              }
            }
          }
        }
      }
      localStorage.setItem(chave, "1");
    }
  } catch (err) {
    console.error("Erro ao criar roteiros iniciais:", err);
  }
}

function novoIdCurto(prefixo) {
  return prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/* ---------- barra de roteiros na tela inicial ---------- */

function renderConcursoBar() {
  const bar = document.getElementById("concurso-bar");
  if (!bar) return;
  const atual = getConcursoAtual();

  bar.innerHTML = `
    <div class="concurso-tabs">
      ${CONCURSOS.map(c => `
        <button type="button" class="concurso-tab ${c.id === state.currentConcursoId ? "active" : ""}" data-id="${c.id}">
          ${escapeHTML(c.icone || "🎯")} ${escapeHTML(c.nome)}
        </button>
      `).join("")}
      <button type="button" class="concurso-tab concurso-tab-add" id="btn-novo-concurso">+ Novo roteiro</button>
    </div>
    ${atual ? `<button type="button" class="btn-secondary" id="btn-gerenciar-concurso" title="Renomear, adicionar/remover matérias ou excluir este roteiro">⚙️ Gerenciar roteiro</button>` : ""}
  `;

  bar.querySelectorAll(".concurso-tab[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.id === state.currentConcursoId) return;
      setConcursoAtual(btn.dataset.id);
      renderHome();
    });
  });
  document.getElementById("btn-novo-concurso").addEventListener("click", abrirModalNovoConcurso);
  const btnGerenciar = document.getElementById("btn-gerenciar-concurso");
  if (btnGerenciar) btnGerenciar.addEventListener("click", abrirModalGerenciarConcurso);
}

/* ---------- modal: novo roteiro ---------- */

function abrirModalNovoConcurso() {
  openModal(`
    <h3 class="modal-title">Novo roteiro</h3>
    <div class="modal-field">
      <label for="input-concurso-nome">Nome do roteiro</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="input-concurso-icone" class="modal-input" style="width:64px; text-align:center;" maxlength="4" value="🎯" title="Emoji">
        <input type="text" id="input-concurso-nome" class="modal-input" placeholder="Ex: Polícia Penal, PRF, Guarda Municipal..." maxlength="60">
      </div>
    </div>
    <p style="font-size:13px; color:var(--text-secondary); margin:0 0 4px;">
      O roteiro novo começa vazio, com seu próprio checklist, cronograma e assuntos. Em seguida você adiciona as matérias.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-primary" id="btn-save-concurso">Criar roteiro</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  const input = document.getElementById("input-concurso-nome");
  const salvar = async () => {
    const nome = input.value.trim();
    if (!nome) { input.focus(); return; }
    const icone = document.getElementById("input-concurso-icone").value.trim() || "🎯";
    const id = novoIdCurto("c_");
    await dbPut("concursos", { id, nome, icone, materias: [], criadoEm: Date.now() });
    await carregarConcursos();
    setConcursoAtual(id);
    closeModal();
    showToast("Roteiro criado.");
    await goToHome();
    abrirModalGerenciarConcurso(); // já abre para adicionar as matérias
  };
  document.getElementById("btn-save-concurso").addEventListener("click", salvar);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") salvar(); });
}

/* ---------- modal: gerenciar roteiro (nome, matérias, excluir) ---------- */

function abrirModalGerenciarConcurso() {
  const c = getConcursoAtual();
  if (!c) return;

  openModal(`
    <h3 class="modal-title">Gerenciar roteiro</h3>

    <div class="modal-field">
      <label for="input-concurso-nome">Nome do roteiro</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="input-concurso-icone" class="modal-input" style="width:64px; text-align:center;" maxlength="4" value="${escapeHTML(c.icone || "🎯")}" title="Emoji">
        <input type="text" id="input-concurso-nome" class="modal-input" value="${escapeHTML(c.nome)}" maxlength="60">
      </div>
    </div>

    <div class="modal-field">
      <label>Matérias deste roteiro</label>
      <div class="gerenciar-materias">
        ${c.materias.length === 0
          ? `<p class="view-subtitle" style="margin:4px 0;">Nenhuma matéria ainda. Adicione abaixo.</p>`
          : c.materias.map(m => `
            <div class="gerenciar-materia-row" data-id="${m.id}">
              <span class="gerenciar-materia-icone">${escapeHTML(m.icone)}</span>
              <input type="text" class="modal-input gerenciar-materia-nome" value="${escapeHTML(m.nome)}" maxlength="80" title="Edite o nome e saia do campo para salvar">
              <button type="button" class="btn-icon btn-excluir-materia" title="Excluir matéria">🗑️</button>
            </div>
          `).join("")}
      </div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <input type="text" id="input-nova-materia-icone" class="modal-input" style="width:64px; text-align:center;" maxlength="4" placeholder="📘" title="Emoji (opcional)">
        <input type="text" id="input-nova-materia-nome" class="modal-input" placeholder="Nova matéria (ex: Direito Penal)" maxlength="80">
        <button type="button" class="btn-secondary" id="btn-add-materia">Adicionar</button>
      </div>
    </div>

    <div class="modal-actions" style="justify-content:space-between; flex-wrap:wrap;">
      <button class="btn-danger" id="btn-excluir-concurso">Excluir roteiro</button>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" id="btn-cancel-modal">Fechar</button>
        <button class="btn-primary" id="btn-save-concurso">Salvar nome</button>
      </div>
    </div>
  `);

  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);

  // salvar nome/emoji do roteiro
  document.getElementById("btn-save-concurso").addEventListener("click", async () => {
    const nome = document.getElementById("input-concurso-nome").value.trim();
    if (!nome) { document.getElementById("input-concurso-nome").focus(); return; }
    c.nome = nome;
    c.icone = document.getElementById("input-concurso-icone").value.trim() || "🎯";
    await dbPut("concursos", c);
    await carregarConcursos();
    closeModal();
    showToast("Roteiro atualizado.");
    renderHome();
  });

  // renomear matéria (salva ao sair do campo)
  document.querySelectorAll(".gerenciar-materia-nome").forEach(input => {
    input.addEventListener("change", async () => {
      const id = input.closest(".gerenciar-materia-row").dataset.id;
      const materia = c.materias.find(m => m.id === id);
      const nome = input.value.trim();
      if (!materia || !nome) { input.value = materia ? materia.nome : ""; return; }
      materia.nome = nome;
      if (!MATERIAS_PADRAO_IDS.has(materia.id)) materia.curto = nome;
      await dbPut("concursos", c);
      await carregarConcursos();
      showToast("Matéria renomeada.");
      renderHome();
    });
  });

  // adicionar matéria
  const inputNome = document.getElementById("input-nova-materia-nome");
  const adicionar = async () => {
    const nome = inputNome.value.trim();
    if (!nome) { inputNome.focus(); return; }
    const icone = document.getElementById("input-nova-materia-icone").value.trim() || "📘";
    c.materias.push({
      id: novoIdCurto("m_"),
      nome,
      curto: nome,
      icone,
      cor: PALETA_CORES[c.materias.length % PALETA_CORES.length],
    });
    await dbPut("concursos", c);
    await carregarConcursos();
    showToast("Matéria adicionada.");
    await renderHome();
    abrirModalGerenciarConcurso();
  };
  document.getElementById("btn-add-materia").addEventListener("click", adicionar);
  inputNome.addEventListener("keydown", (e) => { if (e.key === "Enter") adicionar(); });

  // excluir matéria
  document.querySelectorAll(".btn-excluir-materia").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".gerenciar-materia-row").dataset.id;
      confirmarExcluirMateria(id);
    });
  });

  // excluir roteiro
  document.getElementById("btn-excluir-concurso").addEventListener("click", () => confirmarExcluirConcurso(c.id));
}

// ids das matérias que já vinham prontas (PM): não mexemos no rótulo curto delas
const MATERIAS_PADRAO_IDS = new Set([...MATERIAS_PM, ...MATERIAS_PC].map(m => m.id));

function confirmarExcluirMateria(materiaId) {
  const materia = getMateriaById(materiaId);
  if (!materia) return;
  openModal(`
    <h3 class="modal-title">Excluir "${escapeHTML(materia.nome)}"?</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 4px;">
      Isso apaga os assuntos dessa matéria, com todos os PDFs, questões e flashcards, além dos tópicos do checklist.
      Essa ação não pode ser desfeita.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-delete">Excluir matéria</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", abrirModalGerenciarConcurso);
  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    const c = concursoDaMateria(materiaId);
    await apagarDadosDaMateria(materiaId);
    if (c) {
      c.materias = c.materias.filter(m => m.id !== materiaId);
      await dbPut("concursos", c);
    }
    await carregarConcursos();
    showToast("Matéria excluída.");
    await renderHome();
    abrirModalGerenciarConcurso();
  });
}

function confirmarExcluirConcurso(concursoId) {
  const c = CONCURSOS.find(x => x.id === concursoId);
  if (!c) return;
  openModal(`
    <h3 class="modal-title">Excluir o roteiro "${escapeHTML(c.nome)}"?</h3>
    <p style="font-size:13.5px; color:var(--text-secondary); margin:0 0 4px;">
      Todas as matérias, assuntos, PDFs, questões, flashcards, tópicos do checklist e o cronograma
      <b>deste roteiro</b> serão apagados. Os outros roteiros não são afetados. Essa ação não pode ser desfeita.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-delete">Excluir roteiro</button>
    </div>
  `);
  document.getElementById("btn-cancel-modal").addEventListener("click", abrirModalGerenciarConcurso);
  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    for (const m of c.materias) await apagarDadosDaMateria(m.id);
    await dbDelete("concursos", c.id);
    state.currentConcursoId = null;
    await carregarConcursos();
    closeModal();
    showToast("Roteiro excluído.");
    goToHome();
  });
}

// apaga assuntos (e tudo dentro deles), tópicos do checklist e referências no cronograma de uma matéria
async function apagarDadosDaMateria(materiaId) {
  const assuntos = await dbGetAll("assuntos", "materiaId", materiaId);
  for (const a of assuntos) await deleteAssuntoCascade(a.id);

  const topicos = await dbGetAll("topicos", "materiaId", materiaId);
  for (const t of topicos) await dbDelete("topicos", t.id);

  const cronograma = await dbGetAll("cronograma");
  for (const dia of cronograma) {
    const restante = (dia.materiaIds || []).filter(id => id !== materiaId);
    if (restante.length === (dia.materiaIds || []).length) continue;
    if (restante.length > 0) await dbPut("cronograma", { ...dia, materiaIds: restante });
    else await dbDelete("cronograma", dia.dia);
  }
}

/* ============================================================
   12. INICIALIZAÇÃO
   ============================================================ */

async function init() {
  initTheme();
  try {
    state.db = await openDatabase();
  } catch (err) {
    console.error("Erro ao abrir o IndexedDB:", err);
    showToast("Erro ao iniciar o banco de dados local.");
    return;
  }
  try {
    await seedTopicosIniciais();
    await seedConcursos();
    await carregarConcursos();
    await goToHome();
  } catch (err) {
    console.error("Erro ao iniciar o app:", err);
    mostrarAvisoBanco("⚠️ Erro ao iniciar: " + (err && err.message ? err.message : err) + " — abra o console (F12) para mais detalhes.");
  }
}

document.addEventListener("DOMContentLoaded", init);
