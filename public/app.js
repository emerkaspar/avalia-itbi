import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

let editStates = { hectare: null, fator: null, plantacao: null };
let localidadesBase = [];
let valorFinalCalculado = 0;

// --- UTILITÁRIOS ---
const paraNumero = (str) => str ? parseFloat(str.replace(/\./g, "").replace(",", ".")) : 0;
const paraMoeda = (num) => num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const aplicarMascara = (e) => {
    let valor = e.target.value.replace(/\D/g, "");
    valor = (valor / 100).toFixed(2).replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    e.target.value = valor === "0,00" ? "" : valor;
};

// --- AUTH ---
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

document.getElementById('btnLogar').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    try { await signInWithEmailAndPassword(auth, email, senha); }
    catch (e) { document.getElementById('login-erro').innerText = "Credenciais inválidas."; }
};

document.getElementById('btnSair').onclick = () => signOut(auth);

// --- NAVEGAÇÃO ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link, .tab-content').forEach(el => el.classList.remove('active'));
        link.classList.add('active');
        document.getElementById(link.getAttribute('data-target')).classList.add('active');
    });
});

// --- CÁLCULO ---
function calcular() {
    const areaM2 = paraNumero(document.getElementById('itbi-area').value);
    const localidadeId = document.getElementById('itbi-localidade').value;
    const vDeclarado = paraNumero(document.getElementById('itbi-valor-contribuinte').value);
    const loc = localidadesBase.find(l => l.id === localidadeId);
    
    if (!loc || areaM2 <= 0) {
        document.getElementById('itbi-valor-final').value = "R$ 0,00";
        document.getElementById('painel-comparativo').style.display = 'none';
        return;
    }

    const vHa = loc.valorPorHectare;
    let total = (areaM2 / 10000) * vHa;

    document.querySelectorAll('.fator-item-row').forEach(row => {
        const cb = row.querySelector('.fator-cb');
        if (cb.checked) {
            const aHa = paraNumero(row.querySelector('.fator-area').value) / 10000;
            total += (aHa * vHa) * (paraNumero(cb.dataset.indice) - 1);
        }
    });

    document.querySelectorAll('.plantacao-item-row').forEach(row => {
        const cb = row.querySelector('.pl-cb');
        if (cb.checked) {
            const aHa = paraNumero(row.querySelector('.pl-area').value) / 10000;
            total += aHa * paraNumero(cb.dataset.valorha);
        }
    });

    valorFinalCalculado = total;
    document.getElementById('itbi-valor-final').value = paraMoeda(total);

    const painel = document.getElementById('painel-comparativo');
    if (vDeclarado > 0) {
        painel.style.display = 'flex';
        const dif = vDeclarado - total;
        const perc = (dif / total) * 100;
        painel.style.background = dif < 0 ? "#fef2f2" : "#f0fdf4";
        painel.style.color = dif < 0 ? "#991b1b" : "#166534";
        document.getElementById('comparativo-texto').innerText = `Diferença de ${Math.abs(perc).toFixed(1)}% ${dif < 0 ? 'abaixo' : 'acima'} da pauta.`;
    } else { painel.style.display = 'none'; }
}

// --- SINCRONIZAÇÃO ---
function iniciarApp() {
    onSnapshot(collection(db, "valores_hectare"), snap => {
        localidadesBase = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sel = document.getElementById('itbi-localidade');
        const tab = document.getElementById('tabelaHectares');
        sel.innerHTML = '<option value="">Selecionar...</option>';
        tab.innerHTML = '<thead><tr><th>Localidade</th><th>Valor/ha</th><th style="width: 80px;"></th></tr></thead><tbody>';
        localidadesBase.forEach(l => {
            sel.innerHTML += `<option value="${l.id}">${l.localidade}</option>`;
            tab.innerHTML += `<tr><td>${l.localidade}</td><td>${paraMoeda(l.valorPorHectare)}</td><td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="prepararEdicaoHectare('${l.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-delete" onclick="remover('valores_hectare','${l.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td></tr>`;
        });
    });

    onSnapshot(collection(db, "fatores"), snap => {
        const cont = document.getElementById('lista-fatores-selecao');
        const tab = document.getElementById('tabelaFatores');
        cont.innerHTML = ""; tab.innerHTML = '<thead><tr><th>Fator</th><th>Índice</th><th style="width: 80px;"></th></tr></thead><tbody>';
        snap.forEach(d => {
            const f = d.data();
            cont.innerHTML += `<div class="item-row fator-item-row"><input type="checkbox" class="fator-cb" data-indice="${f.indice}" onchange="atu()"><span class="fator-nome">${f.nome}</span><input type="text" class="fator-area mascara-numero" placeholder="0,00" oninput="atu()"></div>`;
            tab.innerHTML += `<tr><td>${f.nome}</td><td>${f.indice}</td><td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="prepararEdicaoFator('${d.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-delete" onclick="remover('fatores','${d.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td></tr>`;
        });
        atribuirMascaras();
    });

    onSnapshot(collection(db, "plantacoes"), snap => {
        const cont = document.getElementById('lista-plantacoes-selecao');
        const tab = document.getElementById('tabelaPlantacoes');
        cont.innerHTML = ""; tab.innerHTML = '<thead><tr><th>Cultura</th><th>R$/ha</th><th style="width: 80px;"></th></tr></thead><tbody>';
        snap.forEach(d => {
            const p = d.data();
            cont.innerHTML += `<div class="item-row plantacao-item-row"><input type="checkbox" class="pl-cb" data-valorha="${p.valorHectare}" onchange="atu()"><span class="pl-nome">${p.nome}</span><input type="text" class="pl-area mascara-numero" placeholder="0,00" oninput="atu()"></div>`;
            tab.innerHTML += `<tr><td>${p.nome}</td><td>${paraMoeda(p.valorHectare)}</td><td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="prepararEdicaoPlantacao('${d.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-delete" onclick="remover('plantacoes','${d.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td></tr>`;
        });
        atribuirMascaras();
    });

    onSnapshot(query(collection(db, "avaliacoes"), orderBy("dataCadastro", "desc")), snap => {
        const tab = document.getElementById('tabelaITBI');
        tab.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            tab.innerHTML += `<tr><td>${item.dataCadastro.toDate().toLocaleDateString()}</td><td>${item.localidadeNome}</td><td>${item.areaM2}</td><td>${paraMoeda(item.valorFinal)}</td><td>${paraMoeda(item.valorContribuinte)}</td><td>
                <button class="btn-delete" onclick="remover('avaliacoes','${d.id}')"><i class="fas fa-trash"></i></button>
            </td></tr>`;
        });
    });
}

// --- EDIÇÃO ---
window.prepararEdicaoHectare = (id) => {
    const item = localidadesBase.find(l => l.id === id);
    document.getElementById('loc-nome').value = item.localidade;
    document.getElementById('loc-valor').value = item.valorPorHectare.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    editStates.hectare = id;
    toggleUI('hectare', true);
};

window.prepararEdicaoFator = (id) => {
    onSnapshot(doc(db, "fatores", id), (d) => {
        const item = d.data();
        document.getElementById('fator-nome').value = item.nome;
        document.getElementById('fator-indice').value = item.indice.toString().replace(".", ",");
        editStates.fator = id;
        toggleUI('fator', true);
    }, {onlyOnce: true});
};

window.prepararEdicaoPlantacao = (id) => {
    onSnapshot(doc(db, "plantacoes", id), (d) => {
        const item = d.data();
        document.getElementById('pl-nome').value = item.nome;
        document.getElementById('pl-valor').value = item.valorHectare.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        editStates.plantacao = id;
        toggleUI('plantacao', true);
    }, {onlyOnce: true});
};

function toggleUI(sec, isEdit) {
    const s = sec === 'hectare' ? 'Hectare' : sec.charAt(0).toUpperCase() + sec.slice(1);
    document.getElementById(`btnSalvar${s}`).innerText = isEdit ? "Atualizar" : `Salvar ${s}`;
    document.getElementById(`btnCancelar${s}`).style.display = isEdit ? "inline-block" : "none";
    if(!isEdit) {
        document.querySelectorAll(`#secao-${sec === 'hectare' ? 'hectares' : sec+'s'} input`).forEach(i => i.value = "");
        editStates[sec] = null;
    }
}

// --- PERSISTÊNCIA ---
document.getElementById('btnSalvarHectare').onclick = async () => {
    const data = { localidade: document.getElementById('loc-nome').value, valorPorHectare: paraNumero(document.getElementById('loc-valor').value) };
    if(editStates.hectare) await updateDoc(doc(db, "valores_hectare", editStates.hectare), data);
    else await addDoc(collection(db, "valores_hectare"), data);
    toggleUI('hectare', false);
};

document.getElementById('btnSalvarFator').onclick = async () => {
    const data = { nome: document.getElementById('fator-nome').value, indice: paraNumero(document.getElementById('fator-indice').value) };
    if(editStates.fator) await updateDoc(doc(db, "fatores", editStates.fator), data);
    else await addDoc(collection(db, "fatores"), data);
    toggleUI('fator', false);
};

document.getElementById('btnSalvarPlantacao').onclick = async () => {
    const data = { nome: document.getElementById('pl-nome').value, valorHectare: paraNumero(document.getElementById('pl-valor').value) };
    if(editStates.plantacao) await updateDoc(doc(db, "plantacoes", editStates.plantacao), data);
    else await addDoc(collection(db, "plantacoes"), data);
    toggleUI('plantacao', false);
};

document.getElementById('btnCancelarHectare').onclick = () => toggleUI('hectare', false);
document.getElementById('btnCancelarFator').onclick = () => toggleUI('fator', false);
document.getElementById('btnCancelarPlantacao').onclick = () => toggleUI('plantacao', false);

function atribuirMascaras() {
    document.querySelectorAll('.mascara-numero').forEach(el => {
        el.oninput = (e) => { aplicarMascara(e); calcular(); };
    });
}
atribuirMascaras();

document.getElementById('btnSalvarITBI').onclick = async () => {
    if (valorFinalCalculado <= 0) return;
    await addDoc(collection(db, "avaliacoes"), {
        localidadeNome: document.getElementById('itbi-localidade').selectedOptions[0].text,
        areaM2: document.getElementById('itbi-area').value,
        valorFinal: valorFinalCalculado,
        valorContribuinte: paraNumero(document.getElementById('itbi-valor-contribuinte').value),
        dataCadastro: new Date()
    });
    alert("Avaliação arquivada.");
};

window.atu = calcular;
document.getElementById('itbi-area').oninput = calcular;
document.getElementById('itbi-localidade').onchange = calcular;
document.getElementById('itbi-valor-contribuinte').oninput = calcular;
window.remover = async (c, id) => { if(confirm("Excluir registro?")) await deleteDoc(doc(db, c, id)); };