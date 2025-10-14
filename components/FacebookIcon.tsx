import React from 'react';

const FacebookIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M22 12.073C22 6.514 17.523 2 12 2S2 6.514 2 12.073c0 4.991 3.657 9.128 8.438 9.927v-7.03H7.898v-2.897h2.54V9.845c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.242 0-1.63.771-1.63 1.562v1.875h2.773l-.443 2.897h-2.33v7.03C18.343 21.201 22 17.064 22 12.073z" />
  </svg>
);

export default FacebookIcon;
