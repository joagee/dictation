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
      const params = new URLSearchParams({
        tex: encodeURIComponent(text),
        tok: token,
        cuid: 'dictation_h5',
        ctp: '1',
        lan: 'zh',
        spd: '5',
        pit: '5',
        vol: '5',
        per: '0',
        aue: '3'
      });

      const ttsResp = await fetch(`https://tsn.baidu.com/text2audio?${params}`);
      if (!ttsResp.ok) {
        throw new Error('Baidu TTS failed');
      }

      const contentType = ttsResp.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const err = await ttsResp.json();
        return new Response(JSON.stringify({ error: err.err_msg || 'TTS error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const arrayBuffer = await ttsResp.arrayBuffer();
      const base64Audio = arrayBufferToBase64(arrayBuffer);

      return new Response(JSON.stringify({ audioUrl: `data:audio/mpeg;base64,${base64Audio}` }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};

async function getAccessToken(env) {
  const tokenUrl = 'https://aip.baidubce.com/oauth/2.0/token';
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.BAIDU_API_KEY,
    client_secret: env.BAIDU_SECRET_KEY
  });
  const resp = await fetch(`${tokenUrl}?${params}`);
  const data = await resp.json();
  return data.access_token;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
