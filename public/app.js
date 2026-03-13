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

// --- MÁSCARA DE NUMERAIS EM TEMPO REAL ---
function aplicarMascara(event) {
    let input = event.target;
    let valor = input.value.replace(/\D/g, ""); // Remove tudo que não é dígito
    
    // Converte para decimal (dividir por 100 para centavos)
    valor = (valor / 100).toFixed(2) + "";
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); // Adiciona pontos de milhar
    
    input.value = valor === "0,00" ? "" : valor;
}

// Converte "1.250,50" -> 1250.5
const paraNumero = (str) => {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, "").replace(",", "."));
};

// Formata 1250.5 -> "R$ 1.250,50"
const paraMoeda = (num) => num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTENTICAÇÃO ---
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
    catch (e) { document.getElementById('login-erro').innerText = "Acesso negado."; }
};

document.getElementById('btnSair').onclick = () => signOut(auth);

// --- NAVEGAÇÃO ENTRE ABAS ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        link.classList.add('active');
        document.getElementById(link.getAttribute('data-target')).classList.add('active');
    });
});

// --- MOTOR DE CÁLCULO ---
function calcular() {
    const areaM2 = paraNumero(document.getElementById('itbi-area').value);
    const localidadeId = document.getElementById('itbi-localidade').value;
    const vDeclarado = paraNumero(document.getElementById('itbi-valor-contribuinte').value);
    const loc = localidadesBase.find(l => l.id === localidadeId);
    
    if (!loc || areaM2 <= 0) {
        document.getElementById('itbi-valor-final').value = "R$ 0,00";
        document.getElementById('painel-comparativo').style.display = 'none';
        valorFinalCalculado = 0;
        return;
    }

    const vHa = loc.valorPorHectare;
    let total = (areaM2 / 10000) * vHa;

    // Fatores Multiplicadores
    document.querySelectorAll('.fator-item-row').forEach(row => {
        const cb = row.querySelector('.fator-cb');
        if (cb.checked) {
            const aHa = paraNumero(row.querySelector('.fator-area').value) / 10000;
            total += (aHa * vHa) * (paraNumero(cb.dataset.indice) - 1);
        }
    });

    // Plantações Aditivas
    document.querySelectorAll('.plantacao-item-row').forEach(row => {
        const cb = row.querySelector('.pl-cb');
        if (cb.checked) {
            const aHa = paraNumero(row.querySelector('.pl-area').value) / 10000;
            total += aHa * paraNumero(cb.dataset.valorha);
        }
    });

    valorFinalCalculado = total;
    document.getElementById('itbi-valor-final').value = paraMoeda(total);

    // Comparativo
    const painel = document.getElementById('painel-comparativo');
    if (vDeclarado > 0) {
        painel.style.display = 'flex';
        const dif = vDeclarado - total;
        const perc = (dif / total) * 100;
        
        if (dif < 0) {
            painel.style.background = "#fef2f2";
            painel.style.color = "#991b1b";
            document.getElementById('comparativo-texto').innerText = `Diferença de ${Math.abs(perc).toFixed(1)}% abaixo da pauta.`;
        } else {
            painel.style.background = "#f0fdf4";
            painel.style.color = "#166534";
            document.getElementById('comparativo-texto').innerText = `Conformidade: ${perc.toFixed(1)}% acima da pauta.`;
        }
    } else { painel.style.display = 'none'; }
}

function iniciarApp() {
    // Sincronizações
    onSnapshot(collection(db, "valores_hectare"), snap => {
        localidadesBase = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sel = document.getElementById('itbi-localidade');
        const tab = document.getElementById('tabelaHectares');
        sel.innerHTML = '<option value="">Selecionar...</option>';
        tab.innerHTML = '<thead><tr><th>Localidade</th><th>Valor/ha</th><th>Ações</th></tr></thead><tbody>';
        localidadesBase.forEach(l => {
            sel.innerHTML += `<option value="${l.id}">${l.localidade}</option>`;
            tab.innerHTML += `<tr><td>${l.localidade}</td><td>${paraMoeda(l.valorPorHectare)}</td><td><button onclick="remover('valores_hectare','${l.id}')">Excluir</button></td></tr>`;
        });
    });

    onSnapshot(collection(db, "fatores"), snap => {
        const cont = document.getElementById('lista-fatores-selecao');
        const tab = document.getElementById('tabelaFatores');
        cont.innerHTML = ""; tab.innerHTML = '<thead><tr><th>Fator</th><th>Índice</th><th>Ações</th></tr></thead><tbody>';
        snap.forEach(d => {
            const f = d.data();
            cont.innerHTML += `<div class="item-row fator-item-row"><input type="checkbox" class="fator-cb" data-indice="${f.indice}" onchange="atu()"><span class="fator-nome">${f.nome}</span><input type="text" class="fator-area mascara-numero" placeholder="0,00" oninput="atu()"></div>`;
            tab.innerHTML += `<tr><td>${f.nome}</td><td>${f.indice}</td><td><button onclick="remover('fatores','${d.id}')">Excluir</button></td></tr>`;
        });
        atribuirMascaras();
    });

    onSnapshot(collection(db, "plantacoes"), snap => {
        const cont = document.getElementById('lista-plantacoes-selecao');
        const tab = document.getElementById('tabelaPlantacoes');
        cont.innerHTML = ""; tab.innerHTML = '<thead><tr><th>Cultura</th><th>R$/ha</th><th>Ações</th></tr></thead><tbody>';
        snap.forEach(d => {
            const p = d.data();
            cont.innerHTML += `<div class="item-row plantacao-item-row"><input type="checkbox" class="pl-cb" data-valorha="${p.valorHectare}" onchange="atu()"><span class="pl-nome">${p.nome}</span><input type="text" class="pl-area mascara-numero" placeholder="0,00" oninput="atu()"></div>`;
            tab.innerHTML += `<tr><td>${p.nome}</td><td>${paraMoeda(p.valorHectare)}</td><td><button onclick="remover('plantacoes','${d.id}')">Excluir</button></td></tr>`;
        });
        atribuirMascaras();
    });

    onSnapshot(query(collection(db, "avaliacoes"), orderBy("dataCadastro", "desc")), snap => {
        const tab = document.getElementById('tabelaITBI');
        tab.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            tab.innerHTML += `<tr><td>${item.dataCadastro.toDate().toLocaleDateString()}</td><td>${item.localidadeNome}</td><td>${item.areaM2}</td><td>${paraMoeda(item.valorFinal)}</td><td>${paraMoeda(item.valorContribuinte)}</td><td><button onclick="remover('avaliacoes','${d.id}')">Remover</button></td></tr>`;
        });
    });
}

// Gerencia máscaras em campos fixos e dinâmicos
function atribuirMascaras() {
    document.querySelectorAll('.mascara-numero').forEach(el => {
        el.oninput = (e) => {
            aplicarMascara(e);
            calcular();
        };
    });
}

// Inicia máscaras iniciais
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

document.getElementById('btnSalvarHectare').onclick = async () => {
    const nome = document.getElementById('loc-nome').value;
    const valor = paraNumero(document.getElementById('loc-valor').value);
    if(nome && valor) await addDoc(collection(db, "valores_hectare"), { localidade: nome, valorPorHectare: valor });
};

document.getElementById('btnSalvarFator').onclick = async () => {
    const nome = document.getElementById('fator-nome').value;
    const indice = document.getElementById('fator-indice').value.replace(",", ".");
    if(nome && indice) await addDoc(collection(db, "fatores"), { nome, indice });
};

document.getElementById('btnSalvarPlantacao').onclick = async () => {
    const nome = document.getElementById('pl-nome').value;
    const valor = paraNumero(document.getElementById('pl-valor').value);
    if(nome && valor) await addDoc(collection(db, "plantacoes"), { nome, valorHectare: valor });
};

window.atu = calcular;
window.remover = async (c, id) => { if(confirm("Remover registro?")) await deleteDoc(doc(db, c, id)); };