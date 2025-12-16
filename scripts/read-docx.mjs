import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

const folder = './Estrutura Cerebro';
const outputFolder = './Estrutura Cerebro/extracted';

async function extractDocx() {
    // Create output folder
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    const files = fs.readdirSync(folder).filter(f => f.endsWith('.docx'));

    console.log(`📂 Encontrados ${files.length} arquivos .docx\n`);

    for (const file of files) {
        const filePath = path.join(folder, file);
        const outputPath = path.join(outputFolder, file.replace('.docx', '.txt'));

        try {
            const result = await mammoth.extractRawText({ path: filePath });
            fs.writeFileSync(outputPath, result.value, 'utf-8');
            console.log(`✅ Extraído: ${file} -> ${outputPath}`);
        } catch (error) {
            console.log(`❌ Erro ao ler ${file}: ${error.message}`);
        }
    }

    console.log('\n📁 Arquivos extraídos salvos em:', outputFolder);
}

extractDocx();
