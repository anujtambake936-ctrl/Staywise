# Staywise

A Node.js/Express web application for managing listings, reviews, and user accounts.

## Project Overview

Staywise is built with Express, MongoDB, EJS, Passport, Cloudinary, and Mapbox. It supports:
- user signup/login
- listing creation and editing
- review posting
- map display with Mapbox
- image uploads via Cloudinary

## Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd Staywise
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Variables

Create a `.env` file in the project root using `.env.example` as a template:

```bash
cp .env.example .env
```

Then fill in your actual values for:
- `DB_URL`
- `SESSION_SECRET`
- `MAP_TOKEN`
- `CLOUD_NAME`
- `CLOUD_API_KEY`
- `CLOUD_API_SECRET`

> `.env` is ignored by Git. Do not commit it.

## Running the App

Start the application with:

```bash
node app.js
```

If you are using the `classroom` sub-app, start it with:

```bash
node classroom/server.js
```

## Project Structure

- `app.js` — main Express app
- `classroom/server.js` — secondary example server
- `controllers/` — route controller logic
- `models/` — Mongoose models
- `routes/` — Express route definitions
- `views/` — EJS templates
- `public/` — static assets
- `cloudConfig.js` — Cloudinary setup
- `.env.example` — environment variable template

## Git / Deployment Notes

- Make sure `.env` remains untracked
- Commit `.env.example` so collaborators know required settings
- Recommended branch name: `main`

## License

This project is provided as-is. Add your own license information if needed.

