# 🚀 Rychlý návod: Nastavení CORS Proxy pro STAG API

Pokud otevíráš aplikaci `index.html` lokálně z disku \`file://\` nebo přes místní server např. Live Server, tvůj webový prohlížeč z bezpečnostních důvodů CORS zablokuje přímou komunikaci se servery UHK STAGu.

Abychom toto omezení bezpečně obešli a nemuseli instalovat žádné doplňky do prohlížeče, využijeme bezplatný Cloudflare Worker. Ten poslouží jako "prostředník", který stáhne data ze STAGu a pošle nám je s povolením pro náš lokální soubor.

---

## 🛠️ Krok 1: Vytvoření Cloudflare Workeru

Vytvoř si bezplatný účet na 

### Cloudflare

https://dash.cloudflare.com/sign-up pokud ještě nemáš.

Po přihlášení klikni v levém menu na Workers & Pages.

Klikni na tlačítko Create application a poté na Create Worker.

Pojmenuj svůj worker např. \`stag-cors-proxy\` a klikni na Deploy tím se vytvoří s výchozím kódem "Hello World".

## 💻 Krok 2: Vložení kódu do Workeru

Jakmile je worker vytvořen, klikni na tlačítko Edit code Upravit kód.

Smaž vše, co v editoru je, a vlož tam obsah souboru `worker.js` který je součástí tohoto projektu.

Klikni vpravo nahoře na modré tlačítko Deploy a kód ulož.

Zkopíruj si vygenerovanou URL adresu tvého workeru bude vypadat nějak takto: \`https://stag-cors-proxy.tvuj-ucet.workers.dev\`.

## 🔗 Krok 3: Propojení s aplikací soubor proxy.txt

Aplikace STAG Plánovač automaticky hledá soubor s názvem `proxy.txt`, ze kterého si URL proxy serveru přečte.

Ve stejné složce, kde máš svůj `index.html`, vytvoř nový textový soubor a pojmenuj ho přesně `proxy.txt`.

Do tohoto souboru vlož URL adresu tvého workeru, za kterou musíš přidat parametr `/?url=`.

Výsledný obsah souboru `proxy.txt` musí vypadat přesně takto na jednom řádku:

```text
https://stag-cors-proxy.tvuj-ucet.workers.dev/?url=
```

*Nezapomeň změnit \`tvuj-ucet\` podle skutečné adresy, kterou ti Cloudflare přidělil.*

## 🔒 Krok 4 Volitelné: Automatické přihlášení bez zadávání hesla

Kód ve workeru podporuje tzv. "Secrets". Pokud nechceš neustále vypisovat své STAG přihlašovací údaje v HTML aplikaci, můžeš je bezpečně uložit přímo do Cloudflare:

V Cloudflare dashboardu tvého workeru jdi do Settings -> Variables.

V sekci Environment Variables Secret přidej dvě nové proměnné:
- `STAG_USER` Hodnota: tvé os. číslo/login do STAGu, např. \`novakja1\`
- `STAG_PASS` Hodnota: tvé heslo

U obou zaškrtni, že jde o Encrypt Secret, aby heslo nikdo neviděl.

Worker nyní sám pozná, že pokud HTML aplikace nepošle heslo, má použít to z těchto tajných proměnných. V aplikaci na webu pak můžeš políčka pro heslo nechat úplně prázdná!

---
Hotovo! 🎉
Otevři `index.html` ideálně přes Live Server ve VS Code, zaškrtni "Obejít CORS přes proxy.txt" a aplikace bude bez problémů stahovat data.