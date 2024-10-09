// components/CustomEffect.jsx
import { useEffect } from 'react';

const CustomEffect = () => {
  useEffect(() => {
    fetch(window.location.href).then((response) => {
      const fragment = response.headers.get('X-Redirect-Fragment');
      if (fragment) {
        window.location.hash = fragment;
      }
    });
  }, []);

  return null;
};

export default CustomEffect;