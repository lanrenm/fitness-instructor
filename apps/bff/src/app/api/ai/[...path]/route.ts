import { NextRequest } from 'next/server'

const API_BASE = process.env.API_BASE_URL ?? 'http://api:3001'

const SKIP_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
])

function forwardHeaders(req: NextRequest): Headers {
  const out = new Headers()
  req.headers.forEach((value, key) => {
    if (!SKIP_HEADERS.has(key.toLowerCase())) {
      out.set(key, value)
    }
  })
  return out
}

/**
 * @description 把 /api/ai/* 透传到 NestJS。
 * SSE(`text/event-stream`)走流式 pipe,其它路径 JSON 透传。
 */
async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const url = `${API_BASE}/ai/${(path ?? []).join('/')}${req.nextUrl.search}`

  const headers = forwardHeaders(req)
  headers.set('accept', req.headers.get('accept') ?? 'text/event-stream')

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    cache: 'no-store',
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    init.body = req.body as ReadableStream
    init.duplex = 'half'
  }

  const upstream = await fetch(url, init)

  // SSE: pipe body, preserve stream framing.
  if (upstream.headers.get('content-type')?.includes('text/event-stream')) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // Non-streaming: buffer and forward, stripping hop-by-hop / encoding headers.
  const buf = await upstream.arrayBuffer()
  const outHeaders = new Headers(upstream.headers)
  outHeaders.delete('content-encoding')
  outHeaders.delete('transfer-encoding')
  return new Response(buf, { status: upstream.status, headers: outHeaders })
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const DELETE = proxy
