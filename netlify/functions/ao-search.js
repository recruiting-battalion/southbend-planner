exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { area, zips } = JSON.parse(event.body || '{}');
  if (!area && !zips) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing area or zips' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are an AO Intel assistant for Army recruiters. Search for REAL upcoming events in the next 30 days in the specified area. Return ONLY a valid JSON object with four arrays: events, jobs, schools, sports. Each item has: title (string), date (string), location (string), description (string, max 20 words). No markdown, no explanation, just the JSON object.`,
        messages: [{ 
          role: 'user', 
          content: `Find upcoming events near ${area} (zip codes: ${zips}) in the next 30 days for Army recruiters: job fairs, career fairs, community events, school events, sports games, large gatherings where people will be. Return only JSON.` 
        }]
      })
    });

    const data = await response.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    
    let parsed;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      parsed = { events: [], jobs: [], schools: [], sports: [] };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(parsed)
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
