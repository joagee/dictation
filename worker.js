export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
      const body = await request.json();
      const text = body.text;
      if (!text || typeof text !== 'string' || text.length > 120) {
        return new Response(JSON.stringify({ error: 'Text must be 1-120 chars' }), { status: 400 });
      }

      const token = await this.getAccessToken(env);
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
        return new Response(JSON.stringify({ error: err.err_msg || 'TTS error' }), { status: 500 });
      }

      const blob = await ttsResp.blob();
      const audioUrl = URL.createObjectURL(blob);

      return new Response(JSON.stringify({ audioUrl }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  },

  async getAccessToken(env) {
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
};
