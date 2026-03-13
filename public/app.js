import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- NAVEGAÇÃO ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        document.getElementById(target).classList.add('active');
    });
});

// --- FUNCIONALIDADES ITBI ---
async function salvarITBI() {
    const ano = document.getElementById('ano').value;
    const bairro = document.getElementById('bairro').value;
    const area = parseFloat(document.getElementById('area').value);
    const valorTotal = parseFloat(document.getElementById('valor').value);

    if (!ano || !bairro || isNaN(area) || isNaN(valorTotal)) {
        return alert("Por favor, preencha todos os campos obrigatórios.");
    }

    const valorM2 = valorTotal / area;
    
    try {
        await addDoc(collection(db, "avaliacoes"), {
            ano, bairro, area, valorTotal,
            valorMetroQuadrado: valorM2,
            dataCadastro: new Date()
        });
        alert("Avaliação registrada com sucesso!");
        document.querySelectorAll('#secao-itbi input').forEach(i => i.value = '');
    } catch (e) {
        console.error("Erro ao salvar ITBI:", e);
    }
}

// --- FUNCIONALIDADES HECTARE ---
async function salvarHectare() {
    const nome = document.getElementById('loc-nome').value;
    const valorHectare = parseFloat(document.getElementById('loc-valor').value);

    if (!nome || isNaN(valorHectare)) {
        return alert("Informe a localidade e o valor por hectare.");
    }

    try {
        await addDoc(collection(db, "valores_hectare"), {
            localidade: nome,
            valorPorHectare: valorHectare,
            dataAtualizacao: new Date()
        });
        alert("Localidade cadastrada!");
        document.getElementById('loc-nome').value = '';
        document.getElementById('loc-valor').value = '';
    } catch (e) {
        console.error("Erro ao salvar hectare:", e);
    }
}

// --- MONITORAMENTO EM TEMPO REAL ---
function iniciarEscuta() {
    // Escuta Avaliações ITBI
    onSnapshot(collection(db, "avaliacoes"), (snap) => {
        const corpoTabela = document.getElementById('tabelaITBI');
        corpoTabela.innerHTML = "";
        snap.forEach(documento => {
            const d = documento.data();
            corpoTabela.innerHTML += `
                <tr>
                    <td>${d.ano}</td>
                    <td>${d.bairro}</td>
                    <td>${d.area} m²</td>
                    <td>${d.valorTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td>${d.valorMetroQuadrado.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td>
                        <button class="btn-delete" onclick="removerRegistro('avaliacoes', '${documento.id}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </td>
                </tr>`;
        });
    });

    // Escuta Valores por Hectare
    onSnapshot(collection(db, "valores_hectare"), (snap) => {
        const corpoTabela = document.getElementById('tabelaHectares');
        corpoTabela.innerHTML = "";
        snap.forEach(documento => {
            const d = documento.data();
            corpoTabela.innerHTML += `
                <tr>
                    <td>${d.localidade}</td>
                    <td>${d.valorPorHectare.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td>
                        <button class="btn-delete" onclick="removerRegistro('valores_hectare', '${documento.id}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </td>
                </tr>`;
        });
    });
}

window.removerRegistro = async (colecao, id) => {
    if (confirm("Deseja realmente excluir este registro?")) {
        try {
            await deleteDoc(doc(db, colecao, id));
        } catch (e) {
            console.error("Erro ao excluir:", e);
        }
    }
};

document.getElementById('btnSalvarITBI').addEventListener('click', salvarITBI);
document.getElementById('btnSalvarHectare').addEventListener('click', salvarHectare);

iniciarEscuta();