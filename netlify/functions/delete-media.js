const cloudinary = require('cloudinary').v2;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const { publicId, resourceType } = JSON.parse(event.body || '{}');

    console.log('DELETE REQUEST:', { publicId, resourceType });
    console.log('ENV CHECK:', {
      cloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: !!process.env.CLOUDINARY_API_KEY,
      apiSecret: !!process.env.CLOUDINARY_API_SECRET,
    });

    if (!publicId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'publicId is required' }),
      };
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Missing Cloudinary environment variables',
        }),
      };
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || 'image',
      invalidate: true,
    });

    console.log('CLOUDINARY RESULT:', result);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, result }),
    };
  } catch (error) {
    console.error('Cloudinary delete failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Delete failed',
      }),
    };
  }
};
