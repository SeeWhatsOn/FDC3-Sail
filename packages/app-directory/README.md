# FDC3 App Directory API

This is an implementation of the FDC3 Application Directory API in Node.js with TypeScript and Express.

## Overview

The FDC3 App Directory is a service that provides application definitions including trusted identifiers and associated metadata. This information supports discovery, launch configuration, intents, and context data for financial applications.

## Features

- Implementation of the FDC3 App Directory API v2 endpoints
- JWT authentication support
- Error handling
- Logging
- TypeScript models based on the FDC3 schema
- Sample application data

## API Endpoints

- `GET /appd/v2/apps/{appId}` - Retrieve an application definition
- `GET /appd/v2/apps` - Retrieve all application definitions
- `GET /health` - Health check endpoint

## Technologies Used

- Node.js
- TypeScript
- Express
- JWT Authentication
- Winston (logging)
- Jest (testing)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your configuration (see `.env` for example)

### Running the Application

Development mode:

```
npm run dev
```

Production build:

```
npm run build
npm start
```

### Running Tests

```
npm test
```

## Authentication

The API supports JWT authentication. To use it:

1. Set `JWT_SECRET` in your `.env` file
2. Include a Bearer token in the Authorization header of your requests

## Extending

### Adding More Application Data

Edit the `src/data/apps.ts` file to add more application definitions.

### Implementing a Database

To use a database instead of in-memory data:

1. Create a repository layer in `src/repositories/`
2. Update the `appService.ts` to use the repository
3. Configure your database connection

## License

Apache License 2.0
