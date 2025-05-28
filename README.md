# Twitter Video Downloader

A TypeScript CLI tool to download videos from Twitter/X links.

## Installation

```bash
yarn install
yarn build
```

## Usage

Download a video from a Twitter/X link:

```bash
yarn download <twitter_url>
```

### Examples

```bash
# Download video to default output folder
yarn download https://twitter.com/user/status/1234567890

# Download video to custom output folder
yarn download https://twitter.com/user/status/1234567890 -o ./my-videos
```

### Options

- `-o, --output <dir>`: Specify output directory (default: `./output`)
- `-q, --quality <quality>`: Video quality preference (default: `highest`)

## Features

- ✅ Download videos from Twitter/X links
- ✅ Automatic video quality selection (highest bitrate)
- ✅ Custom output directory support
- ✅ Fallback methods for reliability
- ✅ Input URL validation
- ✅ Progress indicators and error handling

## Output

Videos are saved in MP4 format with sanitized filenames including the tweet ID.

## Requirements

- Node.js 16+
- Yarn package manager