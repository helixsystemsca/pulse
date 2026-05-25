# Onboarding Tour Integration Guide for Cursor

## Overview
This guide explains how to integrate the onboarding tour into your Panorama REC application with dynamic element targeting.

## Integration Steps

### 1. File Structure
Create these files in your project:
```
src/
  components/
    OnboardingTour/
      OnboardingTour.jsx (or .tsx)
      onboarding-tour.css
```

### 2. Dynamic Element Targeting

Instead of fixed pixel positions, the tour should target actual DOM elements using:
- **data-tour attributes** (recommended)
- CSS selectors
- React refs

### 3. Add data-tour attributes to your components

Add these attributes to the elements you want to highlight:

```jsx
// Leadership Dashboard section
<div data-tour="leadership-dashboard">
  {/* Important dates, overview content */}
</div>

// Workforce section
<div data-tour="workforce-today">
  {/* Today's scheduled staff */}
</div>

// Time-off section
<div data-tour="time-off-monitoring">
  {/* Time off this month */}
</div>

// CO2 Monitoring
<div data-tour="co2-monitoring">
  {/* CO2 monitoring widget */}
</div>

// Low Inventory
<div data-tour="low-inventory">
  {/* Consumables, low stock list */}
</div>

// Routine Assignments
<div data-tour="routine-assignments">
  {/* Shift routines & handoffs */}
</div>

// Work Requests
<div data-tour="work-requests">
  {/* Work requests dashboard */}
</div>

// Sidebar Navigation
<nav data-tour="sidebar-navigation">
  {/* Your main navigation sidebar */}
</nav>
```

### 4. Tour Step Configuration

The tour steps should look like this (update the selectors to match your actual structure):

```javascript
const tourSteps = [
  {
    target: '[data-tour="leadership-dashboard"]',
    title: "Leadership Dashboard",
    description: "Your central command center. Here you'll find today's overview, important dates, and quick access to key metrics. Everything you need starts here.",
    placement: "right" // where to show the tooltip: top, right, bottom, left
  },
  {
    target: '[data-tour="workforce-today"]',
    title: "Today's Workforce",
    description: "See who's scheduled today at a glance. Green indicators show staff currently on shift, with role badges for quick identification. Click any name to see more details.",
    placement: "bottom"
  },
  {
    target: '[data-tour="time-off-monitoring"]',
    title: "Time-Off Monitoring",
    description: "Track upcoming time-off requests in one place. Color-coded by staff member with clear date ranges, so you can plan coverage ahead of time.",
    placement: "bottom"
  },
  {
    target: '[data-tour="co2-monitoring"]',
    title: "CO₂ Monitoring",
    description: "Real-time chemical monitoring for all your pools and systems. Visual indicators show you what's operating within range and what needs attention.",
    placement: "left"
  },
  {
    target: '[data-tour="low-inventory"]',
    title: "Low Inventory Alerts",
    description: "Never run out of essential supplies. This section flags items that need reordering, with direct links to review and restock.",
    placement: "right"
  },
  {
    target: '[data-tour="routine-assignments"]',
    title: "Routine Assignments",
    description: "Manage shift handoffs and routine tasks. This is your demo area to explore workforce scheduling and daily assignment flows.",
    placement: "top"
  },
  {
    target: '[data-tour="work-requests"]',
    title: "Work Requests Dashboard",
    description: "Track all maintenance and work requests in one place. Color-coded status indicators show pending, in-progress, overdue, and completed items at a glance.",
    placement: "left"
  },
  {
    target: '[data-tour="sidebar-navigation"]',
    title: "Quick Navigation",
    description: "Access all major sections from the sidebar. Operations, scheduling, inventory, maintenance, analytics, and team management—everything is just one click away.",
    placement: "right"
  }
];
```

## Cursor Implementation Prompts

### Option A: Use a Tour Library (Recommended - Faster)
```
Install and configure react-joyride or driver.js for the onboarding tour.

1. Install: npm install react-joyride
2. Create an OnboardingTour component that wraps the tour
3. Add data-tour attributes to these sections:
   - Leadership dashboard (left sidebar with dates)
   - Workforce section (today's scheduled staff)
   - Time-off monitoring section
   - CO2 monitoring widget (right side)
   - Low inventory alerts (left sidebar, bottom)
   - Routine assignments (center panel, bottom)
   - Work requests (right side, bottom)
   - Main navigation sidebar

4. Add a "Restart Tour" button in the app header or settings
5. Store tour completion state in localStorage
6. Use the tour steps from tourSteps configuration above

Style it to match our design system with blue primary color (#3b82f6)
```

### Option B: Custom Implementation (More Control)
```
Create a custom onboarding tour component with these features:

1. Use getBoundingClientRect() to position spotlight and tooltip dynamically
2. Implement smooth scrollIntoView for each step
3. Add keyboard navigation (arrow keys, ESC to exit)
4. Store completion in localStorage: 'panorama-tour-completed'
5. Show "Restart Tour" button in user menu
6. Use portal/modal for overlay layer (z-index management)

Tour should:
- Highlight elements with animated border spotlight
- Show floating tooltip with title, description, and navigation
- Progress through 8 steps covering all main features
- Auto-position tooltip based on available space
- Handle window resize gracefully
- Skip if elements aren't found (conditional rendering)

Match the visual design from onboarding-tour.html
```

## Quick Start Command for Cursor

Copy and paste this into Cursor Chat:

```
Integrate the onboarding tour into the Panorama REC app:

1. Install react-joyride: npm install react-joyride

2. Create src/components/OnboardingTour/OnboardingTour.jsx with:
   - Tour steps targeting these 8 features (in order):
     a. Leadership dashboard (important dates section)
     b. Today's workforce (scheduled staff display)
     c. Time-off monitoring (this month section)
     d. CO2 monitoring (right side widget)
     e. Low inventory alerts (consumables section)
     f. Routine assignments (shift routines demo)
     g. Work requests (status dashboard)
     h. Sidebar navigation (left side menu)

3. Add data-tour="feature-name" to each section

4. Create welcome modal and completion screens

5. Add "Restart Tour" button to app header (always visible)

6. Use localStorage to track: panorama-tour-completed

7. Style with:
   - Primary blue: #3b82f6
   - Card style: white bg, rounded corners, shadow
   - Spotlight: blue border with dark overlay
   - Smooth transitions (0.5s ease)

8. Enable keyboard navigation (arrows, Enter, ESC)

Show the tour on first visit, allow restart anytime.
```

## Testing Checklist

After Cursor implements it:

- [ ] Tour starts automatically on first visit
- [ ] All 8 steps highlight correct elements
- [ ] Tooltips position correctly (don't go off-screen)
- [ ] "Restart Tour" button works
- [ ] Keyboard navigation works
- [ ] Tour state persists in localStorage
- [ ] Mobile responsive (if needed)
- [ ] Works across different screen sizes
- [ ] Smooth scroll to elements if needed
- [ ] Can exit tour anytime (ESC or close button)

## Storage Keys

```javascript
// Store these in localStorage
TOUR_COMPLETED_KEY = 'panorama-rec-tour-completed'
TOUR_DISMISSED_KEY = 'panorama-rec-tour-dismissed'
```

## Customization Options

If managers need different tours by role:
```javascript
const getTourSteps = (userRole) => {
  if (userRole === 'manager') return managerTourSteps;
  if (userRole === 'staff') return staffTourSteps;
  return defaultTourSteps;
};
```
