import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3w1X0wdIpXJRnFNAKEjZXMnauhJv0RvI",
  authDomain: "avalia-itbi.firebaseapp.com",
  projectId: "avalia-itbi",
  storageBucket: "avalia-itbi.firebasestorage.app",
  messagingSenderId: "568434525897",
  appId: "1:568434525897:web:83d9482966b059c4ecaf18"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estados para cálculo dinâmico
let localidadesBase = [];
let valorFinalCalculado = 0;

// --- NAVEGAÇÃO ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item, .tab-content').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(item.getAttribute('data-target')).classList.add('active');
    });
});

// --- MOTOR DE CÁLCULO ---
function calcularValorFinal() {
    const area = parseFloat(document.getElementById('itbi-area').value) || 0;
    const localidadeId = document.getElementById('itbi-localidade').value;
    const localidade = localidadesBase.find(l => l.id === localidadeId);
    
    if (!localidade || area <= 0) {
        document.getElementById('itbi-valor-final').value = "R$ 0,00";
        valorFinalCalculado = 0;
        return;
    }

    let resultado = localidade.valorPorHectare * area;
    
    // Aplica multiplicadores dos checkboxes marcados
    document.querySelectorAll('.fator-checkbox:checked').forEach(cb => {
        resultado *= parseFloat(cb.dataset.indice);
    });

    valorFinalCalculado = resultado;
    document.getElementById('itbi-valor-final').value = resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- ESCUTAS EM TEMPO REAL (FIRESTORE) ---

// 1. Escuta Localidades
onSnapshot(collection(db, "valores_hectare"), (snap) => {
    localidadesBase = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Atualiza Select na Calculadora
    const select = document.getElementById('itbi-localidade');
    select.innerHTML = '<option value="">Selecione...</option>';
    localidadesBase.forEach(loc => {
        select.innerHTML += `<option value="${loc.id}">${loc.localidade} (R$ ${loc.valorPorHectare}/ha)</option>`;
    });

    // Atualiza Tabela de Referência
    const tabela = document.getElementById('tabelaHectares');
    tabela.innerHTML = "";
    localidadesBase.forEach(loc => {
        tabela.innerHTML += `
            <tr>
                <td>${loc.localidade}</td>
                <td>${loc.valorPorHectare.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td><button class="btn-delete" onclick="removerRegistro('valores_hectare', '${loc.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
});

// 2. Escuta Fatores
onSnapshot(collection(db, "fatores"), (snap) => {
    const container = document.getElementById('lista-fatores-selecao');
    const tabela = document.getElementById('tabelaFatores');
    
    container.innerHTML = "";
    tabela.innerHTML = "";

    snap.forEach(documento => {
        const f = documento.data();
        const impacto = Math.round((f.indice - 1) * 100);
        const classeImpacto = f.indice >= 1 ? 'val' : 'desv';

        // Checkbox para calculadora
        container.innerHTML += `
            <label class="checkbox-item">
                <input type="checkbox" class="fator-checkbox" data-indice="${f.indice}" onchange="calcular()">
                ${f.nome} (${impacto > 0 ? '+' : ''}${impacto}%)
            </label>`;
        
        // Linha na tabela de gestão
        tabela.innerHTML += `
            <tr>
                <td>${f.nome}</td>
                <td>${f.indice}</td>
                <td><span class="impacto-badge ${classeImpacto}">${impacto}%</span></td>
                <td><button class="btn-delete" onclick="removerRegistro('fatores', '${documento.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
});

// 3. Escuta Histórico de Avaliações
onSnapshot(query(collection(db, "avaliacoes"), orderBy("dataCadastro", "desc")), (snap) => {
    const tabela = document.getElementById('tabelaITBI');
    tabela.innerHTML = "";
    snap.forEach(documento => {
        const d = documento.data();
        const data = d.dataCadastro?.toDate().toLocaleDateString('pt-BR') || '---';
        tabela.innerHTML += `
            <tr>
                <td>${data}</td>
                <td>${d.localidadeNome}</td>
                <td>${d.area}</td>
                <td>${d.valorFinal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td><button class="btn-delete" onclick="removerRegistro('avaliacoes', '${documento.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
});

// --- FUNÇÕES DE SALVAMENTO ---

document.getElementById('btnSalvarHectare').onclick = async () => {
    const localidade = document.getElementById('loc-nome').value;
    const valor = parseFloat(document.getElementById('loc-valor').value);
    if (!localidade || isNaN(valor)) return alert("Preencha os campos!");
    await addDoc(collection(db, "valores_hectare"), { localidade, valorPorHectare: valor });
    document.getElementById('loc-nome').value = ""; document.getElementById('loc-valor').value = "";
};

document.getElementById('btnSalvarFator').onclick = async () => {
    const nome = document.getElementById('fator-nome').value;
    const indice = parseFloat(document.getElementById('fator-indice').value);
    if (!nome || isNaN(indice)) return alert("Preencha os campos!");
    await addDoc(collection(db, "fatores"), { nome, indice });
    document.getElementById('fator-nome').value = ""; document.getElementById('fator-indice').value = "";
};

document.getElementById('btnSalvarITBI').onclick = async () => {
    const area = parseFloat(document.getElementById('itbi-area').value);
    const localidadeId = document.getElementById('itbi-localidade').value;
    const loc = localidadesBase.find(l => l.id === localidadeId);

    if (!loc || isNaN(area) || valorFinalCalculado <= 0) return alert("Realize um cálculo válido antes de salvar!");

    await addDoc(collection(db, "avaliacoes"), {
        ano: document.getElementById('itbi-ano').value,
        localidadeNome: loc.localidade,
        area: area,
        valorFinal: valorFinalCalculado,
        dataCadastro: new Date()
    });
    alert("Avaliação salva no histórico!");
};

// --- UTILITÁRIOS ---
window.calcular = calcularValorFinal; // Expõe para o onchange do checkbox
document.getElementById('itbi-area').oninput = calcularValorFinal;
document.getElementById('itbi-localidade').onchange = calcularValorFinal;

window.removerRegistro = async (colecao, id) => {
    if (confirm("Deseja excluir este registro permanentemente?")) {
        await deleteDoc(doc(db, colecao, id));
    }
};