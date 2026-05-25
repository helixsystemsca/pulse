# Coming Soon Card - Cursor Integration Guide

## Overview
Add a "Future Features" card to your login page that showcases upcoming features (Mobile App, Microsoft SSO, Xplor Integration, SAP Integration) while seamlessly matching your existing Panorama REC theme and design system.

---

## Quick Start

Copy this prompt into Cursor:

```
Add a "Coming Soon" features card to the login page:

1. Create ComingSoonCard component in src/components/ComingSoonCard/
2. Use our existing theme colors (teal/turquoise primary, match login page gradients)
3. Place it next to the login form (side-by-side on desktop, stacked on mobile)
4. Features to showcase:
   - Mobile App (iOS & Android) - 📱
   - Microsoft SSO - 🔐
   - Xplor Integration - 🔗
   - SAP Integration - ⚡

Design requirements:
- Match existing card style (white bg, rounded corners, shadow)
- Use our teal gradient (#56c9d9, #4db8c4, #3ba6b3) 
- Gradient top border accent
- "Coming Soon" badge with sparkle icon
- Hover animations on feature items (slide right, highlight)
- "Notify Me" button with success state
- Responsive: side-by-side > 968px, stacked below
- Smooth fade-in animations

Reference the existing login form styling for consistency.
```

---

## Detailed Integration Steps

### 1. File Structure

Create these files:
```
src/
  components/
    ComingSoonCard/
      ComingSoonCard.jsx (or .tsx if using TypeScript)
      ComingSoonCard.module.css (or .scss if using Sass)
      index.js
```

### 2. Theme Integration

The component should pull from your existing theme system. Look for:

**Color Variables to Use:**
```javascript
// Find these in your theme/colors file
primary: '#56c9d9',        // Teal primary
primaryDark: '#4db8c4',    // Darker teal
primaryLight: '#a8e6cf',   // Light teal
secondary: '#1e3a5f',      // Navy (from logo)
textPrimary: '#1e293b',    // Dark text
textSecondary: '#64748b',  // Gray text
background: '#ffffff',     // White
border: '#e2e8f0',         // Light gray border
accent: '#FDB924',         // Yellow (from logo sun)
```

**If using CSS Variables:**
```css
/* The component should reference these */
var(--color-primary)
var(--color-primary-dark)
var(--color-text-primary)
var(--color-text-secondary)
var(--color-border)
var(--color-background)
```

**If using Tailwind:**
```javascript
// Map to your tailwind.config.js colors
bg-primary
text-primary
border-gray-200
etc.
```

### 3. Layout Integration

**Option A: Modify Login Page Layout**
```jsx
// In your LoginPage component
<div className="login-page-container">
  <div className="login-content">
    <LoginForm />
    <ComingSoonCard />
  </div>
</div>
```

**Layout CSS:**
```css
.login-page-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  /* Your existing background gradient */
}

.login-content {
  display: flex;
  gap: 32px;
  max-width: 1200px;
  width: 100%;
  align-items: flex-start;
}

/* Responsive */
@media (max-width: 968px) {
  .login-content {
    flex-direction: column;
    align-items: center;
  }
}
```

### 4. Component Props (Optional Customization)

Make the component flexible:

```jsx
<ComingSoonCard 
  features={customFeatures}  // Override default features
  onNotify={handleNotify}     // Custom notify handler
  position="right"            // 'left' | 'right' | 'bottom'
  theme="light"               // Match your theme mode
/>
```

### 5. Animation Preferences

If your app uses specific animation libraries:

**Framer Motion:**
```jsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
>
  {/* Card content */}
</motion.div>
```

**React Spring:**
```jsx
import { useSpring, animated } from 'react-spring';

const props = useSpring({
  from: { opacity: 0, transform: 'translateY(20px)' },
  to: { opacity: 1, transform: 'translateY(0px)' }
});
```

**CSS Animations (Default):**
Keep the existing CSS keyframe animations - they're lightweight and work everywhere.

### 6. Accessibility Considerations

Ensure the component meets your a11y standards:

```jsx
<div 
  className="coming-soon-card" 
  role="region" 
  aria-label="Upcoming features"
>
  {/* Add aria-labels to interactive elements */}
  <button 
    className="notify-btn"
    aria-label="Subscribe to feature updates"
  >
    Notify Me
  </button>
</div>
```

### 7. Feature Content Management

**Option A: Hardcoded (Simple)**
```jsx
const features = [
  { icon: '📱', title: 'Mobile App', description: '...' },
  // ...
];
```

**Option B: CMS/Config (Scalable)**
```jsx
// features.config.js
export const upcomingFeatures = [
  {
    id: 'mobile-app',
    icon: '📱',
    title: 'Mobile App',
    description: 'iOS & Android apps for on-the-go management',
    priority: 1,
    launchDate: '2026-Q3'
  },
  // ...
];
```

**Option C: API-driven (Dynamic)**
```jsx
const { data: features } = useQuery('/api/upcoming-features');
```

### 8. Notification Handling

Hook up the "Notify Me" button to your existing notification system:

```jsx
const handleNotify = async () => {
  try {
    // Option 1: Email subscription
    await subscribeToUpdates(user.email, 'feature-updates');
    
    // Option 2: In-app notification preferences
    await updateUserPreferences({ 
      notifyFeatures: true 
    });
    
    // Option 3: Marketing platform (Mailchimp, SendGrid, etc.)
    await addToMailingList({
      email: user.email,
      listId: 'feature-announcements'
    });
    
    setNotified(true);
  } catch (error) {
    showToast('Failed to subscribe. Please try again.');
  }
};
```

### 9. Responsive Breakpoints

Match your existing breakpoints:

```css
/* If you use these breakpoints: */
/* Mobile: < 640px */
/* Tablet: 640px - 968px */
/* Desktop: > 968px */

@media (max-width: 640px) {
  .coming-soon-card {
    padding: 24px;
    max-width: 100%;
  }
}

@media (min-width: 641px) and (max-width: 968px) {
  .coming-soon-card {
    max-width: 450px;
  }
}

@media (min-width: 969px) {
  .login-content {
    flex-direction: row;
  }
}
```

### 10. Dark Mode Support (If Applicable)

If your app has dark mode:

```css
.coming-soon-card {
  background: var(--card-background);
  color: var(--text-primary);
}

[data-theme="dark"] .coming-soon-card {
  background: #1e293b;
  border-color: #334155;
}

[data-theme="dark"] .feature-item {
  background: #0f172a;
  border-color: #1e293b;
}
```

---

## Testing Checklist

After integration:

- [ ] Card appears on login page
- [ ] Colors match existing theme/brand
- [ ] Responsive layout works (desktop/tablet/mobile)
- [ ] Hover animations work smoothly
- [ ] "Notify Me" button functions
- [ ] Success state shows after clicking notify
- [ ] Card doesn't break existing login form
- [ ] All features display with correct icons
- [ ] Text is readable and properly sized
- [ ] No console errors
- [ ] Passes accessibility audit (if applicable)

---

## Customization Options

### Change Features List
```jsx
const myFeatures = [
  {
    icon: '🎯',
    title: 'Advanced Analytics',
    description: 'Deep insights into operations'
  },
  {
    icon: '🤖',
    title: 'AI Assistant',
    description: 'Smart suggestions powered by AI'
  },
];

<ComingSoonCard features={myFeatures} />
```

### Change Card Position
```css
/* Left side instead of right */
.login-content {
  flex-direction: row-reverse;
}

/* Below login form */
.login-content {
  flex-direction: column;
  align-items: center;
}
```

### Adjust Animations Speed
```css
.feature-item {
  transition: all 0.2s ease; /* Faster: 0.2s, Slower: 0.5s */
}

@keyframes fadeInUp {
  /* Adjust timing */
}

.feature-item:nth-child(1) { animation-delay: 0.3s; } /* Faster entrance */
```

### Change Badge Text
```jsx
<div className="coming-soon-badge">
  {customBadgeText || 'Coming Soon'}
</div>
```

### Hide on Mobile (Optional)
```css
@media (max-width: 640px) {
  .coming-soon-card {
    display: none;
  }
}
```

---

## Common Issues & Solutions

### Issue: Colors don't match
**Solution:** Use CSS variables or import your theme colors directly
```jsx
import { colors } from '@/styles/theme';

style={{ background: colors.primary }}
```

### Issue: Card overflows on small screens
**Solution:** Add proper responsive padding and max-width
```css
.coming-soon-card {
  max-width: min(380px, calc(100vw - 40px));
}
```

### Issue: Animations feel too fast/slow
**Solution:** Adjust transition durations and animation delays in CSS

### Issue: "Notify Me" doesn't work
**Solution:** Connect to your notification system or email service

---

## Advanced: Multi-page Use

To use the card on other pages (e.g., dashboard, settings):

```jsx
// Make it reusable
<ComingSoonCard
  title="What's Next"
  subtitle="Features in development"
  features={dashboardFeatures}
  compact={true} // Smaller version
/>
```

---

## Alternative Placements

**Option 1: Full-width banner above login**
```css
.coming-soon-card {
  max-width: 800px;
  margin: 0 auto 40px;
}
```

**Option 2: Floating tooltip/popover**
```jsx
<Popover content={<ComingSoonCard compact />}>
  <button>🔮 Coming Soon</button>
</Popover>
```

**Option 3: Modal on first visit**
```jsx
{showWelcome && (
  <Modal>
    <ComingSoonCard onClose={() => setShowWelcome(false)} />
  </Modal>
)}
```

---

## Performance Notes

- Component is lightweight (~3KB gzipped with CSS)
- Uses CSS animations (hardware accelerated)
- No heavy dependencies required
- Lazy load if needed: `React.lazy(() => import('./ComingSoonCard'))`

---

## Final Implementation Prompt for Cursor

Use this complete prompt:

```
Integrate the Coming Soon features card into the Panorama REC login page:

SETUP:
1. Create src/components/ComingSoonCard/ComingSoonCard.jsx
2. Create src/components/ComingSoonCard/ComingSoonCard.module.css
3. Import into LoginPage component

STYLING:
- Match existing theme colors from our design system
- Primary teal: #56c9d9, #4db8c4, #3ba6b3
- Use existing card shadow and border radius styles
- Reference login form for typography and spacing
- Responsive: side-by-side on desktop (> 968px), stacked on mobile

FEATURES TO DISPLAY:
1. Mobile App (📱) - iOS & Android apps for on-the-go management
2. Microsoft SSO (🔐) - Seamless single sign-on with your Microsoft account
3. Xplor Integration (🔗) - Direct sync with Xplor for unified operations
4. SAP Integration (⚡) - Enterprise-grade ERP connectivity

INTERACTIONS:
- Hover effect on feature items (slide right 4px, show left border accent)
- "Notify Me" button with success state
- Smooth fade-in animations (stagger by 100ms)

LAYOUT:
<div className="login-page-wrapper">
  <LoginForm />
  <ComingSoonCard />
</div>

Use flexbox with 32px gap, center-aligned. Make it feel premium and polished 
like modern SaaS products (Linear, Notion, Vercel style).
```

---

## Questions to Ask Your Team

Before implementing, clarify:

1. **Where exactly should this appear?** (next to login, below, modal, etc.)
2. **Should it show for everyone or only certain users?** (logged out vs logged in)
3. **How should notifications work?** (email, in-app, third-party service)
4. **Are these the right 4 features?** (can be changed easily)
5. **Should this appear on other pages too?** (dashboard, settings)

---

## Support

If Cursor has trouble:
- Share your existing login page component code
- Share your theme/colors configuration
- Specify your CSS approach (modules, styled-components, Tailwind, etc.)
- Mention any animation library you use (framer-motion, react-spring, etc.)

The component is designed to adapt to your existing patterns!
