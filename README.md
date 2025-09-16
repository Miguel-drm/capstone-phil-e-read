# Phil IRI Dashboard

A comprehensive reading assessment dashboard for teachers, parents, and administrators.

## Project Structure

The project is organized to support multiple dashboard types (Teacher, Parent, Admin) with a modular component architecture:

```
src/
├── components/
│   ├── layout/                 # Reusable layout components
│   ├── dashboard/              # Dashboard-specific components
│   │   ├── teacher/           # Teacher dashboard components
│   │   ├── parent/            # Parent dashboard components
│   │   └── admin/             # Admin dashboard components
│   └── auth/                  # Authentication components
├── pages/                     # Page components
├── services/                  # API and service integrations
├── contexts/                  # React context providers
├── config/                    # Configuration files
├── assets/                    # Static assets
└── App.tsx                    # Main app component
```

## Features

### Current Implementation
- **Authentication System**: User authentication and authorization
- **Teacher Dashboard**: Student performance tracking and management
- **Parent Dashboard**: Student progress monitoring
- **Admin Dashboard**: School-wide analytics and management
- **Responsive Design**: Mobile-friendly layout using Tailwind CSS
- **Modular Architecture**: Reusable components across different dashboard types

### Planned Features
- **Real-time Updates**: Live data synchronization
- **Advanced Analytics**: Enhanced data visualization and reporting
- **Communication Tools**: Integrated messaging system
- **Assessment Tools**: Enhanced reading assessment capabilities

## Dashboard Types

### Teacher Dashboard
- Student performance tracking
- Reading session management
- Assessment creation and grading
- Class list management
- Data export capabilities

### Parent Dashboard
- Child's reading progress
- Assignment tracking
- Communication with teachers
- Progress reports

### Admin Dashboard
- School-wide analytics
- Teacher management
- Student enrollment
- System settings

## Technology Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **Context API** for state management

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

## Component Architecture

The dashboard uses a modular approach where:

- **Layout Components** (`src/components/layout/`) provide the structure
- **Dashboard Components** (`src/components/dashboard/`) contain specific functionality for each user type
- **Auth Components** (`src/components/auth/`) handle authentication and authorization
- **Services** (`src/services/`) manage API integrations and data handling
- **Contexts** (`src/contexts/`) provide global state management
- **Pages** (`src/pages/`) compose components into complete views

This structure enables:
- Clear separation of concerns
- Easy addition of new features
- Reusable components across different views
- Scalable architecture for future growth


PHIL E-READ: A WEB-BASED APPLICATION TOOL FOR ASSESSING READING SPEED, ACCURACY, AND COMPREHENSION SKILLS OF STUDENTS
