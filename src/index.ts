#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { TwitterVideoDownloader } from './twitter-downloader';
import { isValidTwitterUrl } from './utils';

const program = new Command();

program
  .name('twitter-video-downloader')
  .description('Download videos from Twitter links')
  .version('1.0.0');

program
  .argument('<url>', 'Twitter/X URL containing video')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-q, --quality <quality>', 'Video quality preference', 'highest')
  .action(async (url: string, options) => {
    try {
      if (!isValidTwitterUrl(url)) {
        console.error('❌ Invalid Twitter/X URL. Please provide a valid tweet URL.');
        process.exit(1);
      }

      const downloader = new TwitterVideoDownloader();
      const outputPath = await downloader.downloadVideo(url, {
        outputDir: path.resolve(options.output),
        quality: options.quality
      });

      console.log(`🎉 Download completed: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error occurred');
      process.exit(1);
    }
  });

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Twitter Video Downloader');
    console.log('Usage: yarn download <twitter_url>');
    console.log('Example: yarn download https://twitter.com/user/status/1234567890');
    process.exit(1);
  }

  program.parse();
}