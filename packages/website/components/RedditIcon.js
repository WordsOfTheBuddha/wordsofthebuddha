import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

const RedditIcon = () => {
  const { resolvedTheme } = useTheme();
  const fillColor = `var(--icon-fill-color)`;
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <svg
      fill={fillColor}
      height="32"
      width="32"
      version="1.1"
      id="Icons"
      viewBox="0 0 32 32"
      className={theme}
    >
      <path
        d="M32,15.5c0-2.5-2-4.5-4.5-4.5c-1.1,0-2.1,0.4-2.9,1.1C22.1,10.7,19.1,10,16,10s-6.1,0.7-8.6,2.1C6.6,11.4,5.6,11,4.5,11
       C2,11,0,13,0,15.5c0,1.5,0.8,3,2,3.8c0,0.3,0,0.5,0,0.7c0,5.5,6.3,10,14,10s14-4.5,14-10c0-0.2,0-0.5,0-0.7C31.2,18.5,32,17,32,15.5
       z M9,19c0-1.7,1.3-3,3-3s3,1.3,3,3s-1.3,3-3,3S9,20.7,9,19z M21.6,24.8C20.5,25.7,18,26,16,26s-4.5-0.3-5.6-1.2
       c-0.4-0.3-0.5-1-0.2-1.4c0.3-0.4,1-0.5,1.4-0.2C12,23.5,13.5,24,16,24s4-0.5,4.4-0.8c0.4-0.3,1.1-0.3,1.4,0.2S22.1,24.4,21.6,24.8z
        M20,22c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S21.7,22,20,22z"
      />
      <g>
        <path
          d="M16,12c-0.2,0-0.3,0-0.4-0.1c-0.5-0.2-0.7-0.8-0.4-1.3l3-6c0.2-0.5,0.8-0.7,1.3-0.4l4,2c0.5,0.2,0.7,0.8,0.4,1.3
           c-0.2,0.5-0.8,0.7-1.3,0.4l-3.1-1.6l-2.6,5.1C16.7,11.8,16.4,12,16,12z"
        />
      </g>
      <g>
        <path d="M25,11c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S26.7,11,25,11z" />
      </g>
    </svg>
  );
};

export default RedditIcon;
