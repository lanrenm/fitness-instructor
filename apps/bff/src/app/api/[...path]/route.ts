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

async function forward(request: Request, method: string) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');

  try {
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
    const headers = forwardHeaders(request);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(API_BASE + path + url.search, {
      method,
      headers,
      body,
    });
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to connect to API',
      details: String(error),
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(request: Request) {
  return forward(request, 'GET');
}

export async function POST(request: Request) {
  return forward(request, 'POST');
}

export async function PATCH(request: Request) {
  return forward(request, 'PATCH');
}

export async function DELETE(request: Request) {
  return forward(request, 'DELETE');
}
