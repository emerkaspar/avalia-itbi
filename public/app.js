import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

let localidadesBase = [];
let valorFinalCalculado = 0;

// --- SEGURANÇA E AUTH ---
onAuthStateChanged(auth, (user) => {
    const loginUI = document.getElementById('login-overlay');
    const appUI = document.getElementById('app-wrapper');
    if (user) {
        loginUI.style.display = 'none';
        appUI.style.display = 'flex';
        document.getElementById('user-display').innerText = user.email;
        iniciarApp();
    } else {
        loginUI.style.display = 'flex';
        appUI.style.display = 'none';
    }
});

document.getElementById('btnGoogle').onclick = async () => {
    try { await signInWithPopup(auth, provider); }
    catch (e) { document.getElementById('login-erro').innerText = "Erro ao logar com Google."; }
};

document.getElementById('btnLogar').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    try { await signInWithEmailAndPassword(auth, email, senha); }
    catch (e) { document.getElementById('login-erro').innerText = "E-mail ou senha inválidos."; }
};

document.getElementById('btnSair').onclick = () => signOut(auth);

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
function calcular() {
    const areaM2 = parseFloat(document.getElementById('itbi-area').value) || 0;
    const localidadeId = document.getElementById('itbi-localidade').value;
    const vDeclarado = parseFloat(document.getElementById('itbi-valor-contribuinte').value) || 0;
    const loc = localidadesBase.find(l => l.id === localidadeId);
    
    if (!loc || areaM2 <= 0) {
        document.getElementById('itbi-valor-final').value = "R$ 0,00";
        document.getElementById('painel-comparativo').style.display = 'none';
        return;
    }

    const vHa = loc.valorPorHectare;
    let total = (areaM2 / 10000) * vHa;

    // Fatores Multiplicadores (Área parcial)
    document.querySelectorAll('.fator-item-row').forEach(row => {
        const cb = row.querySelector('.fator-cb');
        if (cb.checked) {
            const aHa = (parseFloat(row.querySelector('.fator-area').value) || 0) / 10000;
            total += (aHa * vHa) * (parseFloat(cb.dataset.indice) - 1);
        }
    });

    // Plantações Aditivas (Área parcial)
    document.querySelectorAll('.plantacao-item-row').forEach(row => {
        const cb = row.querySelector('.pl-cb');
        if (cb.checked) {
            const aHa = (parseFloat(row.querySelector('.pl-area').value) || 0) / 10000;
            total += aHa * parseFloat(cb.dataset.valorha);
        }
    });

    valorFinalCalculado = total;
    document.getElementById('itbi-valor-final').value = total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

    // Comparativo
    const painel = document.getElementById('painel-comparativo');
    if (vDeclarado > 0) {
        painel.style.display = 'block';
        const dif = vDeclarado - total;
        const perc = (dif / total) * 100;
        const cor = dif < 0 ? "#e74c3c" : "#27ae60";
        document.getElementById('comparativo-texto').innerHTML = 
            `Status: <b style="color:${cor}">${perc.toFixed(2)}%</b> em relação à pauta.<br>Diferença: ${dif.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
    } else { painel.style.display = 'none'; }
}

// --- SINCRONIZAÇÃO E CRUD ---
function iniciarApp() {
    onSnapshot(collection(db, "valores_hectare"), snap => {
        localidadesBase = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sel = document.getElementById('itbi-localidade');
        const tab = document.getElementById('tabelaHectares');
        sel.innerHTML = '<option value="">Selecione...</option>';
        tab.innerHTML = '<thead><tr><th>Localidade</th><th>Valor/ha</th><th>Ações</th></tr></thead><tbody>';
        localidadesBase.forEach(l => {
            sel.innerHTML += `<option value="${l.id}">${l.localidade}</option>`;
            tab.innerHTML += `<tr><td>${l.localidade}</td><td>R$ ${l.valorPorHectare}</td><td><button class="btn-delete" onclick="remover('valores_hectare','${l.id}')">Excluir</button></td></tr>`;
        });
    });

    onSnapshot(collection(db, "fatores"), snap => {
        const cont = document.getElementById('lista-fatores-selecao');
        const tab = document.getElementById('tabelaFatores');
        cont.innerHTML = ""; tab.innerHTML = '<thead><tr><th>Fator</th><th>Índice</th><th>Ações</th></tr></thead><tbody>';
        snap.forEach(d => {
            const f = d.data();
            cont.innerHTML += `<div class="item-row fator-item-row"><input type="checkbox" class="fator-cb" data-indice="${f.indice}" onchange="atu()"><span class="fator-nome">${f.nome}</span><input type="number" class="fator-area" placeholder="m²" oninput="atu()"></div>`;
            tab.innerHTML += `<tr><td>${f.nome}</td><td>${f.indice}</td><td><button class="btn-delete" onclick="remover('fatores','${d.id}')">Excluir</button></td></tr>`;
        });
    });

    onSnapshot(collection(db, "plantacoes"), snap => {
        const cont = document.getElementById('lista-plantacoes-selecao');
        const tab = document.getElementById('tabelaPlantacoes');
        cont.innerHTML = ""; tab.innerHTML = '<thead><tr><th>Cultura</th><th>R$/ha</th><th>Ações</th></tr></thead><tbody>';
        snap.forEach(d => {
            const p = d.data();
            cont.innerHTML += `<div class="item-row plantacao-item-row"><input type="checkbox" class="pl-cb" data-valorha="${p.valorHectare}" onchange="atu()"><span class="pl-nome">${p.nome}</span><input type="number" class="pl-area" placeholder="m²" oninput="atu()"></div>`;
            tab.innerHTML += `<tr><td>${p.nome}</td><td>R$ ${p.valorHectare}</td><td><button class="btn-delete" onclick="remover('plantacoes','${d.id}')">Excluir</button></td></tr>`;
        });
    });

    onSnapshot(query(collection(db, "avaliacoes"), orderBy("dataCadastro", "desc")), snap => {
        const tab = document.getElementById('tabelaITBI');
        tab.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            tab.innerHTML += `<tr><td>${item.dataCadastro.toDate().toLocaleDateString()}</td><td>${item.localidadeNome}</td><td>${item.areaM2} m²</td><td>${item.valorFinal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td>${item.valorContribuinte.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td><button class="btn-delete" onclick="remover('avaliacoes','${d.id}')">Excluir</button></td></tr>`;
        });
    });
}

// --- SALVAMENTO ---
document.getElementById('btnSalvarITBI').onclick = async () => {
    if (valorFinalCalculado <= 0) return;
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
};

document.getElementById('btnSalvarFator').onclick = async () => {
    const nome = document.getElementById('fator-nome').value;
    const indice = parseFloat(document.getElementById('fator-indice').value);
    if(nome && indice) await addDoc(collection(db, "fatores"), { nome, indice });
};

document.getElementById('btnSalvarPlantacao').onclick = async () => {
    const nome = document.getElementById('pl-nome').value;
    const valor = parseFloat(document.getElementById('pl-valor').value);
    if(nome && valor) await addDoc(collection(db, "plantacoes"), { nome, valorHectare: valor });
};

window.atu = calcular;
document.getElementById('itbi-area').oninput = calcular;
document.getElementById('itbi-localidade').onchange = calcular;
document.getElementById('itbi-valor-contribuinte').oninput = calcular;
window.remover = async (c, id) => { if(confirm("Excluir registro?")) await deleteDoc(doc(db, c, id)); };