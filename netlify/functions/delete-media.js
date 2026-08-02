const crypto = require('crypto');

function createSignature(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

exports.handler = async (event) => {
  // GET = debug check from browser
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        message: 'delete-media function is live',
        env: {
          cloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
          apiKey: !!process.env.CLOUDINARY_API_KEY,
          apiSecret: !!process.env.CLOUDINARY_API_SECRET,
        }
      }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const { publicId, resourceType } = JSON.parse(event.body || '{}');

    if (!publicId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'publicId is required' }),
      };
    }

    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

    if (!cloudName || !apiKey || !apiSecret) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing Cloudinary environment variables',
        }),
      };
    }

    const rt =
      resourceType === 'video'
        ? 'video'
        : resourceType === 'raw'
          ? 'raw'
          : 'image';

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const paramsToSign = {
      invalidate: 'true',
      public_id: publicId,
      timestamp,
    };

    const signature = createSignature(paramsToSign, apiSecret);

    const body = new URLSearchParams({
      public_id: publicId,
      timestamp,
      invalidate: 'true',
      api_key: apiKey,
      signature,
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${rt}/destroy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: data?.error?.message || 'Cloudinary delete failed',
          details: data,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        result: data.result,
        details: data,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Delete failed',
      }),
    };
  }
};
