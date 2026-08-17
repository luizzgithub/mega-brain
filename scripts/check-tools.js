#!/usr/bin/env node
const { checkAllTools } = require('../src/services/checkTools');

checkAllTools()
  .then((results) => {
    const allOk = results.every((r) => r.ok);
    if (allOk) {
      console.log('\nAmbiente pronto para transcrição de vídeo e diarização.');
      process.exit(0);
    }
    console.log('\nCorrija os itens acima antes de usar vídeo/diarização.');
    process.exit(1);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
