/**
 * Script simplificado para gerar Google Refresh Token
 * O token será salvo em token.txt
 */

const http = require('http');
require('dotenv').config();
const url = require('url');
const fs = require('fs');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE';
const REDIRECT_URI = 'http://localhost:3002/callback';

const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/spreadsheets'
];

console.log('\n🔐 Gerador de Google Refresh Token (v2)\n');
console.log('Abra esta URL no navegador:\n');

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent'
})}`;

console.log(authUrl);
console.log('\nAguardando autorização...\n');

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code;

        if (code) {
            try {
                const tokenUrl = 'https://oauth2.googleapis.com/token';
                const params = new URLSearchParams({
                    code: code,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    grant_type: 'authorization_code'
                });

                const response = await fetch(tokenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params
                });

                const tokens = await response.json();

                if (tokens.refresh_token) {
                    // Salvar em arquivo
                    fs.writeFileSync('token.txt', tokens.refresh_token, 'utf8');

                    console.log('\n✅ SUCESSO!\n');
                    console.log('O Refresh Token foi salvo em: token.txt');
                    console.log('\nConteúdo do token:');
                    console.log(tokens.refresh_token);
                    console.log('\nCopie o conteúdo e cole no .env.local em GOOGLE_REFRESH_TOKEN=\n');

                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <html>
                            <body style="font-family: Arial; text-align: center; padding: 50px;">
                                <h1>✅ Token gerado com sucesso!</h1>
                                <p>O token foi salvo em <code>token.txt</code></p>
                                <p>Volte para o terminal para copiar o token.</p>
                                <p>Você pode fechar esta janela.</p>
                            </body>
                        </html>
                    `);

                    setTimeout(() => {
                        server.close();
                        process.exit(0);
                    }, 2000);
                } else {
                    throw new Error('Refresh token não retornado. Resposta: ' + JSON.stringify(tokens));
                }
            } catch (error) {
                console.error('\n❌ Erro:', error.message);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>Erro</h1><p>' + error.message + '</p>');
                server.close();
                process.exit(1);
            }
        }
    }
});

server.listen(3002, () => {
    console.log('✓ Servidor rodando na porta 3002\n');
});
