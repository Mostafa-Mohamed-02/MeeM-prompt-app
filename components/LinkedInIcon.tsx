import React from 'react';

const LinkedInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.226.792 24 1.771 24h20.451C23.204 24 24 23.226 24 22.271V1.729C24 .774 23.204 0 22.225 0zM7.12 20.452H3.667V9h3.453v11.452zM5.394 7.434c-1.105 0-2-.9-2-2.006 0-1.107.895-2.007 2-2.007s2 .9 2 2.007c0 1.106-.895 2.006-2 2.006zM20.452 20.452h-3.453v-5.688c0-1.356-.027-3.099-1.89-3.099-1.89 0-2.179 1.476-2.179 2.997v5.79H9.83V9h3.317v1.561h.047c.462-.876 1.588-1.799 3.268-1.799 3.495 0 4.144 2.301 4.144 5.289v6.401z" />
  </svg>
);

export default LinkedInIcon;
