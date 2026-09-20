export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    try {
      const body = await request.json();
      const text = body.text;
      if (!text || typeof text !== 'string' || text.length > 120) {
        return new Response(JSON.stringify({ error: 'Text must be 1-120 chars' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const token = await getAccessToken(env);
      if (!token) {
        return new Response(JSON.stringify({ error: 'Failed to get token' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const params = new URLSearchParams({
        tex: encodeURIComponent(text),
        tok: token,
        cuid: 'dictation_h5',
        ctp: '1', lan: 'zh', spd: '5', pit: '5', vol: '5', per: '0', aue: '3'
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const ttsResp = await fetch(`https://tsn.baidu.com/text2audio?${params}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ttsResp.ok) throw new Error('TTS failed');
      const ct = ttsResp.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const err = await ttsResp.json();
        return new Response(JSON.stringify({ error: err.err_msg || 'TTS error' }), {
          status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const buf = await ttsResp.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return new Response(JSON.stringify({ audioUrl: `data:audio/mpeg;base64,${base64}` }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' }
      });
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message || 'TTS timeout' }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};

let cachedToken = null;
let tokenExpiry = 0;
async function getAccessToken(env) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60000) return cachedToken;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${env.BAIDU_API_KEY}&client_secret=${env.BAIDU_SECRET_KEY}`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await resp.json();
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in || 2592000) * 1000;
    return cachedToken;
  } catch(e) { return null; }
}
