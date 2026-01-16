import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const backgroundColor =
    type === 'success'
      ? '#22c55e'
      : type === 'error'
      ? '#ef4444'
      : '#4b6fff';

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        backgroundColor,
        color: 'white',
        padding: '12px 20px',
        borderRadius: 8,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 10000,
        fontSize: 14,
        fontWeight: 500,
        maxWidth: 400,
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      {message}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Toast;
