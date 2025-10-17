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

// La funzione API, ora riscritta con fetch.
export async function GET({ request }) {
  try {
    const requestUrl = new URL(request.url);
    const category = requestUrl.searchParams.get('category');
    const offset = requestUrl.searchParams.get('offset');

    // NUOVO: Costruiamo l'URL dell'API Airtable e i suoi parametri.
    // Iniziamo con l'URL di base per la nostra tabella.
    let apiUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
    
    // Usiamo URLSearchParams per aggiungere i parametri in modo pulito e sicuro.
    const params = new URLSearchParams({
        pageSize: PAGE_SIZE,
        view: VIEW_NAME
    });

    // Se il client ha richiesto una categoria specifica, aggiungiamo il filtro.
    if (category && category !== 'all') {
        params.append('filterByFormula', `{Categoria} = '${category}'`);
    }

    // Se il client ci ha fornito un offset (per le pagine successive alla prima), lo aggiungiamo.
    if (offset) {
        params.append('offset', offset);
    }
    
    // Uniamo l'URL di base con i parametri per ottenere l'URL finale.
    apiUrl = `${apiUrl}?${params.toString()}`;

    // NUOVO: Prepariamo gli header per l'autenticazione, come abbiamo fatto in index.astro.
    const headers = {
        'Authorization': `Bearer ${API_KEY}`,
    };

    // NUOVO: Eseguiamo la chiamata diretta con fetch.
    const response = await fetch(apiUrl, { headers: headers });

    if (!response.ok) {
        // Se la risposta non è positiva, lanciamo un errore dettagliato.
        throw new Error(`Errore API: ${response.status} - ${response.statusText}`);
    }

    // Convertiamo la risposta in un oggetto JavaScript.
    const data = await response.json();

    // Mappiamo i dati nel formato atteso dal nostro frontend.
    const items = data.records.map(record => ({
      id: record.id,
      title: record.fields['NomeImmagine'],
      image: record.fields.immagine?.[0]?.url,
      category: record.fields.Categoria,
    }));

    // Restituiamo l'oggetto completo, contenente sia gli items che il nuovo offset.
    return new Response(JSON.stringify({
      items: items,
      offset: data.offset,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error("!!! ERRORE NELL'ENDPOINT API (FETCH):", error.message);
    return new Response(JSON.stringify({ message: 'Errore interno del server' }), {
      status: 500,
    });
  }
}