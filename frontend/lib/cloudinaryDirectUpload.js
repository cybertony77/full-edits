// Client-side helper: upload a File directly to Cloudinary with a signed
// signature obtained from `/api/upload/sign`.
//
// Replaces the slow base64-via-JSON pattern:
//
//   reader.readAsDataURL(file) -> apiClient.post('/api/upload/...', { file: base64 })
//
// The new flow sends the file ONCE as multipart/form-data straight to Cloudinary,
// halving bandwidth and avoiding Next.js body parsing of huge JSON bodies.

import apiClient from './axios';

/**
 * @typedef {Object} DirectUploadOptions
 * @property {('profile-pictures'|'homeworks-questions-images'|'quizzes-questions-images'|'mock-exams-questions-images'|'HW-PDFs'|'Quizs-PDFs'|'MockExams-PDFs'|'material')} folder
 * @property {(percent:number) => void} [onProgress]    0-100
 * @property {AbortSignal} [signal]                     cancel mid-upload
 */

/**
 * @typedef {Object} DirectUploadResult
 * @property {string} public_id
 * @property {string} secure_url
 * @property {'image'|'raw'|'video'} resource_type
 * @property {'private'|'upload'} type
 * @property {number} bytes
 * @property {string} [format]
 */

/**
 * Upload a single File to Cloudinary, server-signed.
 *
 * @param {File|Blob} file
 * @param {DirectUploadOptions} options
 * @returns {Promise<DirectUploadResult>}
 */
export async function uploadToCloudinaryDirect(file, options) {
  if (!file) throw new Error('No file provided');
  if (!options?.folder) throw new Error('folder is required');

  // 1) Ask server to sign the upload for the requested folder.
  const { data: sig } = await apiClient.post('/api/upload/sign', { folder: options.folder });

  if (!sig?.upload_url || !sig?.signature) {
    throw new Error('Invalid sign response from server');
  }

  // 2) Build multipart body. The set of fields here MUST exactly match the
  //    fields the server included in its signature payload (see sign.js).
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('type', sig.type);

  // 3) POST directly to Cloudinary using XHR for real upload-progress events.
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.upload_url, true);

    if (options.onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          try { options.onProgress(percent); } catch { /* swallow */ }
        }
      };
    }

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return reject(new DOMException('Upload aborted', 'AbortError'));
      }
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve({
            public_id: json.public_id,
            secure_url: json.secure_url,
            resource_type: json.resource_type,
            type: json.type,
            bytes: json.bytes,
            format: json.format,
          });
        } catch (e) {
          reject(new Error('Cloudinary returned invalid JSON'));
        }
      } else {
        let message = `Cloudinary upload failed (HTTP ${xhr.status})`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json?.error?.message) message = json.error.message;
        } catch { /* ignore */ }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading to Cloudinary'));
    xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
    xhr.ontimeout = () => reject(new Error('Upload to Cloudinary timed out'));
    xhr.timeout = 5 * 60 * 1000; // 5 minutes

    xhr.send(form);
  });
}
