import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const auth = getAuth(app);

let localidadesBase = [];
let valorFinalCalculado = 0;

// --- GESTÃO DE AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    const loginUI = document.getElementById('login-overlay');
    const appUI = document.getElementById('app-wrapper');
    if (user) {
        loginUI.style.display = 'none';
        appUI.style.display = 'flex';
        document.getElementById('user-display').innerText = user.email;
        iniciarSincronizacao();
    } else {
        loginUI.style.display = 'flex';
        appUI.style.display = 'none';
    }
});

// Login por E-mail
document.getElementById('btnLogar').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const erroTxt = document.getElementById('login-erro');
    try { 
        await signInWithEmailAndPassword(auth, email, senha); 
        erroTxt.innerText = "";
    } catch (e) { 
        erroTxt.innerText = "E-mail ou senha incorretos."; 
    }
};

document.getElementById('btnSair').onclick = () => signOut(auth);

// --- NAVEGAÇÃO ENTRE ABAS ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item, .tab-content').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(item.getAttribute('data-target')).classList.add('active');
    });
});

// --- MOTOR DE CÁLCULO (m² para Hectares) ---
function calcularAvaliacao() {
    const areaTotalM2 = parseFloat(document.getElementById('itbi-area').value) || 0;
    const localidadeId = document.getElementById('itbi-localidade').value;
    const vDeclarado = parseFloat(document.getElementById('itbi-valor-contribuinte').value) || 0;
    const loc = localidadesBase.find(l => l.id === localidadeId);
    
    if (!loc || areaTotalM2 <= 0) {
        document.getElementById('itbi-valor-final').value = "R$ 0,00";
        document.getElementById('painel-comparativo').style.display = 'none';
        valorFinalCalculado = 0;
        return;
    }

    const valorUnitarioHa = loc.valorPorHectare;
    let totalAcumulado = (areaTotalM2 / 10000) * valorUnitarioHa;

    // Fatores de Ajuste (Multiplicadores)
    document.querySelectorAll('.fator-item-row').forEach(row => {
        const cb = row.querySelector('.fator-cb');
        if (cb.checked) {
            const areaAfetadaHa = (parseFloat(row.querySelector('.fator-area').value) || 0) / 10000;
            const indice = parseFloat(cb.dataset.indice);
            totalAcumulado += (areaAfetadaHa * valorUnitarioHa) * (indice - 1);
        }
    });

    // Plantações (Valores Aditivos)
    document.querySelectorAll('.plantacao-item-row').forEach(row => {
        const cb = row.querySelector('.pl-cb');
        if (cb.checked) {
            const areaCulturaHa = (parseFloat(row.querySelector('.pl-area').value) || 0) / 10000;
            const valorCulturaHa = parseFloat(cb.dataset.valorha);
            totalAcumulado += areaCulturaHa * valorCulturaHa;
        }
    });

    valorFinalCalculado = totalAcumulado;
    document.getElementById('itbi-valor-final').value = totalAcumulado.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

    // Painel Comparativo
    const painel = document.getElementById('painel-comparativo');
    if (vDeclarado > 0) {
        painel.style.display = 'block';
        const diferenca = vDeclarado - totalAcumulado;
        const percentual = (diferenca / totalAcumulado) * 100;
        const cor = diferenca < 0 ? "#e74c3c" : "#27ae60";
        document.getElementById('comparativo-texto').innerHTML = 
            `O valor declarado está <b style="color:${cor}">${Math.abs(percentual).toFixed(2)}% ${diferenca < 0 ? 'abaixo' : 'acima'}</b> da pauta fiscal.<br>Diferença: ${diferenca.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
    } else { painel.style.display = 'none'; }
}

// --- SINCRONIZAÇÃO EM TEMPO REAL ---
function iniciarSincronizacao() {
    onSnapshot(collection(db, "valores_hectare"), snap => {
        localidadesBase = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const select = document.getElementById('itbi-localidade');
        const tabela = document.getElementById('tabelaHectares');
        select.innerHTML = '<option value="">Selecione...</option>';
        tabela.innerHTML = '<thead><tr><th>Localidade</th><th>Valor/ha</th><th>Ações</th></tr></thead><tbody>';
        localidadesBase.forEach(l => {
            select.innerHTML += `<option value="${l.id}">${l.localidade}</option>`;
            tabela.innerHTML += `<tr><td>${l.localidade}</td><td>R$ ${l.valorPorHectare}</td><td><button class="btn-delete" onclick="remover('valores_hectare','${l.id}')">Excluir</button></td></tr>`;
        });
    });

    onSnapshot(collection(db, "fatores"), snap => {
        const calculadora = document.getElementById('lista-fatores-selecao');
        const gestao = document.getElementById('tabelaFatores');
        calculadora.innerHTML = ""; 
        gestao.innerHTML = '<thead><tr><th>Fator</th><th>Índice</th><th>Ações</th></tr></thead><tbody>';
        snap.forEach(d => {
            const f = d.data();
            calculadora.innerHTML += `<div class="item-row fator-item-row"><input type="checkbox" class="fator-cb" data-indice="${f.indice}" onchange="atu()"><span class="fator-nome">${f.nome}</span><input type="number" class="fator-area" placeholder="m²" oninput="atu()"></div>`;
            gestao.innerHTML += `<tr><td>${f.nome}</td><td>${f.indice}</td><td><button class="btn-delete" onclick="remover('fatores','${d.id}')">Excluir</button></td></tr>`;
        });
    });

    onSnapshot(collection(db, "plantacoes"), snap => {
        const calculadora = document.getElementById('lista-plantacoes-selecao');
        const gestao = document.getElementById('tabelaPlantacoes');
        calculadora.innerHTML = ""; 
        gestao.innerHTML = '<thead><tr><th>Cultura</th><th>R$/ha</th><th>Ações</th></tr></thead><tbody>';
        snap.forEach(d => {
            const p = d.data();
            calculadora.innerHTML += `<div class="item-row plantacao-item-row"><input type="checkbox" class="pl-cb" data-valorha="${p.valorHectare}" onchange="atu()"><span class="pl-nome">${p.nome}</span><input type="number" class="pl-area" placeholder="m²" oninput="atu()"></div>`;
            gestao.innerHTML += `<tr><td>${p.nome}</td><td>R$ ${p.valorHectare}</td><td><button class="btn-delete" onclick="remover('plantacoes','${d.id}')">Excluir</button></td></tr>`;
        });
    });

    onSnapshot(query(collection(db, "avaliacoes"), orderBy("dataCadastro", "desc")), snap => {
        const historico = document.getElementById('tabelaITBI');
        historico.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            historico.innerHTML += `<tr><td>${item.dataCadastro.toDate().toLocaleDateString()}</td><td>${item.localidadeNome}</td><td>${item.areaM2}</td><td>${item.valorFinal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td>${item.valorContribuinte.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td><button class="btn-delete" onclick="remover('avaliacoes','${d.id}')">Excluir</button></td></tr>`;
        });
    });
}

// --- PERSISTÊNCIA ---
document.getElementById('btnSalvarITBI').onclick = async () => {
    if (valorFinalCalculado <= 0) return alert("Cálculo zerado!");
    await addDoc(collection(db, "avaliacoes"), {
        localidadeNome: document.getElementById('itbi-localidade').selectedOptions[0].text,
        areaM2: document.getElementById('itbi-area').value,
        valorFinal: valorFinalCalculado,
        valorContribuinte: parseFloat(document.getElementById('itbi-valor-contribuinte').value) || 0,
        dataCadastro: new Date()
    });
    alert("Avaliação Registrada!");
};

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

// --- UTILITÁRIOS ---
window.atu = calcularAvaliacao;
document.getElementById('itbi-area').oninput = calcularAvaliacao;
document.getElementById('itbi-localidade').onchange = calcularAvaliacao;
document.getElementById('itbi-valor-contribuinte').oninput = calcularAvaliacao;
window.remover = async (c, id) => { if(confirm("Deseja realmente excluir este registro?")) await deleteDoc(doc(db, c, id)); };