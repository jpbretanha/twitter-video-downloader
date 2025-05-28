import axios from 'axios';
import path from 'path';
import { VideoInfo, DownloadOptions, TwitterVideoData } from './types';
import { extractTweetId, sanitizeFilename, downloadFile, ensureDirectoryExists } from './utils';

export class TwitterVideoDownloader {
  private readonly bearerToken: string;

  constructor() {
    this.bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  }

  async getVideoInfo(twitterUrl: string): Promise<VideoInfo | null> {
    try {
      const tweetId = extractTweetId(twitterUrl);
      if (!tweetId) {
        throw new Error('Invalid Twitter URL');
      }

      // Use web scraping approach instead of deprecated API
      const response = await axios.get(twitterUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const html = response.data;
      
      // Try multiple patterns to extract video URLs
      let videoUrls: string[] = [];
      
      // Pattern 1: Direct video.twimg.com URLs
      const pattern1 = /https:\/\/video\.twimg\.com\/[^"]+\.mp4[^"]*/g;
      const matches1 = html.match(pattern1);
      if (matches1) videoUrls.push(...matches1);
      
      // Pattern 2: Amplify video URLs
      const pattern2 = /https:\/\/video\.twimg\.com\/amplify_video\/[^"]+/g;
      const matches2 = html.match(pattern2);
      if (matches2) videoUrls.push(...matches2);
      
      // Pattern 3: Look for JSON data containing video info
      const jsonPattern = /"video_info":\s*{[^}]+}/g;
      const jsonMatches = html.match(jsonPattern);
      if (jsonMatches) {
        for (const jsonMatch of jsonMatches) {
          const urlPattern = /https:\/\/video\.twimg\.com\/[^"]+/g;
          const urls = jsonMatch.match(urlPattern);
          if (urls) videoUrls.push(...urls);
        }
      }
      
      // Pattern 4: Look in script tags for video data
      const scriptPattern = /<script[^>]*>.*?"playback_url":"([^"]*)".*?<\/script>/gs;
      const scriptMatches = html.match(scriptPattern);
      if (scriptMatches) {
        for (const script of scriptMatches) {
          const urlMatch = script.match(/"playback_url":"([^"]*)"/);
          if (urlMatch) {
            videoUrls.push(urlMatch[1].replace(/\\u002F/g, '/'));
          }
        }
      }
      
      // Remove duplicates and filter valid URLs
      videoUrls = [...new Set(videoUrls)].filter(url => url.includes('.mp4') || url.includes('video'));
      
      if (videoUrls.length === 0) {
        throw new Error('No video found in this tweet');
      }

      // Get the highest quality video URL (usually the last one or the longest URL)
      const videoUrl = videoUrls.sort((a, b) => b.length - a.length)[0];
      
      // Extract title from meta tags
      const titleMatch = html.match(/<meta property="og:description" content="([^"]*)"/) || 
                        html.match(/<title>([^<]*)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(/\s*\/\s*Twitter\s*$/, '').trim() : 'twitter_video';
      
      const filename = `${sanitizeFilename(title)}_${tweetId}.mp4`;

      return {
        url: videoUrl,
        title,
        filename,
        quality: 'auto'
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log(`⚠️ Primary method failed: ${error.response?.status || error.message}`);
        return null;
      }
      console.log(`⚠️ Primary method failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async getVideoInfoFallback(twitterUrl: string): Promise<VideoInfo | null> {
    try {
      const tweetId = extractTweetId(twitterUrl);
      if (!tweetId) {
        throw new Error('Invalid Twitter URL');
      }

      // Try mobile version of Twitter which sometimes has different HTML structure
      const mobileUrl = twitterUrl.replace('twitter.com', 'm.twitter.com').replace('x.com', 'm.twitter.com');
      
      const response = await axios.get(mobileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive'
        }
      });

      const html = response.data;
      
      // Look for video URLs in mobile version
      const videoPatterns = [
        /https:\/\/video\.twimg\.com\/[^"'\s]+\.mp4[^"'\s]*/g,
        /https:\/\/video\.twimg\.com\/amplify_video\/[^"'\s]+/g,
        /"playback_url":"([^"]+)"/g,
        /video_url['"]\s*:\s*['"]([^'"]+)['"]/g
      ];

      let videoUrls: string[] = [];
      
      for (const pattern of videoPatterns) {
        const matches = html.match(pattern);
        if (matches) {
          videoUrls.push(...matches.map((match: string) => {
            // Extract URL from quoted strings
            const urlMatch = match.match(/https:\/\/[^"'\s]+/);
            return urlMatch ? urlMatch[0] : match;
          }));
        }
      }
      
      videoUrls = [...new Set(videoUrls)].filter(url => 
        url.includes('video.twimg.com') && (url.includes('.mp4') || url.includes('amplify'))
      );
      
      if (videoUrls.length === 0) {
        return null;
      }

      const videoUrl = videoUrls[0];
      const title = `twitter_video_${tweetId}`;
      const filename = `${sanitizeFilename(title)}.mp4`;

      return {
        url: videoUrl,
        title,
        filename,
        quality: 'auto'
      };

    } catch (error) {
      console.error('Fallback method also failed:', error);
      return null;
    }
  }

  private selectBestVariant(variants: TwitterVideoData['variants']) {
    const videoVariants = variants.filter(v => v.content_type === 'video/mp4');
    
    if (videoVariants.length === 0) {
      return null;
    }

    return videoVariants.reduce((best, current) => {
      if (!best.bitrate && current.bitrate) return current;
      if (!current.bitrate && best.bitrate) return best;
      if (!best.bitrate && !current.bitrate) return current;
      
      return (current.bitrate || 0) > (best.bitrate || 0) ? current : best;
    });
  }

  async downloadVideo(twitterUrl: string, options: DownloadOptions = { outputDir: './output' }): Promise<string> {
    try {
      console.log('🔍 Extracting video information...');
      const tweetId = extractTweetId(twitterUrl);
      console.log(`🔗 Tweet ID: ${tweetId}`);
      
      let videoInfo = await this.getVideoInfo(twitterUrl);
      
      if (!videoInfo) {
        console.log('⚠️  Primary method failed, trying fallback...');
        videoInfo = await this.getVideoInfoFallback(twitterUrl);
      }
      
      if (!videoInfo) {
        console.log('⚠️  Fallback failed, trying yt-dlp approach...');
        videoInfo = await this.getVideoInfoYtDlp(twitterUrl);
      }
      
      if (!videoInfo) {
        throw new Error('Failed to extract video information from the tweet. This tweet may not contain a video or may be private.');
      }

      console.log(`📹 Found video: ${videoInfo.title}`);
      console.log(`🎯 Quality: ${videoInfo.quality}`);

      ensureDirectoryExists(options.outputDir);
      
      const outputPath = path.join(options.outputDir, videoInfo.filename);
      
      console.log('⬇️  Downloading video...');
      await downloadFile(videoInfo.url, outputPath);
      
      console.log(`✅ Video downloaded successfully: ${outputPath}`);
      return outputPath;

    } catch (error) {
      console.error('❌ Download failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getVideoInfoYtDlp(twitterUrl: string): Promise<VideoInfo | null> {
    try {
      const tweetId = extractTweetId(twitterUrl);
      if (!tweetId) {
        throw new Error('Invalid Twitter URL');
      }

      // Use a third-party service that extracts Twitter videos
      const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;
      
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });

      const data = response.data;
      
      if (!data.tweet || !data.tweet.media || !data.tweet.media.videos || data.tweet.media.videos.length === 0) {
        return null;
      }

      const video = data.tweet.media.videos[0];
      const videoUrl = video.url;
      
      if (!videoUrl) {
        return null;
      }

      const title = data.tweet.text || 'twitter_video';
      const filename = `${sanitizeFilename(title)}_${tweetId}.mp4`;

      return {
        url: videoUrl,
        title,
        filename,
        quality: video.height ? `${video.height}p` : 'auto'
      };

    } catch (error) {
      console.error('yt-dlp approach failed:', error);
      return null;
    }
  }
}