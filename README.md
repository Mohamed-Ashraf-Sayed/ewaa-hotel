# Hotel CRM — Sales & Contract Management System

A complete CRM built for hotel sales teams to manage corporate clients, track visits, and handle contract approval workflows.

## Tech Stack
- **Backend**: Node.js + Express + Prisma ORM + SQLite
- **Frontend**: React + TypeScript + Tailwind CSS + Vite

## First Time Setup
```
Double-click setup.bat
```
Then run:
```
Double-click start.bat
```
Open: http://localhost:5173

## Login Credentials (Demo)
| Role | Email | Password |
|------|-------|----------|
| General Manager | gm@hotelcrm.com | gm123 |
| Vice GM | vgm@hotelcrm.com | vgm123 |
| Contract Officer | contracts@hotelcrm.com | contracts123 |
| Sales Director 1 | dir1@hotelcrm.com | dir123 |
| Sales Director 2 | dir2@hotelcrm.com | dir123 |
| Sales Rep (Omar) | omar@hotelcrm.com | sales123 |
| Sales Rep (Sara) | sara@hotelcrm.com | sales123 |

## Org Hierarchy
```
Ahmed Kamal (General Manager)
└── Mohamed Farid (Vice GM)
    ├── Rania Hassan (Contract Officer)
    ├── Khaled Mansour (Sales Director 1 - Cairo)
    │   ├── Omar Saeed (Sales Rep)
    │   ├── Sara Ahmed (Sales Rep)
    │   └── Mona Tarek (Sales Rep)
    └── Nour ElDin Samir (Sales Director 2 - Alexandria)
        ├── Hassan Ali (Sales Rep)
        ├── Dina Mostafa (Sales Rep)
        └── Amir Gamal (Sales Rep)
```

## Hotels
- Grand Palace Hotel — Cairo (5★ Business)
- Blue Nile Hotel — Luxor (4★ Resort)
- Alexandria Star Hotel — Alexandria (4★ Beach)

## Features
- **Role-Based Access**: Each role sees only what's relevant
- **CRM**: Track companies, contacts, leads, notes, calls, emails
- **Visit Logging**: Track all client visits with outcomes & follow-ups
- **Contract Upload**: PDF/Word upload + approval workflow
- **Contract Officer**: Reviews and approves/rejects contracts
- **Deal Pulse Intelligence**: AI engagement scoring (see below)

## ✨ Innovative Feature: Deal Pulse Intelligence
A proprietary engagement scoring system that calculates a 0-100 score for each client based on:
- **Recency (40%)**: Days since last visit
- **Visit Frequency (30%)**: Number of visits in last 30 days
- **Contract Health (30%)**: Active/past contracts status

The system then:
- Flags "At Risk" clients before they go cold
- Identifies "Hot Leads" ready for contract
- Suggests specific next actions for each client
- Alerts when contracts are expiring (30/60/90 days)
- Tracks engagement trends (↑ up / → stable / ↓ down)

## Reset Database
```
cd backend
npm run db:reset
```
