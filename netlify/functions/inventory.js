import fetch from 'node-fetch';

export async function handler(event, context) {
  const {
    AIRTABLE_TOKEN,
    AIRTABLE_BASE_ID,
    AIRTABLE_STOCK_TABLE,
    AIRTABLE_STOCK_VIEW
  } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_STOCK_TABLE) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Airtable env vars manquantes.' })
    };
  }

  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_STOCK_TABLE)}`);
  if (AIRTABLE_STOCK_VIEW) {
    url.searchParams.set('view', AIRTABLE_STOCK_VIEW);
  }

  try {
    const airtableResponse = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`
      }
    });

    if (!airtableResponse.ok) {
      const errorPayload = await airtableResponse.text();
      return {
        statusCode: airtableResponse.status,
        body: JSON.stringify({ error: errorPayload })
      };
    }

    const data = await airtableResponse.json();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
                              }
