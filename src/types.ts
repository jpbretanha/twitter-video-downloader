export interface VideoInfo {
  url: string;
  title: string;
  filename: string;
  quality: string;
}

export interface DownloadOptions {
  outputDir: string;
  quality?: 'highest' | 'lowest' | 'highestaudio' | 'lowestaudio';
}

export interface TwitterVideoData {
  variants: Array<{
    bitrate?: number;
    content_type: string;
    url: string;
  }>;
}