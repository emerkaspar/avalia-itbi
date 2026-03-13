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

// --- MOTOR DE CÁLCULO (Lógica de Área Parcial) ---
function calcularValorFinal() {
    const areaTotal = parseFloat(document.getElementById('itbi-area').value) || 0;
    const localidadeId = document.getElementById('itbi-localidade').value;
    const loc = localidadesBase.find(l => l.id === localidadeId);
    
    if (!loc || areaTotal <= 0) {
        document.getElementById('itbi-valor-final').value = "R$ 0,00";
        valorFinalCalculado = 0;
        return;
    }

    const vUnitario = loc.valorPorHectare;
    let total = areaTotal * vUnitario;

    // Calcula impactos individuais
    document.querySelectorAll('.fator-item-row').forEach(row => {
        const checkbox = row.querySelector('.fator-checkbox');
        const inputArea = row.querySelector('.area-afetada-input');
        
        if (checkbox.checked) {
            const areaAfetada = parseFloat(inputArea.value) || 0;
            const indice = parseFloat(checkbox.dataset.indice);
            
            // Impacto = (Área * Valor Base) * (Diferencial do Índice)
            // Ex: Índice 0.70 causa um impacto de -0.30 (30% de desconto)
            const impacto = (areaAfetada * vUnitario) * (indice - 1);
            total += impacto;
        }
    });

    valorFinalCalculado = total;
    document.getElementById('itbi-valor-final').value = total.toLocaleString('pt-PT', { style: 'currency', currency: 'BRL' });
}

// --- ESCUTAS FIRESTORE ---

// 1. Localidades
onSnapshot(collection(db, "valores_hectare"), (snap) => {
    localidadesBase = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const select = document.getElementById('itbi-localidade');
    const tabela = document.getElementById('tabelaHectares');
    select.innerHTML = '<option value="">Selecione...</option>';
    tabela.innerHTML = "";
    localidadesBase.forEach(l => {
        select.innerHTML += `<option value="${l.id}">${l.localidade}</option>`;
        tabela.innerHTML += `<tr><td>${l.localidade}</td><td>R$ ${l.valorPorHectare}</td><td><button class="btn-delete" onclick="remover('valores_hectare','${l.id}')">Excluir</button></td></tr>`;
    });
});

// 2. Fatores
onSnapshot(collection(db, "fatores"), (snap) => {
    const container = document.getElementById('lista-fatores-selecao');
    const tabela = document.getElementById('tabelaFatores');
    container.innerHTML = "";
    tabela.innerHTML = "";
    snap.forEach(docSnap => {
        const f = docSnap.data();
        const impactoPercent = Math.round((f.indice - 1) * 100);

        // Row na calculadora
        container.innerHTML += `
            <div class="fator-item-row">
                <input type="checkbox" class="fator-checkbox" data-indice="${f.indice}" onchange="atualizar()">
                <span class="fator-nome">${f.nome} (${impactoPercent}%)</span>
                <input type="number" class="area-afetada-input" placeholder="ha afetados" step="0.01" oninput="atualizar()">
            </div>`;

        // Linha na tabela de gestão
        tabela.innerHTML += `<tr><td>${f.nome}</td><td>${f.indice}</td><td>${impactoPercent}%</td><td><button class="btn-delete" onclick="remover('fatores','${docSnap.id}')">Excluir</button></td></tr>`;
    });
});

// 3. Histórico de ITBI
onSnapshot(query(collection(db, "avaliacoes"), orderBy("dataCadastro", "desc")), (snap) => {
    const tabela = document.getElementById('tabelaITBI');
    tabela.innerHTML = "";
    snap.forEach(d => {
        const item = d.data();
        tabela.innerHTML += `<tr><td>${item.dataCadastro.toDate().toLocaleDateString()}</td><td>${item.localidadeNome}</td><td>${item.area} ha</td><td>${item.valorFinal.toLocaleString('pt-PT',{style:'currency',currency:'BRL'})}</td><td><button class="btn-delete" onclick="remover('avaliacoes','${d.id}')">Excluir</button></td></tr>`;
    });
});

// --- OPERAÇÕES ---
document.getElementById('btnSalvarHectare').onclick = async () => {
    const nome = document.getElementById('loc-nome').value;
    const valor = parseFloat(document.getElementById('loc-valor').value);
    if(nome && valor) await addDoc(collection(db, "valores_hectare"), { localidade: nome, valorPorHectare: valor });
};

document.getElementById('btnSalvarFator').onclick = async () => {
    const nome = document.getElementById('fator-nome').value;
    const indice = parseFloat(document.getElementById('fator-indice').value);
    if(nome && indice) await addDoc(collection(db, "fatores"), { nome, indice });
};

document.getElementById('btnSalvarITBI').onclick = async () => {
    if(valorFinalCalculado <= 0) return alert("Cálculo inválido!");
    await addDoc(collection(db, "avaliacoes"), {
        localidadeNome: document.getElementById('itbi-localidade').selectedOptions[0].text,
        area: document.getElementById('itbi-area').value,
        valorFinal: valorFinalCalculado,
        dataCadastro: new Date()
    });
    alert("Avaliação guardada com sucesso!");
};

window.atualizar = calcularValorFinal;
document.getElementById('itbi-area').oninput = calcularValorFinal;
document.getElementById('itbi-localidade').onchange = calcularValorFinal;
window.remover = async (col, id) => { if(confirm("Confirmar exclusão?")) await deleteDoc(doc(db, col, id)); };