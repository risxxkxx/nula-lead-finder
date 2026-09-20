# NULA Lead Finder

A lightweight lead-research tool for finding local businesses that do not appear to have a website and preparing personalised outreach for potential web-development clients.

## Overview

NULA Lead Finder was built as an internal business-development tool for NULA Studio.

The application uses Google Places data through a Netlify serverless function, filters results to businesses where no website is returned, and helps organise the next steps of manual outreach.

It does **not** automatically message businesses.

## Features

- Search businesses by category and city
- Google Places integration
- Filter businesses without a returned website
- Google Maps links for manual verification
- Manual Instagram search workflow
- Lead status tracking
- Personalised outreach-message generation
- Multiple offer types and message tones
- Local persistence of lead status and prepared messages
- CSV export
- Basic API-usage counter
- API key protected through Netlify environment variables
- Security headers configured through Netlify

## Workflow

1. Choose a business category and location.
2. Search through Google Places.
3. Review businesses where no website was returned.
4. Verify the business manually through Google Maps and Instagram search.
5. Select the appropriate website offer.
6. Generate and edit an outreach message.
7. Mark the lead status.
8. Export the results when needed.

## Tech Stack

- **HTML**
- **CSS**
- **Vanilla JavaScript**
- **Google Places API**
- **Netlify Functions**
- **Netlify**
- **Browser localStorage**

## Architecture

The Google Places API key is not exposed in the frontend. Requests are routed through a Netlify serverless function, with the key stored as an environment variable.

Lead notes, statuses, settings, and prepared messages are stored locally in the browser for this version of the tool.

## Local / Deployment Setup

The frontend can be viewed locally, but the Places search requires the Netlify backend.

In Netlify, configure:

```text
GOOGLE_PLACES_API_KEY
```

Then deploy the repository with the included `netlify.toml`.

## Why I built it

The goal was to solve a real workflow problem: finding potential clients, reducing repetitive research, and preparing more relevant outreach without fully automating communication.

This project combines frontend development, API integration, serverless functions, business-process design, and practical automation.

## Author

**Riste Kozarev**  
Founder, NULA Studio  
https://agencynula.com/

Portfolio: https://riste-kozarev.netlify.app/
