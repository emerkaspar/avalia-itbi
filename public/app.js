let avaliacoes = [];

function adicionarDado() {
    let valorInput = document.getElementById('valorAvaliacao').value;
    let valor = parseFloat(valorInput);

    if (valorInput === "" || isNaN(valor)) {
        alert("Por favor, insira um valor válido.");
        return;
    }

    // Adiciona o valor na nossa lista
    avaliacoes.push(valor);

    // Calcula a nova média
    let soma = 0;
    for(let i = 0; i < avaliacoes.length; i++) {
        soma += avaliacoes[i];
    }
    
    let media = soma / avaliacoes.length;

    // Atualiza a tela
    document.getElementById('resultadoMedia').innerText = media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('totalImoveis').innerText = avaliacoes.length;

    // Limpa o campo para o próximo preenchimento
    document.getElementById('valorAvaliacao').value = "";
    document.getElementById('bairro').value = "";
}