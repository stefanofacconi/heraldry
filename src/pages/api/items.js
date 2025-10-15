// src/pages/api/items.js
import Airtable from 'airtable';

// La configurazione di Airtable è la stessa, ma vive in questo file
const base = new Airtable({
  apiKey: import.meta.env.PUBLIC_AIRTABLE_API_KEY,
}).base(import.meta.env.PUBLIC_AIRTABLE_BASE_ID);

const TABLE_NAME = import.meta.env.PUBLIC_AIRTABLE_TABLE_NAME;
const VIEW_NAME = 'links 2'; // Usiamo una vista stabile
const PAGE_SIZE = 100; // Quanti record per pagina

// Questa è la funzione che viene eseguita quando qualcuno visita /api/items
export async function GET({ request }) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    
    // Funzione helper per recuperare una pagina specifica
    const getPage = (pageNumber) => {
      return new Promise((resolve, reject) => {
        let currentPage = 0;
        const recordsBuffer = [];
        
        base(TABLE_NAME).select({
          view: VIEW_NAME,
          pageSize: PAGE_SIZE, // Chiedi a Airtable di darci pagine da 100
        }).eachPage(
          function page(records, fetchNextPage) {
            currentPage++;
            if (currentPage === pageNumber) {
              records.forEach(record => recordsBuffer.push(record));
              // Abbiamo trovato la pagina che volevamo, fermiamo l'iterazione
              resolve(recordsBuffer);
              return;
            }
            // Non è la pagina che vogliamo, chiedi la successiva
            fetchNextPage();
          },
          function done(err) {
            if (err) {
              reject(err);
              return;
            }
            // Se arriviamo qui, significa che abbiamo finito le pagine
            // senza trovare quella richiesta (o era l'ultima)
            resolve(recordsBuffer); 
          }
        );
      });
    };

    const records = await getPage(page);

    // Mappa i dati nel formato che ci serve, proprio come prima
    const items = records.map(record => ({
      id: record.id,
      title: record.fields['NomeImmagine'],
      image: record.fields.immagine?.[0]?.url,
      category: record.fields.Categoria,
    }));

    // Restituisce i dati come JSON
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: 'Errore del server' }), {
      status: 500,
    });
  }
}