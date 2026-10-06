// Monta uma página única (CSS e JS embutidos) a partir do build em modo artifact.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const dir = 'dist-artifact/assets'
const files = readdirSync(dir)
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith('.css'))}`, 'utf8')
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script')

const html = `<title>Maria Dolores Showroom</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500&display=swap">
<style>${css}</style>
<div id="root"><p style="font-family:Georgia,serif;font-style:italic;color:#6f5f53;padding:48px 24px;text-align:center">Carregando a plataforma Maria Dolores…</p></div>
<script>
window.addEventListener('error', function (e) {
  var r = document.getElementById('root');
  if (r && !r.dataset.montado) r.innerHTML = '<div style="font-family:system-ui,sans-serif;color:#b0524a;padding:32px 24px;max-width:640px;margin:0 auto"><b>Não foi possível abrir a plataforma.</b><br><br>Detalhe técnico: ' + String(e.message).replace(/</g, '&lt;') + '</div>';
});
</script>
<script>${js}</script>
`
writeFileSync('dist-artifact/maria-dolores-showroom.html', html)
console.log('ok', (html.length / 1024).toFixed(0) + ' KB')
