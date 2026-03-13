// 1. Importando as ferramentas do Firebase direto da internet (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// =========================================================
// 2. COLE O SEU FIREBASE CONFIG AQUI DENTRO:
const firebaseConfig = {
  apiKey: "AIzaSyB3w1X0wdIpXJRnFNAKEjZXMnauhJv0RvI",
  authDomain: "avalia-itbi.firebaseapp.com",
  projectId: "avalia-itbi",
  storageBucket: "avalia-itbi.firebasestorage.app",
  messagingSenderId: "568434525897",
  appId: "1:568434525897:web:83d9482966b059c4ecaf18",
  measurementId: "G-2R9M2VLDZ2"
};
// =========================================================

// 3. Ligando o nosso site ao Firebase e ao Banco de Dados (Firestore)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. Função para SALVAR os dados no banco
async function salvarDado() {
    // Pegando os valores digitados
    const ano = document.getElementById('ano').value;
    const bairro = document.getElementById('bairro').value;
    const area = parseFloat(document.getElementById('area').value);
    const valor = parseFloat(document.getElementById('valor').value);
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;

    // Verificando se preencheu o básico
    if (!ano || !bairro || isNaN(area) || isNaN(valor)) {
        alert("Por favor, preencha Ano, Bairro, Área e Valor!");
        return;
    }

    // Calculando o valor do m2
    const valorM2 = valor / area;

    try {
        // Gravando a "ficha" na coleção chamada "avaliacoes" no Firebase
        await addDoc(collection(db, "avaliacoes"), {
            ano: ano,
            bairro: bairro,
            area: area,
            valorTotal: valor,
            valorMetroQuadrado: valorM2,
            latitude: lat,
            longitude: lng,
            dataCadastro: new Date() // Guarda a data exata que foi cadastrado
        });
        
        alert("Avaliação salva com sucesso na nuvem!");
        
        // Limpando os campos após salvar
        document.getElementById('ano').value = '';
        document.getElementById('bairro').value = '';
        document.getElementById('area').value = '';
        document.getElementById('valor').value = '';
        document.getElementById('lat').value = '';
        document.getElementById('lng').value = '';

    } catch (e) {
        console.error("Erro ao salvar: ", e);
        alert("Deu um erro ao salvar. Veja o console.");
    }
}

// Vinculando o clique do botão à função de salvar
document.getElementById('btnSalvar').addEventListener('click', salvarDado);

// 5. Função para LER os dados do banco e mostrar na tabela em tempo real
function carregarDados() {
    const tabela = document.getElementById('tabelaDados');
    
    // O 'onSnapshot' fica "escutando" o banco. Se adicionar algo lá, ele atualiza a tabela na hora!
    onSnapshot(collection(db, "avaliacoes"), (querySnapshot) => {
        tabela.innerHTML = ""; // Limpa a tabela para não duplicar

        querySnapshot.forEach((doc) => {
            const dado = doc.data();
            
            // Formatando o dinheiro para o padrão brasileiro
            const valorFormatado = dado.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const m2Formatado = dado.valorMetroQuadrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // Adicionando a linha na tabela
            tabela.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;">${dado.ano}</td>
                    <td style="padding: 8px;">${dado.bairro}</td>
                    <td style="padding: 8px;">${dado.area} m²</td>
                    <td style="padding: 8px; color: green; font-weight: bold;">${valorFormatado}</td>
                    <td style="padding: 8px;">${m2Formatado}/m²</td>
                </tr>
            `;
        });
    });
}

// Chama a função de carregar assim que o site abre
carregarDados();