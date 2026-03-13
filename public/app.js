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

// --- MOTOR DE CÁLCULO (CONVERSÃO M² -> HA) ---
// --- MOTOR DE CÁLCULO ATUALIZADO ---
function calcularValorFinal() {
    const areaTotalM2 = parseFloat(document.getElementById('itbi-area').value) || 0;
    const localidadeId = document.getElementById('itbi-localidade').value;
    const valorContribuinte = parseFloat(document.getElementById('itbi-valor-contribuinte').value) || 0;
    const loc = localidadesBase.find(l => l.id === localidadeId);
    
    if (!loc || areaTotalM2 <= 0) {
        document.getElementById('itbi-valor-final').value = "R$ 0,00";
        document.getElementById('painel-comparativo').style.display = 'none';
        valorFinalCalculado = 0;
        return;
    }

    const areaTotalHa = areaTotalM2 / 10000;
    let total = areaTotalHa * loc.valorPorHectare;

    document.querySelectorAll('.fator-item-row').forEach(row => {
        const checkbox = row.querySelector('.fator-checkbox');
        if (checkbox.checked) {
            const areaAfetadaHa = (parseFloat(row.querySelector('.area-afetada-input').value) || 0) / 10000;
            total += (areaAfetadaHa * loc.valorPorHectare) * (parseFloat(checkbox.dataset.indice) - 1);
        }
    });

    valorFinalCalculado = total;
    document.getElementById('itbi-valor-final').value = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- LÓGICA DE COMPARAÇÃO ---
    if (valorContribuinte > 0) {
        const painel = document.getElementById('painel-comparativo');
        const texto = document.getElementById('comparativo-texto');
        painel.style.display = 'block';

        const diferenca = valorContribuinte - total;
        const percentual = (diferenca / total) * 100;

        if (diferenca < 0) {
            painel.className = "comparativo-card comparativo-alerta";
            texto.innerHTML = `O valor informado está <span class="texto-destaque">${Math.abs(percentual).toFixed(2)}% ABAIXO</span> da pauta fiscal. Diferença negativa de ${Math.abs(diferenca).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.`;
        } else {
            painel.className = "comparativo-card comparativo-ok";
            texto.innerHTML = `O valor informado está <span class="texto-destaque">${percentual.toFixed(2)}% ACIMA</span> da pauta fiscal. Diferença positiva de ${diferenca.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.`;
        }
    } else {
        document.getElementById('painel-comparativo').style.display = 'none';
    }
}

// --- ADICIONE O LISTENER PARA O NOVO CAMPO ---
document.getElementById('itbi-valor-contribuinte').oninput = calcularValorFinal;

// --- ATUALIZE A FUNÇÃO DE SALVAMENTO ---
document.getElementById('btnSalvarITBI').onclick = async () => {
    const areaM2 = document.getElementById('itbi-area').value;
    const vContribuinte = parseFloat(document.getElementById('itbi-valor-contribuinte').value) || 0;
    
    if(valorFinalCalculado <= 0) return alert("Cálculo incompleto.");

    await addDoc(collection(db, "avaliacoes"), {
        localidadeNome: document.getElementById('itbi-localidade').selectedOptions[0].text,
        areaM2: areaM2,
        valorFinal: valorFinalCalculado,
        valorContribuinte: vContribuinte, // Campo novo no banco
        dataCadastro: new Date()
    });
    alert("Avaliação e comparativo salvos!");
};

// --- ESCUTAS EM TEMPO REAL ---

// Localidades
onSnapshot(collection(db, "valores_hectare"), (snap) => {
    localidadesBase = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const select = document.getElementById('itbi-localidade');
    const tabela = document.getElementById('tabelaHectares');
    select.innerHTML = '<option value="">Selecione...</option>';
    tabela.innerHTML = "";
    localidadesBase.forEach(l => {
        select.innerHTML += `<option value="${l.id}">${l.localidade}</option>`;
        tabela.innerHTML += `<tr><td>${l.localidade}</td><td>R$ ${l.valorPorHectare}/ha</td><td><button class="btn-delete" onclick="remover('valores_hectare','${l.id}')">Excluir</button></td></tr>`;
    });
});

// Fatores (Inputs gerados com placeholder em m²)
onSnapshot(collection(db, "fatores"), (snap) => {
    const container = document.getElementById('lista-fatores-selecao');
    const tabela = document.getElementById('tabelaFatores');
    container.innerHTML = "";
    tabela.innerHTML = "";
    snap.forEach(docSnap => {
        const f = docSnap.data();
        const impactoPercent = Math.round((f.indice - 1) * 100);

        container.innerHTML += `
            <div class="fator-item-row">
                <input type="checkbox" class="fator-checkbox" data-indice="${f.indice}" onchange="atualizar()">
                <span class="fator-nome">${f.nome} (${impactoPercent}%)</span>
                <input type="number" class="area-afetada-input" placeholder="m² afetados" step="0.01" oninput="atualizar()">
            </div>`;

        tabela.innerHTML += `<tr><td>${f.nome}</td><td>${f.indice}</td><td>${impactoPercent}%</td><td><button class="btn-delete" onclick="remover('fatores','${docSnap.id}')">Excluir</button></td></tr>`;
    });
});

// Histórico
onSnapshot(query(collection(db, "avaliacoes"), orderBy("dataCadastro", "desc")), (snap) => {
    const tabela = document.getElementById('tabelaITBI');
    tabela.innerHTML = "";
    snap.forEach(d => {
        const item = d.data();
        tabela.innerHTML += `<tr><td>${item.dataCadastro.toDate().toLocaleDateString()}</td><td>${item.localidadeNome}</td><td>${item.areaM2} m²</td><td>${item.valorFinal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td><button class="btn-delete" onclick="remover('avaliacoes','${d.id}')">Excluir</button></td></tr>`;
    });
});

// --- SALVAMENTO ---
document.getElementById('btnSalvarHectare').onclick = async () => {
    const nome = document.getElementById('loc-nome').value;
    const valor = parseFloat(document.getElementById('loc-valor').value);
    if(nome && valor) await addDoc(collection(db, "valores_hectare"), { localidade: nome, valorPorHectare: valor });
    document.getElementById('loc-nome').value = ""; document.getElementById('loc-valor').value = "";
};

document.getElementById('btnSalvarFator').onclick = async () => {
    const nome = document.getElementById('fator-nome').value;
    const indice = parseFloat(document.getElementById('fator-indice').value);
    if(nome && indice) await addDoc(collection(db, "fatores"), { nome, indice });
    document.getElementById('fator-nome').value = ""; document.getElementById('fator-indice').value = "";
};

document.getElementById('btnSalvarITBI').onclick = async () => {
    const areaM2 = document.getElementById('itbi-area').value;
    if(valorFinalCalculado <= 0) return alert("Cálculo incompleto.");
    await addDoc(collection(db, "avaliacoes"), {
        localidadeNome: document.getElementById('itbi-localidade').selectedOptions[0].text,
        areaM2: areaM2,
        valorFinal: valorFinalCalculado,
        dataCadastro: new Date()
    });
    alert("Avaliação arquivada!");
};

window.atualizar = calcularValorFinal;
document.getElementById('itbi-area').oninput = calcularValorFinal;
document.getElementById('itbi-localidade').onchange = calcularValorFinal;
window.remover = async (col, id) => { if(confirm("Confirmar exclusão?")) await deleteDoc(doc(db, col, id)); };