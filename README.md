# Telegram Member Management Tool

A powerful full-stack application for managing Telegram channel members with advanced extraction and addition capabilities.

## Features

- **Channel Member Extraction**: Extract members from Telegram channels you admin
- **Member Addition**: Add members to channels with intelligent rate limiting
- **Contact Helper**: Access your Telegram contacts for guaranteed success
- **Real-time Progress**: Live monitoring of member addition jobs
- **Multi-Account Support**: Connect multiple Telegram accounts
- **Rate Limit Protection**: Built-in safeguards against API abuse

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **UI**: Tailwind CSS + Radix UI
- **API**: Telegram Client API integration

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Telegram API credentials (api_id and api_hash)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/rapidhit/Telegram-Member-Magnet.git
cd Telegram-Member-Magnet
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
DATABASE_URL=your_postgresql_connection_string
PORT=5000
```

4. Push database schema:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm run start
```

## Usage

1. **Connect Telegram Account**: Enter your API credentials and phone number
2. **Select Channel**: Choose the target channel for member additions
3. **Upload Members**: Upload a text file with usernames or user IDs
4. **Configure Settings**: Set rate limits and batch sizes
5. **Start Addition**: Monitor progress in real-time

## Best Practices

- Use Channel Member Extractor for highest success rates (80-100%)
- Extract contacts from channels you admin
- Avoid random internet username lists (0-5% success rate)
- Use conservative rate limits to prevent account restrictions
- Process smaller batches (10-50 users) for better results

## Rate Limit Recovery

If your account gets rate limited:
- Wait for the specified time period
- Use longer delays between invitations (10+ seconds)
- Extract members from accessible sources only
- Consider using multiple accounts for distribution

## Support

For technical support and assistance, contact: https://t.me/tele_magnet_bot

## License

MIT License - see LICENSE file for details.