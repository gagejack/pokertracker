# Poker Session Tracker

A web application for tracking poker sessions, player statistics, and managing buy-ins and cash-outs.

## Features

- Track multiple players in a session
- Record buy-ins and cash-outs
- Calculate player statistics
- View all-time player stats
- Session persistence across page refreshes
- Admin authentication for resetting stats

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: MongoDB
- Authentication: JWT

## Setup

1. Clone the repository
```bash
git clone [your-repo-url]
cd poker-tracker
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=3000
```

4. Start the development server
```bash
npm run dev
```

## Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT authentication
- `PORT`: Port number for the server (default: 3000)

## Default Admin Credentials

- Username: admin
- Password: admin123

## License

MIT 