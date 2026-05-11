import { getCloudinary } from '../../../lib/cloudinaryConfig';

const cloudinary = getCloudinary();

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_BASE64_SIZE = MAX_FILE_SIZE * 1.4;
const ALLOWED_FOLDERS = ['HW-PDFs', 'Quizs-PDFs', 'MockExams-PDFs', 'material'];
const CLOUDINARY_TIMEOUT_MS = 300000; // 5 minutes
const MAX_RETRY_COUNT = 2;

async function uploadPdfWithRetry(file, options) {
  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt += 1) {
    try {
      return await cloudinary.uploader.upload(file, options);
    } catch (error) {
      lastError = error;
      const status = Number(error?.http_code || 0);
      const transient = !status || status >= 500 || status === 420 || status === 429;
      if (!transient || attempt === MAX_RETRY_COUNT) {
        throw error;
      }
      const waitMs = 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!req.body || !req.body.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { file, fileType, folder } = req.body;

    if (!fileType || fileType !== 'application/pdf') {
      return res.status(400).json({ error: 'Invalid file type. Only PDF files are allowed.' });
    }

    if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: 'Invalid upload folder.' });
    }

    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    const fileSize = Buffer.byteLength(base64Data, 'base64');

    if (fileSize > MAX_BASE64_SIZE) {
      return res.status(400).json({ error: 'Max PDF file size is 20 MB.' });
    }

    const uploadResult = await uploadPdfWithRetry(file, {
      folder,
      resource_type: 'raw',
      type: 'upload',
      overwrite: false,
      timeout: CLOUDINARY_TIMEOUT_MS,
    });

    return res.status(200).json({
      success: true,
      url: uploadResult.secure_url,
    });
  } catch (error) {
    console.error('Cloudinary PDF upload error:', error?.message || error);

    if (error.http_code === 400) {
      return res.status(400).json({ error: error.message || 'Invalid PDF file.' });
    }

    if (error.http_code === 401 || error.http_code === 403) {
      return res.status(500).json({ error: 'Cloudinary authentication error. Please contact support.' });
    }

    return res.status(500).json({ error: error.message || 'Failed to upload PDF. Please try again.' });
  }
}

export const config = {
  api: {
    bodyParser: {
      // 20MB binary PDF may exceed 30MB once base64 + JSON overhead are added.
      sizeLimit: '40mb',
    },
    responseLimit: false,
  },
};
