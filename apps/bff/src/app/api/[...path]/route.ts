const API_BASE = process.env.API_BASE_URL || 'http://api:3001';
const SKIP_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
]);

function forwardHeaders(request: Request): Headers {
  const out = new Headers();
  request.headers.forEach(function (value, key) {
    if (!SKIP_HEADERS.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');

  try {
    const response = await fetch(API_BASE + path, {
      headers: forwardHeaders(request),
    });
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    return Response.json(
      { error: 'Failed to connect to API', details: String(error) },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');

  try {
    const body = await request.text();
    const headers = forwardHeaders(request);
    headers.set('Content-Type', 'application/json');
    const response = await fetch(API_BASE + path, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    return Response.json(
      { error: 'Failed to connect to API', details: String(error) },
      { status: 502 },
    );
  }
}