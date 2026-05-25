import React, { useState, useEffect } from 'react';
import './onboarding-tour.css';

const TOUR_COMPLETED_KEY = 'panorama-rec-tour-completed';

const tourSteps = [
  {
    target: '[data-tour="leadership-dashboard"]',
    title: "Leadership Dashboard",
    description: "Your central command center. Here you'll find today's overview, important dates, and quick access to key metrics. Everything you need starts here.",
    placement: "right"
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

export const OnboardingTour = () => {
  const [isActive, setIsActive] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightStyle, setSpotlightStyle] = useState({});
  const [cardStyle, setCardStyle] = useState({});

  useEffect(() => {
    // Check if tour has been completed
    const tourCompleted = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!tourCompleted) {
      setShowStart(true);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      updatePositions();
      window.addEventListener('resize', updatePositions);
      return () => window.removeEventListener('resize', updatePositions);
    }
  }, [isActive, currentStep]);

  const updatePositions = () => {
    const step = tourSteps[currentStep];
    const element = document.querySelector(step.target);
    
    if (!element) {
      console.warn(`Tour target not found: ${step.target}`);
      return;
    }

    const rect = element.getBoundingClientRect();
    
    // Scroll element into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Set spotlight position
    setSpotlightStyle({
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    // Calculate card position based on placement
    const cardPos = calculateCardPosition(rect, step.placement);
    setCardStyle(cardPos);
  };

  const calculateCardPosition = (rect, placement) => {
    const cardWidth = 420;
    const cardHeight = 300; // approximate
    const offset = 20;

    let style = {};

    switch (placement) {
      case 'right':
        style = {
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.right + window.scrollX + offset}px`,
        };
        // If goes off screen, adjust
        if (rect.right + offset + cardWidth > window.innerWidth) {
          style.left = `${rect.left + window.scrollX - cardWidth - offset}px`;
        }
        break;
      case 'left':
        style = {
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.left + window.scrollX - cardWidth - offset}px`,
        };
        if (rect.left - cardWidth - offset < 0) {
          style.left = `${rect.right + window.scrollX + offset}px`;
        }
        break;
      case 'bottom':
        style = {
          top: `${rect.bottom + window.scrollY + offset}px`,
          left: `${rect.left + window.scrollX}px`,
        };
        if (rect.bottom + offset + cardHeight > window.innerHeight + window.scrollY) {
          style.top = `${rect.top + window.scrollY - cardHeight - offset}px`;
        }
        break;
      case 'top':
        style = {
          top: `${rect.top + window.scrollY - cardHeight - offset}px`,
          left: `${rect.left + window.scrollX}px`,
        };
        if (rect.top - cardHeight - offset < window.scrollY) {
          style.top = `${rect.bottom + window.scrollY + offset}px`;
        }
        break;
      default:
        style = {
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.right + window.scrollX + offset}px`,
        };
    }

    return style;
  };

  const startTour = () => {
    setShowStart(false);
    setTimeout(() => {
      setIsActive(true);
      setCurrentStep(0);
    }, 300);
  };

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      endTour();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const endTour = () => {
    setIsActive(false);
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
    setTimeout(() => {
      setShowEnd(true);
    }, 300);
  };

  const finishTour = () => {
    setShowEnd(false);
  };

  const restartTour = () => {
    setIsActive(false);
    setShowEnd(false);
    setCurrentStep(0);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    setTimeout(() => {
      setShowStart(true);
    }, 300);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isActive) return;
      
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        previousStep();
      } else if (e.key === 'Escape') {
        endTour();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep]);

  return (
    <>
      {/* Restart Button (Always Visible) */}
      <button className="restart-btn" onClick={restartTour}>
        <span className="restart-icon">↻</span>
        Restart Tour
      </button>

      {/* Tour Overlay */}
      {isActive && <div className="tour-overlay active" />}

      {/* Spotlight */}
      {isActive && <div className="spotlight" style={spotlightStyle} />}

      {/* Start Screen */}
      {showStart && (
        <div className="tour-start-screen active">
          <div className="start-icon">🏊</div>
          <h1 className="start-title">Welcome to Panorama REC</h1>
          <p className="start-subtitle">
            Let's take a quick tour of your new management platform. 
            We'll walk through the key features that will help you streamline 
            operations and reduce friction.
          </p>
          <button className="btn-start" onClick={startTour}>
            Start Tour
          </button>
        </div>
      )}

      {/* Tour Card */}
      {isActive && (
        <div className="tour-card active" style={cardStyle}>
          <div className="tour-header">
            <div className="tour-step-counter">
              Step {currentStep + 1} of {tourSteps.length}
            </div>
            <h2 className="tour-title">{tourSteps[currentStep].title}</h2>
          </div>
          <p className="tour-description">
            {tourSteps[currentStep].description}
          </p>
          <div className="tour-actions">
            {currentStep > 0 && (
              <button className="btn btn-secondary" onClick={previousStep}>
                Back
              </button>
            )}
            <button className="btn btn-primary" onClick={nextStep}>
              {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
          <div className="progress-dots">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`progress-dot ${index === currentStep ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* End Screen */}
      {showEnd && (
        <div className="tour-end-screen active">
          <div className="end-icon">✓</div>
          <h1 className="start-title">You're All Set!</h1>
          <p className="start-subtitle">
            You now know the key features of Panorama REC. 
            Explore the platform and reach out if you have any questions.
          </p>
          <button className="btn-finish" onClick={finishTour}>
            Get Started
          </button>
        </div>
      )}
    </>
  );
};

export default OnboardingTour;
