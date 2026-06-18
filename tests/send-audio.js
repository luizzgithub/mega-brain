const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const API_URL = 'http://192.168.1.4:4144/api/transcribe';
// Substitua pelo caminho de um arquivo de áudio real que você tenha
const AUDIO_FILE_PATH = path.join(__dirname, 'teste.wav');

async function testTranscription() {
  try {
    if (!fs.existsSync(AUDIO_FILE_PATH)) {
      console.error(`Erro: Arquivo de áudio não encontrado em ${AUDIO_FILE_PATH}`);
      console.log('Por favor, coloque um arquivo test.wav na pasta tests/ para rodar este script.');
      return;
    }

    console.log(`Enviando ${AUDIO_FILE_PATH} para a API em ${API_URL}...`);
    console.log('Aguardando resposta (isso pode levar alguns segundos/minutos dependendo do tamanho do áudio e do seu hardware)...');

    const form = new FormData();
    form.append('file', fs.createReadStream(AUDIO_FILE_PATH));
    // Você pode forçar um idioma aqui, se não enviar ele usa o padrão do .env (pt)
    // form.append('language', 'pt'); 

    const startTime = Date.now();

    const response = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(),
      },
      // Desativa o timeout do Axios, pois a transcrição pode demorar
      timeout: 0,
    });

    const duration = (Date.now() - startTime) / 1000;

    console.log('\n--- Resultado Recebido com Sucesso! ---');
    console.log(`Tempo total da requisição: ${duration.toFixed(2)} segundos`);
    console.log('---------------------------------------');
    console.log('Texto Transcrito:');
    console.log(response.data.result.text);
    console.log('---------------------------------------');

    // Mostra o JSON completo se quiser ver os segmentos e detalhes
    // console.dir(response.data, { depth: null });

  } catch (error) {
    console.error('\nErro ao testar a API:');
    if (error.response) {
      // O servidor respondeu com um status code fora do range 2xx
      console.error(`Status HTTP: ${error.response.status}`);
      console.error('Resposta do Servidor:', error.response.data);
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta (ex: servidor desligado)
      console.error('Nenhuma resposta recebida. A API (node src/server.js) está rodando?');
      console.error(error.message);
    } else {
      // Erro ao configurar a requisição
      console.error('Erro na configuração da requisição:', error.message);
    }
  }
}

testTranscription();
