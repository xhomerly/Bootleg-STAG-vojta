export default {
    async fetch(request) {
        // Hlavičky, které povolí tvému lokálnímu HTML souboru číst data
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        };

        // Prohlížeč se nejdřív zeptá přes OPTIONS, jestli má povoleno stahovat
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // Získáme cílovou URL STAGu, kterou nám pošle naše frontend aplikace
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get("url");

        if (!targetUrl) {
            return new Response("Chybí parametr 'url'", { status: 400, headers: corsHeaders });
        }

        try {
            // Připravíme hlavičky pro STAG
            const fetchHeaders = {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            };

            // Pokud nám webová aplikace poslala přihlašovací údaje, předáme je STAGu
            const authHeader = request.headers.get("Authorization");
            if (authHeader) {
                fetchHeaders["Authorization"] = authHeader;
            }

            // Pošleme dotaz na STAG
            const stagResponse = await fetch(targetUrl, {
                headers: fetchHeaders
            });

            // Přepošleme odpověď ze STAGu zpět do naší aplikace a přidáme CORS povolení
            const newResponse = new Response(stagResponse.body, stagResponse);
            newResponse.headers.set("Access-Control-Allow-Origin", "*");
            
            return newResponse;

        } catch (err) {
            return new Response("Chyba při stahování: " + err.message, { status: 500, headers: corsHeaders });
        }
    }
}