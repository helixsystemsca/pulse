import React, { useState } from 'react';
import './coming-soon-card.css';

const ComingSoonCard = () => {
  const [email, setEmail] = useState('');
  const [notified, setNotified] = useState(false);

  const features = [
    {
      icon: '📱',
      title: 'Mobile App',
      description: 'iOS & Android apps for on-the-go management'
    },
    {
      icon: '🔐',
      title: 'Microsoft SSO',
      description: 'Seamless single sign-on with your Microsoft account'
    },
    {
      icon: '🔗',
      title: 'Xplor Integration',
      description: 'Direct sync with Xplor for unified operations'
    },
    {
      icon: '⚡',
      title: 'SAP Integration',
      description: 'Enterprise-grade ERP connectivity'
    }
  ];

  const handleNotify = () => {
    // Add your notification logic here (e.g., API call to save email)
    console.log('User wants notifications:', email);
    setNotified(true);
    
    setTimeout(() => {
      setNotified(false);
    }, 3000);
  };

  return (
    <div className="coming-soon-card">
      <div className="coming-soon-header">
        <div className="coming-soon-badge">Coming Soon</div>
        <h2 className="coming-soon-title">Future Features</h2>
        <p className="coming-soon-subtitle">
          We're constantly improving. Here's what's on the horizon.
        </p>
      </div>

      <ul className="features-list">
        {features.map((feature, index) => (
          <li key={index} className="feature-item" style={{ animationDelay: `${0.5 + index * 0.1}s` }}>
            <div className="feature-icon">{feature.icon}</div>
            <div className="feature-content">
              <div className="feature-title">{feature.title}</div>
              <div className="feature-description">{feature.description}</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="coming-soon-footer">
        <p className="notify-text">Want updates when features launch?</p>
        {!notified ? (
          <button className="notify-btn" onClick={handleNotify}>
            Notify Me
          </button>
        ) : (
          <div className="notify-success">
            ✓ You'll be notified!
          </div>
        )}
      </div>
    </div>
  );
};

export default ComingSoonCard;
