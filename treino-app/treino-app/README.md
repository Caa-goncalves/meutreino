# Meu Treino — app pessoal de musculação

Aplicativo pessoal de treino: 100% offline, sem contas, sem anúncios, sem
assinaturas. Todos os dados ficam salvos apenas no seu dispositivo
(IndexedDB do navegador).

## Estrutura de arquivos

```
treino-app/
├── index.html          # tela única do app (SPA)
├── manifest.json        # configuração do PWA (instalar na tela inicial)
├── sw.js                 # service worker (funcionamento offline)
├── css/
│   └── styles.css        # todo o visual do app
├── js/
│   ├── app.js             # navegação, telas e lógica principal
│   ├── db.js               # camada de persistência (IndexedDB)
│   └── seed.js              # dados iniciais / exemplos
├── icons/                # ícones do app (gerados)
└── README.md
```

Não há build, bundler nem dependências para instalar. É HTML/CSS/JS puro.

## Como rodar localmente

Como o app usa módulos JavaScript (`type="module"`), ele precisa ser aberto
através de um servidor local (não funciona clicando duas vezes no
`index.html` por causa das regras de CORS do navegador para módulos).

A forma mais simples, com Python já instalado:

```bash
cd treino-app
python3 -m http.server 8080
```

Depois abra `http://localhost:8080` no navegador.

Alternativa com Node.js:

```bash
npx serve treino-app
```

## Como publicar gratuitamente (GitHub Pages)

1. Crie um repositório novo no GitHub (pode ser privado).
2. Envie o conteúdo da pasta `treino-app/` para a raiz do repositório.
3. Em **Settings → Pages**, escolha a branch `main` e a pasta `/root`.
4. Aguarde alguns minutos. O GitHub vai te dar uma URL como
   `https://seuusuario.github.io/nome-do-repo/`.
5. Pronto — o app está no ar, gratuitamente, sem domínio próprio.

Alternativas igualmente gratuitas, caso prefira: **Cloudflare Pages** ou
**Vercel** (nesses dois basta conectar o repositório e apontar a raiz como
pasta de publicação — não há passo de build).

> Importante: o app é totalmente estático. Qualquer uma dessas opções
> funciona sem servidor, sem banco de dados pago e sem custo.

## Como instalar no celular (like um app de verdade)

**iPhone (Safari):**
1. Abra o link do app no Safari.
2. Toque no ícone de compartilhar (quadrado com seta para cima).
3. Toque em "Adicionar à Tela de Início".

**Android (Chrome):**
1. Abra o link do app no Chrome.
2. Toque no menu (⋮) → "Adicionar à tela inicial" ou "Instalar app"
   (o Chrome pode sugerir isso automaticamente com um banner).

Depois de instalado, o app abre em tela cheia, sem barra de endereço, e
funciona offline (depois do primeiro carregamento).

## Como fazer backup dos seus dados

Vá em **Ajustes → Exportar backup (JSON)**. Isso baixa um arquivo com todos
os seus treinos, exercícios e histórico. Guarde esse arquivo (Google Drive,
e-mail para você mesmo, etc.).

Para restaurar (em um celular novo, por exemplo): **Ajustes → Importar
backup** e selecione o arquivo `.json`. Isso substitui os dados atuais pelos
dados do backup.

**Recomendação:** exporte um backup de vez em quando, principalmente antes
de trocar de celular ou limpar os dados do navegador — dados de site (como
o IndexedDB) podem ser apagados se você limpar o cache/dados de navegação
do navegador.

## Como alterar os exercícios depois

- **Editar um exercício:** abra o treino → toque no ícone de lápis (✏️) no
  cartão do exercício.
- **Adicionar exercício:** abra o treino → toque no botão + (canto
  inferior direito).
- **Remover exercício:** dentro da edição do exercício, botão "Remover
  exercício" no final da tela.
- **Mover exercício para outro treino:** dentro da edição do exercício,
  campo "Treino (dia)" — escolha o novo treino.
- **Reordenar / renomear treinos (A, B, C...):** Ajustes → "Treinos
  (nomes)".
- **Trocar o que cada dia da semana faz (treino ou descanso, e qual
  treino):** Ajustes → "Dias da semana".

Nada é fixo no código — tudo isso é editável pela interface.

## Limitações importantes

- **Os dados vivem no navegador do dispositivo.** Se você limpar os dados
  de navegação do Safari/Chrome, ou desinstalar o app da tela inicial de
  forma "profunda", os dados podem ser perdidos. Por isso a recomendação de
  backup regular.
- **Não sincroniza entre dispositivos automaticamente.** Se você usar o app
  no celular e no computador, cada um terá seu próprio banco de dados local.
  Para levar os dados de um para o outro, use exportar/importar backup.
- **Fontes do Google (Fraunces, Manrope, IBM Plex Mono):** o app carrega
  essas fontes da internet na primeira vez (`fonts.googleapis.com`). Sem
  internet, ele usa fontes do sistema como alternativa — a aparência muda
  um pouco, mas tudo continua funcionando.
- **Cronômetro em segundo plano:** se você trocar de aplicativo durante o
  descanso, alguns navegadores móveis podem pausar o timer. O som/vibração
  ao final funciona quando o app está em primeiro plano.
- Os quatro exercícios que já vêm cadastrados estão marcados como
  "(EXEMPLO)" propositalmente — remova-os em **Ajustes → Remover
  exercícios de exemplo** assim que cadastrar os seus.

## O que foi testado

Antes da entrega, o app foi executado em um navegador real (Chromium) e
verificado automaticamente:
- marcação/desmarcação de séries;
- registro de carga e repetições, com valor da vez anterior pré-preenchido;
- histórico sendo populado corretamente a partir dos treinos feitos;
- gráfico/lista de evolução de carga por exercício;
- cronômetro de descanso (presets, pausa, som/vibração ao terminar);
- criação, edição e remoção de exercícios;
- edição dos dias da semana e dos nomes dos treinos;
- exportação e importação de backup (dados preservados no ciclo completo);
- funcionamento offline após o primeiro carregamento (service worker);
- responsividade em layout de celular.
