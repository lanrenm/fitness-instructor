import { NextRequest } from 'next/server'

const API_BASE = process.env.API_BASE_URL ?? 'http://api:3001'

const SKIP_REQ_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
])

function forwardHeaders(req: NextRequest): Headers {
  const out = new Headers()
  req.headers.forEach((value, key) => {
    if (!SKIP_REQ_HEADERS.has(key.toLowerCase())) {
      out.set(key, value)
    }
  })
  return out
}

async function safeJsonFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Failed to connect to API', details: String(e) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/**
 * @description 把 /api/ai/* 透传到 NestJS。
 * SSE(`text/event-stream`)走流式 pipe,其它路径 JSON 透传。
 */
async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const url = `${API_BASE}/ai/${(path ?? []).join('/')}${req.nextUrl.search}`

  const headers = forwardHeaders(req)
  const accept = req.headers.get('accept')
  if (accept) headers.set('accept', accept)

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
    signal: req.signal,
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    init.body = req.body
    // @ts-expect-error duplex is required by undici for streaming uploads
    init.duplex = 'half'
  }

  const upstream = await safeJsonFetch(url, init)

  // SSE: pipe body, preserve stream framing.
  if (upstream.headers.get('content-type')?.includes('text/event-stream')) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // Non-streaming: buffer and forward, stripping hop-by-hop / length /
  // encoding headers so Next/Node can recompute correct framing.
  const buf = await upstream.arrayBuffer()
  const outHeaders = new Headers(upstream.headers)
  outHeaders.delete('content-encoding')
  outHeaders.delete('transfer-encoding')
  outHeaders.delete('content-length')
  return new Response(buf, { status: upstream.status, headers: outHeaders })
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const DELETE = proxy
