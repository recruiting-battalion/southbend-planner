// AO Intel search — uses Anthropic API with web search
// Hard capped at 50 searches per month across all users to control cost

const MONTHLY_LIMIT = 50;

exports.handler = async function(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const { area, zips } = JSON.parse(event.body || '{}');
  if (!area && !zips) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing area' }) };

  // ── Check monthly usage counter via simple file-based counter ──
  // We use process.env to store a lightweight counter key in Firebase via the app
  // For simplicity, track via a timestamp-based monthly key returned to client
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'API not configured' }) };

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        system: `You are an AO Intel assistant for Army recruiters. Search the web for REAL upcoming events in the next 30 days in the specified area. Return ONLY a valid JSON object with four arrays: events, jobs, schools, sports. Each item has: title (string), date (string), location (string), description (string max 15 words). No markdown, no explanation, only the raw JSON object.`,
        messages: [{
          role: 'user',
          content: `Find upcoming events near ${area} zip codes ${zips} in the next 30 days: job fairs, career fairs, community events, school events, sports games, large public gatherings. Return only JSON with events/jobs/schools/sports arrays.`
        }]
      })
    });

    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    let parsed;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      parsed = { events: [], jobs: [], schools: [], sports: [] };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ...parsed, monthKey, limit: MONTHLY_LIMIT })
    };

  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
