import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurações mantidas conforme seu arquivo original
const firebaseConfig = {
  apiKey: "AIzaSyB3w1X0wdIpXJRnFNAKEjZXMnauhJv0RvI",
  authDomain: "avalia-itbi.firebaseapp.com",
  projectId: "avalia-itbi",
  storageBucket: "avalia-itbi.firebasestorage.app",
  messagingSenderId: "568434525897",
  appId: "1:568434525897:web:83d9482966b059c4ecaf18",
  measurementId: "G-2R9M2VLDZ2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let localidadesBase = [];
let valorFinalCalculado = 0;

// --- NAVEGAÇÃO ENTRE ABAS ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item, .tab-content').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(item.getAttribute('data-target')).classList.add('active');
    });
});

// --- MOTOR DE CÁLCULO (Entrada m² -> Base ha) ---
function calcularTudo() {
    const areaTotalM2 = parseFloat(document.getElementById('itbi-area').value) || 0;
    const localidadeId = document.getElementById('itbi-localidade').value;
    const vContribuinte = parseFloat(document.getElementById('itbi-valor-contribuinte').value) || 0;
    const loc = localidadesBase.find(l => l.id === localidadeId);
    
    if (!loc || areaTotalM2 <= 0) {
        document.getElementById('itbi-valor-final').value = "R$ 0,00";
        document.getElementById('painel-comparativo').style.display = 'none';
        return;
    }

    // Conversão base: 1 ha = 10.000 m²
    const vUnitarioHa = loc.valorPorHectare;
    let totalAcumulado = (areaTotalM2 / 10000) * vUnitarioHa;

    // 1. Fatores de Ajuste (Multiplicadores)
    document.querySelectorAll('.fator-item-row').forEach(row => {
        const cb = row.querySelector('.fator-cb');
        if (cb.checked) {
            const areaAfetadaHa = (parseFloat(row.querySelector('.fator-area').value) || 0) / 10000;
            const indice = parseFloat(cb.dataset.indice);
            totalAcumulado += (areaAfetadaHa * vUnitarioHa) * (indice - 1);
        }
    });

    // 2. Plantações (Valorização Aditiva)
    document.querySelectorAll('.plantacao-item-row').forEach(row => {
        const cb = row.querySelector('.pl-cb');
        if (cb.checked) {
            const areaPlHa = (parseFloat(row.querySelector('.pl-area').value) || 0) / 10000;
            const valorPlHa = parseFloat(cb.dataset.valorha);
            totalAcumulado += areaPlHa * valorPlHa;
        }
    });

    valorFinalCalculado = totalAcumulado;
    document.getElementById('itbi-valor-final').value = totalAcumulado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // 3. Comparativo com Contribuinte
    const painel = document.getElementById('painel-comparativo');
    if (vContribuinte > 0) {
        painel.style.display = 'block';
        const dif = vContribuinte - totalAcumulado;
        const perc = (dif / totalAcumulado) * 100;
        
        const cor = dif < 0 ? "#e74c3c" : "#27ae60";
        const status = dif < 0 ? "ABAIXO" : "ACIMA";
        
        document.getElementById('comparativo-texto').innerHTML = 
            `O valor informado está <b style="color:${cor}">${Math.abs(perc).toFixed(2)}% ${status}</b> da pauta fiscal.<br>
             Diferença: <b>${dif.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</b>`;
        painel.style.borderLeftColor = cor;
    } else {
        painel.style.display = 'none';
    }
}

// --- LISTENERS E SINCRONIZAÇÃO (SNAPSHOTS) ---

// Localidades
onSnapshot(collection(db, "valores_hectare"), (snap) => {
    localidadesBase = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const select = document.getElementById('itbi-localidade');
    const tabela = document.getElementById('tabelaHectares');
    select.innerHTML = '<option value="">Selecione...</option>';
    tabela.innerHTML = "";
    localidadesBase.forEach(l => {
        select.innerHTML += `<option value="${l.id}">${l.localidade}</option>`;
        tabela.innerHTML += `<tr><td>${l.localidade}</td><td>R$ ${l.valorPorHectare}</td><td><button class="btn-delete" onclick="remover('valores_hectare','${l.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
});

// Fatores
onSnapshot(collection(db, "fatores"), (snap) => {
    const container = document.getElementById('lista-fatores-selecao');
    const tabela = document.getElementById('tabelaFatores');
    container.innerHTML = ""; tabela.innerHTML = "";
    snap.forEach(docSnap => {
        const f = docSnap.data();
        container.innerHTML += `
            <div class="item-row fator-item-row">
                <input type="checkbox" class="fator-cb" data-indice="${f.indice}" onchange="atualizar()">
                <span class="item-nome">${f.nome} (${Math.round((f.indice-1)*100)}%)</span>
                <input type="number" class="fator-area" placeholder="m²" oninput="atualizar()">
            </div>`;
        tabela.innerHTML += `<tr><td>${f.nome}</td><td>${f.indice}</td><td>${Math.round((f.indice-1)*100)}%</td><td><button class="btn-delete" onclick="remover('fatores','${docSnap.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
});

// Plantações
onSnapshot(collection(db, "plantacoes"), (snap) => {
    const container = document.getElementById('lista-plantacoes-selecao');
    const tabela = document.getElementById('tabelaPlantacoes');
    container.innerHTML = ""; tabela.innerHTML = "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        container.innerHTML += `
            <div class="item-row plantacao-item-row">
                <input type="checkbox" class="pl-cb" data-valorha="${p.valorHectare}" onchange="atualizar()">
                <span class="item-nome">${p.nome} (R$/ha)</span>
                <input type="number" class="pl-area" placeholder="m²" oninput="atualizar()">
            </div>`;
        tabela.innerHTML += `<tr><td>${p.nome}</td><td>R$ ${p.valorHectare}</td><td><button class="btn-delete" onclick="remover('plantacoes','${docSnap.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
});

// Histórico de Avaliações
onSnapshot(query(collection(db, "avaliacoes"), orderBy("dataCadastro", "desc")), (snap) => {
    const tabela = document.getElementById('tabelaITBI');
    tabela.innerHTML = "";
    snap.forEach(d => {
        const item = d.data();
        tabela.innerHTML += `
            <tr>
                <td>${item.dataCadastro?.toDate().toLocaleDateString() || '--'}</td>
                <td>${item.localidadeNome}</td>
                <td>${item.areaM2} m²</td>
                <td style="color:green; font-weight:bold">${item.valorFinal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                <td><button class="btn-delete" onclick="remover('avaliacoes','${d.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
});

// --- FUNÇÕES DE SALVAMENTO ---

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

document.getElementById('btnSalvarPlantacao').onclick = async () => {
    const nome = document.getElementById('pl-nome').value;
    const valor = parseFloat(document.getElementById('pl-valor').value);
    if(nome && valor) await addDoc(collection(db, "plantacoes"), { nome, valorHectare: valor });
    document.getElementById('pl-nome').value = ""; document.getElementById('pl-valor').value = "";
};

document.getElementById('btnSalvarITBI').onclick = async () => {
    if(valorFinalCalculado <= 0) return alert("Realize um cálculo válido!");
    await addDoc(collection(db, "avaliacoes"), {
        localidadeNome: document.getElementById('itbi-localidade').selectedOptions[0].text,
        areaM2: document.getElementById('itbi-area').value,
        valorFinal: valorFinalCalculado,
        valorContribuinte: parseFloat(document.getElementById('itbi-valor-contribuinte').value) || 0,
        dataCadastro: new Date()
    });
    alert("Avaliação arquivada!");
};

// --- UTILITÁRIOS ---
window.atualizar = calcularTudo;
document.getElementById('itbi-area').oninput = calcularTudo;
document.getElementById('itbi-localidade').onchange = calcularTudo;
document.getElementById('itbi-valor-contribuinte').oninput = calcularTudo;
window.remover = async (col, id) => { if(confirm("Excluir registro?")) await deleteDoc(doc(db, col, id)); };