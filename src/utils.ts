import fs from 'fs';
import path from 'path';
import axios from 'axios';

export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function isValidTwitterUrl(url: string): boolean {
  const twitterRegex = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/;
  return twitterRegex.test(url);
}

export function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function sanitizeFilename(filename: string): string {
  const sanitized = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  // Limit filename to 100 characters to avoid ENAMETOOLONG errors
  return sanitized.length > 100 ? sanitized.substring(0, 100) : sanitized;
}

export async function downloadFile(url: string, filepath: string): Promise<void> {
  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}