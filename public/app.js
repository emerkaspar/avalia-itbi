import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Suas configurações do Firebase
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

// --- LÓGICA DE NAVEGAÇÃO ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        // Remove active de todos
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        // Adiciona no clicado
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        document.getElementById(target).classList.add('active');
    });
});

// --- FUNCIONALIDADES ITBI ---
async function salvarITBI() {
    const dados = {
        ano: document.getElementById('ano').value,
        bairro: document.getElementById('bairro').value,
        area: parseFloat(document.getElementById('area').value),
        valorTotal: parseFloat(document.getElementById('valor').value),
        latitude: document.getElementById('lat').value,
        longitude: document.getElementById('lng').value,
        dataCadastro: new Date()
    };

    if (!dados.ano || !dados.bairro || isNaN(dados.area)) return alert("Preencha os campos obrigatórios!");

    const valorM2 = dados.valorTotal / dados.area;
    
    try {
        await addDoc(collection(db, "avaliacoes"), { ...dados, valorMetroQuadrado: valorM2 });
        alert("ITBI salvo!");
    } catch (e) { console.error(e); }
}

// --- FUNCIONALIDADES HECTARE ---
async function salvarHectare() {
    const nome = document.getElementById('loc-nome').value;
    const valorHectare = parseFloat(document.getElementById('loc-valor').value);
    const tipo = document.getElementById('loc-tipo').value;

    if (!nome || isNaN(valorHectare)) return alert("Preencha o nome e o valor!");

    try {
        await addDoc(collection(db, "valores_hectare"), {
            localidade: nome,
            valorPorHectare: valorHectare,
            tipo: tipo,
            dataAtualizacao: new Date()
        });
        alert("Valor por hectare registrado!");
        document.getElementById('loc-nome').value = '';
        document.getElementById('loc-valor').value = '';
    } catch (e) { console.error(e); }
}

// --- CARREGAMENTO EM TEMPO REAL ---
function monitorarDados() {
    // Monitor ITBI
    onSnapshot(collection(db, "avaliacoes"), (snap) => {
        const lista = document.getElementById('tabelaITBI');
        lista.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            lista.innerHTML += `
                <tr>
                    <td>${d.ano}</td>
                    <td>${d.bairro}</td>
                    <td>${d.area} m²</td>
                    <td>${d.valorTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td>${d.valorMetroQuadrado.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}/m²</td>
                </tr>`;
        });
    });

    // Monitor Hectares
    onSnapshot(collection(db, "valores_hectare"), (snap) => {
        const lista = document.getElementById('tabelaHectares');
        lista.innerHTML = "";
        snap.forEach(snapDoc => {
            const d = snapDoc.data();
            lista.innerHTML += `
                <tr>
                    <td>${d.localidade}</td>
                    <td>${d.tipo}</td>
                    <td>${d.valorPorHectare.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td><button onclick="deletarDoc('valores_hectare', '${snapDoc.id}')">Excluir</button></td>
                </tr>`;
        });
    });
}

// Expõe a função de deletar para o HTML (se necessário)
window.deletarDoc = async (colecao, id) => {
    if(confirm("Deseja excluir este registro?")) {
        await deleteDoc(doc(db, colecao, id));
    }
};

document.getElementById('btnSalvarITBI').addEventListener('click', salvarITBI);
document.getElementById('btnSalvarHectare').addEventListener('click', salvarHectare);

monitorarDados();