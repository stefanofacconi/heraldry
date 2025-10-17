// ==========================================================
// ## FILE: src/pages/api/items.js (VERSIONE FINALE con FETCH)
// ## RUOLO: API che usa una chiamata diretta e affidabile ad Airtable.
// ==========================================================

// NOTA: Non importiamo più 'Airtable', non ci serve più. 

// Le costanti per le credenziali rimangono le stesse.
const TABLE_NAME = import.meta.env.PUBLIC_AIRTABLE_TABLE_NAME;
const BASE_ID = import.meta.env.PUBLIC_AIRTABLE_BASE_ID;
const API_KEY = import.meta.env.PUBLIC_AIRTABLE_API_KEY;
const VIEW_NAME = 'links 2';
const PAGE_SIZE = 100;

export async function GET({ request }) {
  try {
    // DEBUG: log di tutte le header per ispezione
    const headersObj = Object.fromEntries(request.headers.entries());
    console.log('API DEBUG | all request headers:', headersObj);

    // Proviamo più fonti possibili per ricostruire l'URL con query string
    const host = request.headers.get('host') || 'localhost:4321';
    const candidates = [
      request.url,                                 // potrebbe essere "/api/items?..."
      request.headers.get('x-original-url'),       // proxy
      request.headers.get('x-forwarded-url'),      // proxy
      request.headers.get('x-original-uri'),       // proxy
      request.headers.get('x-rewrite-url'),        // alcune dev server
      request.headers.get('referer')               // browser (contiene query se presente)
    ].filter(Boolean);

    let requestUrl;
    for (const c of candidates) {
      try {
        // se è solo path (es. "/api/items?category=..."), aggiungiamo host
        const maybe = c.includes('://') ? c : `http://${host}${c.startsWith('/') ? '' : '/'}${c}`;
        const u = new URL(maybe);
        // usiamo il primo che contiene query params oppure il primo valido
        requestUrl = u;
        if (u.searchParams && u.searchParams.toString()) break;
      } catch (e) {
        // ignora candidate non valida
      }
    }

    // fallback definitivo
    if (!requestUrl) {
      requestUrl = new URL(request.url, `http://${host}`);
    }

    console.log('API DEBUG | resolved requestUrl:', String(requestUrl));
    const category = requestUrl.searchParams.get('category');
    const offset = requestUrl.searchParams.get('offset');
    const wantDebug = requestUrl.searchParams.get('debug') === '1';

    // DEBUG: mostra l'URL grezzo ricevuto e il valore letto di "category"
    console.log('API DEBUG | raw request.url:', request.url);
    console.log('API DEBUG | parsed category param:', category);

    let apiUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
    const params = new URLSearchParams();
    params.set('pageSize', String(PAGE_SIZE));
    params.set('view', VIEW_NAME);

    let formula;
    if (category && category !== 'all') {
      const safeCat = String(category).replace(/'/g, "\\'");
      formula = `LOWER({Categoria})='${safeCat.toLowerCase()}'`;
      params.set('filterByFormula', formula);
    }

    if (offset) {
      params.set('offset', offset);
    }

    apiUrl = `${apiUrl}?${params.toString()}`;

    // DEBUG: stampa ciò che stiamo inviando ad Airtable
    console.log('API DEBUG | apiUrl:', apiUrl);
    if (formula) console.log('API DEBUG | formula:', formula);

    const headers = { 'Authorization': `Bearer ${API_KEY}` };
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      throw new Error(`Errore API: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();

    // DEBUG: mostra le categorie presenti nei record restituiti
    console.log('API DEBUG | returned categories:', (data.records || []).map(r => r.fields?.Categoria));

    const items = (data.records || []).map(record => ({
      id: record.id,
      title: record.fields['NomeImmagine'],
      image: record.fields.immagine?.[0]?.url ?? null,
      category: record.fields.Categoria,
    }));

    // Se richiesta di debug, ritorna anche il payload raw per ispezione
    if (wantDebug) {
      return new Response(JSON.stringify({ debug: { apiUrl, formula, raw: data }, items, offset: data.offset || null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ items, offset: data.offset || null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("!!! ERRORE NELL'ENDPOINT API (FETCH):", error.message);
    return new Response(JSON.stringify({ message: 'Errore interno del server' }), { status: 500 });
  }
}